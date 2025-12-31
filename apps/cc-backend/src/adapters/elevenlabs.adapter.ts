export class ElevenLabsAdapter {
  private readonly webhookToken: string;

  constructor() {
    this.webhookToken = process.env.ELEVENLABS_WEBHOOK_TOKEN || '';
  }

  verifyToken(token: string): boolean {
    return token === this.webhookToken;
  }

  /**
   * Normalizar payload de webhook de ElevenLabs ConvAI
   * Basado en la estructura real de la API de ElevenLabs
   */
  normalizePayload(payload: any): {
    eventId?: string;
    callId?: string;
    sessionId?: string;
    conversationId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    status?: any;
    startedAt?: Date;
    endedAt?: Date;
    assignedAgent?: string;
    agentId?: string;
    agentName?: string;
    intent?: string;
    outcome?: any;
    recordingUrl?: string;
    transcriptText?: string;
    transcriptId?: string;
    summary?: string;
    durationSec?: number;
    hangupReason?: string;
    customerRef?: string;
    queue?: string;
  } {
    const normalized: any = {};

    // IDs - ElevenLabs ConvAI usa conversation_id principalmente
    normalized.eventId = payload.event_id || payload.id || payload.eventId;
    normalized.conversationId = payload.conversation_id || payload.conversationId || payload.conversation?.id;
    normalized.callId = payload.call_id || payload.callId || normalized.conversationId;
    normalized.sessionId = payload.session_id || payload.sessionId || normalized.conversationId;

    // Event type
    normalized.eventType = payload.event_type || payload.type || payload.event || 'call.event';

    // From/To - buscar en diferentes lugares según el formato
    // Para webhooks, puede venir en el payload directo
    normalized.from = 
      payload.from || 
      payload.caller || 
      payload.phone_number || 
      payload.phone ||
      payload.metadata?.phone_call?.external_number ||
      payload.conversation_initiation_client_data?.dynamic_variables?.system__called_number ||
      'unknown';

    normalized.to = 
      payload.to || 
      payload.callee || 
      payload.destination || 
      payload.metadata?.phone_call?.internal_number ||
      'unknown';

    // Timestamps - ElevenLabs usa start_time_unix_secs (epoch en segundos)
    if (payload.start_time_unix_secs) {
      normalized.startedAt = new Date(payload.start_time_unix_secs * 1000);
    } else if (payload.started_at || payload.start_time || payload.timestamp) {
      normalized.startedAt = new Date(payload.started_at || payload.start_time || payload.timestamp);
    }

    if (payload.end_time_unix_secs) {
      normalized.endedAt = new Date(payload.end_time_unix_secs * 1000);
    } else if (payload.ended_at || payload.end_time) {
      normalized.endedAt = new Date(payload.ended_at || payload.end_time);
    }

    // Status mapping - ElevenLabs usa "done", "failed", etc.
    if (payload.status) {
      const statusMap: Record<string, any> = {
        'done': 'COMPLETED',
        'completed': 'COMPLETED',
        'ended': 'COMPLETED',
        'abandoned': 'ABANDONED',
        'failed': 'FAILED',
        'in_progress': 'IN_PROGRESS',
        'active': 'IN_PROGRESS',
        'ringing': 'IN_PROGRESS',
      };
      normalized.status = statusMap[payload.status.toLowerCase()] || payload.status;
    }

    // Agent - ElevenLabs tiene agent_id y agent_name
    normalized.agentId = payload.agent_id || payload.agentId;
    normalized.agentName = payload.agent_name || payload.agentName || payload.agent?.name;
    normalized.assignedAgent = normalized.agentName || normalized.agentId || payload.agent || payload.assigned_agent;

    // Intent
    normalized.intent = payload.intent || payload.intention || payload.reason;

    // Outcome - puede venir en diferentes formatos
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

    // Transcript - puede venir como array o string
    if (payload.transcript) {
      if (Array.isArray(payload.transcript)) {
        normalized.transcriptText = payload.transcript
          .map((msg: any) => {
            const role = msg.role === 'agent' ? 'Agente' : 'Cliente';
            const message = msg.message || msg.content || '';
            return `${role}: ${message}`;
          })
          .join('\n\n');
      } else {
        normalized.transcriptText = payload.transcript;
      }
    } else {
      normalized.transcriptText = payload.transcript_text || payload.transcription?.text;
    }

    normalized.transcriptId = payload.transcript_id || payload.transcription?.id;

    // Summary - buscar en analysis.transcript_summary (formato de convai API)
    normalized.summary = 
      payload.analysis?.transcript_summary ||  // Formato de convai API
      payload.summary || 
      payload.summary_text || 
      payload.ai_summary || 
      payload.call_summary ||
      payload.transcript_summary;

    // Duration - ElevenLabs usa call_duration_secs
    if (payload.call_duration_secs !== undefined) {
      normalized.durationSec = parseInt(payload.call_duration_secs);
    } else if (payload.duration_seconds !== undefined) {
      normalized.durationSec = parseInt(payload.duration_seconds);
    } else if (payload.duration) {
      normalized.durationSec = parseInt(payload.duration);
    }

    // Hangup reason
    normalized.hangupReason = payload.hangup_reason || payload.hangupReason || payload.reason;

    // Customer reference y queue desde dynamic_variables
    if (payload.conversation_initiation_client_data?.dynamic_variables) {
      const vars = payload.conversation_initiation_client_data.dynamic_variables;
      normalized.customerRef = vars.nombre_paciente || vars.nombre_contacto || vars.customer_name || vars.customer_ref;
      normalized.queue = vars.queue || vars.cola || vars.department;
    }

    return normalized;
  }

  /**
   * Obtener resumen, transcripción y grabación de una llamada desde la API de ElevenLabs
   * Basado en la implementación de NutryHome y documentación oficial
   */
  async fetchCallDetails(conversationId: string): Promise<{
    recordingUrl?: string;
    transcriptText?: string;
    summary?: string;
    durationSec?: number;
    agentId?: string;
    agentName?: string;
    from?: string;
    to?: string;
    customerRef?: string;
    queue?: string;
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
        const errorText = await conversationResponse.text();
        throw new Error(`ElevenLabs API error: ${conversationResponse.status} ${errorText}`);
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
        // El audio se obtiene desde el endpoint /audio, no hay URL directa
        // Guardamos referencia para usar el endpoint
        details.recordingUrl = `api://elevenlabs/conversations/${conversationId}/audio`;
      }

      // Duración - ElevenLabs usa call_duration_secs
      if (conversationData.call_duration_secs !== undefined) {
        details.durationSec = parseInt(conversationData.call_duration_secs);
      } else if (conversationData.duration_seconds !== undefined) {
        details.durationSec = parseInt(conversationData.duration_seconds);
      }

      // Agent info
      if (conversationData.agent_id) {
        details.agentId = conversationData.agent_id;
      }
      if (conversationData.agent_name) {
        details.agentName = conversationData.agent_name;
      }

      // From/To desde metadata
      if (conversationData.metadata?.phone_call?.external_number) {
        details.from = conversationData.metadata.phone_call.external_number;
      }
      if (conversationData.metadata?.phone_call?.internal_number) {
        details.to = conversationData.metadata.phone_call.internal_number;
      }

      // Customer reference y queue desde dynamic_variables
      if (conversationData.conversation_initiation_client_data?.dynamic_variables) {
        const vars = conversationData.conversation_initiation_client_data.dynamic_variables;
        details.customerRef = vars.nombre_paciente || vars.nombre_contacto || vars.customer_name || vars.customer_ref;
        details.queue = vars.queue || vars.cola || vars.department;
      }

      return details;
    } catch (error: any) {
      throw new Error(`Failed to fetch call details from ElevenLabs: ${error.message}`);
    }
  }
}
