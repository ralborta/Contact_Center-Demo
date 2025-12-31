import { Controller, Get, Param, Res, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { InteractionsService } from './interactions.service';
import { ElevenLabsAdapter } from '../adapters/elevenlabs.adapter';
import { Channel, Direction, Provider } from '@prisma/client';

@ApiTags('ElevenLabs')
@Controller('elevenlabs')
export class ElevenLabsController {
  private elevenLabsAdapter: ElevenLabsAdapter;

  constructor(private interactionsService: InteractionsService) {
    this.elevenLabsAdapter = new ElevenLabsAdapter();
  }

  @Get('conversations/:conversationId')
  @ApiOperation({ summary: 'Obtener transcripción y resumen de una conversación de ElevenLabs' })
  async getConversationDetails(@Param('conversationId') conversationId: string) {
    try {
      const details = await this.elevenLabsAdapter.fetchCallDetails(conversationId);
      
      return {
        success: true,
        conversationId,
        transcript: details.transcriptText,
        summary: details.summary,
        source: 'elevenlabs-api',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('audio/:conversationId')
  @ApiOperation({ summary: 'Obtener audio de una conversación de ElevenLabs' })
  async getAudio(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
  ) {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const apiUrl = process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io';

      if (!apiKey) {
        return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
      }

      // Obtener audio desde ElevenLabs
      const audioResponse = await fetch(
        `${apiUrl}/v1/convai/conversations/${conversationId}/audio`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Accept': 'audio/mpeg',
          },
        }
      );

      if (!audioResponse.ok) {
        return res.status(audioResponse.status).json({ error: 'Audio no disponible' });
      }

      const audioBuffer = await audioResponse.arrayBuffer();

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength.toString());
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      return res.send(Buffer.from(audioBuffer));
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Obtener todas las conversaciones de ElevenLabs' })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getAllConversations(
    @Query('agentId') agentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const result = await this.elevenLabsAdapter.fetchAllConversations({
        agentId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return {
        success: true,
        conversations: result.conversations,
        total: result.total,
        hasMore: result.hasMore,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar llamadas desde ElevenLabs API' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        limit: { type: 'number' },
        syncDetails: { type: 'boolean' },
      },
    },
    required: false,
  })
  async syncCalls(
    @Body() body?: {
      agentId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      syncDetails?: boolean;
    },
  ) {
    try {
      // Obtener todas las conversaciones
      const result = await this.elevenLabsAdapter.fetchAllConversations({
        agentId: body?.agentId,
        startDate: body?.startDate ? new Date(body.startDate) : undefined,
        endDate: body?.endDate ? new Date(body.endDate) : undefined,
        limit: body?.limit,
      });

      const synced = [];
      const errors = [];

      // Sincronizar cada conversación
      for (const conversation of result.conversations) {
        try {
          // Normalizar el payload de la conversación
          const normalized = this.elevenLabsAdapter.normalizePayload(conversation);

          // Obtener detalles completos si se solicita
          let callDetails: any = {};
          if (body?.syncDetails !== false && normalized.conversationId) {
            try {
              callDetails = await this.elevenLabsAdapter.syncConversation(normalized.conversationId);
            } catch (error) {
              console.error(`Error syncing details for ${normalized.conversationId}:`, error);
            }
          }

          // Upsert Interaction usando el servicio
          // Nota: Necesitamos inyectar el servicio, por ahora usamos el método directo
          const interaction = await this.interactionsService.upsertInteraction({
            channel: Channel.CALL,
            direction: Direction.INBOUND,
            provider: Provider.ELEVENLABS,
            providerConversationId: normalized.conversationId || normalized.callId || normalized.sessionId,
            from: normalized.from || callDetails.from || 'unknown',
            to: normalized.to || callDetails.to || 'unknown',
            status: normalized.status || callDetails.status,
            startedAt: normalized.startedAt || callDetails.startedAt,
            endedAt: normalized.endedAt || callDetails.endedAt,
            assignedAgent: normalized.assignedAgent || normalized.agentName || normalized.agentId || callDetails.agentName || callDetails.agentId,
            intent: normalized.intent,
            outcome: normalized.outcome,
            customerRef: normalized.customerRef || callDetails.customerRef,
            queue: normalized.queue || callDetails.queue,
          });

          // Upsert CallDetail con todos los datos
          if (interaction.id) {
            await this.interactionsService.upsertCallDetail({
              interactionId: interaction.id,
              elevenCallId: normalized.conversationId || normalized.callId,
              recordingUrl: normalized.recordingUrl || callDetails.recordingUrl,
              transcriptText: normalized.transcriptText || callDetails.transcriptText,
              transcriptId: normalized.transcriptId,
              summary: normalized.summary || callDetails.summary,
              durationSec: normalized.durationSec || callDetails.durationSec,
              hangupReason: normalized.hangupReason,
            });
          }

          synced.push({
            conversationId: normalized.conversationId || normalized.callId,
            interactionId: interaction.id,
          });
        } catch (error: any) {
          errors.push({
            conversationId: conversation.conversation_id || conversation.id,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        synced: synced.length,
        errors: errors.length,
        total: result.total || result.conversations.length,
        details: {
          synced,
          errors: errors.slice(0, 10), // Limitar errores mostrados
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
