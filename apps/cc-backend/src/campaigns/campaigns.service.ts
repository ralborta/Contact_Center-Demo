import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CampaignJobStatus,
  CampaignStatus,
  CampaignType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.outboundCampaign.findMany({
      include: {
        _count: { select: { jobs: true } },
        jobs: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async get(id: string) {
    const c = await this.prisma.outboundCampaign.findUnique({
      where: { id },
      include: {
        jobs: {
          include: { patient: true, appointment: { include: { slot: true, doctor: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Campaña no encontrada');
    return c;
  }

  async createReminderCampaign(hoursAhead = 24) {
    const from = new Date();
    const to = new Date(Date.now() + hoursAhead * 3600_000);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['RESERVED', 'CONFIRMED', 'RESCHEDULED'] },
        slot: { startsAt: { gte: from, lte: to } },
      },
      include: { patient: true, slot: true },
    });

    return this.prisma.outboundCampaign.create({
      data: {
        name: `Recordatorio ${hoursAhead}h — ${from.toISOString().slice(0, 10)}`,
        type: CampaignType.REMINDER,
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
      include: { jobs: true },
    });
  }

  async createConfirmationCampaign(appointmentIds: string[]) {
    const appointments = await this.prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      include: { patient: true },
    });
    return this.prisma.outboundCampaign.create({
      data: {
        name: `Confirmación — ${new Date().toISOString().slice(0, 10)}`,
        type: CampaignType.CONFIRMATION,
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
      include: { jobs: true },
    });
  }

  async updateJobStatus(jobId: string, status: CampaignJobStatus, notes?: string) {
    return this.prisma.outboundCampaignJob.update({
      where: { id: jobId },
      data: {
        status,
        resultNotes: notes,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }

  async markRunning(id: string) {
    return this.prisma.outboundCampaign.update({
      where: { id },
      data: { status: CampaignStatus.RUNNING, startedAt: new Date() },
    });
  }

  async markCompleted(id: string) {
    return this.prisma.outboundCampaign.update({
      where: { id },
      data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
    });
  }
}
