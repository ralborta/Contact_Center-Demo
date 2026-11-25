import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AppointmentStatus,
  ChangeOrigin,
  SlotStatus,
  WhatsappChatStatus,
  WhatsappMessageDirection,
  WhatsappSendMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { resolveWhatsappProvider } from './whatsapp-provider';
import {
  DEFAULT_CONFIRM_TEMPLATE,
  formatLaPazParts,
  isWithinSendWindow,
  laPazHm,
  laPazYmd,
  renderTemplate,
} from './whatsapp.templates';

const CHAT_INCLUDE = {
  patient: true,
  appointment: {
    include: {
      doctor: { include: { specialty: true } },
      specialty: true,
      slot: true,
    },
  },
  messages: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private appointments: AppointmentsService,
  ) {}

  async getConfig() {
    return this.prisma.whatsappConfirmConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        enabled: true,
        messageTemplate: DEFAULT_CONFIRM_TEMPLATE,
      },
    });
  }

  async updateConfig(data: {
    enabled?: boolean;
    mode?: WhatsappSendMode;
    hoursBefore?: number;
    dayBeforeTime?: string;
    intervalMinutes?: number;
    sendWindowStart?: string;
    sendWindowEnd?: string;
    messageTemplate?: string;
    provider?: string;
  }) {
    if (data.intervalMinutes != null && ![15, 30, 60].includes(data.intervalMinutes)) {
      throw new BadRequestException('El intervalo debe ser 15, 30 o 60 minutos');
    }
    if (data.hoursBefore != null && (data.hoursBefore < 1 || data.hoursBefore > 24)) {
      throw new BadRequestException('Las horas antes deben estar entre 1 y 24');
    }
    return this.prisma.whatsappConfirmConfig.upsert({
      where: { id: 'default' },
      update: {
        ...data,
        provider: data.provider || undefined,
      },
      create: {
        id: 'default',
        messageTemplate: DEFAULT_CONFIRM_TEMPLATE,
        ...data,
      },
    });
  }

  async metrics() {
    const [confirmed, cancelled, rescheduled, pending, total] = await Promise.all([
      this.prisma.whatsappConversation.count({
        where: { status: WhatsappChatStatus.CONFIRMED },
      }),
      this.prisma.whatsappConversation.count({
        where: { status: WhatsappChatStatus.CANCELLED },
      }),
      this.prisma.whatsappConversation.count({
        where: { status: WhatsappChatStatus.RESCHEDULED },
      }),
      this.prisma.whatsappConversation.count({
        where: { status: WhatsappChatStatus.PENDING },
      }),
      this.prisma.whatsappConversation.count(),
    ]);
    return { confirmed, cancelled, rescheduled, pending, total };
  }

  async listConversations(status?: WhatsappChatStatus) {
    return this.prisma.whatsappConversation.findMany({
      where: status ? { status } : undefined,
      include: {
        patient: true,
        appointment: {
          include: {
            doctor: true,
            specialty: true,
            slot: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async getConversation(id: string) {
    const row = await this.prisma.whatsappConversation.findUnique({
      where: { id },
      include: CHAT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Conversación no encontrada');
    return row;
  }

  private async appendMessage(params: {
    conversationId: string;
    direction: WhatsappMessageDirection;
    body: string;
    simulated?: boolean;
    status?: WhatsappChatStatus;
    responded?: boolean;
  }) {
    const preview = params.body.slice(0, 120);
    const now = new Date();
    await this.prisma.whatsappMessage.create({
      data: {
        conversationId: params.conversationId,
        direction: params.direction,
        body: params.body,
        simulated: params.simulated ?? true,
      },
    });
    return this.prisma.whatsappConversation.update({
      where: { id: params.conversationId },
      data: {
        lastMessageAt: now,
        lastMessagePreview: preview,
        ...(params.status ? { status: params.status } : {}),
        ...(params.responded ? { respondedAt: now } : {}),
      },
      include: CHAT_INCLUDE,
    });
  }

  buildConfirmMessage(template: string, appt: {
    patient: { firstName: string; lastName: string };
    doctor: { lastName: string; firstName?: string };
    specialty: { name: string };
    slot: { startsAt: Date };
  }) {
    const { fecha, hora } = formatLaPazParts(new Date(appt.slot.startsAt));
    return renderTemplate(template, {
      paciente: `${appt.patient.firstName} ${appt.patient.lastName}`.trim(),
      doctor: appt.doctor.lastName,
      especialidad: appt.specialty.name,
      fecha,
      hora,
    });
  }

  async sendConfirmationForAppointment(appointmentId: string) {
    const config = await this.getConfig();
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        specialty: true,
        slot: true,
        whatsappConversation: true,
      },
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    const sendable: AppointmentStatus[] = [
      AppointmentStatus.RESERVED,
      AppointmentStatus.RESCHEDULED,
      AppointmentStatus.CONFIRMED,
    ];
    if (!sendable.includes(appt.status)) {
      throw new BadRequestException('La cita no está activa para confirmar');
    }

    let conversation = appt.whatsappConversation;
    if (!conversation) {
      conversation = await this.prisma.whatsappConversation.create({
        data: {
          patientId: appt.patientId,
          appointmentId: appt.id,
          phone: appt.patient.phone,
          status: WhatsappChatStatus.PENDING,
          provider: config.provider || 'simulated',
        },
      });
    }

    const body = this.buildConfirmMessage(config.messageTemplate, appt);
    const provider = resolveWhatsappProvider(config.provider);
    await provider.send({
      to: appt.patient.phone,
      body,
      conversationId: conversation.id,
      appointmentId: appt.id,
    });

    await this.prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: { sentAt: new Date(), provider: provider.name },
    });

    return this.appendMessage({
      conversationId: conversation.id,
      direction: WhatsappMessageDirection.OUTBOUND,
      body,
      simulated: provider.name === 'simulated',
    });
  }

  /** Cron cada minuto; respeta intervalo y ventana de envío de la config. */
  @Cron('* * * * *')
  async scheduledTick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runSchedulerPass();
    } catch (e: any) {
      this.logger.warn(`WhatsApp scheduler: ${e?.message || e}`);
    } finally {
      this.running = false;
    }
  }

  async runSchedulerPass(force = false) {
    const config = await this.getConfig();
    if (!config.enabled && !force) {
      return { ok: true, skipped: 'disabled', sent: 0 };
    }
    const now = new Date();
    if (!force && !isWithinSendWindow(now, config.sendWindowStart, config.sendWindowEnd)) {
      return { ok: true, skipped: 'outside_window', sent: 0 };
    }
    const intervalMs = (config.intervalMinutes || 30) * 60_000;
    if (
      !force &&
      config.lastRunAt &&
      now.getTime() - config.lastRunAt.getTime() < intervalMs - 5_000
    ) {
      return { ok: true, skipped: 'interval', sent: 0 };
    }

    const candidates = await this.findAppointmentsNeedingConfirm(config);
    let sent = 0;
    for (const appt of candidates) {
      try {
        await this.sendConfirmationForAppointment(appt.id);
        sent += 1;
      } catch (e: any) {
        this.logger.warn(`No se pudo enviar a cita ${appt.id}: ${e?.message || e}`);
      }
    }

    await this.prisma.whatsappConfirmConfig.update({
      where: { id: 'default' },
      data: { lastRunAt: now },
    });
    return { ok: true, sent, candidates: candidates.length };
  }

  private async findAppointmentsNeedingConfirm(config: {
    mode: WhatsappSendMode;
    hoursBefore: number;
    dayBeforeTime: string;
  }) {
    const now = new Date();
    const horizon = new Date(now.getTime() + 48 * 3600_000);
    const rows = await this.prisma.appointment.findMany({
      where: {
        status: {
          in: [AppointmentStatus.RESERVED, AppointmentStatus.RESCHEDULED],
        },
        slot: { startsAt: { gt: now, lte: horizon } },
        OR: [
          { whatsappConversation: null },
          { whatsappConversation: { sentAt: null } },
        ],
      },
      include: {
        patient: true,
        doctor: true,
        specialty: true,
        slot: true,
        whatsappConversation: true,
      },
      take: 40,
    });

    const today = laPazYmd(now);
    const tomorrowDate = new Date(now.getTime() + 24 * 3600_000);
    const tomorrow = laPazYmd(tomorrowDate);
    const hm = laPazHm(now);

    return rows.filter((a) => {
      const start = new Date(a.slot.startsAt);
      const day = laPazYmd(start);
      const hoursUntil = (start.getTime() - now.getTime()) / 3600_000;

      const sameDay =
        day === today &&
        hoursUntil > 0 &&
        hoursUntil <= config.hoursBefore;

      const dayBefore =
        day === tomorrow && hm >= config.dayBeforeTime;

      if (config.mode === WhatsappSendMode.SAME_DAY) return sameDay;
      if (config.mode === WhatsappSendMode.DAY_BEFORE) return dayBefore;
      return sameDay || dayBefore;
    });
  }

  /**
   * Simula respuesta del paciente desde la bandeja (demo).
   * action: confirm | cancel | reschedule
   * Para reschedule, newSlotId opcional; si no viene, propone opciones.
   */
  async simulatePatientReply(params: {
    conversationId: string;
    action: 'confirm' | 'cancel' | 'reschedule';
    newSlotId?: string;
  }) {
    const conv = await this.getConversation(params.conversationId);
    if (!conv.appointmentId || !conv.appointment) {
      throw new BadRequestException('Esta conversación no tiene cita vinculada');
    }
    const appt = conv.appointment;

    if (params.action === 'confirm') {
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: 'Sí, confirmo mi cita. Ahí estaré, gracias.',
        responded: true,
      });
      await this.appointments.confirmByPatient({
        appointmentId: appt.id,
        origin: ChangeOrigin.PATIENT,
        reason: 'Confirmación por WhatsApp',
      });
      return this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.OUTBOUND,
        body: `Perfecto, ${conv.patient.firstName}. Tu cita quedó confirmada. Te esperamos.`,
        status: WhatsappChatStatus.CONFIRMED,
      });
    }

    if (params.action === 'cancel') {
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: 'No voy a poder asistir, por favor cancelen la cita.',
        responded: true,
      });
      await this.appointments.cancelByPatient({
        appointmentId: appt.id,
        origin: ChangeOrigin.PATIENT,
        reason: 'Cancelación por WhatsApp',
      });
      return this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.OUTBOUND,
        body: `Listo, ${conv.patient.firstName}. Cancelamos tu cita. Cuando quieras podés pedir otro turno.`,
        status: WhatsappChatStatus.CANCELLED,
      });
    }

    // reschedule
    if (!params.newSlotId) {
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: 'Necesito cambiar el horario, ¿qué otras opciones tienen?',
        responded: true,
      });
      const options = await this.prisma.slot.findMany({
        where: {
          doctorId: appt.doctorId,
          status: SlotStatus.FREE,
          startsAt: { gt: new Date() },
        },
        orderBy: { startsAt: 'asc' },
        take: 3,
      });
      if (!options.length) {
        return this.appendMessage({
          conversationId: conv.id,
          direction: WhatsappMessageDirection.OUTBOUND,
          body: 'Por ahora no hay otros horarios libres con el mismo médico. ¿Preferís cancelar o mantener la cita?',
        });
      }
      const lines = options.map((s, i) => {
        const { fecha, hora } = formatLaPazParts(new Date(s.startsAt));
        return `${i + 1}) ${fecha} a las ${hora}`;
      });
      // Guardar ids en mensaje system para el front
      const payload = options.map((s) => s.id).join(',');
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.SYSTEM,
        body: `OPCIONES:${payload}`,
      });
      return this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.OUTBOUND,
        body: `Claro. Estas son las próximas opciones disponibles:\n${lines.join('\n')}\nDecime cuál te sirve (1, 2 o 3).`,
      });
    }

    const slot = await this.prisma.slot.findUnique({ where: { id: params.newSlotId } });
    if (!slot) throw new NotFoundException('Horario no encontrado');
    const { fecha, hora } = formatLaPazParts(new Date(slot.startsAt));
    await this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.INBOUND,
      body: `Me sirve el de ${fecha} a las ${hora}, por favor.`,
      responded: true,
    });
    await this.appointments.reschedule({
      appointmentId: appt.id,
      newSlotId: params.newSlotId,
      origin: ChangeOrigin.PATIENT,
      reason: 'Reprogramación por WhatsApp',
    });
    return this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.OUTBOUND,
      body: `Listo, ${conv.patient.firstName}. Reprogramamos tu cita para el ${fecha} a las ${hora}. ¡Gracias!`,
      status: WhatsappChatStatus.RESCHEDULED,
    });
  }

  async getRescheduleOptions(conversationId: string) {
    const conv = await this.getConversation(conversationId);
    if (!conv.appointment) throw new BadRequestException('Sin cita vinculada');
    const options = await this.prisma.slot.findMany({
      where: {
        doctorId: conv.appointment.doctorId,
        status: SlotStatus.FREE,
        startsAt: { gt: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
    });
    return options.map((s) => {
      const { fecha, hora } = formatLaPazParts(new Date(s.startsAt));
      return { slotId: s.id, label: `${fecha} · ${hora}`, startsAt: s.startsAt };
    });
  }

  /**
   * Siembra conversaciones demo realistas (idempotente).
   * No usa datos personales reales; solo pacientes de la DB.
   */
  async seedDemoConversations() {
    const existing = await this.prisma.whatsappConversation.count();
    if (existing >= 6) {
      return { ok: true, created: 0, existing };
    }

    const config = await this.getConfig();
    const now = new Date();
    let created = 0;
    const errors: string[] = [];

    const patients = await this.prisma.patient.findMany({
      take: 12,
      orderBy: { lastName: 'asc' },
    });
    if (!patients.length) {
      return { ok: false, created: 0, existing, error: 'Sin pacientes' };
    }

    const scenarios: Array<'confirm' | 'cancel' | 'reschedule' | 'pending'> = [
      'confirm',
      'cancel',
      'reschedule',
      'pending',
      'confirm',
      'pending',
    ];
    const toCreate = Math.max(0, 6 - existing);

    for (let i = 0; i < toCreate; i++) {
      try {
        const patient = patients[(existing + i) % patients.length];
        const freeSlot = await this.prisma.slot.findFirst({
          where: {
            status: SlotStatus.FREE,
            startsAt: { gt: new Date(now.getTime() + (i + 1) * 3600_000) },
          },
          include: { doctor: true },
          orderBy: { startsAt: 'asc' },
        });
        if (!freeSlot) break;

        const claimed = await this.prisma.slot.updateMany({
          where: { id: freeSlot.id, status: SlotStatus.FREE },
          data: { status: SlotStatus.RESERVED },
        });
        if (claimed.count !== 1) continue;

        const appt = await this.prisma.appointment.create({
          data: {
            patientId: patient.id,
            doctorId: freeSlot.doctorId,
            specialtyId: freeSlot.doctor.specialtyId,
            slotId: freeSlot.id,
            status: AppointmentStatus.RESERVED,
            changes: {
              create: {
                toStatus: AppointmentStatus.RESERVED,
                toSlotId: freeSlot.id,
                origin: ChangeOrigin.SYSTEM,
                reason: 'Cita para demo WhatsApp',
              },
            },
          },
          include: {
            patient: true,
            doctor: true,
            specialty: true,
            slot: true,
          },
        });

        const scenario = scenarios[i % scenarios.length];
        const body = this.buildConfirmMessage(config.messageTemplate, appt);
        const conv = await this.prisma.whatsappConversation.create({
          data: {
            patientId: appt.patientId,
            appointmentId: appt.id,
            phone: appt.patient.phone,
            status: WhatsappChatStatus.PENDING,
            provider: 'simulated',
            sentAt: new Date(Date.now() - (i + 2) * 3600_000),
            lastMessageAt: new Date(Date.now() - (i + 2) * 3600_000),
            lastMessagePreview: body.slice(0, 120),
          },
        });
        await this.prisma.whatsappMessage.create({
          data: {
            conversationId: conv.id,
            direction: WhatsappMessageDirection.OUTBOUND,
            body,
            simulated: true,
            createdAt: new Date(Date.now() - (i + 2) * 3600_000),
          },
        });

        if (scenario === 'confirm') {
          await this.simulatePatientReply({ conversationId: conv.id, action: 'confirm' });
        } else if (scenario === 'cancel') {
          await this.simulatePatientReply({ conversationId: conv.id, action: 'cancel' });
        } else if (scenario === 'reschedule') {
          const opt = await this.prisma.slot.findFirst({
            where: {
              doctorId: appt.doctorId,
              status: SlotStatus.FREE,
              startsAt: { gt: now },
              NOT: { id: freeSlot.id },
            },
            orderBy: { startsAt: 'asc' },
          });
          if (opt) {
            await this.simulatePatientReply({
              conversationId: conv.id,
              action: 'reschedule',
              newSlotId: opt.id,
            });
          }
        }
        created += 1;
      } catch (e: any) {
        errors.push(String(e?.message || e).slice(0, 160));
      }
    }

    return {
      ok: true,
      created,
      existing,
      total: existing + created,
      errors: errors.slice(0, 5),
    };
  }
}
