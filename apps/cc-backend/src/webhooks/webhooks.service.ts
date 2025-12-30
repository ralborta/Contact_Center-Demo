import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Channel, Direction, InteractionStatus, Provider } from '@prisma/client';
import * as crypto from 'crypto';
import { ElevenLabsAdapter } from '../../../packages/adapters/src/elevenlabs.adapter';
import { BuilderBotAdapter } from '../../../packages/adapters/src/builderbot.adapter';
import { TwilioAdapter } from '../../../packages/adapters/src/twilio.adapter';

@Injectable()
export class WebhooksService {
  private elevenLabsAdapter: ElevenLabsAdapter;
  private builderBotAdapter: BuilderBotAdapter;
  private twilioAdapter: TwilioAdapter;

  constructor(
    private interactionsService: InteractionsService,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {
    this.elevenLabsAdapter = new ElevenLabsAdapter();
    this.builderBotAdapter = new BuilderBotAdapter();
    this.twilioAdapter = new TwilioAdapter();
  }

  async handleElevenLabs(payload: any, token: string) {
    // Validar token
    if (!this.elevenLabsAdapter.verifyToken(token)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    // Normalizar payload
    const normalized = this.elevenLabsAdapter.normalizePayload(payload);

    // Generar idempotency key
    const idempotencyKey = `elevenlabs:${normalized.eventId || crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;

    // Verificar si ya existe el evento
    const existingEvent = await this.prisma.interactionEvent.findUnique({
      where: { idempotencyKey },
    });

    if (existingEvent) {
      return { message: 'Event already processed', id: existingEvent.id };
    }

    // Upsert Interaction
    const interaction = await this.interactionsService.upsertInteraction({
      channel: Channel.CALL,
      direction: Direction.INBOUND,
      provider: Provider.ELEVENLABS,
      providerConversationId: normalized.callId || normalized.sessionId,
      from: normalized.from || 'unknown',
      to: normalized.to || 'unknown',
      status: normalized.status,
      startedAt: normalized.startedAt,
      endedAt: normalized.endedAt,
      assignedAgent: normalized.assignedAgent,
      intent: normalized.intent,
      outcome: normalized.outcome,
    });

    // Crear evento
    await this.interactionsService.createEvent({
      interactionId: interaction.id,
      type: normalized.eventType || 'call.event',
      provider: Provider.ELEVENLABS,
      providerEventId: normalized.eventId,
      idempotencyKey,
      payload: { raw: payload, normalized },
    });

    // Actualizar CallDetail si hay información
    if (normalized.recordingUrl || normalized.transcriptText || normalized.durationSec) {
      await this.interactionsService.upsertCallDetail({
        interactionId: interaction.id,
        elevenCallId: normalized.callId,
        recordingUrl: normalized.recordingUrl,
        transcriptText: normalized.transcriptText,
        transcriptId: normalized.transcriptId,
        durationSec: normalized.durationSec,
        hangupReason: normalized.hangupReason,
      });
    }

    // Audit log
    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'webhook.elevenlabs',
      entityType: 'Interaction',
      entityId: interaction.id,
      metadata: { eventType: normalized.eventType },
    });

    return { success: true, interactionId: interaction.id };
  }

  async handleBuilderBot(payload: any, token: string) {
    // Validar token
    if (!this.builderBotAdapter.verifyToken(token)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    // Normalizar payload
    const normalized = this.builderBotAdapter.normalizePayload(payload);

    // Upsert Interaction
    const interaction = await this.interactionsService.upsertInteraction({
      channel: Channel.WHATSAPP,
      direction: Direction.INBOUND,
      provider: Provider.BUILDERBOT,
      providerConversationId: normalized.threadId || normalized.conversationId,
      from: normalized.from,
      to: normalized.to,
      status: InteractionStatus.IN_PROGRESS,
      startedAt: normalized.timestamp || new Date(),
    });

    // Crear Message
    await this.interactionsService.createMessage({
      interactionId: interaction.id,
      channel: Channel.WHATSAPP,
      direction: Direction.INBOUND,
      providerMessageId: normalized.messageId,
      text: normalized.text,
      mediaUrl: normalized.mediaUrl,
      sentAt: normalized.timestamp,
    });

    // Crear evento
    await this.interactionsService.createEvent({
      interactionId: interaction.id,
      type: 'wa.message.in',
      provider: Provider.BUILDERBOT,
      providerEventId: normalized.messageId,
      payload: { raw: payload, normalized },
    });

    // Audit log
    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'webhook.builderbot',
      entityType: 'Interaction',
      entityId: interaction.id,
      metadata: { messageId: normalized.messageId },
    });

    return { success: true, interactionId: interaction.id };
  }

  async handleTwilioStatus(payload: any, token: string) {
    // Validar token (opcional, Twilio también puede usar firma)
    if (token && !this.twilioAdapter.verifyToken(token)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    // Normalizar payload
    const normalized = this.twilioAdapter.normalizeStatusPayload(payload);

    // Buscar Message por providerMessageId
    const message = await this.prisma.message.findFirst({
      where: { providerMessageId: normalized.messageSid },
      include: { interaction: true },
    });

    if (message) {
      // Actualizar Message
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          providerStatus: normalized.status,
          deliveredAt: normalized.status === 'delivered' ? new Date() : null,
          readAt: normalized.status === 'read' ? new Date() : null,
        },
      });

      // Crear evento
      await this.interactionsService.createEvent({
        interactionId: message.interactionId,
        type: 'sms.status',
        provider: Provider.TWILIO,
        providerEventId: normalized.messageSid,
        payload: { raw: payload, normalized },
      });

      // Actualizar Interaction si es necesario
      if (normalized.status === 'delivered' || normalized.status === 'failed') {
        await this.prisma.interaction.update({
          where: { id: message.interactionId },
          data: {
            status: normalized.status === 'delivered' ? InteractionStatus.COMPLETED : InteractionStatus.FAILED,
            endedAt: new Date(),
          },
        });
      }
    }

    // Audit log
    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'webhook.twilio.status',
      entityType: 'Message',
      entityId: message?.id || 'unknown',
      metadata: { status: normalized.status, messageSid: normalized.messageSid },
    });

    return { success: true };
  }
}
