import { Injectable, NotFoundException } from '@nestjs/common';
import { Direction, InteractionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isTestConversationId } from '../voice/transcript';
import { RecordingsService } from './recordings.service';

/** Filtro panel: oculta stubs de prueba / técnicos sin borrar de la DB. */
function panelVisibilityWhere(): Prisma.InteractionWhereInput {
  return {
    AND: [
      {
        NOT: {
          OR: [
            { providerConversationId: { startsWith: 'test-', mode: 'insensitive' } },
            { providerConversationId: { startsWith: 'test_', mode: 'insensitive' } },
            { providerConversationId: { startsWith: 'conv_test', mode: 'insensitive' } },
          ],
        },
      },
      // Stubs sin paciente ni teléfono real (from unknown/pending)
      {
        NOT: {
          AND: [
            { patientId: null },
            { OR: [{ from: 'unknown' }, { from: 'pending' }] },
          ],
        },
      },
    ],
  };
}

@Injectable()
export class InteractionsService {
  constructor(
    private prisma: PrismaService,
    private recordings: RecordingsService,
  ) {}

  async findAll(filters: {
    direction?: Direction;
    status?: InteractionStatus;
    from?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    skip?: number;
    /** Si true, incluye filas de prueba (default: ocultas en panel). */
    includeTests?: boolean;
  }) {
    const where: Prisma.InteractionWhereInput = {
      ...(filters.includeTests ? {} : panelVisibilityWhere()),
    };
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.from) where.from = { contains: filters.from };
    if (filters.dateFrom || filters.dateTo) {
      where.startedAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }
    const rows = await this.prisma.interaction.findMany({
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
    // Cinturón extra por si el prefijo no cubre algún id raro
    return rows.filter(
      (r) => filters.includeTests || !isTestConversationId(r.providerConversationId),
    );
  }

  async count(filters: {
    direction?: Direction;
    status?: InteractionStatus;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.InteractionWhereInput = {
      ...panelVisibilityWhere(),
    };
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

    // Si el audio ya está en disco, asegurar recordingUrl del panel
    const convId = item.callDetail?.externalCallId;
    if (convId && this.recordings.hasLocalFile(convId)) {
      const url = this.recordings.publicUrlFor(item.id);
      if (item.callDetail && item.callDetail.recordingUrl !== url) {
        await this.prisma.callDetail.update({
          where: { interactionId: item.id },
          data: { recordingUrl: url },
        });
        item.callDetail.recordingUrl = url;
      }
    }

    return item;
  }

  async delete(id: string) {
    await this.prisma.interaction.delete({ where: { id } });
    return { ok: true };
  }

  async getMetrics() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const visible = panelVisibilityWhere();
    const [today, inProgress, completed, abandoned] = await Promise.all([
      this.prisma.interaction.count({
        where: { AND: [visible, { startedAt: { gte: startOfDay } }] },
      }),
      this.prisma.interaction.count({
        where: { AND: [visible, { status: 'IN_PROGRESS' }] },
      }),
      this.prisma.interaction.count({
        where: {
          AND: [visible, { startedAt: { gte: startOfDay }, status: 'COMPLETED' }],
        },
      }),
      this.prisma.interaction.count({
        where: {
          AND: [visible, { startedAt: { gte: startOfDay }, status: 'ABANDONED' }],
        },
      }),
    ]);
    return { today, inProgress, completed, abandoned };
  }
}
