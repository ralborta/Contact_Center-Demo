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
      // Para mensajes salientes: el bot/agente envía
      // IMPORTANTE: En message.outgoing, el número del cliente puede estar en:
      // - data.from (el cliente es el destinatario)
      // - data.respMessage.key.remoteJid (dentro de la respuesta)
      // - data.to (menos común)
      let customerPhone: string;
      
      if (isInbound) {
        // Mensaje entrante: el cliente envía
        customerPhone = data.from || data.remoteJid?.split('@')[0] || data.phone || 'unknown';
      } else {
        // Mensaje saliente del bot: el destinatario es el cliente
        // IMPORTANTE: En BuilderBot, para message.outgoing, el número puede estar en:
        // 1. data.from (el cliente que recibe el mensaje)
        // 2. data.respMessage.key.remoteJid (dentro de la estructura de respuesta)
        // 3. data.to (menos común)
        // 4. data.remoteJid (nivel raíz, menos común)
        
        // Primero intentar desde respMessage.key.remoteJid (estructura anidada de BuilderBot)
        if (data.respMessage?.key?.remoteJid) {
          const remoteJid = data.respMessage.key.remoteJid;
          customerPhone = remoteJid.split('@')[0];
          this.logger.log(`📞 Número extraído desde respMessage.key.remoteJid: ${customerPhone}`);
        }
        
        // Si no se encontró, intentar desde from (para message.outgoing, from es el destinatario)
        if (!customerPhone || customerPhone === 'unknown') {
          customerPhone = data.from || 'unknown';
          if (customerPhone !== 'unknown') {
            this.logger.log(`📞 Número extraído desde from: ${customerPhone}`);
          }
        }
        
        // Si aún no se encontró, intentar desde to
        if (!customerPhone || customerPhone === 'unknown') {
          customerPhone = data.to || 'unknown';
          if (customerPhone !== 'unknown') {
            this.logger.log(`📞 Número extraído desde to: ${customerPhone}`);
          }
        }
        
        // Si aún no se encontró, intentar desde remoteJid (nivel raíz)
        if (!customerPhone || customerPhone === 'unknown') {
          if (data.remoteJid) {
            customerPhone = data.remoteJid.split('@')[0];
            this.logger.log(`📞 Número extraído desde remoteJid: ${customerPhone}`);
          }
        }
        
        // Si aún no se encontró, intentar desde phone
        if (!customerPhone || customerPhone === 'unknown') {
          customerPhone = data.phone || 'unknown';
          if (customerPhone !== 'unknown') {
            this.logger.log(`📞 Número extraído desde phone: ${customerPhone}`);
          }
        }
      }
      
      this.logger.log(`📞 Número extraído: ${customerPhone} (${isInbound ? 'INBOUND - del cliente' : 'OUTBOUND - del bot automático'})`);
      this.logger.log(`📋 Campos disponibles: from=${data.from}, to=${data.to}, remoteJid=${data.remoteJid}, phone=${data.phone}`);
      if (data.respMessage?.key?.remoteJid) {
        this.logger.log(`📋 respMessage.key.remoteJid=${data.respMessage.key.remoteJid}`);
      }
      
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
      // Usar el customerPhone normalizado como base para providerConversationId
      const basePhoneNumber = normalizePhoneNumber(customerPhone);
      
      // Tiempo máximo para considerar una interacción como "activa" (24 horas)
      const MAX_INACTIVE_HOURS = 24;
      const maxInactiveTime = new Date(Date.now() - MAX_INACTIVE_HOURS * 60 * 60 * 1000);

      this.logger.log(`💾 Buscando interacción para ${customerPhone} (normalized: ${basePhoneNumber})`);
      this.logger.log(`⏰ Tiempo máximo de inactividad: ${MAX_INACTIVE_HOURS} horas (antes de ${maxInactiveTime.toISOString()})`);

      let interaction;
      try {
        // Buscar la interacción más reciente para este número (no necesariamente la única)
        // Buscar todas las interacciones de WhatsApp para este número y encontrar la más reciente
        const recentInteractions = await this.interactionsService['prisma'].interaction.findMany({
        where: {
            provider: Provider.BUILDERBOT,
            channel: Channel.WHATSAPP,
            OR: [
              { providerConversationId: basePhoneNumber },
              { providerConversationId: customerPhone },
              { from: basePhoneNumber },
              { from: customerPhone },
              { to: basePhoneNumber },
              { to: customerPhone },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        });

        if (recentInteractions.length > 0) {
          interaction = recentInteractions[0];
          const lastUpdateTime = interaction.updatedAt || interaction.startedAt || interaction.createdAt;
          const isOld = new Date(lastUpdateTime) < maxInactiveTime;
          
          this.logger.log(`🔍 Interacción encontrada: ${interaction.id}`);
          this.logger.log(`📅 Última actualización: ${lastUpdateTime.toISOString()}`);
          this.logger.log(`⏰ ¿Es antigua? ${isOld ? 'SÍ (crear nueva)' : 'NO (usar existente)'}`);
          
          if (isOld) {
            this.logger.log(`📝 La interacción es muy antigua (${Math.round((Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60))} horas), creando nueva interacción`);
            interaction = null; // Forzar creación de nueva interacción
          } else {
            this.logger.log(`✅ Usando interacción existente (última actualización hace ${Math.round((Date.now() - lastUpdateTime.getTime()) / (1000 * 60))} minutos)`);
            // Actualizar el updatedAt para que aparezca primero en la lista
          interaction = await this.interactionsService['prisma'].interaction.update({
            where: { id: interaction.id },
            data: {
                updatedAt: new Date(),
            },
          });
        }
        } else {
          this.logger.log(`🔍 No se encontró interacción previa para este número`);
      }

        // Si no existe o es muy antigua, crear una nueva interacción
      if (!interaction) {
          // Generar un providerConversationId único para esta nueva sesión
          // Usar el número base + timestamp para crear una sesión única
          const sessionId = `${basePhoneNumber}-${Date.now()}`;
          
          this.logger.log(`📝 Creando nueva interacción (sesión nueva)...`);
          this.logger.log(`📋 Datos para crear interacción:`, {
            channel: Channel.WHATSAPP,
            direction: isInbound ? Direction.INBOUND : Direction.OUTBOUND,
            provider: Provider.BUILDERBOT,
            providerConversationId: sessionId,
            from: isInbound ? basePhoneNumber : 'system',
            to: isInbound ? 'system' : basePhoneNumber,
            status: InteractionStatus.IN_PROGRESS,
            customerRef: customerName,
          });
          
          try {
        interaction = await this.interactionsService.upsertInteraction({
          channel: Channel.WHATSAPP,
          direction: isInbound ? Direction.INBOUND : Direction.OUTBOUND,
          provider: Provider.BUILDERBOT,
              providerConversationId: sessionId, // Usar sessionId único en lugar del número base
              from: isInbound ? basePhoneNumber : 'system',
              to: isInbound ? 'system' : basePhoneNumber,
          status: InteractionStatus.IN_PROGRESS,
          customerRef: customerName,
        });
            this.logger.log(`✅ Nueva interacción creada: ${interaction.id} (sesión: ${sessionId})`);
            this.logger.log(`📋 Interacción creada con:`, {
              id: interaction.id,
              providerConversationId: interaction.providerConversationId,
              from: interaction.from,
              to: interaction.to,
              channel: interaction.channel,
              direction: interaction.direction,
            });
          } catch (upsertError: any) {
            this.logger.error(`❌ ERROR en upsertInteraction:`, upsertError);
            this.logger.error(`❌ Stack trace:`, upsertError.stack);
            throw upsertError;
          }
        } else {
          this.logger.log(`✅ Interacción existente encontrada: ${interaction.id}`);
          this.logger.log(`📋 Interacción existente:`, {
            id: interaction.id,
            providerConversationId: interaction.providerConversationId,
            from: interaction.from,
            to: interaction.to,
            channel: interaction.channel,
            direction: interaction.direction,
            lastUpdate: interaction.updatedAt,
          });
        }
      } catch (error: any) {
        this.logger.error(`❌ ERROR creando/actualizando interacción:`, error);
        this.logger.error(`❌ Stack trace:`, error.stack);
        this.logger.error(`❌ Datos que causaron el error:`, {
          basePhoneNumber,
          customerPhone,
          from: isInbound ? basePhoneNumber : 'system',
          to: isInbound ? 'system' : basePhoneNumber,
          channel: Channel.WHATSAPP,
        });
        throw error;
      }

      this.logger.log(`✅ Interaction creada/actualizada: ${interaction.id}`);

      // Crear mensaje (entrante o saliente según corresponda)
      const hasAttachments = attachments.length > 0 || !!urlTempFile;
      
      this.logger.log(`💾 Guardando mensaje: direction=${direction}, interactionId=${interaction.id}, text="${messageText.substring(0, 50)}..."`);
      
      let savedMessage;
      try {
        savedMessage = await this.interactionsService.createMessage({
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
      } catch (messageError: any) {
        this.logger.error(`❌ ERROR guardando mensaje:`, messageError);
        this.logger.error(`❌ Stack trace:`, messageError.stack);
        this.logger.error(`❌ Datos del mensaje:`, {
          interactionId: interaction.id,
          channel: Channel.WHATSAPP,
          direction: direction,
          providerMessageId: messageId,
          textLength: messageText.length,
        });
        throw messageError;
      }

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
      this.logger.log(`🔍 Verificando que el mensaje se guardó correctamente...`);
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

      // Verificar que el mensaje recién creado existe
      const verifyMessage = await this.interactionsService['prisma'].message.findFirst({
        where: {
          interactionId: interaction.id,
          providerMessageId: messageId,
        },
      });

      if (!verifyMessage) {
        this.logger.error(`❌ CRÍTICO: El mensaje NO se encontró en la base de datos después de crearlo!`);
        this.logger.error(`❌ MessageId buscado: ${messageId}`);
        this.logger.error(`❌ InteractionId: ${interaction.id}`);
      } else {
        this.logger.log(`✅ Verificación exitosa: Mensaje encontrado en DB con ID: ${verifyMessage.id}`);
      }

      this.logger.log(
        `✅ Mensaje ${isInbound ? 'INBOUND' : 'OUTBOUND'} procesado completamente: Interaction ${interaction.id}, Customer: ${customerName || customerPhone}`,
      );
      this.logger.log(`📊 Estado final: Total=${messageCount}, INBOUND=${inboundCount}, OUTBOUND=${outboundCount}`);
      this.logger.log(`═══════════════════════════════════════════════════════`);

      return {
        ok: true,
        interactionId: interaction.id,
        messageId: savedMessage.id,
        messageCount,
        inboundCount,
        outboundCount,
        verified: !!verifyMessage,
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
