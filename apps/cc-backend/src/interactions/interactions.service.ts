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

    return this.prisma.interaction.findMany({
      where,
      include: {
        events: {
          orderBy: { ts: 'asc' },
          take: 10,
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
        callDetail: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string) {
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
    const where = data.providerConversationId
      ? {
          provider: data.provider as any,
          providerConversationId: data.providerConversationId,
        }
      : {
          provider: data.provider as any,
          from: data.from,
          to: data.to,
          channel: data.channel,
        };

    return this.prisma.interaction.upsert({
      where: where as any,
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
