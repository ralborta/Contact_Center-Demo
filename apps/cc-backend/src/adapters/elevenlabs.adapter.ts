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
    durationSec?: number;
    hangupReason?: string;
  } {
    // Normalizador tolerante - adaptarse a diferentes formatos de payload
    const normalized: any = {};

    // IDs
    normalized.eventId = payload.event_id || payload.id || payload.eventId;
    normalized.callId = payload.call_id || payload.callId || payload.session?.id;
    normalized.sessionId = payload.session_id || payload.sessionId || payload.session?.id;

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

    // Duration
    if (payload.duration || payload.duration_seconds) {
      normalized.durationSec = parseInt(payload.duration || payload.duration_seconds);
    }

    // Hangup reason
    normalized.hangupReason = payload.hangup_reason || payload.hangupReason || payload.reason;

    return normalized;
  }
}
