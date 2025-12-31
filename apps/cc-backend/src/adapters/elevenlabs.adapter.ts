export class ElevenLabsAdapter {
  private readonly webhookToken: string;

  constructor() {
    this.webhookToken = process.env.ELEVENLABS_WEBHOOK_TOKEN || '';
  }

  verifyToken(token: string): boolean {
    return token === this.webhookToken;
  }

  normalizePayload(payload: any): {
    eventId?: string;
    callId?: string;
    sessionId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    status?: any;
    startedAt?: Date;
    endedAt?: Date;
    assignedAgent?: string;
    intent?: string;
    outcome?: any;
    recordingUrl?: string;
    transcriptText?: string;
    transcriptId?: string;
    summary?: string;
    durationSec?: number;
    hangupReason?: string;
  } {
    // Normalizador tolerante - adaptarse a diferentes formatos de payload
    const normalized: any = {};

    // IDs - también buscar conversation_id para convai API
    normalized.eventId = payload.event_id || payload.id || payload.eventId;
    normalized.callId = payload.call_id || payload.callId || payload.conversation_id || payload.session?.id;
    normalized.sessionId = payload.session_id || payload.sessionId || payload.conversation_id || payload.session?.id;

    // Event type
    normalized.eventType = payload.event_type || payload.type || payload.event || 'call.event';

    // From/To
    normalized.from = payload.from || payload.caller || payload.phone_number || payload.phone;
    normalized.to = payload.to || payload.callee || payload.destination || 'unknown';

    // Timestamps
    if (payload.started_at || payload.start_time || payload.timestamp) {
      normalized.startedAt = new Date(payload.started_at || payload.start_time || payload.timestamp);
    }
    if (payload.ended_at || payload.end_time) {
      normalized.endedAt = new Date(payload.ended_at || payload.end_time);
    }

    // Status mapping
    if (payload.status) {
      const statusMap: Record<string, any> = {
        'completed': 'COMPLETED',
        'ended': 'COMPLETED',
        'abandoned': 'ABANDONED',
        'failed': 'FAILED',
        'in_progress': 'IN_PROGRESS',
        'active': 'IN_PROGRESS',
      };
      normalized.status = statusMap[payload.status.toLowerCase()] || payload.status;
    }

    // Agent
    normalized.assignedAgent = payload.agent || payload.assigned_agent || payload.agent_name;

    // Intent
    normalized.intent = payload.intent || payload.intention || payload.reason;

    // Outcome
    if (payload.outcome) {
      const outcomeMap: Record<string, any> = {
        'resolved': 'RESOLVED',
        'escalated': 'ESCALATED',
        'ticket': 'TICKETED',
        'transferred': 'TRANSFERRED',
      };
      normalized.outcome = outcomeMap[payload.outcome.toLowerCase()] || payload.outcome;
    }

    // Recording
    normalized.recordingUrl = payload.recording_url || payload.recordingUrl || payload.recording?.url;
    normalized.transcriptText = payload.transcript_text || payload.transcript || payload.transcription?.text;
    normalized.transcriptId = payload.transcript_id || payload.transcription?.id;

    // Summary - buscar en diferentes lugares según el formato del payload
    normalized.summary = 
      payload.analysis?.transcript_summary ||  // Formato de convai API
      payload.summary || 
      payload.summary_text || 
      payload.ai_summary || 
      payload.call_summary ||
      payload.transcript_summary;

    // Duration
    if (payload.duration || payload.duration_seconds) {
      normalized.durationSec = parseInt(payload.duration || payload.duration_seconds);
    }

    // Hangup reason
    normalized.hangupReason = payload.hangup_reason || payload.hangupReason || payload.reason;

    return normalized;
  }

  /**
   * Obtener resumen, transcripción y grabación de una llamada desde la API de ElevenLabs
   * Basado en la implementación de NutryHome
   */
  async fetchCallDetails(conversationId: string): Promise<{
    recordingUrl?: string;
    transcriptText?: string;
    summary?: string;
    durationSec?: number;
  }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const apiUrl = process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io';

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    try {
      // Obtener detalle completo de la conversación (usando convai API)
      const conversationResponse = await fetch(
        `${apiUrl}/v1/convai/conversations/${conversationId}`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      );

      if (!conversationResponse.ok) {
        throw new Error(`ElevenLabs API error: ${conversationResponse.statusText}`);
      }

      const conversationData: any = await conversationResponse.json();

      const details: any = {};

      // Obtener resumen desde analysis.transcript_summary
      if (conversationData.analysis?.transcript_summary) {
        details.summary = conversationData.analysis.transcript_summary;
      }

      // Obtener transcripción
      if (conversationData.transcript) {
        if (Array.isArray(conversationData.transcript)) {
          // Si es un array de mensajes, convertir a texto
          details.transcriptText = conversationData.transcript
            .filter((msg: any) => msg.message && msg.message.trim())
            .map((msg: any) => {
              const role = msg.role === 'agent' ? 'Agente' : 'Cliente';
              const message = msg.message || msg.content || '';
              return `${role}: ${message}`;
            })
            .join('\n\n');
        } else if (typeof conversationData.transcript === 'string') {
          // Si ya es string, usar directamente
          details.transcriptText = conversationData.transcript;
        }
      }

      // Obtener URL de grabación/audio
      if (conversationData.recording_url) {
        details.recordingUrl = conversationData.recording_url;
      } else if (conversationData.audio_url) {
        details.recordingUrl = conversationData.audio_url;
      } else {
        // Intentar obtener audio desde el endpoint de audio
        try {
          const audioResponse = await fetch(
            `${apiUrl}/v1/convai/conversations/${conversationId}/audio`,
            {
              headers: {
                'xi-api-key': apiKey,
                'Accept': 'audio/mpeg',
              },
            }
          );

          if (audioResponse.ok) {
            // Si el audio está disponible, crear una URL temporal o guardar referencia
            // Por ahora, usamos el conversationId para construir la URL
            details.recordingUrl = `${apiUrl}/v1/convai/conversations/${conversationId}/audio`;
          }
        } catch (error) {
          console.error('Error fetching audio URL:', error);
        }
      }

      // Duración
      if (conversationData.call_duration_secs) {
        details.durationSec = conversationData.call_duration_secs;
      } else if (conversationData.duration_seconds) {
        details.durationSec = conversationData.duration_seconds;
      }

      return details;
    } catch (error: any) {
      throw new Error(`Failed to fetch call details from ElevenLabs: ${error.message}`);
    }
  }
}
