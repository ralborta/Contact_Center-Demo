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
    const active = { archived: false };
    const [
      confirmed,
      cancelled,
      rescheduled,
      pending,
      total,
      doctorChanges,
    ] = await Promise.all([
      this.prisma.whatsappConversation.count({
        where: { ...active, status: WhatsappChatStatus.CONFIRMED },
      }),
      this.prisma.whatsappConversation.count({
        where: { ...active, status: WhatsappChatStatus.CANCELLED },
      }),
      this.prisma.whatsappConversation.count({
        where: { ...active, status: WhatsappChatStatus.RESCHEDULED },
      }),
      this.prisma.whatsappConversation.count({
        where: { ...active, status: WhatsappChatStatus.PENDING },
      }),
      this.prisma.whatsappConversation.count({ where: active }),
      this.prisma.appointmentChange.count({
        where: {
          origin: ChangeOrigin.DOCTOR,
          appointment: {
            whatsappConversation: { is: { archived: false } },
          },
        },
      }),
    ]);
    return {
      confirmed,
      cancelled,
      rescheduled,
      pending,
      total,
      doctorChanges,
    };
  }

  /** Alternativas reales: mismo doctor, si faltan completa con misma especialidad. */
  async findAlternativeSlots(params: {
    doctorId: string;
    specialtyId: string;
    excludeSlotId?: string;
    take?: number;
  }) {
    const take = params.take ?? 3;
    const baseWhere = {
      status: SlotStatus.FREE,
      startsAt: { gt: new Date() },
      ...(params.excludeSlotId ? { NOT: { id: params.excludeSlotId } } : {}),
    };
    const sameDoctor = await this.prisma.slot.findMany({
      where: { ...baseWhere, doctorId: params.doctorId },
      include: { doctor: true },
      orderBy: { startsAt: 'asc' },
      take,
    });
    if (sameDoctor.length >= take) return sameDoctor;
    const extra = await this.prisma.slot.findMany({
      where: {
        ...baseWhere,
        doctor: { specialtyId: params.specialtyId },
        id: { notIn: sameDoctor.map((s) => s.id) },
      },
      include: { doctor: true },
      orderBy: { startsAt: 'asc' },
      take: take - sameDoctor.length,
    });
    return [...sameDoctor, ...extra];
  }

  private async ensureConversationForAppointment(appt: {
    id: string;
    patientId: string;
    patient: { phone: string };
    whatsappConversation?: { id: string } | null;
  }) {
    const config = await this.getConfig();
    if (appt.whatsappConversation?.id) {
      return this.prisma.whatsappConversation.findUniqueOrThrow({
        where: { id: appt.whatsappConversation.id },
      });
    }
    const existing = await this.prisma.whatsappConversation.findUnique({
      where: { appointmentId: appt.id },
    });
    if (existing) return existing;
    return this.prisma.whatsappConversation.create({
      data: {
        patientId: appt.patientId,
        appointmentId: appt.id,
        phone: appt.patient.phone,
        status: WhatsappChatStatus.PENDING,
        provider: config.provider || 'simulated',
      },
    });
  }

  private formatOptionsMessage(options: Array<{ id: string; startsAt: Date; doctor?: { lastName: string } }>) {
    const lines = options.map((s, i) => {
      const { fecha, hora } = formatLaPazParts(new Date(s.startsAt));
      const doc = s.doctor?.lastName ? ` · Dr(a). ${s.doctor.lastName}` : '';
      return `${i + 1}) ${fecha} a las ${hora}${doc}`;
    });
    return {
      payload: options.map((s) => s.id).join(','),
      text: lines.join('\n'),
    };
  }

  /**
   * Cancelar cita por doctor + aviso WhatsApp simulado con 2–3 alternativas.
   */
  async doctorCancelWithNotice(params: {
    appointmentId: string;
    reason: string;
    actorId?: string;
  }) {
    const before = await this.prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        patient: true,
        doctor: true,
        specialty: true,
        slot: true,
        whatsappConversation: true,
      },
    });
    if (!before) throw new NotFoundException('Cita no encontrada');

    const cancelled = await this.appointments.cancelByDoctor({
      appointmentId: params.appointmentId,
      actorId: params.actorId,
      reason: params.reason,
      blockSlot: false,
      createOutboundNotice: false,
    });

    const options = await this.findAlternativeSlots({
      doctorId: before.doctorId,
      specialtyId: before.specialtyId,
      excludeSlotId: before.slotId,
      take: 3,
    });

    const conv = await this.ensureConversationForAppointment({
      ...before,
      patient: cancelled.patient,
    });

    const { fecha, hora } = formatLaPazParts(new Date(before.slot.startsAt));
    const intro =
      `Hola ${cancelled.patient.firstName}, te escribimos del Hospital Central La Paz. ` +
      `Lamentablemente el/la Dr(a). ${before.doctor.lastName} tuvo que cancelar tu cita de ${before.specialty.name} ` +
      `del ${fecha} a las ${hora}. Motivo: ${params.reason}.`;

    const provider = resolveWhatsappProvider((await this.getConfig()).provider);
    let body = intro;
    if (options.length) {
      const fmt = this.formatOptionsMessage(options);
      body += `\n\nPodemos reasignarte uno de estos horarios:\n${fmt.text}\n\nRespondé con el número que preferís, o decinos si preferís cancelar.`;
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.SYSTEM,
        body: `KIND:DOCTOR_CANCEL`,
      });
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.SYSTEM,
        body: `OPCIONES:${fmt.payload}`,
      });
    } else {
      body +=
        '\n\nPor ahora no hay otros horarios libres. Respondé CANCELAR si querés dar de baja, o escribinos más adelante.';
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.SYSTEM,
        body: `KIND:DOCTOR_CANCEL`,
      });
    }

    await provider.send({
      to: cancelled.patient.phone,
      body,
      conversationId: conv.id,
      appointmentId: cancelled.id,
    });
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: {
        sentAt: new Date(),
        status: WhatsappChatStatus.PENDING,
        appointmentId: cancelled.id,
      },
    });
    return this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.OUTBOUND,
      body,
      simulated: true,
    });
  }

  /**
   * El doctor pide cambiar el horario: libera turno + WhatsApp con alternativas.
   */
  async doctorRescheduleWithNotice(params: {
    appointmentId: string;
    reason: string;
    actorId?: string;
  }) {
    const before = await this.prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        patient: true,
        doctor: true,
        specialty: true,
        slot: true,
        whatsappConversation: true,
      },
    });
    if (!before) throw new NotFoundException('Cita no encontrada');

    const updated = await this.appointments.requestDoctorReschedule({
      appointmentId: params.appointmentId,
      actorId: params.actorId,
      reason: params.reason,
    });

    const options = await this.findAlternativeSlots({
      doctorId: before.doctorId,
      specialtyId: before.specialtyId,
      excludeSlotId: before.slotId,
      take: 3,
    });
    if (!options.length) {
      throw new BadRequestException(
        'No hay horarios alternativos libres para ofrecer al paciente',
      );
    }

    const conv = await this.ensureConversationForAppointment({
      ...before,
      patient: updated.patient,
    });

    const { fecha, hora } = formatLaPazParts(new Date(before.slot.startsAt));
    const fmt = this.formatOptionsMessage(options);
    const body =
      `Hola ${updated.patient.firstName}, te escribimos del Hospital Central La Paz. ` +
      `El/la Dr(a). ${before.doctor.lastName} necesita cambiar tu cita de ${before.specialty.name} ` +
      `del ${fecha} a las ${hora}. Motivo: ${params.reason}.\n\n` +
      `Estas son las opciones disponibles:\n${fmt.text}\n\n` +
      `Respondé con el número que te sirva, o CANCELAR si no podés en ninguno.`;

    await this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.SYSTEM,
      body: `KIND:DOCTOR_RESCHEDULE`,
    });
    await this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.SYSTEM,
      body: `OPCIONES:${fmt.payload}`,
    });

    const provider = resolveWhatsappProvider((await this.getConfig()).provider);
    await provider.send({
      to: updated.patient.phone,
      body,
      conversationId: conv.id,
      appointmentId: updated.id,
    });
    await this.prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: {
        sentAt: new Date(),
        status: WhatsappChatStatus.PENDING,
        appointmentId: updated.id,
      },
    });
    return this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.OUTBOUND,
      body,
      simulated: true,
    });
  }

  private conversationKind(
    messages: Array<{ direction: string; body: string }>,
  ): 'CONFIRMATION' | 'DOCTOR_CANCEL' | 'DOCTOR_RESCHEDULE' {
    for (let i = messages.length - 1; i >= 0; i--) {
      const b = messages[i]?.body || '';
      if (b === 'KIND:DOCTOR_CANCEL') return 'DOCTOR_CANCEL';
      if (b === 'KIND:DOCTOR_RESCHEDULE') return 'DOCTOR_RESCHEDULE';
    }
    return 'CONFIRMATION';
  }

  async listConversations(status?: WhatsappChatStatus) {
    return this.prisma.whatsappConversation.findMany({
      where: {
        archived: false,
        ...(status ? { status } : {}),
      },
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

  private pickReply(pool: string[], salt: string) {
    let h = 0;
    for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
  }

  async getConversation(id: string) {
    const row = await this.prisma.whatsappConversation.findUnique({
      where: { id },
      include: CHAT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Conversación no encontrada');
    return {
      ...row,
      kind: this.conversationKind(row.messages || []),
    };
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
    const kind = this.conversationKind(conv.messages || []);

    // Aviso del doctor: el paciente elige horario o declina
    if (kind === 'DOCTOR_CANCEL' || kind === 'DOCTOR_RESCHEDULE') {
      if (params.action === 'cancel' || (params.action === 'confirm' && !params.newSlotId)) {
        await this.appendMessage({
          conversationId: conv.id,
          direction: WhatsappMessageDirection.INBOUND,
          body: 'Gracias, por ahora no puedo en ninguno de esos horarios. Cancelen la cita.',
          responded: true,
        });
        if (
          appt.status !== AppointmentStatus.CANCELLED_BY_DOCTOR &&
          appt.status !== AppointmentStatus.CANCELLED_BY_PATIENT
        ) {
          await this.appointments.cancelByPatient({
            appointmentId: appt.id,
            origin: ChangeOrigin.PATIENT,
            reason: 'Paciente declinó alternativas por WhatsApp',
          });
        } else {
          await this.prisma.appointment.update({
            where: { id: appt.id },
            data: { needsReschedule: false },
          });
        }
        return this.appendMessage({
          conversationId: conv.id,
          direction: WhatsappMessageDirection.OUTBOUND,
          body: `Entendido, ${conv.patient.firstName}. Dejamos la cita cancelada. Cuando quieras podés pedir un nuevo turno.`,
          status: WhatsappChatStatus.CANCELLED,
        });
      }

      if (!params.newSlotId) {
        // Reexponer opciones guardadas o buscar de nuevo
        const opts = await this.getRescheduleOptions(conv.id);
        return { ...conv, offeredOptions: opts };
      }

      const slot = await this.prisma.slot.findUnique({
        where: { id: params.newSlotId },
        include: { doctor: true },
      });
      if (!slot) throw new NotFoundException('Horario no encontrado');
      const { fecha, hora } = formatLaPazParts(new Date(slot.startsAt));
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: `Me sirve la opción del ${fecha} a las ${hora}, por favor.`,
        responded: true,
      });
      await this.appointments.reschedule({
        appointmentId: appt.id,
        newSlotId: params.newSlotId,
        origin: ChangeOrigin.PATIENT,
        reason: 'Paciente eligió alternativa ofrecida por el doctor (WhatsApp)',
      });
      return this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.OUTBOUND,
        body: `Listo, ${conv.patient.firstName}. Quedó reprogramada para el ${fecha} a las ${hora}. ¡Gracias!`,
        status: WhatsappChatStatus.RESCHEDULED,
      });
    }

    if (params.action === 'confirm') {
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: this.pickReply(
          [
            'Sí, confirmo mi cita. Ahí estaré, gracias.',
            'CONFIRMAR. Todo bien, nos vemos ese día.',
            'Dale, confirmo. Gracias por el recordatorio.',
            'Sí, confirmo asistencia. ¡Gracias!',
          ],
          conv.id + ':confirm',
        ),
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
        body: this.pickReply(
          [
            `Perfecto, ${conv.patient.firstName}. Tu cita quedó confirmada. Te esperamos.`,
            `Listo, ${conv.patient.firstName}. Quedó confirmada. ¡Hasta pronto!`,
            `Gracias, ${conv.patient.firstName}. Anotamos tu confirmación. Te esperamos.`,
          ],
          conv.id + ':confirm-out',
        ),
        status: WhatsappChatStatus.CONFIRMED,
      });
    }

    if (params.action === 'cancel') {
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: this.pickReply(
          [
            'No voy a poder asistir, por favor cancelen la cita.',
            'CANCELAR. Surgió un imprevisto y no puedo ir.',
            'Mejor cancelen, no me va a dar el tiempo. Gracias.',
            'No puedo ir esa fecha, cancelen por favor.',
          ],
          conv.id + ':cancel',
        ),
        responded: true,
      });
      if (
        appt.status !== AppointmentStatus.CANCELLED_BY_DOCTOR &&
        appt.status !== AppointmentStatus.CANCELLED_BY_PATIENT
      ) {
        await this.appointments.cancelByPatient({
          appointmentId: appt.id,
          origin: ChangeOrigin.PATIENT,
          reason: 'Cancelación por WhatsApp',
        });
      }
      return this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.OUTBOUND,
        body: `Listo, ${conv.patient.firstName}. Cancelamos tu cita. Cuando quieras podés pedir otro turno.`,
        status: WhatsappChatStatus.CANCELLED,
      });
    }

    // reschedule (iniciado por el paciente)
    if (!params.newSlotId) {
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.INBOUND,
        body: this.pickReply(
          [
            'Necesito cambiar el día, ¿qué otras opciones tienen?',
            'CAMBIAR. Ese horario no me sirve, ¿hay otro día?',
            '¿Pueden pasarme otras fechas? Me surgió un compromiso.',
            'Quiero reprogramar para otro día si es posible.',
          ],
          conv.id + ':ask-change',
        ),
        responded: true,
      });
      const options = await this.findAlternativeSlots({
        doctorId: appt.doctorId,
        specialtyId: appt.specialtyId,
        excludeSlotId: appt.slotId,
        take: 3,
      });
      if (!options.length) {
        return this.appendMessage({
          conversationId: conv.id,
          direction: WhatsappMessageDirection.OUTBOUND,
          body: 'Por ahora no hay otros horarios libres con el mismo médico. ¿Preferís cancelar o mantener la cita?',
        });
      }
      const fmt = this.formatOptionsMessage(options);
      await this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.SYSTEM,
        body: `OPCIONES:${fmt.payload}`,
      });
      return this.appendMessage({
        conversationId: conv.id,
        direction: WhatsappMessageDirection.OUTBOUND,
        body: `Claro. Estas son las próximas opciones disponibles:\n${fmt.text}\n\nDecime cuál te sirve (1, 2 o 3).`,
      });
    }

    const slot = await this.prisma.slot.findUnique({ where: { id: params.newSlotId } });
    if (!slot) throw new NotFoundException('Horario no encontrado');
    const { fecha, hora } = formatLaPazParts(new Date(slot.startsAt));
    await this.appendMessage({
      conversationId: conv.id,
      direction: WhatsappMessageDirection.INBOUND,
      body: this.pickReply(
        [
          `Me sirve el de ${fecha} a las ${hora}, por favor.`,
          `La opción del ${fecha} a las ${hora} me viene bien.`,
          `Elegí el ${fecha} · ${hora}. Gracias.`,
        ],
        conv.id + ':pick',
      ),
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

    // Preferir opciones ya ofrecidas en el chat
    const optMsg = [...(conv.messages || [])]
      .reverse()
      .find((m) => String(m.body || '').startsWith('OPCIONES:'));
    if (optMsg) {
      const ids = String(optMsg.body)
        .replace(/^OPCIONES:/, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length) {
        const slots = await this.prisma.slot.findMany({
          where: { id: { in: ids } },
          include: { doctor: true },
        });
        const byId = new Map(slots.map((s) => [s.id, s]));
        return ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((s: any) => {
            const { fecha, hora } = formatLaPazParts(new Date(s.startsAt));
            return {
              slotId: s.id,
              label: `${fecha} · ${hora}${s.doctor ? ` · Dr(a). ${s.doctor.lastName}` : ''}`,
              startsAt: s.startsAt,
            };
          });
      }
    }

    const options = await this.findAlternativeSlots({
      doctorId: conv.appointment.doctorId,
      specialtyId: conv.appointment.specialtyId,
      excludeSlotId: conv.appointment.slotId,
      take: 5,
    });
    return options.map((s) => {
      const { fecha, hora } = formatLaPazParts(new Date(s.startsAt));
      return {
        slotId: s.id,
        label: `${fecha} · ${hora}${s.doctor ? ` · Dr(a). ${s.doctor.lastName}` : ''}`,
        startsAt: s.startsAt,
      };
    });
  }

  private static readonly SEED_TAG = 'SEED:bandeja-demo-v2';

  /**
   * Siembra conversaciones demo variadas (idempotente, no destructiva).
   * Archiva duplicados de prueba de Juan Pérez sin borrarlos.
   * Objetivo: ≥3 reprogramadas, ≥3 confirmadas, ≥2 canceladas paciente,
   * ≥2 cambios por doctor, ≥2 sin respuesta — pacientes distintos.
   */
  async seedDemoConversations() {
    const archivedJuan = await this.archiveJuanPerezDuplicates();
    const config = await this.getConfig();
    const now = new Date();
    const errors: string[] = [];
    let created = 0;

    const active = await this.prisma.whatsappConversation.findMany({
      where: { archived: false },
      include: {
        patient: true,
        messages: { select: { body: true, direction: true } },
      },
    });

    const isDoctorKind = (c: { messages: Array<{ body: string }> }) =>
      c.messages.some(
        (m) => m.body === 'KIND:DOCTOR_CANCEL' || m.body === 'KIND:DOCTOR_RESCHEDULE',
      );

    const counts = {
      confirmed: active.filter((c) => c.status === WhatsappChatStatus.CONFIRMED).length,
      cancelled: active.filter((c) => c.status === WhatsappChatStatus.CANCELLED).length,
      rescheduled: active.filter((c) => c.status === WhatsappChatStatus.RESCHEDULED).length,
      pendingConfirm: active.filter(
        (c) => c.status === WhatsappChatStatus.PENDING && !isDoctorKind(c),
      ).length,
      doctorPending: active.filter(
        (c) => c.status === WhatsappChatStatus.PENDING && isDoctorKind(c),
      ).length,
    };

    const need: Array<{
      kind: 'confirm' | 'cancel' | 'reschedule' | 'pending' | 'doctor_cancel' | 'doctor_reschedule';
    }> = [];
    for (let i = counts.rescheduled; i < 3; i++) need.push({ kind: 'reschedule' });
    for (let i = counts.confirmed; i < 3; i++) need.push({ kind: 'confirm' });
    for (let i = counts.cancelled; i < 2; i++) need.push({ kind: 'cancel' });
    for (let i = counts.doctorPending; i < 2; i++) {
      need.push({
        kind: i % 2 === 0 ? 'doctor_cancel' : 'doctor_reschedule',
      });
    }
    for (let i = counts.pendingConfirm; i < 2; i++) need.push({ kind: 'pending' });

    if (!need.length) {
      return {
        ok: true,
        created: 0,
        archivedJuan,
        counts,
        total: active.length,
        message: 'Bandeja demo ya completa',
      };
    }

    const usedPatientIds = new Set(active.map((c) => c.patientId));
    const patients = await this.prisma.patient.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 40,
    });
    const pickPatient = () => {
      const fresh = patients.find((p) => !usedPatientIds.has(p.id));
      if (fresh) {
        usedPatientIds.add(fresh.id);
        return fresh;
      }
      // Evitar Juan Pérez en re-seed si hay alternativas
      const nonJuan = patients.find(
        (p) =>
          !(
            p.firstName.toLowerCase() === 'juan' &&
            p.lastName.toLowerCase().startsWith('pérez')
          ),
      );
      const p = nonJuan || patients[0];
      if (p) usedPatientIds.add(p.id);
      return p;
    };

    if (!patients.length) {
      return { ok: false, created: 0, archivedJuan, error: 'Sin pacientes' };
    }

    let hourOffset = 2;
    for (const scenario of need) {
      try {
        const patient = pickPatient();
        if (!patient) break;

        const freeSlot = await this.prisma.slot.findFirst({
          where: {
            status: SlotStatus.FREE,
            startsAt: { gt: new Date(now.getTime() + hourOffset * 3600_000) },
          },
          include: { doctor: true },
          orderBy: { startsAt: 'asc' },
        });
        hourOffset += 1;
        if (!freeSlot) {
          errors.push('Sin slots libres');
          break;
        }

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
                reason: 'Cita demo WhatsApp bandeja',
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

        const sentAt = new Date(Date.now() - (created + 3) * 50 * 60_000);

        if (scenario.kind === 'doctor_cancel' || scenario.kind === 'doctor_reschedule') {
          const reason =
            scenario.kind === 'doctor_cancel'
              ? 'Cirugía de urgencia programada'
              : 'Congreso médico ese día';
          if (scenario.kind === 'doctor_cancel') {
            await this.doctorCancelWithNotice({
              appointmentId: appt.id,
              reason,
            });
          } else {
            await this.doctorRescheduleWithNotice({
              appointmentId: appt.id,
              reason,
            });
          }
          const conv = await this.prisma.whatsappConversation.findFirst({
            where: { appointmentId: appt.id },
          });
          if (conv) {
            await this.appendMessage({
              conversationId: conv.id,
              direction: WhatsappMessageDirection.SYSTEM,
              body: WhatsappService.SEED_TAG,
            });
            await this.prisma.whatsappConversation.update({
              where: { id: conv.id },
              data: { sentAt, archived: false },
            });
          }
          created += 1;
          continue;
        }

        const body = this.buildConfirmMessage(config.messageTemplate, appt);
        const conv = await this.prisma.whatsappConversation.create({
          data: {
            patientId: appt.patientId,
            appointmentId: appt.id,
            phone: appt.patient.phone,
            status: WhatsappChatStatus.PENDING,
            provider: 'simulated',
            sentAt,
            lastMessageAt: sentAt,
            lastMessagePreview: body.slice(0, 120),
          },
        });
        await this.prisma.whatsappMessage.create({
          data: {
            conversationId: conv.id,
            direction: WhatsappMessageDirection.SYSTEM,
            body: WhatsappService.SEED_TAG,
            simulated: true,
            createdAt: sentAt,
          },
        });
        await this.prisma.whatsappMessage.create({
          data: {
            conversationId: conv.id,
            direction: WhatsappMessageDirection.OUTBOUND,
            body,
            simulated: true,
            createdAt: sentAt,
          },
        });

        if (scenario.kind === 'confirm') {
          await this.simulatePatientReply({ conversationId: conv.id, action: 'confirm' });
        } else if (scenario.kind === 'cancel') {
          await this.simulatePatientReply({ conversationId: conv.id, action: 'cancel' });
        } else if (scenario.kind === 'reschedule') {
          await this.simulatePatientReply({
            conversationId: conv.id,
            action: 'reschedule',
          });
          const opts = await this.getRescheduleOptions(conv.id);
          if (opts[0]?.slotId) {
            await this.simulatePatientReply({
              conversationId: conv.id,
              action: 'reschedule',
              newSlotId: opts[0].slotId,
            });
          }
        }
        // pending: deja sin respuesta
        created += 1;
      } catch (e: any) {
        errors.push(String(e?.message || e).slice(0, 180));
      }
    }

    const after = await this.prisma.whatsappConversation.count({
      where: { archived: false },
    });
    return {
      ok: true,
      created,
      archivedJuan,
      beforeCounts: counts,
      total: after,
      errors: errors.slice(0, 8),
    };
  }

  /** Archiva (no borra) chats duplicados de Juan Pérez de pruebas. */
  private async archiveJuanPerezDuplicates() {
    const juans = await this.prisma.patient.findMany({
      where: {
        firstName: { equals: 'Juan', mode: 'insensitive' },
        lastName: { startsWith: 'P', mode: 'insensitive' },
      },
    });
    const juanIds = juans
      .filter((p) => /^p[eé]rez$/i.test(p.lastName.trim()))
      .map((p) => p.id);
    if (!juanIds.length) return 0;

    const rows = await this.prisma.whatsappConversation.findMany({
      where: { patientId: { in: juanIds }, archived: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    // Archivar todos los de Juan Pérez (ruido de pruebas); el seed crea pacientes distintos
    if (!rows.length) return 0;
    const res = await this.prisma.whatsappConversation.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true },
    });
    return res.count;
  }
}
