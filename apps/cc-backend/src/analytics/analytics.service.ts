import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  InteractionStatus,
  WhatsappChatStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const startOfDay = this.startOfArgentinaDay();
    const endOfDay = new Date(startOfDay.getTime() + 24 * 3600_000);

    const [
      callsToday,
      callsInProgress,
      appointmentsToday,
      reserved,
      cancelledPatient,
      cancelledDoctor,
      needsReschedule,
      specialties,
      aiResolved,
      transferred,
      totalCallsWeek,
      waConfirmed,
      waCancelled,
      waRescheduled,
      waPending,
      waDoctorChanges,
    ] = await Promise.all([
      this.prisma.interaction.count({
        where: { startedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.interaction.count({
        where: { status: InteractionStatus.IN_PROGRESS },
      }),
      this.prisma.appointment.count({
        where: {
          slot: { startsAt: { gte: startOfDay, lt: endOfDay } },
          status: { in: ['RESERVED', 'CONFIRMED', 'RESCHEDULED'] },
        },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.RESERVED,
          createdAt: { gte: startOfDay },
        },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.CANCELLED_BY_PATIENT,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.CANCELLED_BY_DOCTOR,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.appointment.count({ where: { needsReschedule: true } }),
      this.occupancyBySpecialty(startOfDay, endOfDay),
      this.prisma.interaction.count({
        where: {
          startedAt: { gte: startOfDay },
          aiHandled: true,
          outcome: { in: ['RESOLVED'] },
        },
      }),
      this.prisma.interaction.count({
        where: {
          startedAt: { gte: startOfDay },
          outcome: { in: ['ESCALATED', 'TRANSFERRED'] },
        },
      }),
      this.prisma.interaction.count({
        where: { startedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
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
      this.prisma.appointmentChange.count({
        where: { origin: 'DOCTOR' },
      }),
    ]);

    const resolutionRate =
      callsToday > 0 ? Math.round((aiResolved / callsToday) * 100) : 0;

    return {
      callsToday,
      callsInProgress,
      appointmentsToday,
      reservedToday: reserved,
      cancelledByPatientToday: cancelledPatient,
      cancelledByDoctorToday: cancelledDoctor,
      needsReschedule,
      occupancyBySpecialty: specialties,
      aiResolutionRate: resolutionRate,
      humanTransfersToday: transferred,
      callsLast7Days: totalCallsWeek,
      whatsapp: {
        confirmed: waConfirmed,
        cancelled: waCancelled,
        rescheduled: waRescheduled,
        pending: waPending,
        doctorChanges: waDoctorChanges,
      },
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
    };
  }

  async kpis(days = 30) {
    const from = new Date(Date.now() - days * 86400000);
    const [appointments, cancellationsPatient, cancellationsDoctor, calls, noShows] =
      await Promise.all([
        this.prisma.appointment.count({ where: { createdAt: { gte: from } } }),
        this.prisma.appointment.count({
          where: { status: 'CANCELLED_BY_PATIENT', updatedAt: { gte: from } },
        }),
        this.prisma.appointment.count({
          where: { status: 'CANCELLED_BY_DOCTOR', updatedAt: { gte: from } },
        }),
        this.prisma.interaction.findMany({
          where: { startedAt: { gte: from } },
          include: { callDetail: true },
        }),
        this.prisma.appointment.count({
          where: { status: 'NO_SHOW', updatedAt: { gte: from } },
        }),
      ]);

    const avgDuration =
      calls.reduce((acc, c) => acc + (c.callDetail?.durationSec || 0), 0) /
      (calls.filter((c) => c.callDetail?.durationSec).length || 1);

    return {
      periodDays: days,
      appointmentsCreated: appointments,
      cancellationsPatient,
      cancellationsDoctor,
      noShows,
      callsTotal: calls.length,
      avgCallDurationSec: Math.round(avgDuration),
      bookingRateFromCalls:
        calls.length > 0
          ? Math.round(
              (calls.filter((c) => c.resultCode === 'APPOINTMENT_BOOKED').length /
                calls.length) *
                100,
            )
          : 0,
    };
  }

  private async occupancyBySpecialty(from: Date, to: Date) {
    const specialties = await this.prisma.specialty.findMany({
      where: { active: true },
      include: {
        doctors: {
          include: {
            slots: {
              where: { startsAt: { gte: from, lt: to } },
            },
          },
        },
      },
    });
    return specialties.map((s) => {
      const slots = s.doctors.flatMap((d) => d.slots);
      const total = slots.length;
      const reserved = slots.filter((sl) => sl.status === 'RESERVED').length;
      return {
        specialtyId: s.id,
        name: s.name,
        totalSlots: total,
        reservedSlots: reserved,
        occupancyPct: total ? Math.round((reserved / total) * 100) : 0,
      };
    });
  }

  /** Inicio del día en America/Argentina/Buenos_Aires (UTC-3). */
  private startOfArgentinaDay(): Date {
    const now = new Date();
    const local = new Date(now.getTime() - 3 * 3600_000);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0));
  }
}
