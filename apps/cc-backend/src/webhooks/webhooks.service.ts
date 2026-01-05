import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InteractionsService } from '../interactions/interactions.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { Channel, Direction, InteractionStatus, Provider } from '@prisma/client';
import * as crypto from 'crypto';
import { ElevenLabsAdapter } from '../adapters/elevenlabs.adapter';
import { BuilderBotAdapter } from '../adapters/builderbot.adapter';
import { TwilioAdapter } from '../adapters/twilio.adapter';

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

    // Log del payload completo para debugging
    console.log(`[Webhook ElevenLabs] Payload recibido:`, JSON.stringify(payload, null, 2));

    // Normalizar payload
    const normalized = this.elevenLabsAdapter.normalizePayload(payload);
    const eventType = normalized.eventType || 'call.event';
    const conversationId = normalized.conversationId || normalized.callId || normalized.sessionId;

    console.log(`[Webhook ElevenLabs] Evento recibido: ${eventType}, ConversationId: ${conversationId}`);
    console.log(`[Webhook ElevenLabs] Payload normalizado:`, JSON.stringify(normalized, null, 2));
    
    // Validar que tenemos información mínima para crear la interacción
    if (!conversationId && (!normalized.from || normalized.from === 'unknown')) {
      console.error(`[Webhook ElevenLabs] ERROR: No se puede crear interacción sin conversationId o número de teléfono`);
      console.error(`[Webhook ElevenLabs] Payload original:`, JSON.stringify(payload, null, 2));
      throw new Error('Missing required fields: conversationId or from phone number');
    }

    // Generar idempotency key
    const idempotencyKey = `elevenlabs:${normalized.eventId || crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;

    // Verificar si ya existe el evento
    const existingEvent = await this.prisma.interactionEvent.findUnique({
      where: { idempotencyKey },
    });

    if (existingEvent) {
      console.log(`[Webhook ElevenLabs] Evento ya procesado: ${idempotencyKey}`);
      return { message: 'Event already processed', id: existingEvent.id };
    }

    // Upsert Interaction - respuesta rápida para tiempo real
    console.log(`[Webhook ElevenLabs] Creando/actualizando interacción con:`, {
      providerConversationId: conversationId,
      from: normalized.from,
      to: normalized.to,
      status: normalized.status,
      startedAt: normalized.startedAt,
    });

    let interaction;
    try {
      interaction = await this.interactionsService.upsertInteraction({
        channel: Channel.CALL,
        direction: Direction.INBOUND,
        provider: Provider.ELEVENLABS,
        providerConversationId: conversationId || undefined, // Convertir string vacío a undefined
        from: normalized.from || 'unknown',
        to: normalized.to || 'unknown',
        status: normalized.status,
        startedAt: normalized.startedAt,
        endedAt: normalized.endedAt,
        assignedAgent: normalized.assignedAgent || normalized.agentName || normalized.agentId,
        intent: normalized.intent,
        outcome: normalized.outcome,
        customerRef: normalized.customerRef,
        queue: normalized.queue,
      });

      console.log(`[Webhook ElevenLabs] ✅ Interaction ${interaction.id} creada/actualizada exitosamente`);
      console.log(`[Webhook ElevenLabs] Interaction details:`, {
        id: interaction.id,
        providerConversationId: interaction.providerConversationId,
        from: interaction.from,
        to: interaction.to,
        status: interaction.status,
        createdAt: interaction.createdAt,
      });
    } catch (error: any) {
      console.error(`[Webhook ElevenLabs] ❌ ERROR creando/actualizando interacción:`, error);
      console.error(`[Webhook ElevenLabs] Stack trace:`, error.stack);
      throw error;
    }

    // Crear evento
    await this.interactionsService.createEvent({
      interactionId: interaction.id,
      type: eventType,
      provider: Provider.ELEVENLABS,
      providerEventId: normalized.eventId,
      idempotencyKey,
      payload: { raw: payload, normalized },
    });

    // Actualizar CallDetail si hay información básica del webhook
    if (normalized.recordingUrl || normalized.transcriptText || normalized.summary || normalized.durationSec) {
      await this.interactionsService.upsertCallDetail({
        interactionId: interaction.id,
        elevenCallId: conversationId,
        recordingUrl: normalized.recordingUrl,
        transcriptText: normalized.transcriptText,
        transcriptId: normalized.transcriptId,
        summary: normalized.summary,
        durationSec: normalized.durationSec,
        hangupReason: normalized.hangupReason,
      });
    }

    // Procesar detalles completos de forma asíncrona para no bloquear la respuesta
    // Esto es crítico para tiempo real - respondemos rápido y luego obtenemos detalles
    if (conversationId) {
      // No esperamos esta promesa - se ejecuta en background
      this.fetchAndUpdateCallDetails(interaction.id, conversationId, normalized).catch((error) => {
        console.error(`[Webhook ElevenLabs] Error en procesamiento asíncrono para ${conversationId}:`, error);
      });
    }

    // Audit log (también asíncrono para no bloquear)
    this.auditService.log({
      actorType: 'SYSTEM',
      action: 'webhook.elevenlabs',
      entityType: 'Interaction',
      entityId: interaction.id,
      metadata: { eventType, conversationId },
    }).catch((error) => {
      console.error(`[Webhook ElevenLabs] Error en audit log:`, error);
    });

    // Responder inmediatamente para tiempo real
    return { 
      success: true, 
      interactionId: interaction.id,
      eventType,
      conversationId,
      message: 'Event processed, details will be updated asynchronously'
    };
  }

  /**
   * Procesar detalles completos de la llamada de forma asíncrona
   * Esto permite que el webhook responda rápido mientras obtenemos todos los datos
   */
  private async fetchAndUpdateCallDetails(
    interactionId: string,
    conversationId: string,
    normalized: any
  ): Promise<void> {
    try {
      console.log(`[Webhook ElevenLabs] Obteniendo detalles completos para ${conversationId}`);
      
      // Usar syncConversation para obtener todos los detalles
      const callDetails = await this.elevenLabsAdapter.syncConversation(conversationId);
      
      console.log(`[Webhook ElevenLabs] Detalles obtenidos para ${conversationId}, actualizando...`);
      
      // Actualizar CallDetail con todos los datos disponibles
      await this.interactionsService.upsertCallDetail({
        interactionId,
        elevenCallId: conversationId,
        recordingUrl: callDetails.recordingUrl || normalized.recordingUrl,
        transcriptText: callDetails.transcriptText || normalized.transcriptText,
        transcriptId: normalized.transcriptId,
        summary: callDetails.summary || normalized.summary,
        durationSec: callDetails.durationSec || normalized.durationSec,
        hangupReason: normalized.hangupReason,
      });

      // Actualizar interaction con datos adicionales si están disponibles
      const updateData: any = {};
      if (callDetails.customerRef || normalized.customerRef) {
        updateData.customerRef = callDetails.customerRef || normalized.customerRef;
      }
      if (callDetails.queue || normalized.queue) {
        updateData.queue = callDetails.queue || normalized.queue;
      }
      if (callDetails.agentName || callDetails.agentId || normalized.assignedAgent) {
        updateData.assignedAgent = callDetails.agentName || callDetails.agentId || normalized.assignedAgent;
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

      console.log(`[Webhook ElevenLabs] Detalles actualizados exitosamente para ${conversationId}`);
    } catch (error: any) {
      console.error(`[Webhook ElevenLabs] Error obteniendo detalles para ${conversationId}:`, error.message);
      // No lanzar error - ya tenemos los datos básicos del webhook
    }
  }

  async handleBuilderBot(payload: any, token: string) {
    // Nota: La validación de token se removió porque BuilderBot no usa tokens en webhooks
    
    // Normalizar payload
    const normalized = this.builderBotAdapter.normalizePayload(payload);

    // Extraer número de teléfono con fallbacks
    const customerPhone = normalized.from || 
                         payload.data?.from || 
                         payload.data?.remoteJid?.split('@')[0] || 
                         payload.data?.phone || 
                         'unknown';

    // Validar que tenemos un número válido
    if (!customerPhone || customerPhone === 'unknown') {
      throw new Error(`No se pudo extraer número de teléfono del payload: ${JSON.stringify(payload)}`);
    }

    // Upsert Interaction
    const interaction = await this.interactionsService.upsertInteraction({
      channel: Channel.WHATSAPP,
      direction: Direction.INBOUND,
      provider: Provider.BUILDERBOT,
      providerConversationId: normalized.threadId || normalized.conversationId || customerPhone,
      from: customerPhone,
      to: normalized.to || 'system',
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
    console.log(`[Webhook Twilio Status] Payload recibido:`, JSON.stringify(payload, null, 2));

    // Validar token (opcional, Twilio también puede usar firma)
    if (token && !this.twilioAdapter.verifyToken(token)) {
      console.error(`[Webhook Twilio Status] ❌ Token inválido`);
      throw new UnauthorizedException('Invalid webhook token');
    }

    // Normalizar payload
    const normalized = this.twilioAdapter.normalizeStatusPayload(payload);
    console.log(`[Webhook Twilio Status] Payload normalizado:`, JSON.stringify(normalized, null, 2));

    // Buscar Message por providerMessageId
    console.log(`[Webhook Twilio Status] Buscando mensaje con providerMessageId: ${normalized.messageSid}`);
    const message = await this.prisma.message.findFirst({
      where: { providerMessageId: normalized.messageSid },
      include: { interaction: true },
    });

    if (!message) {
      console.warn(`[Webhook Twilio Status] ⚠️ Mensaje no encontrado con providerMessageId: ${normalized.messageSid}`);
      console.warn(`[Webhook Twilio Status] Esto puede ser normal si el mensaje aún no se ha creado en la base de datos`);
      return { 
        success: false, 
        message: 'Message not found',
        messageSid: normalized.messageSid 
      };
    }

    console.log(`[Webhook Twilio Status] ✅ Mensaje encontrado: MessageId=${message.id}, InteractionId=${message.interactionId}`);

    try {
      // Actualizar Message
      console.log(`[Webhook Twilio Status] Actualizando mensaje con status: ${normalized.status}`);
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          providerStatus: normalized.status,
          deliveredAt: normalized.status === 'delivered' ? new Date() : null,
          readAt: normalized.status === 'read' ? new Date() : null,
        },
      });
      console.log(`[Webhook Twilio Status] ✅ Mensaje actualizado exitosamente`);

      // Crear evento
      try {
        await this.interactionsService.createEvent({
          interactionId: message.interactionId,
          type: 'sms.status',
          provider: Provider.TWILIO,
          providerEventId: normalized.messageSid,
          payload: { raw: payload, normalized },
        });
        console.log(`[Webhook Twilio Status] ✅ Evento creado exitosamente`);
      } catch (error: any) {
        console.error(`[Webhook Twilio Status] ⚠️ Error creando evento (no crítico):`, error.message);
      }

      // Actualizar Interaction si es necesario
      if (normalized.status === 'delivered' || normalized.status === 'failed') {
        console.log(`[Webhook Twilio Status] Actualizando interacción con status: ${normalized.status === 'delivered' ? 'COMPLETED' : 'FAILED'}`);
        try {
          await this.prisma.interaction.update({
            where: { id: message.interactionId },
            data: {
              status: normalized.status === 'delivered' ? InteractionStatus.COMPLETED : InteractionStatus.FAILED,
              endedAt: new Date(),
            },
          });
          console.log(`[Webhook Twilio Status] ✅ Interacción actualizada exitosamente`);
        } catch (error: any) {
          console.error(`[Webhook Twilio Status] ⚠️ Error actualizando interacción (no crítico):`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`[Webhook Twilio Status] ❌ ERROR procesando webhook:`, error);
      console.error(`[Webhook Twilio Status] Stack trace:`, error.stack);
      throw error;
    }

    // Audit log
    try {
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'webhook.twilio.status',
        entityType: 'Message',
        entityId: message.id,
        metadata: { status: normalized.status, messageSid: normalized.messageSid },
      });
    } catch (error: any) {
      console.error(`[Webhook Twilio Status] ⚠️ Error en audit log (no crítico):`, error.message);
    }

    return { success: true, messageId: message.id, interactionId: message.interactionId };
  }

  /**
   * Maneja el webhook de inicio de llamada de ElevenLabs
   * ElevenLabs consulta este endpoint cuando recibe una llamada entrante
   * Podemos responder con variables dinámicas para personalizar el agente
   */
  async handleCallInit(payload: any, token: string) {
    // Validar token
    if (!this.elevenLabsAdapter.verifyToken(token)) {
      throw new UnauthorizedException('Invalid webhook token');
    }

    console.log('[Webhook ElevenLabs Call Init] Solicitud recibida:', JSON.stringify(payload, null, 2));

    // Extraer información de la llamada entrante
    const callerId = payload.caller_id || payload.callerId || payload.phone_number || payload.phone;
    const calledNumber = payload.called_number || payload.calledNumber || payload.destination;
    const agentId = payload.agent_id || payload.agentId;
    const callSid = payload.call_sid || payload.callSid;

    console.log(`[Webhook ElevenLabs Call Init] Llamada desde ${callerId} a ${calledNumber}, Agent: ${agentId}`);

    // Buscar información del cliente en la base de datos
    const customerInfo = await this.getCustomerInfo(callerId);

    // Buscar historial de interacciones previas
    const interactionHistory = await this.getInteractionHistory(callerId);

    // Preparar variables dinámicas para el agente (CONTEXTO COMPLETO)
    const dynamicVariables: Record<string, any> = {
      // Información básica del cliente
      ...(customerInfo.name && { nombre_paciente: customerInfo.name }),
      ...(customerInfo.name && { nombre_contacto: customerInfo.name }),
      ...(customerInfo.name && { customer_name: customerInfo.name }),
      ...(customerInfo.phone && { customer_phone: customerInfo.phone }),
      
      // Información de contexto del cliente
      ...(customerInfo.queue && { queue: customerInfo.queue }),
      ...(customerInfo.queue && { cola: customerInfo.queue }),
      ...(customerInfo.queue && { department: customerInfo.queue }),
      ...(customerInfo.preferredChannel && { canal_preferido: customerInfo.preferredChannel }),
      ...(customerInfo.lastIntent && { ultimo_tema: customerInfo.lastIntent }),
      ...(customerInfo.lastOutcome && { ultimo_resultado: customerInfo.lastOutcome }),
      
      // Historial completo (TODOS los canales)
      ...(interactionHistory.totalInteractions > 0 && { 
        total_interacciones_previas: interactionHistory.totalInteractions.toString(),
        total_llamadas_previas: interactionHistory.totalCalls.toString(),
        total_whatsapp_previos: interactionHistory.totalWhatsApp.toString(),
        total_sms_previos: interactionHistory.totalSms.toString(),
        ultima_interaccion: interactionHistory.lastInteractionDate || 'Nunca',
        ultima_llamada: interactionHistory.lastCallDate || 'Nunca',
        resumen_historial: interactionHistory.summary || 'Sin historial previo',
        ...(interactionHistory.contextSummary && { 
          contexto_historial: interactionHistory.contextSummary 
        }),
      }),

      // Mensajes recientes de WhatsApp/SMS (contexto adicional)
      ...(customerInfo.recentMessages && customerInfo.recentMessages.length > 0 && {
        mensajes_recientes: customerInfo.recentMessages.slice(0, 2).join(' | ')
      }),

      // Información de la llamada actual
      ...(callerId && { system__called_number: callerId }),
      ...(calledNumber && { system__internal_number: calledNumber }),
      ...(callSid && { system__call_sid: callSid }),
    };

    // Construir respuesta para ElevenLabs
    const response = {
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables,
      },
      // Puedes agregar más configuraciones aquí según la documentación de ElevenLabs
      // Por ejemplo: agent_config, custom_prompts, etc.
    };

    console.log(`[Webhook ElevenLabs Call Init] Respondiendo con variables dinámicas para ${callerId}`);
    console.log('[Webhook ElevenLabs Call Init] Variables:', JSON.stringify(dynamicVariables, null, 2));

    // Audit log
    this.auditService.log({
      actorType: 'SYSTEM',
      action: 'webhook.elevenlabs.call-init',
      entityType: 'Call',
      entityId: callSid || callerId || 'unknown',
      metadata: { 
        callerId, 
        calledNumber, 
        agentId,
        hasCustomerInfo: !!customerInfo.name,
        variablesCount: Object.keys(dynamicVariables).length
      },
    }).catch((error) => {
      console.error('[Webhook ElevenLabs Call Init] Error en audit log:', error);
    });

    return response;
  }

  /**
   * Obtener información del cliente desde la base de datos
   * Busca en TODOS los canales (CALL, WHATSAPP, SMS) para obtener contexto completo
   */
  private async getCustomerInfo(phone: string): Promise<{
    name?: string;
    phone?: string;
    queue?: string;
    preferredChannel?: string;
    lastIntent?: string;
    lastOutcome?: string;
    [key: string]: any;
  }> {
    if (!phone || phone === 'unknown') {
      return {};
    }

    try {
      // Buscar en TODAS las interacciones previas (todos los canales)
      const previousInteractions = await this.prisma.interaction.findMany({
        where: {
          from: phone,
          OR: [
            { customerRef: { not: null } },
            { intent: { not: null } },
            { outcome: { not: null } },
          ],
        },
        orderBy: { startedAt: 'desc' },
        take: 20, // Buscar en las últimas 20 interacciones
        include: {
          messages: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          callDetail: {
            select: { summary: true },
          },
        },
      });

      if (previousInteractions.length === 0) {
        return { phone };
      }

      // Obtener información más reciente y relevante
      const mostRecent = previousInteractions[0];
      
      // Buscar nombre del cliente (customerRef) en cualquier interacción
      const interactionWithName = previousInteractions.find(i => i.customerRef);
      const customerName = interactionWithName?.customerRef || mostRecent.customerRef;

      // Determinar canal preferido (el más usado)
      const channelCounts = previousInteractions.reduce((acc, i) => {
        acc[i.channel] = (acc[i.channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const preferredChannel = Object.entries(channelCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      // Obtener último intent y outcome
      const lastIntent = mostRecent.intent;
      const lastOutcome = mostRecent.outcome;

      // Obtener cola más frecuente
      const queueCounts = previousInteractions
        .filter(i => i.queue)
        .reduce((acc, i) => {
          acc[i.queue!] = (acc[i.queue!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      const preferredQueue = Object.entries(queueCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || mostRecent.queue;

      // Extraer contexto de mensajes recientes (WhatsApp/SMS)
      const recentMessages = previousInteractions
        .flatMap(i => i.messages || [])
        .filter(m => m.text)
        .slice(0, 3)
        .map(m => m.text)
        .filter(Boolean);

      return {
        name: customerName || undefined,
        phone: phone,
        queue: preferredQueue || undefined,
        preferredChannel: preferredChannel || undefined,
        lastIntent: lastIntent || undefined,
        lastOutcome: lastOutcome || undefined,
        recentMessages: recentMessages.length > 0 ? recentMessages : undefined,
      };
    } catch (error) {
      console.error(`[Webhook ElevenLabs] Error obteniendo info del cliente ${phone}:`, error);
      return { phone };
    }
  }

  /**
   * Obtener historial completo de interacciones del cliente
   * Incluye TODOS los canales: llamadas, WhatsApp, SMS
   */
  private async getInteractionHistory(phone: string): Promise<{
    totalInteractions: number;
    totalCalls: number;
    totalWhatsApp: number;
    totalSms: number;
    lastInteractionDate?: string;
    lastCallDate?: string;
    summary?: string;
    contextSummary?: string;
  }> {
    if (!phone || phone === 'unknown') {
      return { totalInteractions: 0, totalCalls: 0, totalWhatsApp: 0, totalSms: 0 };
    }

    try {
      // Obtener TODAS las interacciones de TODOS los canales
      const allInteractions = await this.prisma.interaction.findMany({
        where: {
          from: phone,
        },
        orderBy: { startedAt: 'desc' },
        take: 30, // Últimas 30 interacciones para contexto
        include: {
          callDetail: {
            select: { summary: true, transcriptText: true },
          },
          messages: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { text: true, channel: true, direction: true },
          },
        },
      });

      if (allInteractions.length === 0) {
        return { 
          totalInteractions: 0, 
          totalCalls: 0, 
          totalWhatsApp: 0, 
          totalSms: 0,
          summary: 'Primera interacción de este cliente.'
        };
      }

      // Contar por canal
      const totalInteractions = allInteractions.length;
      const totalCalls = allInteractions.filter(i => i.channel === Channel.CALL).length;
      const totalWhatsApp = allInteractions.filter(i => i.channel === Channel.WHATSAPP).length;
      const totalSms = allInteractions.filter(i => i.channel === Channel.SMS).length;

      // Fechas
      const lastInteraction = allInteractions[0];
      const lastInteractionDate = lastInteraction?.startedAt 
        ? new Date(lastInteraction.startedAt).toLocaleDateString('es-AR')
        : undefined;

      const lastCall = allInteractions.find(i => i.channel === Channel.CALL);
      const lastCallDate = lastCall?.startedAt 
        ? new Date(lastCall.startedAt).toLocaleDateString('es-AR')
        : undefined;

      // Estadísticas
      const completed = allInteractions.filter(i => i.status === InteractionStatus.COMPLETED).length;
      const resolved = allInteractions.filter(i => i.outcome === 'RESOLVED').length;
      const escalated = allInteractions.filter(i => i.outcome === 'ESCALATED').length;

      // Crear resumen del historial
      const summaryParts = [];
      if (totalInteractions > 0) {
        summaryParts.push(`${totalInteractions} interacción${totalInteractions > 1 ? 'es' : ''} previa${totalInteractions > 1 ? 's' : ''}`);
        if (totalCalls > 0) summaryParts.push(`${totalCalls} llamada${totalCalls > 1 ? 's' : ''}`);
        if (totalWhatsApp > 0) summaryParts.push(`${totalWhatsApp} WhatsApp`);
        if (totalSms > 0) summaryParts.push(`${totalSms} SMS`);
        if (completed > 0) summaryParts.push(`${completed} completada${completed > 1 ? 's' : ''}`);
        if (resolved > 0) summaryParts.push(`${resolved} resuelta${resolved > 1 ? 's' : ''}`);
        if (escalated > 0) summaryParts.push(`${escalated} escalada${escalated > 1 ? 's' : ''}`);
      }

      const summary = summaryParts.length > 0
        ? `Cliente con ${summaryParts.join(', ')}.`
        : 'Primera interacción de este cliente.';

      // Crear resumen de contexto (últimos temas/intents)
      const recentIntents = allInteractions
        .filter(i => i.intent)
        .slice(0, 3)
        .map(i => i.intent)
        .filter(Boolean);

      const recentSummaries = allInteractions
        .filter(i => i.callDetail?.summary)
        .slice(0, 2)
        .map(i => i.callDetail!.summary)
        .filter(Boolean);

      const contextParts = [];
      if (recentIntents.length > 0) {
        contextParts.push(`Últimos temas: ${recentIntents.join(', ')}`);
      }
      if (recentSummaries.length > 0) {
        contextParts.push(`Resúmenes recientes: ${recentSummaries.slice(0, 1).join('; ')}`);
      }

      const contextSummary = contextParts.length > 0
        ? contextParts.join('. ')
        : undefined;

      return {
        totalInteractions,
        totalCalls,
        totalWhatsApp,
        totalSms,
        lastInteractionDate,
        lastCallDate,
        summary,
        contextSummary,
      };
    } catch (error) {
      console.error(`[Webhook ElevenLabs] Error obteniendo historial para ${phone}:`, error);
      return { totalInteractions: 0, totalCalls: 0, totalWhatsApp: 0, totalSms: 0 };
    }
  }
}
