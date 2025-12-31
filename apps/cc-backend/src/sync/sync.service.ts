import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ElevenLabsAdapter } from '../adapters/elevenlabs.adapter';
import { InteractionsService } from '../interactions/interactions.service';
import { Provider } from '@prisma/client';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly elevenLabsAdapter: ElevenLabsAdapter;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private interactionsService: InteractionsService,
  ) {
    this.elevenLabsAdapter = new ElevenLabsAdapter();
  }

  /**
   * Sincronización automática cada 5 minutos
   * Trae llamadas de las últimas 2 horas que puedan haber faltado por webhook
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncRecentCalls() {
    if (this.isRunning) {
      this.logger.warn('Sincronización ya en progreso, saltando...');
      return;
    }

    if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID) {
      this.logger.warn('ElevenLabs no configurado, saltando sincronización');
      return;
    }

    this.isRunning = true;
    this.logger.log('Iniciando sincronización automática de llamadas...');

    try {
      // Obtener llamadas de las últimas 2 horas
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 2 * 60 * 60 * 1000); // 2 horas atrás

      const result = await this.elevenLabsAdapter.fetchAllConversations({
        agentId: process.env.ELEVENLABS_AGENT_ID,
        startDate,
        endDate,
        limit: 100, // Máximo 100 llamadas por sincronización
      });

      this.logger.log(`Encontradas ${result.conversations.length} conversaciones para sincronizar`);

      let synced = 0;
      let errors = 0;

      for (const conversation of result.conversations) {
        try {
          const conversationId = conversation.conversation_id || conversation.id;
          if (!conversationId) {
            this.logger.warn('Conversación sin ID, saltando...');
            continue;
          }

          // Verificar si ya existe en la base de datos
          const existing = await this.prisma.interaction.findFirst({
            where: {
              provider: Provider.ELEVENLABS,
              providerConversationId: conversationId,
            },
          });

          if (existing) {
            // Si existe, actualizar detalles si es necesario
            const details = await this.elevenLabsAdapter.syncConversation(conversationId);
            
            // Actualizar CallDetail
            if (details.recordingUrl || details.transcriptText || details.summary) {
              await this.interactionsService.upsertCallDetail({
                interactionId: existing.id,
                elevenCallId: conversationId,
                recordingUrl: details.recordingUrl,
                transcriptText: details.transcriptText,
                transcriptId: details.transcriptId,
                summary: details.summary,
                durationSec: details.durationSec,
                hangupReason: details.hangupReason,
              });
            }

            // Actualizar fechas si están disponibles
            if (details.startedAt || details.endedAt) {
              await this.prisma.interaction.update({
                where: { id: existing.id },
                data: {
                  ...(details.startedAt && { startedAt: details.startedAt }),
                  ...(details.endedAt && { endedAt: details.endedAt }),
                },
              });
            }

            synced++;
          } else {
            // Si no existe, crear nueva interacción
            const normalized = this.elevenLabsAdapter.normalizePayload(conversation);
            
            const interaction = await this.interactionsService.upsertInteraction({
              channel: 'CALL' as any,
              direction: normalized.from ? 'INBOUND' as any : 'OUTBOUND' as any,
              provider: Provider.ELEVENLABS,
              providerConversationId: conversationId,
              from: normalized.from || 'unknown',
              to: normalized.to || 'unknown',
              status: normalized.status || 'COMPLETED' as any,
              startedAt: normalized.startedAt || new Date(),
              endedAt: normalized.endedAt,
              assignedAgent: normalized.assignedAgent || normalized.agentName,
              intent: normalized.intent,
              outcome: normalized.outcome,
              customerRef: normalized.customerRef,
              queue: normalized.queue,
            });

            // Obtener detalles completos
            const details = await this.elevenLabsAdapter.syncConversation(conversationId);
            
            if (details.recordingUrl || details.transcriptText || details.summary) {
              await this.interactionsService.upsertCallDetail({
                interactionId: interaction.id,
                elevenCallId: conversationId,
                recordingUrl: details.recordingUrl,
                transcriptText: details.transcriptText,
                transcriptId: details.transcriptId,
                summary: details.summary,
                durationSec: details.durationSec,
                hangupReason: details.hangupReason,
              });
            }

            synced++;
          }
        } catch (error: any) {
          this.logger.error(`Error sincronizando conversación ${conversation.conversation_id || conversation.id}:`, error.message);
          errors++;
        }
      }

      this.logger.log(`Sincronización completada: ${synced} actualizadas, ${errors} errores`);
    } catch (error: any) {
      this.logger.error('Error en sincronización automática:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sincronización completa manual (últimas 24 horas)
   * Se puede llamar desde un endpoint o ejecutar manualmente
   */
  async syncFull(limit: number = 500) {
    this.logger.log('Iniciando sincronización completa...');

    if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID) {
      throw new Error('ElevenLabs no configurado');
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 horas atrás

    const result = await this.elevenLabsAdapter.fetchAllConversations({
      agentId: process.env.ELEVENLABS_AGENT_ID,
      startDate,
      endDate,
      limit,
    });

    this.logger.log(`Procesando ${result.conversations.length} conversaciones...`);

    let synced = 0;
    let errors = 0;

    for (const conversation of result.conversations) {
      try {
        const conversationId = conversation.conversation_id || conversation.id;
        if (!conversationId) continue;

        const normalized = this.elevenLabsAdapter.normalizePayload(conversation);
        
        const interaction = await this.interactionsService.upsertInteraction({
          channel: 'CALL' as any,
          direction: normalized.from ? 'INBOUND' as any : 'OUTBOUND' as any,
          provider: Provider.ELEVENLABS,
          providerConversationId: conversationId,
          from: normalized.from || 'unknown',
          to: normalized.to || 'unknown',
          status: normalized.status || 'COMPLETED' as any,
          startedAt: normalized.startedAt || new Date(),
          endedAt: normalized.endedAt,
          assignedAgent: normalized.assignedAgent || normalized.agentName,
          intent: normalized.intent,
          outcome: normalized.outcome,
          customerRef: normalized.customerRef,
          queue: normalized.queue,
        });

        // Obtener detalles completos
        const details = await this.elevenLabsAdapter.syncConversation(conversationId);
        
        if (details.recordingUrl || details.transcriptText || details.summary) {
          await this.interactionsService.upsertCallDetail({
            interactionId: interaction.id,
            elevenCallId: conversationId,
            recordingUrl: details.recordingUrl,
            transcriptText: details.transcriptText,
            transcriptId: details.transcriptId,
            summary: details.summary,
            durationSec: details.durationSec,
            hangupReason: details.hangupReason,
          });
        }

        synced++;
      } catch (error: any) {
        this.logger.error(`Error sincronizando conversación:`, error.message);
        errors++;
      }
    }

    return {
      total: result.conversations.length,
      synced,
      errors,
    };
  }
}
