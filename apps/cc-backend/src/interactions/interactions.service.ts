import { Injectable, NotFoundException } from '@nestjs/common';
import { Direction, InteractionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InteractionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    direction?: Direction;
    status?: InteractionStatus;
    from?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    skip?: number;
  }) {
    const where: Prisma.InteractionWhereInput = {};
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.from) where.from = { contains: filters.from };
    if (filters.dateFrom || filters.dateTo) {
      where.startedAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }
    return this.prisma.interaction.findMany({
      where,
      include: {
        callDetail: true,
        patient: true,
        appointment: {
          include: { doctor: true, specialty: true, slot: true },
        },
        events: { orderBy: { ts: 'asc' }, take: 20 },
      },
      orderBy: { updatedAt: 'desc' },
      take: filters.limit || 100,
      skip: filters.skip || 0,
    });
  }

  async count(filters: {
    direction?: Direction;
    status?: InteractionStatus;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.InteractionWhereInput = {};
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.startedAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }
    return this.prisma.interaction.count({ where });
  }

  async findOne(id: string) {
    const item = await this.prisma.interaction.findUnique({
      where: { id },
      include: {
        callDetail: true,
        patient: true,
        appointment: {
          include: { doctor: true, specialty: true, slot: true, patient: true },
        },
        events: { orderBy: { ts: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('Llamada no encontrada');
    return item;
  }

  async delete(id: string) {
    await this.prisma.interaction.delete({ where: { id } });
    return { ok: true };
  }

  async getMetrics() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [today, inProgress, completed, abandoned] = await Promise.all([
      this.prisma.interaction.count({ where: { startedAt: { gte: startOfDay } } }),
      this.prisma.interaction.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.interaction.count({
        where: { startedAt: { gte: startOfDay }, status: 'COMPLETED' },
      }),
      this.prisma.interaction.count({
        where: { startedAt: { gte: startOfDay }, status: 'ABANDONED' },
      }),
    ]);
    return { today, inProgress, completed, abandoned };
  }
}
