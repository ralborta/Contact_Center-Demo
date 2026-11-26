import { Injectable, NotFoundException } from '@nestjs/common';
import { DoctorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../appointments/availability.service';

@Injectable()
export class DoctorsService {
  constructor(
    private prisma: PrismaService,
    private availability: AvailabilityService,
  ) {}

  list(specialtyId?: string) {
    return this.prisma.doctor.findMany({
      where: {
        status: DoctorStatus.ACTIVE,
        ...(specialtyId ? { specialtyId } : {}),
      },
      include: {
        specialty: true,
        schedules: { where: { active: true }, orderBy: { dayOfWeek: 'asc' } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async get(id: string) {
    const d = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        specialty: true,
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        exceptions: { orderBy: { date: 'asc' }, take: 50 },
      },
    });
    if (!d) throw new NotFoundException('Doctor no encontrado');
    return d;
  }

  create(data: {
    firstName: string;
    lastName: string;
    specialtyId: string;
    consultorio?: string;
    phone?: string;
    email?: string;
    defaultDurationMin?: number;
    notes?: string;
    schedules?: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDuration?: number }>;
  }) {
    return this.prisma.doctor.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        specialtyId: data.specialtyId,
        consultorio: data.consultorio,
        phone: data.phone,
        email: data.email,
        defaultDurationMin: data.defaultDurationMin ?? 30,
        notes: data.notes,
        schedules: data.schedules
          ? { create: data.schedules.map((s) => ({ ...s, slotDuration: s.slotDuration ?? 30 })) }
          : undefined,
      },
      include: { specialty: true, schedules: true },
    });
  }

  update(id: string, data: Prisma.DoctorUpdateInput) {
    return this.prisma.doctor.update({ where: { id }, data, include: { specialty: true, schedules: true } });
  }

  async setSchedules(
    doctorId: string,
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDuration?: number }>,
  ) {
    await this.prisma.doctorSchedule.deleteMany({ where: { doctorId } });
    await this.prisma.doctorSchedule.createMany({
      data: schedules.map((s) => ({
        doctorId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDuration: s.slotDuration ?? 30,
      })),
    });
    return this.get(doctorId);
  }

  async addException(data: {
    doctorId?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    type?: 'BLOCK' | 'EXTRA' | 'HOLIDAY';
    reason?: string;
  }) {
    return this.prisma.scheduleException.create({
      data: {
        doctorId: data.doctorId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        type: data.type || 'BLOCK',
        reason: data.reason,
      },
    });
  }

  async agenda(doctorId: string, from: string, to: string) {
    return this.prisma.slot.findMany({
      where: {
        doctorId,
        startsAt: { gte: new Date(from), lte: new Date(to) },
      },
      include: {
        appointment: {
          include: {
            patient: true,
            specialty: true,
            interactions: {
              where: { provider: 'VOICE_AGENT' },
              select: {
                id: true,
                providerConversationId: true,
                resultCode: true,
                startedAt: true,
              },
              orderBy: { startedAt: 'desc' },
              take: 3,
            },
            whatsappConversation: {
              select: { id: true, status: true, lastMessageAt: true },
            },
            changes: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                origin: true,
                reason: true,
                toStatus: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async generateSlots(doctorId: string, weeks = 4) {
    const from = new Date();
    const to = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
    return this.availability.generateSlots(doctorId, from, to);
  }

  setStatus(id: string, status: DoctorStatus) {
    return this.prisma.doctor.update({ where: { id }, data: { status } });
  }
}
