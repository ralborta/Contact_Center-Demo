import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentChannel,
  AppointmentStatus,
  ChangeOrigin,
  CampaignJobStatus,
  CampaignStatus,
  CampaignType,
  Prisma,
  SlotStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.RESERVED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.NEEDS_RESCHEDULE,
];

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async list(filters: {
    status?: AppointmentStatus;
    doctorId?: string;
    specialtyId?: string;
    patientId?: string;
    from?: Date;
    to?: Date;
    needsReschedule?: boolean;
  }) {
    const where: Prisma.AppointmentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.specialtyId) where.specialtyId = filters.specialtyId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.needsReschedule !== undefined) where.needsReschedule = filters.needsReschedule;
    if (filters.from || filters.to) {
      where.slot = {
        startsAt: {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {}),
        },
      };
    }
    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { specialty: true } },
        specialty: true,
        slot: true,
        changes: { orderBy: { createdAt: 'desc' }, take: 5 },
        interactions: {
          select: { id: true, startedAt: true, resultCode: true, outcome: true },
          orderBy: { startedAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getById(id: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { specialty: true } },
        specialty: true,
        slot: true,
        changes: { orderBy: { createdAt: 'desc' } },
        interactions: {
          include: { callDetail: true },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!appt) throw new NotFoundException('Cita no encontrada');
    return appt;
  }

  async listPatientAppointments(patientId: string, upcomingOnly = true) {
    return this.prisma.appointment.findMany({
      where: {
        patientId,
        status: { in: ACTIVE_STATUSES },
        ...(upcomingOnly
          ? { slot: { startsAt: { gte: new Date() } } }
          : {}),
      },
      include: {
        doctor: { include: { specialty: true } },
        specialty: true,
        slot: true,
      },
      orderBy: { slot: { startsAt: 'asc' } },
    });
  }

  /**
   * Reserva atómica: marca el slot FREE→RESERVED dentro de una transacción.
   * Evita doble reserva con el unique + update condicional.
   */
  async reserve(params: {
    patientId: string;
    slotId: string;
    channel: AppointmentChannel;
    origin: ChangeOrigin;
    actorId?: string;
    reason?: string;
    notes?: string;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const slot = await tx.slot.findUnique({
          where: { id: params.slotId },
          include: { doctor: true },
        });
        if (!slot) throw new NotFoundException('Horario no encontrado');
        if (slot.status !== SlotStatus.FREE) {
          throw new ConflictException('Ese horario ya no está disponible');
        }
        if (slot.startsAt <= new Date()) {
          throw new BadRequestException('No se puede reservar un horario pasado');
        }

        const updated = await tx.slot.updateMany({
          where: { id: slot.id, status: SlotStatus.FREE },
          data: { status: SlotStatus.RESERVED },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Ese horario acaba de ser tomado');
        }

        const appointment = await tx.appointment.create({
          data: {
            patientId: params.patientId,
            doctorId: slot.doctorId,
            specialtyId: slot.doctor.specialtyId,
            slotId: slot.id,
            status: AppointmentStatus.RESERVED,
            channel: params.channel,
            reason: params.reason,
            notes: params.notes,
            changes: {
              create: {
                toStatus: AppointmentStatus.RESERVED,
                toSlotId: slot.id,
                origin: params.origin,
                actorId: params.actorId,
                reason: params.reason,
              },
            },
          },
          include: {
            patient: true,
            doctor: { include: { specialty: true } },
            specialty: true,
            slot: true,
          },
        });
        return appointment;
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese horario ya está reservado');
      }
      throw e;
    }
  }

  async reschedule(params: {
    appointmentId: string;
    newSlotId: string;
    origin: ChangeOrigin;
    actorId?: string;
    reason?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: params.appointmentId },
        include: { slot: true, doctor: true },
      });
      if (!appt) throw new NotFoundException('Cita no encontrada');
      if (!ACTIVE_STATUSES.includes(appt.status) && appt.status !== AppointmentStatus.NEEDS_RESCHEDULE) {
        throw new BadRequestException(`No se puede reprogramar una cita en estado ${appt.status}`);
      }

      const newSlot = await tx.slot.findUnique({
        where: { id: params.newSlotId },
        include: { doctor: true },
      });
      if (!newSlot) throw new NotFoundException('Nuevo horario no encontrado');
      if (newSlot.status !== SlotStatus.FREE) {
        throw new ConflictException('El nuevo horario no está disponible');
      }
      if (newSlot.startsAt <= new Date()) {
        throw new BadRequestException('No se puede reprogramar a un horario pasado');
      }

      const claimed = await tx.slot.updateMany({
        where: { id: newSlot.id, status: SlotStatus.FREE },
        data: { status: SlotStatus.RESERVED },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('El nuevo horario acaba de ser tomado');
      }

      await tx.slot.update({
        where: { id: appt.slotId },
        data: { status: SlotStatus.FREE },
      });

      const updated = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          slotId: newSlot.id,
          doctorId: newSlot.doctorId,
          specialtyId: newSlot.doctor.specialtyId,
          status: AppointmentStatus.RESCHEDULED,
          needsReschedule: false,
          changes: {
            create: {
              fromStatus: appt.status,
              toStatus: AppointmentStatus.RESCHEDULED,
              fromSlotId: appt.slotId,
              toSlotId: newSlot.id,
              origin: params.origin,
              actorId: params.actorId,
              reason: params.reason,
            },
          },
        },
        include: {
          patient: true,
          doctor: { include: { specialty: true } },
          specialty: true,
          slot: true,
        },
      });
      return updated;
    });
  }

  async cancelByPatient(params: {
    appointmentId: string;
    origin: ChangeOrigin;
    actorId?: string;
    reason?: string;
  }) {
    return this.cancelInternal({
      ...params,
      toStatus: AppointmentStatus.CANCELLED_BY_PATIENT,
      blockSlot: false,
    });
  }

  /**
   * Cancelación por doctor: libera o bloquea el slot, marca afectados
   * para reprogramar y crea campaña saliente de aviso.
   */
  async cancelByDoctor(params: {
    appointmentId: string;
    actorId?: string;
    reason: string;
    blockSlot?: boolean;
    createOutboundNotice?: boolean;
  }) {
    const result = await this.cancelInternal({
      appointmentId: params.appointmentId,
      origin: ChangeOrigin.DOCTOR,
      actorId: params.actorId,
      reason: params.reason,
      toStatus: AppointmentStatus.CANCELLED_BY_DOCTOR,
      blockSlot: params.blockSlot ?? false,
      markNeedsReschedule: true,
    });

    if (params.createOutboundNotice !== false) {
      await this.createDoctorCancelCampaign(result.id, result.patientId, result.patient.phone);
    }
    return result;
  }

  /**
   * Bloquea un rango de agenda del doctor y cancela citas afectadas.
   */
  async blockDoctorAgenda(params: {
    doctorId: string;
    from: Date;
    to: Date;
    reason: string;
    actorId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.scheduleException.create({
        data: {
          doctorId: params.doctorId,
          date: params.from,
          startTime: null,
          endTime: null,
          type: 'BLOCK',
          reason: params.reason,
        },
      });

      const slots = await tx.slot.findMany({
        where: {
          doctorId: params.doctorId,
          startsAt: { gte: params.from, lte: params.to },
          status: { in: [SlotStatus.FREE, SlotStatus.RESERVED] },
        },
        include: { appointment: { include: { patient: true } } },
      });

      const affected: string[] = [];
      for (const slot of slots) {
        await tx.slot.update({
          where: { id: slot.id },
          data: { status: SlotStatus.BLOCKED },
        });
        if (slot.appointment && ACTIVE_STATUSES.includes(slot.appointment.status)) {
          await tx.appointment.update({
            where: { id: slot.appointment.id },
            data: {
              status: AppointmentStatus.CANCELLED_BY_DOCTOR,
              needsReschedule: true,
              changes: {
                create: {
                  fromStatus: slot.appointment.status,
                  toStatus: AppointmentStatus.CANCELLED_BY_DOCTOR,
                  fromSlotId: slot.id,
                  origin: ChangeOrigin.DOCTOR,
                  actorId: params.actorId,
                  reason: params.reason,
                },
              },
            },
          });
          affected.push(slot.appointment.id);
        }
      }

      let campaignId: string | null = null;
      if (affected.length > 0) {
        const appointments = await tx.appointment.findMany({
          where: { id: { in: affected } },
          include: { patient: true },
        });
        const campaign = await tx.outboundCampaign.create({
          data: {
            name: `Aviso cancelación doctor — ${params.from.toISOString().slice(0, 10)}`,
            type: CampaignType.DOCTOR_CANCEL_NOTICE,
            status: CampaignStatus.QUEUED,
            scheduledAt: new Date(),
            jobs: {
              create: appointments.map((a) => ({
                patientId: a.patientId,
                appointmentId: a.id,
                phone: a.patient.phone,
                status: CampaignJobStatus.PENDING,
              })),
            },
          },
        });
        campaignId = campaign.id;
      }

      return { blockedSlots: slots.length, affectedAppointments: affected, campaignId };
    });
  }

  private async cancelInternal(params: {
    appointmentId: string;
    origin: ChangeOrigin;
    actorId?: string;
    reason?: string;
    toStatus: AppointmentStatus;
    blockSlot: boolean;
    markNeedsReschedule?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: params.appointmentId },
        include: { patient: true, doctor: { include: { specialty: true } }, specialty: true, slot: true },
      });
      if (!appt) throw new NotFoundException('Cita no encontrada');
      if (
        appt.status === AppointmentStatus.CANCELLED_BY_PATIENT ||
        appt.status === AppointmentStatus.CANCELLED_BY_DOCTOR ||
        appt.status === AppointmentStatus.COMPLETED
      ) {
        throw new BadRequestException(`La cita ya está en estado ${appt.status}`);
      }

      await tx.slot.update({
        where: { id: appt.slotId },
        data: { status: params.blockSlot ? SlotStatus.BLOCKED : SlotStatus.FREE },
      });

      return tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: params.toStatus,
          needsReschedule: params.markNeedsReschedule ?? false,
          reason: params.reason ?? appt.reason,
          changes: {
            create: {
              fromStatus: appt.status,
              toStatus: params.toStatus,
              fromSlotId: appt.slotId,
              origin: params.origin,
              actorId: params.actorId,
              reason: params.reason,
            },
          },
        },
        include: {
          patient: true,
          doctor: { include: { specialty: true } },
          specialty: true,
          slot: true,
        },
      });
    });
  }

  private async createDoctorCancelCampaign(
    appointmentId: string,
    patientId: string,
    phone: string,
  ) {
    return this.prisma.outboundCampaign.create({
      data: {
        name: `Aviso cancelación — cita ${appointmentId.slice(0, 8)}`,
        type: CampaignType.DOCTOR_CANCEL_NOTICE,
        status: CampaignStatus.QUEUED,
        scheduledAt: new Date(),
        jobs: {
          create: {
            patientId,
            appointmentId,
            phone,
            status: CampaignJobStatus.PENDING,
          },
        },
      },
    });
  }

  formatForVoice(appt: {
    id: string;
    status: AppointmentStatus;
    doctor: { firstName: string; lastName: string; specialty?: { name: string } | null };
    specialty: { name: string };
    slot: { startsAt: Date; endsAt: Date };
  }) {
    const starts = appt.slot.startsAt;
    const fecha = starts.toLocaleDateString('es-BO', {
      timeZone: 'America/La_Paz',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const hora = starts.toLocaleTimeString('es-BO', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return {
      id: appt.id,
      estado: appt.status,
      especialidad: appt.specialty.name,
      doctor: `Dr(a). ${appt.doctor.firstName} ${appt.doctor.lastName}`,
      fecha,
      hora,
      mensaje: `Cita de ${appt.specialty.name} con el Dr(a). ${appt.doctor.lastName} el ${fecha} a las ${hora}.`,
    };
  }
}
