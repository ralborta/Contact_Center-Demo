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
    from?: string;
    remoteJid?: string;
    phone?: string;
    attachment?: any[];
    urlTempFile?: string;
    projectId?: string;
    [key: string]: any; // Permitir campos adicionales
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

      // Procesar mensajes entrantes (del cliente) y salientes (del bot/agente)
      if (eventName !== 'message.incoming' && eventName !== 'message.outgoing') {
        this.logger.log(`ℹ️ Evento ignorado: ${eventName}`);
        return { ok: true, message: `Evento ${eventName} recibido pero no procesado` };
      }

      const isInbound = eventName === 'message.incoming';
      const direction = isInbound ? Direction.INBOUND : Direction.OUTBOUND;

      this.logger.log(`✅ Procesando mensaje ${isInbound ? 'entrante' : 'saliente'}. Data recibida: ${JSON.stringify(data)}`);
      
      const messageText = data.body || '';
      
      // Para mensajes entrantes: el cliente envía (from = cliente)
      // Para mensajes salientes: el bot/agente envía (to = cliente)
      const customerPhone = isInbound 
        ? (data.from || data.remoteJid?.split('@')[0] || data.phone || 'unknown')
        : (data.to || data.remoteJid?.split('@')[0] || data.phone || 'unknown');
      
      const customerName = data.name;
      const attachments = data.attachment || [];
      const urlTempFile = data.urlTempFile;

      // Validar que tenemos un número de teléfono válido
      if (!customerPhone || customerPhone === 'unknown') {
        this.logger.error(`❌ No se pudo extraer número de teléfono del payload: ${JSON.stringify(data)}`);
        return { ok: false, error: 'Número de teléfono no encontrado en el payload' };
      }

      if (!messageText && attachments.length === 0 && !urlTempFile) {
        this.logger.warn('⚠️ Mensaje sin contenido, ignorado');
        return { ok: true, message: 'Mensaje vacío ignorado' };
      }

      this.logger.log(`📞 Teléfono extraído: ${customerPhone} (${isInbound ? 'INBOUND' : 'OUTBOUND'})`);

      // Generar messageId único (idempotencia)
      const messageId = data.id || `${customerPhone}-${Date.now()}-${isInbound ? 'in' : 'out'}`;
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

      // Normalizar el número de teléfono para que coincida con el formato usado en los mensajes salientes
      const normalizePhoneNumber = (phone: string): string => {
        let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
        if (!normalized.startsWith('+')) {
          if (normalized.startsWith('54')) {
            normalized = '+' + normalized;
          } else {
            normalized = '+54' + normalized;
          }
        }
        return normalized;
      };

      // Buscar o crear interacción
      // Usar el customerPhone normalizado como providerConversationId para agrupar mensajes del mismo número
      const providerConversationId = normalizePhoneNumber(customerPhone);

      this.logger.log(`💾 Creando/actualizando interacción para ${customerPhone} (normalized: ${providerConversationId})`);
      this.logger.log(`📋 Datos para upsert: from=${isInbound ? providerConversationId : 'system'}, to=${isInbound ? 'system' : providerConversationId}, providerConversationId=${providerConversationId}`);

      // Buscar interacción existente primero
      let interaction = await this.interactionsService['prisma'].interaction.findUnique({
        where: {
          provider_providerConversationId: {
            provider: Provider.BUILDERBOT,
            providerConversationId: providerConversationId,
          },
        },
      });

      // Si no se encuentra, intentar buscar por el número sin normalizar (para migrar datos existentes)
      if (!interaction) {
        interaction = await this.interactionsService['prisma'].interaction.findUnique({
          where: {
            provider_providerConversationId: {
              provider: Provider.BUILDERBOT,
              providerConversationId: customerPhone,
            },
          },
        });
        
        // Si se encuentra con el formato sin normalizar, actualizar para usar el formato normalizado
        if (interaction) {
          this.logger.log(`⚠️ Encontrada interacción con formato sin normalizar, actualizando providerConversationId`);
          interaction = await this.interactionsService['prisma'].interaction.update({
            where: { id: interaction.id },
            data: {
              providerConversationId: providerConversationId,
              from: isInbound ? providerConversationId : interaction.from,
              to: isInbound ? interaction.to : providerConversationId,
            },
          });
        }
      }

      // Si no existe, crear una nueva
      if (!interaction) {
        interaction = await this.interactionsService.upsertInteraction({
          channel: Channel.WHATSAPP,
          direction: isInbound ? Direction.INBOUND : Direction.OUTBOUND,
          provider: Provider.BUILDERBOT,
          providerConversationId: providerConversationId,
          from: isInbound ? providerConversationId : 'system',
          to: isInbound ? 'system' : providerConversationId,
          status: InteractionStatus.IN_PROGRESS,
          customerRef: customerName,
        });
      }

      this.logger.log(`✅ Interaction creada/actualizada: ${interaction.id}`);

      // Crear mensaje (entrante o saliente según corresponda)
      const hasAttachments = attachments.length > 0 || !!urlTempFile;
      await this.interactionsService.createMessage({
        interactionId: interaction.id,
        channel: Channel.WHATSAPP,
        direction: direction,
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
