import {
  Controller,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { BuilderBotAdapter } from '../adapters/builderbot.adapter';
import { Channel, Direction, InteractionStatus, Provider } from '@prisma/client';

interface BuilderBotWebhook {
  eventName: string;
  data: {
    body?: string;
    name?: string;
    from: string;
    attachment?: any[];
    urlTempFile?: string;
    projectId?: string;
  };
}

@ApiTags('Webhooks')
@Controller('webhooks/builderbot')
export class BuilderBotWebhookController {
  private readonly logger = new Logger(BuilderBotWebhookController.name);
  private builderBotAdapter: BuilderBotAdapter;

  constructor(
    private interactionsService: InteractionsService,
    private auditService: AuditService,
  ) {
    this.builderBotAdapter = new BuilderBotAdapter();
  }

  @Post('whatsapp')
  @ApiOperation({ summary: 'Webhook para mensajes entrantes de BuilderBot' })
  async handleWhatsAppWebhook(
    @Body() payload: BuilderBotWebhook,
  ) {
    try {
      this.logger.log(
        `📩 Webhook recibido de BuilderBot: ${JSON.stringify(payload)}`,
      );

      const { eventName, data } = payload;

      // Solo procesar mensajes entrantes
      if (eventName !== 'message.incoming') {
        this.logger.log(`ℹ️ Evento ignorado: ${eventName}`);
        return { ok: true, message: `Evento ${eventName} recibido pero no procesado` };
      }

      this.logger.log(`✅ Procesando mensaje entrante de ${data.from}`);
      
      const messageText = data.body || '';
      const customerPhone = data.from;
      const customerName = data.name;
      const attachments = data.attachment || [];
      const urlTempFile = data.urlTempFile;

      if (!messageText && attachments.length === 0 && !urlTempFile) {
        this.logger.warn('⚠️ Mensaje sin contenido, ignorado');
        return { ok: true, message: 'Mensaje vacío ignorado' };
      }

      // Generar messageId único (idempotencia)
      const messageId = `${customerPhone}-${Date.now()}`;
      const idempotencyKey = `builderbot-${messageId}`;

      this.logger.log(`🔑 idempotencyKey: ${idempotencyKey}`);

      // Verificar idempotencia
      const existingEvent = await this.interactionsService['prisma'].interactionEvent.findUnique({
        where: { idempotencyKey },
      });

      if (existingEvent) {
        this.logger.log('ℹ️ Mensaje duplicado (idempotencia), ignorando');
        return {
          ok: true,
          interactionId: existingEvent.interactionId,
          idempotent: true,
        };
      }

      // Buscar o crear interacción
      // Usar el customerPhone como providerConversationId para agrupar mensajes del mismo número
      const providerConversationId = customerPhone;

      this.logger.log(`💾 Creando/actualizando interacción para ${customerPhone}`);

      const interaction = await this.interactionsService.upsertInteraction({
        channel: Channel.WHATSAPP,
        direction: Direction.INBOUND,
        provider: Provider.BUILDERBOT,
        providerConversationId,
        from: customerPhone,
        to: 'system', // El número del negocio (podría venir en process.env)
        status: InteractionStatus.IN_PROGRESS,
        customerRef: customerName,
      });

      this.logger.log(`✅ Interaction creada/actualizada: ${interaction.id}`);

      // Crear mensaje entrante
      const hasAttachments = attachments.length > 0 || !!urlTempFile;
      await this.interactionsService.createMessage({
        interactionId: interaction.id,
        channel: Channel.WHATSAPP,
        direction: Direction.INBOUND,
        providerMessageId: messageId,
        text: messageText || (hasAttachments ? '[Archivo adjunto]' : null),
        mediaUrl: urlTempFile || (attachments[0]?.url),
        sentAt: new Date(),
      });

      this.logger.log(`💬 Mensaje guardado en Interaction ${interaction.id}`);

      // Crear evento
      await this.interactionsService.createEvent({
        interactionId: interaction.id,
        type: 'message.incoming',
        provider: Provider.BUILDERBOT,
        idempotencyKey,
        payload: payload as any,
      });

      // Audit log
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'wa.message.received',
        entityType: 'Interaction',
        entityId: interaction.id,
        metadata: {
          from: customerPhone,
          customerName,
          hasAttachments,
          messageLength: messageText.length,
        },
      });

      this.logger.log(
        `✅ Mensaje procesado completamente: Interaction ${interaction.id}, Customer: ${customerName || customerPhone}`,
      );

      return {
        ok: true,
        interactionId: interaction.id,
        messageId,
      };
    } catch (error) {
      this.logger.error(`❌ Error procesando webhook de BuilderBot:`, error.stack || error);
      throw error;
    }
  }
}
