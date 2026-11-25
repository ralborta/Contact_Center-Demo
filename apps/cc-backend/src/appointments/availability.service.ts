import { Injectable } from '@nestjs/common';
import { SlotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async findAvailable(params: {
    specialtyId?: string;
    doctorId?: string;
    from: Date;
    to: Date;
    period?: 'morning' | 'afternoon' | 'any';
    limit?: number;
  }) {
    const period = params.period || 'any';
    const limit = params.limit ?? 10;

    const slots = await this.prisma.slot.findMany({
      where: {
        status: SlotStatus.FREE,
        startsAt: { gte: params.from, lte: params.to },
        ...(params.doctorId ? { doctorId: params.doctorId } : {}),
        doctor: {
          status: 'ACTIVE',
          ...(params.specialtyId ? { specialtyId: params.specialtyId } : {}),
        },
      },
      include: {
        doctor: { include: { specialty: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: 80,
    });

    const filtered = slots.filter((s) => {
      if (period === 'any') return true;
      const hour = Number(
        s.startsAt.toLocaleString('en-US', {
          timeZone: 'America/La_Paz',
          hour: 'numeric',
          hour12: false,
        }),
      );
      if (period === 'morning') return hour < 12;
      return hour >= 12;
    });

    return filtered.slice(0, limit).map((s) => this.formatSlot(s));
  }

  formatSlot(s: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    doctor: {
      id: string;
      firstName: string;
      lastName: string;
      consultorio: string | null;
      specialty: { id: string; name: string };
    };
  }) {
    const fecha = s.startsAt.toLocaleDateString('es-BO', {
      timeZone: 'America/La_Paz',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const hora = s.startsAt.toLocaleTimeString('es-BO', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return {
      slotId: s.id,
      doctorId: s.doctor.id,
      doctor: `Dr(a). ${s.doctor.firstName} ${s.doctor.lastName}`,
      especialidad: s.doctor.specialty.name,
      specialtyId: s.doctor.specialty.id,
      consultorio: s.doctor.consultorio,
      fecha,
      hora,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      mensaje: `${fecha} a las ${hora} con Dr(a). ${s.doctor.lastName}`,
    };
  }

  /**
   * Genera slots FREE a partir de horarios semanales, respetando excepciones.
   */
  async generateSlots(doctorId: string, from: Date, to: Date) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { schedules: { where: { active: true } }, exceptions: true },
    });
    if (!doctor) return { created: 0 };

    const duration = doctor.defaultDurationMin;
    const exceptions = doctor.exceptions;
    let created = 0;

    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      const day = cursor.getDay();
      const daySchedules = doctor.schedules.filter((s) => s.dayOfWeek === day);
      const dateStr = cursor.toISOString().slice(0, 10);

      const dayBlocked = exceptions.some(
        (e) =>
          e.type === 'BLOCK' &&
          e.date.toISOString().slice(0, 10) === dateStr &&
          !e.startTime,
      );

      if (!dayBlocked) {
        for (const schedule of daySchedules) {
          const slotDur = schedule.slotDuration || duration;
          const [sh, sm] = schedule.startTime.split(':').map(Number);
          const [eh, em] = schedule.endTime.split(':').map(Number);
          let mins = sh * 60 + sm;
          const endMins = eh * 60 + em;

          while (mins + slotDur <= endMins) {
            const startsAt = this.laPazLocalToUtc(cursor, Math.floor(mins / 60), mins % 60);
            const endsAt = new Date(startsAt.getTime() + slotDur * 60_000);

            const blockedRange = exceptions.some((e) => {
              if (e.date.toISOString().slice(0, 10) !== dateStr) return false;
              if (e.type !== 'BLOCK' || !e.startTime || !e.endTime) return false;
              const [bsh, bsm] = e.startTime.split(':').map(Number);
              const [beh, bem] = e.endTime.split(':').map(Number);
              const bStart = bsh * 60 + bsm;
              const bEnd = beh * 60 + bem;
              return mins < bEnd && mins + slotDur > bStart;
            });

            if (!blockedRange && startsAt > new Date()) {
              try {
                await this.prisma.slot.create({
                  data: {
                    doctorId,
                    startsAt,
                    endsAt,
                    status: SlotStatus.FREE,
                  },
                });
                created++;
              } catch {
                // unique violation — already exists
              }
            }
            mins += slotDur;
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { created };
  }

  /** Interpreta hora local America/La_Paz como UTC (offset fijo -4). */
  private laPazLocalToUtc(day: Date, hour: number, minute: number): Date {
    const y = day.getFullYear();
    const m = day.getMonth();
    const d = day.getDate();
    // La Paz = UTC-4
    return new Date(Date.UTC(y, m, d, hour + 4, minute, 0, 0));
  }
}
