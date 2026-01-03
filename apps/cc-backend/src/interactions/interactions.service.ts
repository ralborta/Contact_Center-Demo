import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Channel, Direction, InteractionStatus } from '@prisma/client';

@Injectable()
export class InteractionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    channel?: Channel;
    direction?: Direction;
    status?: InteractionStatus;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
    agent?: string;
    provider?: string;
    limit?: number;
    skip?: number;
    includeAllEvents?: boolean;
    includeAllMessages?: boolean;
  }) {
    const where: any = {};

    if (filters.channel) where.channel = filters.channel;
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.from) where.from = { contains: filters.from };
    if (filters.to) where.to = { contains: filters.to };
    if (filters.agent) where.assignedAgent = filters.agent;
    if (filters.provider) where.provider = filters.provider;

    if (filters.dateFrom || filters.dateTo) {
      where.startedAt = {};
      if (filters.dateFrom) where.startedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startedAt.lte = new Date(filters.dateTo);
    }

    const limit = filters.limit || 100;
    const skip = filters.skip || 0;

    return this.prisma.interaction.findMany({
      where,
      include: {
        events: {
          orderBy: { ts: 'asc' },
          ...(filters.includeAllEvents ? {} : { take: 10 }),
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          ...(filters.includeAllMessages ? {} : { take: 10 }),
        },
        callDetail: true,
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: skip,
    });
  }

  async count(filters: {
    channel?: Channel;
    direction?: Direction;
    status?: InteractionStatus;
    from?: string;
    to?: string;
    dateFrom?: string;
    dateTo?: string;
    agent?: string;
    provider?: string;
  }) {
    const where: any = {};

    if (filters.channel) where.channel = filters.channel;
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.from) where.from = { contains: filters.from };
    if (filters.to) where.to = { contains: filters.to };
    if (filters.agent) where.assignedAgent = filters.agent;
    if (filters.provider) where.provider = filters.provider;

    if (filters.dateFrom || filters.dateTo) {
      where.startedAt = {};
      if (filters.dateFrom) where.startedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startedAt.lte = new Date(filters.dateTo);
    }

    return this.prisma.interaction.count({ where });
  }

  async findOne(id: string, includeAllEvents: boolean = true, includeAllMessages: boolean = true) {
    return this.prisma.interaction.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { ts: 'asc' },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        callDetail: true,
        otpChallenges: true,
      },
    });
  }

  /**
   * Obtener o actualizar detalles completos de una llamada desde ElevenLabs
   */
  async refreshCallDetails(interactionId: string, conversationId: string) {
    const { ElevenLabsAdapter } = await import('../adapters/elevenlabs.adapter');
    const adapter = new ElevenLabsAdapter();

    try {
      const callDetails = await adapter.syncConversation(conversationId);

      // Actualizar CallDetail
      await this.upsertCallDetail({
        interactionId,
        elevenCallId: conversationId,
        recordingUrl: callDetails.recordingUrl,
        transcriptText: callDetails.transcriptText,
        summary: callDetails.summary,
        durationSec: callDetails.durationSec,
      });

      // Actualizar Interaction si hay datos adicionales
      const updateData: any = {};
      if (callDetails.agentName || callDetails.agentId) {
        updateData.assignedAgent = callDetails.agentName || callDetails.agentId;
      }
      if (callDetails.customerRef) {
        updateData.customerRef = callDetails.customerRef;
      }
      if (callDetails.queue) {
        updateData.queue = callDetails.queue;
      }
      if (callDetails.status) {
        updateData.status = callDetails.status as any;
      }
      if (callDetails.startedAt) {
        updateData.startedAt = callDetails.startedAt;
      }
      if (callDetails.endedAt) {
        updateData.endedAt = callDetails.endedAt;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.interaction.update({
          where: { id: interactionId },
          data: updateData,
        });
      }

      return callDetails;
    } catch (error: any) {
      console.error(`Error refreshing call details for ${conversationId}:`, error);
      throw error;
    }
  }

  async upsertInteraction(data: {
    channel: Channel;
    direction: Direction;
    provider: string;
    providerConversationId?: string;
    from: string;
    to: string;
    status?: InteractionStatus;
    startedAt?: Date;
    endedAt?: Date;
    assignedAgent?: string;
    intent?: string;
    outcome?: string;
    customerRef?: string;
    queue?: string;
  }) {
    // Si no hay providerConversationId, usar findFirst + create en lugar de upsert
    if (!data.providerConversationId) {
      // Buscar interacción existente por otros campos
      const existing = await this.prisma.interaction.findFirst({
        where: {
          provider: data.provider as any,
          from: data.from,
          to: data.to,
          channel: data.channel,
          startedAt: data.startedAt,
        },
      });

      if (existing) {
        // Actualizar existente
        return this.prisma.interaction.update({
          where: { id: existing.id },
          data: {
            status: data.status,
            startedAt: data.startedAt,
            endedAt: data.endedAt,
            assignedAgent: data.assignedAgent,
            intent: data.intent,
            outcome: data.outcome as any,
            customerRef: data.customerRef,
            queue: data.queue,
            updatedAt: new Date(),
          },
        });
      } else {
        // Crear nuevo
        return this.prisma.interaction.create({
          data: {
            channel: data.channel,
            direction: data.direction,
            provider: data.provider as any,
            providerConversationId: data.providerConversationId,
            from: data.from,
            to: data.to,
            status: data.status || InteractionStatus.NEW,
            startedAt: data.startedAt || new Date(),
            endedAt: data.endedAt,
            assignedAgent: data.assignedAgent,
            intent: data.intent,
            outcome: data.outcome as any,
            customerRef: data.customerRef,
            queue: data.queue,
          },
        });
      }
    }

    // Si hay providerConversationId, usar upsert con el índice único
    return this.prisma.interaction.upsert({
      where: {
        provider_providerConversationId: {
          provider: data.provider as any,
          providerConversationId: data.providerConversationId!,
        },
      },
      update: {
        status: data.status,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        assignedAgent: data.assignedAgent,
        intent: data.intent,
        outcome: data.outcome as any,
        customerRef: data.customerRef,
        queue: data.queue,
        updatedAt: new Date(),
      },
      create: {
        channel: data.channel,
        direction: data.direction,
        provider: data.provider as any,
        providerConversationId: data.providerConversationId,
        from: data.from,
        to: data.to,
        status: data.status || InteractionStatus.NEW,
        startedAt: data.startedAt || new Date(),
        endedAt: data.endedAt,
        assignedAgent: data.assignedAgent,
        intent: data.intent,
        outcome: data.outcome as any,
        customerRef: data.customerRef,
        queue: data.queue,
      },
    });
  }

  async createEvent(data: {
    interactionId: string;
    type: string;
    provider: string;
    providerEventId?: string;
    idempotencyKey?: string;
    payload: any;
    ts?: Date;
  }) {
    return this.prisma.interactionEvent.create({
      data: {
        interactionId: data.interactionId,
        type: data.type,
        provider: data.provider as any,
        providerEventId: data.providerEventId,
        idempotencyKey: data.idempotencyKey,
        payload: data.payload,
        ts: data.ts || new Date(),
      },
    });
  }

  async createMessage(data: {
    interactionId: string;
    channel: Channel;
    direction: Direction;
    providerMessageId?: string;
    text?: string;
    mediaUrl?: string;
    providerStatus?: string;
    sentAt?: Date;
    deliveredAt?: Date;
  }) {
    return this.prisma.message.create({
      data: {
        interactionId: data.interactionId,
        channel: data.channel,
        direction: data.direction,
        providerMessageId: data.providerMessageId,
        text: data.text,
        mediaUrl: data.mediaUrl,
        providerStatus: data.providerStatus,
        sentAt: data.sentAt,
        deliveredAt: data.deliveredAt,
      },
    });
  }

  async upsertCallDetail(data: {
    interactionId: string;
    elevenCallId?: string;
    recordingUrl?: string;
    transcriptText?: string;
    transcriptId?: string;
    summary?: string;
    durationSec?: number;
    hangupReason?: string;
  }) {
    return this.prisma.callDetail.upsert({
      where: { interactionId: data.interactionId },
      update: {
        elevenCallId: data.elevenCallId,
        recordingUrl: data.recordingUrl,
        transcriptText: data.transcriptText,
        transcriptId: data.transcriptId,
        summary: data.summary,
        durationSec: data.durationSec,
        hangupReason: data.hangupReason,
      },
      create: {
        interactionId: data.interactionId,
        elevenCallId: data.elevenCallId,
        recordingUrl: data.recordingUrl,
        transcriptText: data.transcriptText,
        transcriptId: data.transcriptId,
        summary: data.summary,
        durationSec: data.durationSec,
        hangupReason: data.hangupReason,
      },
    });
  }
}
