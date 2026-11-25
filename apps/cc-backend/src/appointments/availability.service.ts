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
          timeZone: 'America/Argentina/Buenos_Aires',
          hour: 'numeric',
          hour12: false,
        }),
      );
      if (period === 'morning') return hour < 12;
      return hour >= 12;
    });

    // Diversificar por día: 1–2 slots de días distintos para ofrecer
    // opciones de la próxima semana, no solo la agenda de un día.
    const byDay = new Map<string, typeof filtered>();
    for (const s of filtered) {
      const dayKey = s.startsAt.toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      const list = byDay.get(dayKey) || [];
      list.push(s);
      byDay.set(dayKey, list);
    }
    const diversified: typeof filtered = [];
    const dayKeys = [...byDay.keys()];
    let round = 0;
    while (diversified.length < limit && dayKeys.some((k) => (byDay.get(k) || []).length > 0)) {
      for (const key of dayKeys) {
        if (diversified.length >= limit) break;
        const list = byDay.get(key) || [];
        if (list.length > round) diversified.push(list[round]);
      }
      round++;
      if (round > 3) break;
    }
    const chosen = diversified.length > 0 ? diversified : filtered.slice(0, limit);
    return chosen
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit)
      .map((s) => this.formatSlot(s));
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
    const fecha = s.startsAt.toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const hora = s.startsAt.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
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

  /** Interpreta hora local America/Argentina/Buenos_Aires como UTC (offset fijo -3). */
  private laPazLocalToUtc(day: Date, hour: number, minute: number): Date {
    const y = day.getFullYear();
    const m = day.getMonth();
    const d = day.getDate();
    // Argentina (sin DST) = UTC-3
    return new Date(Date.UTC(y, m, d, hour + 3, minute, 0, 0));
  }
}
