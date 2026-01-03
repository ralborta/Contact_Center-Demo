import {
  Controller,
  Post,
  Body,
  Logger,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { BuilderBotAdapter } from '../adapters/builderbot.adapter';
import { Channel, Direction, InteractionStatus, Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
    private prisma: PrismaService,
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
      this.logger.log(`🔍 Evento recibido: ${eventName}`);
      
      if (eventName !== 'message.incoming' && eventName !== 'message.outgoing') {
        this.logger.log(`ℹ️ Evento ignorado: ${eventName} (solo procesamos message.incoming y message.outgoing)`);
        return { ok: true, message: `Evento ${eventName} recibido pero no procesado` };
      }
      
      // Log importante: si es message.outgoing, es un mensaje del bot automático
      if (eventName === 'message.outgoing') {
        this.logger.log(`🤖 IMPORTANTE: Mensaje saliente del BOT AUTOMÁTICO detectado!`);
      }

      const isInbound = eventName === 'message.incoming';
      const direction = isInbound ? Direction.INBOUND : Direction.OUTBOUND;

      this.logger.log(`═══════════════════════════════════════════════════════`);
      this.logger.log(`📩 WEBHOOK BUILDERBOT: ${isInbound ? 'MENSAJE ENTRANTE (cliente)' : 'MENSAJE SALIENTE (bot automático)'}`);
      this.logger.log(`═══════════════════════════════════════════════════════`);
      this.logger.log(`EventName: ${eventName}`);
      this.logger.log(`Data completa: ${JSON.stringify(data, null, 2)}`);
      
      const messageText = data.body || '';
      
      // Para mensajes entrantes: el cliente envía (from = cliente)
      // Para mensajes salientes: el bot/agente envía (to = cliente, o puede venir en remoteJid)
      let customerPhone: string;
      
      if (isInbound) {
        // Mensaje entrante: el cliente envía
        customerPhone = data.from || data.remoteJid?.split('@')[0] || data.phone || 'unknown';
      } else {
        // Mensaje saliente del bot: el destinatario es el cliente
        // Puede venir en 'to', 'remoteJid', o necesitamos extraerlo del jid
        customerPhone = data.to || 
                       data.remoteJid?.split('@')[0] || 
                       data.phone || 
                       (data.remoteJid ? data.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '') : null) ||
                       'unknown';
        
        // Si no encontramos el número, intentar extraer del remoteJid completo
        if (customerPhone === 'unknown' && data.remoteJid) {
          const jidParts = data.remoteJid.split('@');
          if (jidParts.length > 0) {
            customerPhone = jidParts[0];
          }
        }
      }
      
      this.logger.log(`📞 Número extraído: ${customerPhone} (${isInbound ? 'INBOUND - del cliente' : 'OUTBOUND - del bot automático'})`);
      this.logger.log(`📋 Campos disponibles: from=${data.from}, to=${data.to}, remoteJid=${data.remoteJid}, phone=${data.phone}`);
      
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
      
      this.logger.log(`💾 Guardando mensaje: direction=${direction}, interactionId=${interaction.id}, text="${messageText.substring(0, 50)}..."`);
      
      const savedMessage = await this.interactionsService.createMessage({
        interactionId: interaction.id,
        channel: Channel.WHATSAPP,
        direction: direction,
        providerMessageId: messageId,
        text: messageText || (hasAttachments ? '[Archivo adjunto]' : null),
        mediaUrl: urlTempFile || (attachments[0]?.url),
        sentAt: new Date(),
      });

      this.logger.log(`✅ Mensaje ${isInbound ? 'INBOUND' : 'OUTBOUND'} guardado: MessageId=${savedMessage.id}, InteractionId=${interaction.id}`);
      this.logger.log(`📝 Detalles completos: direction=${savedMessage.direction}, text="${savedMessage.text?.substring(0, 50)}...", createdAt=${savedMessage.createdAt}`);

      // Crear evento con el tipo correcto
      const eventType = isInbound ? 'message.incoming' : 'message.outgoing';
      await this.interactionsService.createEvent({
        interactionId: interaction.id,
        type: eventType,
        provider: Provider.BUILDERBOT,
        idempotencyKey,
        payload: payload as any,
      });
      
      this.logger.log(`📌 Evento creado: type=${eventType}`);

      // Audit log
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: isInbound ? 'wa.message.received' : 'wa.message.sent',
        entityType: 'Interaction',
        entityId: interaction.id,
        metadata: {
          from: customerPhone,
          customerName,
          hasAttachments,
          messageLength: messageText.length,
          direction: isInbound ? 'INBOUND' : 'OUTBOUND',
          isBotMessage: !isInbound,
        },
      });

      // Verificar que el mensaje se guardó correctamente
      const messageCount = await this.interactionsService['prisma'].message.count({
        where: { interactionId: interaction.id },
      });
      
      const inboundCount = await this.interactionsService['prisma'].message.count({
        where: { 
          interactionId: interaction.id,
          direction: Direction.INBOUND,
        },
      });
      
      const outboundCount = await this.interactionsService['prisma'].message.count({
        where: { 
          interactionId: interaction.id,
          direction: Direction.OUTBOUND,
        },
      });

      this.logger.log(
        `✅ Mensaje ${isInbound ? 'INBOUND' : 'OUTBOUND'} procesado completamente: Interaction ${interaction.id}, Customer: ${customerName || customerPhone}`,
      );
      this.logger.log(`📊 Estado final: Total=${messageCount}, INBOUND=${inboundCount}, OUTBOUND=${outboundCount}`);
      this.logger.log(`═══════════════════════════════════════════════════════`);

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

  @Get('diagnostic')
  @ApiOperation({ summary: 'Diagnóstico: Verificar mensajes OUTBOUND del bot' })
  async diagnostic(@Query('phone') phone?: string) {
    this.logger.log(`🔬 Ejecutando diagnóstico para mensajes OUTBOUND del bot`);
    
    try {
      // Buscar todas las interacciones de WhatsApp
      const interactions = await this.prisma.interaction.findMany({
        where: {
          channel: Channel.WHATSAPP,
          provider: Provider.BUILDERBOT,
          ...(phone ? {
            OR: [
              { providerConversationId: { contains: phone } },
              { from: { contains: phone } },
              { to: { contains: phone } },
            ],
          } : {}),
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const results = interactions.map(interaction => {
        const totalMessages = interaction.messages.length;
        const inboundMessages = interaction.messages.filter(m => m.direction === 'INBOUND');
        const outboundMessages = interaction.messages.filter(m => m.direction === 'OUTBOUND');

        return {
          interactionId: interaction.id,
          providerConversationId: interaction.providerConversationId,
          from: interaction.from,
          to: interaction.to,
          createdAt: interaction.createdAt,
          totalMessages,
          inboundCount: inboundMessages.length,
          outboundCount: outboundMessages.length,
          messages: interaction.messages.map(m => ({
            id: m.id,
            direction: m.direction,
            text: m.text?.substring(0, 50) + (m.text && m.text.length > 50 ? '...' : ''),
            sentAt: m.sentAt,
            createdAt: m.createdAt,
          })),
        };
      });

      // Estadísticas generales
      const allOutbound = await this.prisma.message.count({
        where: {
          direction: Direction.OUTBOUND,
          interaction: {
            channel: Channel.WHATSAPP,
            provider: Provider.BUILDERBOT,
          },
        },
      });

      const allInbound = await this.prisma.message.count({
        where: {
          direction: Direction.INBOUND,
          interaction: {
            channel: Channel.WHATSAPP,
            provider: Provider.BUILDERBOT,
          },
        },
      });

      return {
        summary: {
          totalOutboundMessages: allOutbound,
          totalInboundMessages: allInbound,
          totalInteractions: interactions.length,
        },
        interactions: results,
        message: phone 
          ? `Diagnóstico para número: ${phone}` 
          : 'Diagnóstico general - últimas 10 interacciones',
      };
    } catch (error) {
      this.logger.error(`❌ Error en diagnóstico:`, error);
      throw error;
    }
  }

  @Post('test-outgoing')
  @ApiOperation({ summary: 'TEST: Simular webhook de message.outgoing del bot' })
  async testOutgoing(
    @Body() body: { phone: string; message: string },
  ) {
    this.logger.log(`🧪 TEST: Simulando webhook message.outgoing para ${body.phone}`);
    
    const testPayload: BuilderBotWebhook = {
      eventName: 'message.outgoing',
      data: {
        body: body.message,
        to: body.phone,
        remoteJid: `${body.phone.replace('+', '')}@s.whatsapp.net`,
        phone: body.phone,
      },
    };

    return this.handleWhatsAppWebhook(testPayload);
  }
}
