import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Direction,
  InteractionStatus,
  Outcome,
  Provider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';
import {
  inferResultCodeFromTurns,
  parseConversationTranscript,
  type TranscriptTurn,
} from './transcript';

export type { TranscriptTurn };

@Injectable()
export class VoiceService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private patients: PatientsService,
  ) {}

  private apiKey() {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ELEVENLABS_API_KEY no configurada en el servidor',
      );
    }
    return apiKey;
  }

  private agentId() {
    return (
      this.config.get<string>('ELEVENLABS_AGENT_ID') ||
      'agent_8301m89vh2zsf3jrcs1h3ej36nk2'
    );
  }

  async getSignedUrl() {
    const apiKey = this.apiKey();
    const agentId = this.agentId();
    const url = new URL(
      'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url',
    );
    url.searchParams.set('agent_id', agentId);
    url.searchParams.set('include_conversation_id', 'true');
    const res = await fetch(url.toString(), {
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ServiceUnavailableException(
        `No se pudo obtener signed URL (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      signed_url?: string;
      conversation_id?: string;
    };
    return {
      signedUrl: data.signed_url,
      conversationId: data.conversation_id || null,
      agentId,
      defaultCallerPhone:
        this.config.get<string>('SIMULATOR_CALLER_PHONE') || '59170111222',
      hospitalName: 'Hospital Central La Paz',
    };
  }

  /** Sesión pública para la webapp del teléfono (sin JWT). */
  async getPublicSession() {
    try {
      const session = await this.getSignedUrl();
      return {
        agentId: this.agentId(),
        signedUrl: session.signedUrl,
        conversationId: session.conversationId,
        hospitalName: session.hospitalName,
        defaultCallerPhone: session.defaultCallerPhone,
      };
    } catch {
      // El widget puede usar agent-id directo si el agente no exige auth
      return {
        agentId: this.agentId(),
        signedUrl: null,
        conversationId: null,
        hospitalName: 'Hospital Central La Paz',
        defaultCallerPhone:
          this.config.get<string>('SIMULATOR_CALLER_PHONE') || '59170111222',
      };
    }
  }

  async syncFromConversation(params: {
    conversationId: string;
    callerPhone?: string;
    durationSec?: number;
  }) {
    const conversationId = params.conversationId?.trim();
    if (!conversationId) {
      throw new NotFoundException('conversationId requerido');
    }

    const apiKey = this.apiKey();
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: { 'xi-api-key': apiKey } },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new ServiceUnavailableException(
        `No se pudo leer la conversación (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const data: any = await res.json();

    const turns = this.parseTranscript(data);
    const transcriptText = JSON.stringify(turns);
    const summary =
      data?.analysis?.transcript_summary ||
      data?.analysis?.call_summary_title ||
      data?.analysis?.call_successful_result ||
      null;
    const durationSec =
      params.durationSec ??
      data?.metadata?.call_duration_secs ??
      data?.metadata?.duration_secs ??
      this.inferDuration(turns);

    const phoneFromMeta =
      data?.metadata?.phone_call?.external_number ||
      data?.metadata?.caller_id ||
      data?.conversation_initiation_client_data?.dynamic_variables?.caller_phone ||
      data?.conversation_initiation_client_data?.dynamic_variables?.telefono ||
      null;
    const from = String(params.callerPhone || phoneFromMeta || 'unknown');
    const patient = await this.patients.findByPhoneOrCi(from);

    const resultCode = this.inferResultCode(turns, summary);
    const outcome =
      resultCode === 'APPOINTMENT_BOOKED' ||
      resultCode === 'RESCHEDULED' ||
      resultCode === 'CANCELLED'
        ? Outcome.RESOLVED
        : Outcome.RESOLVED;

    const startedAt = new Date(Date.now() - (durationSec || 0) * 1000);
    const endedAt = new Date();

    const interaction = await this.prisma.interaction.upsert({
      where: {
        provider_providerConversationId: {
          provider: Provider.VOICE_AGENT,
          providerConversationId: conversationId,
        },
      },
      create: {
        channel: 'CALL',
        direction: Direction.INBOUND,
        status: InteractionStatus.COMPLETED,
        startedAt,
        endedAt,
        from,
        to: 'Hospital Central La Paz',
        patientId: patient?.id,
        aiHandled: true,
        outcome,
        intent: resultCode?.startsWith('APPOINTMENT')
          ? 'cita'
          : resultCode === 'CANCELLED'
            ? 'cancelar'
            : resultCode === 'RESCHEDULED'
              ? 'reprogramar'
              : 'consulta',
        resultCode,
        provider: Provider.VOICE_AGENT,
        providerConversationId: conversationId,
        callDetail: {
          create: {
            externalCallId: conversationId,
            transcriptText,
            summary: typeof summary === 'string' ? summary : null,
            durationSec: durationSec ? Number(durationSec) : null,
          },
        },
      },
      update: {
        status: InteractionStatus.COMPLETED,
        endedAt,
        from,
        patientId: patient?.id || undefined,
        outcome,
        resultCode: resultCode || undefined,
        callDetail: {
          upsert: {
            create: {
              externalCallId: conversationId,
              transcriptText,
              summary: typeof summary === 'string' ? summary : null,
              durationSec: durationSec ? Number(durationSec) : null,
            },
            update: {
              transcriptText,
              summary: typeof summary === 'string' ? summary : undefined,
              durationSec: durationSec ? Number(durationSec) : undefined,
            },
          },
        },
      },
      include: { callDetail: true },
    });

    // Eventos de tools legibles
    await this.prisma.interactionEvent.deleteMany({
      where: { interactionId: interaction.id, type: 'TOOL' },
    });
    for (const turn of turns.filter((t) => t.role === 'tool')) {
      await this.prisma.interactionEvent.create({
        data: {
          interactionId: interaction.id,
          type: 'TOOL',
          provider: Provider.VOICE_AGENT,
          ts: new Date(
            startedAt.getTime() + (turn.t || 0) * 1000,
          ),
          payload: { label: turn.text },
          idempotencyKey: `${conversationId}:tool:${turn.t}:${turn.text.slice(0, 40)}`,
        },
      });
    }

    const linked = await this.linkAppointmentForCall({
      interactionId: interaction.id,
      patientId: patient?.id,
      conversationId,
      startedAt,
      endedAt,
    });

    return {
      ok: true,
      interactionId: interaction.id,
      appointmentId: linked?.appointmentId || interaction.appointmentId,
      turns: turns.length,
    };
  }

  async linkAppointmentToConversation(
    conversationId: string | undefined,
    appointmentId: string,
    resultCode?: string,
  ) {
    if (!conversationId) return;
    const interaction = await this.prisma.interaction.findUnique({
      where: {
        provider_providerConversationId: {
          provider: Provider.VOICE_AGENT,
          providerConversationId: conversationId,
        },
      },
    });
    if (!interaction) {
      // Crear stub mínimo; end-call lo completará
      await this.prisma.interaction.create({
        data: {
          channel: 'CALL',
          direction: Direction.INBOUND,
          status: InteractionStatus.IN_PROGRESS,
          startedAt: new Date(),
          from: 'pending',
          to: 'Hospital Central La Paz',
          aiHandled: true,
          resultCode: resultCode || 'APPOINTMENT_BOOKED',
          provider: Provider.VOICE_AGENT,
          providerConversationId: conversationId,
          appointmentId,
        },
      });
      return;
    }
    await this.prisma.interaction.update({
      where: { id: interaction.id },
      data: {
        appointmentId,
        resultCode: resultCode || interaction.resultCode || undefined,
      },
    });
  }

  private async linkAppointmentForCall(params: {
    interactionId: string;
    patientId?: string;
    conversationId: string;
    startedAt: Date;
    endedAt: Date;
  }) {
    const existing = await this.prisma.interaction.findUnique({
      where: { id: params.interactionId },
    });
    if (existing?.appointmentId) {
      return { appointmentId: existing.appointmentId };
    }

    const windowStart = new Date(params.startedAt.getTime() - 5 * 60_000);
    const windowEnd = new Date(params.endedAt.getTime() + 5 * 60_000);

    // Prefer appointments touched by VOICE_AGENT in the call window
    const change = await this.prisma.appointmentChange.findFirst({
      where: {
        origin: 'VOICE_AGENT',
        createdAt: { gte: windowStart, lte: windowEnd },
        ...(params.patientId
          ? { appointment: { patientId: params.patientId } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { appointment: true },
    });

    let appointmentId = change?.appointmentId;
    if (!appointmentId && params.patientId) {
      const recent = await this.prisma.appointment.findFirst({
        where: {
          patientId: params.patientId,
          channel: 'PHONE_IN',
          updatedAt: { gte: windowStart, lte: windowEnd },
        },
        orderBy: { updatedAt: 'desc' },
      });
      appointmentId = recent?.id;
    }

    if (appointmentId) {
      await this.prisma.interaction.update({
        where: { id: params.interactionId },
        data: { appointmentId },
      });
      return { appointmentId };
    }
    return null;
  }

  private parseTranscript(data: any): TranscriptTurn[] {
    return parseConversationTranscript(data);
  }

  private inferDuration(turns: TranscriptTurn[]) {
    const times = turns.map((t) => t.t || 0).filter(Boolean);
    if (!times.length) return null;
    return Math.max(...times);
  }

  private inferResultCode(turns: TranscriptTurn[], summary: any): string | null {
    return inferResultCodeFromTurns(
      turns,
      typeof summary === 'string' ? summary : null,
    );
  }
}
