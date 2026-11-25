import { Injectable } from '@nestjs/common';
import {
  AppointmentChannel,
  ChangeOrigin,
  Direction,
  InteractionStatus,
  Outcome,
  Provider,
} from '@prisma/client';
import { AppointmentsService } from '../appointments/appointments.service';
import { AvailabilityService } from '../appointments/availability.service';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ensureSpanishSummary } from '../voice/summary-es';
import {
  extractAppointmentIdFromTranscript,
  extractExecutedToolNames,
  inferResultCodeFromTurns,
  parseConversationTranscript,
} from '../voice/transcript';
import { doctorMatchesName, stripDoctorPrefix } from './doctor-name';

/** Extrae conversation_id de body EL (system__conversation_id o aliases). */
function resolveConversationId(body: any): string | undefined {
  const raw =
    body?.conversationId ||
    body?.conversation_id ||
    body?.system__conversation_id ||
    body?.['system__conversation_id'] ||
    null;
  const id = raw != null ? String(raw).trim() : '';
  return id || undefined;
}

@Injectable()
export class AgentService {
  constructor(
    private patients: PatientsService,
    private appointments: AppointmentsService,
    private availability: AvailabilityService,
    private prisma: PrismaService,
  ) {}

  async identifyPatient(body: {
    telefono?: string;
    ci?: string;
    nombre?: string;
    apellido?: string;
    seguro?: string;
  }) {
    // Solo búsqueda: el alta va por registrar-paciente
    const patient = await this.patients.findByPhoneOrCi(body.telefono, body.ci);
    if (!patient) {
      return {
        ok: false,
        encontrado: false,
        mensaje:
          'No encontré al paciente. Ofrezca registrarlo: pida nombre, apellido, DNI y teléfono, confirme los datos y use registrar_paciente.',
        faltantes: ['nombre', 'apellido', 'dni', 'telefono'],
      };
    }
    const voice = this.patients.formatForVoice(patient);
    const citas = await this.appointments.listPatientAppointments(patient.id);
    return {
      ok: true,
      encontrado: true,
      creado: false,
      paciente: voice,
      citasProximas: citas.map((c) => this.appointments.formatForVoice(c)),
      mensaje: `Hola ${patient.firstName}. ${voice.mensaje}`,
    };
  }

  async registerPatient(body: {
    nombre?: string;
    apellido?: string;
    documento?: string;
    ci?: string;
    telefono?: string;
    fechaNacimiento?: string;
    fecha_nacimiento?: string;
    seguro?: string;
    conversationId?: string;
    conversation_id?: string;
    system__conversation_id?: string;
  }) {
    const documentId = body.documento || body.ci;
    const dateOfBirth = body.fechaNacimiento || body.fecha_nacimiento || null;
    const result = await this.patients.registerNew({
      firstName: (body.nombre || '').trim(),
      lastName: (body.apellido || '').trim(),
      documentId: documentId || '',
      phone: body.telefono || '',
      insurance: body.seguro,
      dateOfBirth,
    });
    if (!result.patient) {
      return {
        ok: false,
        registrado: false,
        mensaje:
          'Faltan datos para registrar. Necesito nombre, apellido, DNI y teléfono.',
        faltantes: result.missing,
      };
    }
    const conversationId = resolveConversationId(body);
    await this.linkConversationToPatient(conversationId, result.patient.id);
    const voice = this.patients.formatForVoice(result.patient);
    return {
      ok: true,
      registrado: true,
      creado: result.created,
      yaExistia: !result.created,
      paciente: voice,
      pacienteId: result.patient.id,
      conversationId: conversationId || null,
      mensaje: result.created
        ? `Registré a ${voice.nombre}. ¿En qué especialidad desea su cita?`
        : `Ya teníamos a ${voice.nombre} en el sistema. ¿En qué especialidad desea su cita?`,
    };
  }

  async listSpecialties() {
    const items = await this.prisma.specialty.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return {
      ok: true,
      especialidades: items.map((s) => ({
        id: s.id,
        codigo: s.code,
        nombre: s.name,
      })),
      mensaje: `Tenemos ${items.length} especialidades: ${items.map((s) => s.name).join(', ')}.`,
    };
  }

  async searchDoctors(body: {
    especialidad?: string;
    especialidadId?: string;
    nombre?: string;
    doctor?: string;
    doctorId?: string;
  }) {
    const nameQuery = body.nombre || body.doctor;
    let specialtyId = body.especialidadId;
    if (!specialtyId && body.especialidad) {
      const sp = await this.prisma.specialty.findFirst({
        where: {
          OR: [
            { name: { contains: body.especialidad, mode: 'insensitive' } },
            { code: { equals: body.especialidad, mode: 'insensitive' } },
          ],
          active: true,
        },
      });
      specialtyId = sp?.id;
    }

    if (body.doctorId) {
      const one = await this.prisma.doctor.findFirst({
        where: {
          id: body.doctorId,
          status: 'ACTIVE',
          ...(specialtyId ? { specialtyId } : {}),
        },
        include: { specialty: true },
      });
      const doctors = one ? [one] : [];
      return this.formatDoctorSearch(doctors, nameQuery);
    }

    const candidates = await this.prisma.doctor.findMany({
      where: {
        status: 'ACTIVE',
        ...(specialtyId ? { specialtyId } : {}),
      },
      include: { specialty: true },
      orderBy: { lastName: 'asc' },
    });
    // Sin tope artificial: el listado completo (≈30) debe verse en la API del agente.
    const matched = nameQuery
      ? candidates.filter((d) => doctorMatchesName(d, nameQuery))
      : candidates;
    return this.formatDoctorSearch(matched, nameQuery);
  }

  private formatDoctorSearch(
    doctors: Array<{
      id: string;
      firstName: string;
      lastName: string;
      consultorio: string | null;
      defaultDurationMin: number;
      specialty: { name: string };
    }>,
    nameQuery?: string,
  ) {
    if (doctors.length === 0 && stripDoctorPrefix(nameQuery || '')) {
      return {
        ok: true,
        doctores: [],
        mensaje: 'No encontré un médico con ese nombre',
      };
    }
    return {
      ok: true,
      doctores: doctors.map((d) => ({
        id: d.id,
        nombre: `Dr(a). ${d.firstName} ${d.lastName}`,
        especialidad: d.specialty.name,
        consultorio: d.consultorio,
        duracionMin: d.defaultDurationMin,
      })),
      mensaje:
        doctors.length === 0
          ? 'No encontré doctores con esos criterios.'
          : `Encontré ${doctors.length}: ${doctors.map((d) => `Dr(a). ${d.lastName}`).join(', ')}.`,
    };
  }

  async checkAvailability(body: {
    especialidad?: string;
    especialidadId?: string;
    doctorId?: string;
    doctor?: string;
    nombre?: string;
    desde?: string;
    hasta?: string;
    periodo?: 'manana' | 'tarde' | 'cualquiera';
    dias?: number;
  }) {
    const nameQuery = body.doctor || body.nombre;
    let specialtyId = body.especialidadId;
    if (!specialtyId && body.especialidad) {
      const sp = await this.prisma.specialty.findFirst({
        where: {
          OR: [
            { name: { contains: body.especialidad, mode: 'insensitive' } },
            { code: { equals: body.especialidad, mode: 'insensitive' } },
          ],
        },
      });
      specialtyId = sp?.id;
    }

    // Por defecto buscamos 14 días (próxima semana + margen), no un solo día.
    const rangeDays = Math.min(Math.max(Number(body.dias) || 14, 7), 21);
    const from = body.desde ? new Date(body.desde) : new Date();
    const to = body.hasta
      ? new Date(body.hasta)
      : new Date(Date.now() + rangeDays * 24 * 60 * 60 * 1000);
    const periodMap = {
      manana: 'morning' as const,
      tarde: 'afternoon' as const,
      cualquiera: 'any' as const,
    };
    const period = periodMap[body.periodo || 'cualquiera'];

    let doctorId = body.doctorId;
    if (!doctorId && nameQuery) {
      const candidates = await this.prisma.doctor.findMany({
        where: {
          status: 'ACTIVE',
          ...(specialtyId ? { specialtyId } : {}),
        },
      });
      const matched = candidates.filter((d) => doctorMatchesName(d, nameQuery));
      if (matched.length === 0) {
        return {
          ok: true,
          disponibles: [],
          mensaje: 'No encontré un médico con ese nombre',
        };
      }
      if (matched.length === 1) {
        doctorId = matched[0].id;
      } else {
        const allSlots = [];
        for (const d of matched) {
          const slots = await this.availability.findAvailable({
            specialtyId,
            doctorId: d.id,
            from,
            to,
            period,
            limit: 5,
          });
          allSlots.push(...slots);
          if (allSlots.length >= 5) break;
        }
        const slots = allSlots
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .slice(0, 5);
        return {
          ok: true,
          rangoDias: rangeDays,
          disponibles: slots,
          mensaje:
            slots.length === 0
              ? `No hay horarios libres en los próximos ${rangeDays} días. ¿Quiere que busque más adelante?`
              : `Tengo estas opciones en los próximos ${rangeDays} días: ${slots.map((s, i) => `${i + 1}) ${s.mensaje}`).join('; ')}.`,
        };
      }
    }

    const slots = await this.availability.findAvailable({
      specialtyId,
      doctorId,
      from,
      to,
      period,
      limit: 5,
    });
    return {
      ok: true,
      rangoDias: rangeDays,
      disponibles: slots,
      mensaje:
        slots.length === 0
          ? `No hay horarios libres en los próximos ${rangeDays} días. ¿Quiere que busque más adelante?`
          : `Tengo estas opciones en los próximos ${rangeDays} días: ${slots.map((s, i) => `${i + 1}) ${s.mensaje}`).join('; ')}.`,
    };
  }

  async reserve(body: {
    pacienteId: string;
    slotId: string;
    motivo?: string;
    conversationId?: string;
    conversation_id?: string;
    system__conversation_id?: string;
  }) {
    const conversationId = resolveConversationId(body);
    try {
      const appt = await this.appointments.reserve({
        patientId: body.pacienteId,
        slotId: body.slotId,
        channel: AppointmentChannel.PHONE_IN,
        origin: ChangeOrigin.VOICE_AGENT,
        reason: body.motivo,
        voiceConversationId: conversationId,
      });
      await this.linkConversationToAppointment(
        conversationId,
        appt.id,
        'APPOINTMENT_BOOKED',
      );
      const voice = this.appointments.formatForVoice(appt);
      return {
        ok: true,
        cita: voice,
        citaId: appt.id,
        conversationId: conversationId || null,
        mensaje: `Listo. ${voice.mensaje} ¿Algo más en lo que pueda ayudarle?`,
      };
    } catch (e: any) {
      return {
        ok: false,
        mensaje: e.message || 'No pude reservar ese horario. Elija otra opción.',
      };
    }
  }

  async listPatientAppointments(body: { pacienteId: string }) {
    const citas = await this.appointments.listPatientAppointments(body.pacienteId);
    return {
      ok: true,
      citas: citas.map((c) => this.appointments.formatForVoice(c)),
      mensaje:
        citas.length === 0
          ? 'No tiene citas próximas.'
          : `Sus citas: ${citas.map((c) => this.appointments.formatForVoice(c).mensaje).join(' | ')}`,
    };
  }

  async reschedule(body: {
    citaId: string;
    nuevoSlotId: string;
    motivo?: string;
    conversationId?: string;
    conversation_id?: string;
    system__conversation_id?: string;
  }) {
    const conversationId = resolveConversationId(body);
    try {
      const appt = await this.appointments.reschedule({
        appointmentId: body.citaId,
        newSlotId: body.nuevoSlotId,
        origin: ChangeOrigin.VOICE_AGENT,
        reason: body.motivo,
        voiceConversationId: conversationId,
      });
      await this.linkConversationToAppointment(
        conversationId,
        appt.id,
        'RESCHEDULED',
      );
      const voice = this.appointments.formatForVoice(appt);
      return {
        ok: true,
        cita: voice,
        citaId: appt.id,
        conversationId: conversationId || null,
        mensaje: `Reprogramé su cita. ${voice.mensaje}`,
      };
    } catch (e: any) {
      return { ok: false, mensaje: e.message || 'No pude reprogramar.' };
    }
  }

  async cancel(body: {
    citaId: string;
    motivo?: string;
    conversationId?: string;
    conversation_id?: string;
    system__conversation_id?: string;
  }) {
    const conversationId = resolveConversationId(body);
    try {
      const appt = await this.appointments.cancelByPatient({
        appointmentId: body.citaId,
        origin: ChangeOrigin.VOICE_AGENT,
        reason: body.motivo || 'Cancelada por el paciente vía teléfono',
        voiceConversationId: conversationId,
      });
      await this.linkConversationToAppointment(
        conversationId,
        appt.id,
        'CANCELLED',
      );
      return {
        ok: true,
        citaId: appt.id,
        conversationId: conversationId || null,
        mensaje: 'Su cita quedó cancelada. Si desea otra fecha, puedo ayudarle a reservar.',
      };
    } catch (e: any) {
      return { ok: false, mensaje: e.message || 'No pude cancelar la cita.' };
    }
  }

  /** Vincula la conversación del agente con la cita (y viceversa). */
  private async linkConversationToAppointment(
    conversationId: string | undefined,
    appointmentId: string,
    resultCode: string,
  ) {
    if (!conversationId) return;
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true },
    });
    const existing = await this.prisma.interaction.findUnique({
      where: {
        provider_providerConversationId: {
          provider: Provider.VOICE_AGENT,
          providerConversationId: conversationId,
        },
      },
    });
    if (existing) {
      await this.prisma.interaction.update({
        where: { id: existing.id },
        data: {
          appointmentId,
          resultCode,
          ...(appt?.patientId ? { patientId: appt.patientId } : {}),
        },
      });
      return;
    }
    await this.prisma.interaction.create({
      data: {
        channel: 'CALL',
        direction: Direction.INBOUND,
        status: InteractionStatus.IN_PROGRESS,
        startedAt: new Date(),
        from: 'pending',
        to: 'Hospital Santa María',
        aiHandled: true,
        resultCode,
        provider: Provider.VOICE_AGENT,
        providerConversationId: conversationId,
        appointmentId,
        ...(appt?.patientId ? { patientId: appt.patientId } : {}),
      },
    });
  }

  /** Vincula la conversación en curso con el paciente recién registrado/encontrado. */
  private async linkConversationToPatient(
    conversationId: string | undefined,
    patientId: string,
  ) {
    if (!conversationId) return;
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { phone: true, normalizedPhone: true },
    });
    const from = patient?.normalizedPhone || patient?.phone || 'pending';
    const existing = await this.prisma.interaction.findUnique({
      where: {
        provider_providerConversationId: {
          provider: Provider.VOICE_AGENT,
          providerConversationId: conversationId,
        },
      },
    });
    if (existing) {
      await this.prisma.interaction.update({
        where: { id: existing.id },
        data: { patientId, from: existing.from === 'pending' ? from : existing.from },
      });
      return;
    }
    await this.prisma.interaction.create({
      data: {
        channel: 'CALL',
        direction: Direction.INBOUND,
        status: InteractionStatus.IN_PROGRESS,
        startedAt: new Date(),
        from,
        to: 'Hospital Santa María',
        aiHandled: true,
        intent: 'consulta',
        provider: Provider.VOICE_AGENT,
        providerConversationId: conversationId,
        patientId,
      },
    });
  }

  async handleCallInit(payload: any) {
    const dyn = payload?.dynamic_variables || payload?.dynamicVariables || {};
    const phone =
      payload?.caller_id ||
      payload?.from ||
      payload?.phone ||
      payload?.metadata?.phone ||
      dyn?.caller_phone ||
      dyn?.telefono ||
      // system__caller_id solo lo setea ElevenLabs en canales telefónicos reales
      dyn?.system__caller_id ||
      '';
    const patient = phone
      ? await this.patients.findByPhoneOrCi(String(phone))
      : null;
    const config = await this.prisma.agentConfig.findUnique({ where: { id: 'default' } });
    const hospital = config?.hospitalName || 'Hospital Santa María';
    const saludo =
      config?.greeting ||
      'Buenos días, habla el asistente de turnos del Hospital Santa María. ¿En qué te puedo ayudar?';

    // Respuesta estricta: type + dynamic_variables (strings). HTTP 200.
    // No incluir claves system__* (las pone ElevenLabs).
    if (!patient) {
      return {
        type: 'conversation_initiation_client_data',
        dynamic_variables: {
          caller_phone: String(phone || ''),
          telefono: String(phone || ''),
          paciente_conocido: 'false',
          hospital_nombre: hospital,
          saludo,
        },
      };
    }
    const citas = await this.appointments.listPatientAppointments(patient.id);
    return {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        caller_phone: String(phone || patient.phone || ''),
        telefono: String(phone || patient.phone || ''),
        paciente_conocido: 'true',
        paciente_id: String(patient.id),
        paciente_nombre: String(patient.firstName || ''),
        paciente_nombre_completo: `${patient.firstName} ${patient.lastName}`.trim(),
        paciente_ci_mask: String(patient.documentId || '').slice(-3),
        citas_proximas_count: String(citas.length),
        citas_resumen:
          citas.length === 0
            ? 'sin turnos próximos'
            : citas
                .slice(0, 3)
                .map((c) => this.appointments.formatForVoice(c).mensaje)
                .join('; '),
        hospital_nombre: hospital,
        saludo,
      },
    };
  }

  /**
   * Payload real ElevenLabs: { type: 'post_call_transcription', event_timestamp, data: {
   *   agent_id, conversation_id, status, transcript[], analysis{}, metadata{}, ... } }
   */
  async handlePostCall(payload: any) {
    const type = payload?.type || payload?.event || null;
    const data =
      payload?.data && typeof payload.data === 'object' ? payload.data : payload;

    const conversationId =
      data?.conversation_id ||
      payload?.conversation_id ||
      payload?.cid ||
      null;

    const dyn =
      data?.conversation_initiation_client_data?.dynamic_variables ||
      data?.dynamic_variables ||
      payload?.dynamic_variables ||
      {};

    const from =
      data?.metadata?.phone_call?.external_number ||
      data?.metadata?.caller_id ||
      dyn?.caller_phone ||
      dyn?.telefono ||
      dyn?.system__caller_id ||
      payload?.caller_id ||
      'unknown';
    const to =
      data?.metadata?.phone_call?.agent_number ||
      payload?.to ||
      'Hospital Santa María';

    const transcript = data?.transcript ?? payload?.transcript ?? null;
    const analysis = data?.analysis || payload?.analysis || {};
    const rawSummary =
      analysis?.transcript_summary ||
      analysis?.call_summary_title ||
      payload?.summary ||
      null;

    const durationSec =
      data?.metadata?.call_duration_secs ||
      payload?.duration_secs ||
      null;
    const recordingUrl =
      data?.metadata?.recording_url ||
      data?.metadata?.feedback?.recording_url ||
      payload?.recording_url ||
      null;
    const direction =
      (data?.metadata?.phone_call?.direction || '').toLowerCase() === 'outbound'
        ? Direction.OUTBOUND
        : Direction.INBOUND;

    // Turns normalizados (chat + tools legibles) para el detalle de Llamadas
    const turns = parseConversationTranscript({ transcript });
    const transcriptText =
      turns.length > 0
        ? JSON.stringify(turns)
        : typeof transcript === 'string'
          ? transcript
          : '';

    const executedTools = extractExecutedToolNames(transcript);
    let appointmentIdFromTools = extractAppointmentIdFromTranscript(transcript);
    // resultCode SOLO desde tools reales (nunca del summary)
    let resultCode = inferResultCodeFromTurns(turns);
    if (
      executedTools.some((n) => /reservar_cita/i.test(n)) &&
      resultCode === 'RESOLVED'
    ) {
      resultCode = 'APPOINTMENT_BOOKED';
    } else if (
      executedTools.some((n) => /reprogramar_cita/i.test(n)) &&
      resultCode === 'RESOLVED'
    ) {
      resultCode = 'RESCHEDULED';
    } else if (
      executedTools.some((n) => /cancelar_cita/i.test(n)) &&
      resultCode === 'RESOLVED'
    ) {
      resultCode = 'CANCELLED';
    }
    // Si no hubo tool de reserva/reprog/cancel → no marcar booked
    if (
      resultCode === 'APPOINTMENT_BOOKED' &&
      !executedTools.some((n) => /reservar_cita/i.test(n)) &&
      !turns.some((t) => t.toolName && /reservar/i.test(t.toolName))
    ) {
      resultCode = 'RESOLVED';
      appointmentIdFromTools = null;
    }

    const patient = await this.patients.findByPhoneOrCi(String(from));
    const startedAt = new Date(Date.now() - (durationSec || 0) * 1000);
    const endedAt = new Date();
    const providerConversationId = conversationId || `anon-${Date.now()}`;

    // Cita exacta de ESTA conversación (guardada en reservar_cita)
    if (!appointmentIdFromTools && providerConversationId) {
      const byConv = await this.prisma.appointment.findFirst({
        where: { voiceConversationId: providerConversationId },
        orderBy: { createdAt: 'desc' },
      });
      if (byConv) appointmentIdFromTools = byConv.id;
    }

    const intent =
      resultCode === 'APPOINTMENT_BOOKED'
        ? 'cita'
        : resultCode === 'CANCELLED'
          ? 'cancelar'
          : resultCode === 'RESCHEDULED'
            ? 'reprogramar'
            : 'consulta';

    const patientName = patient
      ? `${patient.firstName} ${patient.lastName}`.trim()
      : null;
    const summary = ensureSpanishSummary({
      summary: typeof rawSummary === 'string' ? rawSummary : null,
      turns,
      toolNames: executedTools,
      resultCode,
      patientName,
    });

    const interaction = await this.prisma.interaction.upsert({
      where: {
        provider_providerConversationId: {
          provider: Provider.VOICE_AGENT,
          providerConversationId,
        },
      },
      create: {
        channel: 'CALL',
        direction,
        status: InteractionStatus.COMPLETED,
        startedAt,
        endedAt,
        from: String(from),
        to: String(to),
        patientId: patient?.id,
        aiHandled: true,
        outcome: Outcome.RESOLVED,
        intent,
        resultCode: resultCode || undefined,
        provider: Provider.VOICE_AGENT,
        providerConversationId,
        appointmentId: appointmentIdFromTools || undefined,
        callDetail: {
          create: {
            externalCallId: conversationId,
            transcriptText,
            summary,
            durationSec: durationSec ? Number(durationSec) : null,
            recordingUrl,
          },
        },
      },
      update: {
        status: InteractionStatus.COMPLETED,
        endedAt,
        from: String(from),
        patientId: patient?.id || undefined,
        intent,
        resultCode: resultCode || undefined,
        // Solo setear cita si la resolvimos de tools/conversationId (nunca “última del paciente”)
        appointmentId: appointmentIdFromTools,
        callDetail: {
          upsert: {
            create: {
              externalCallId: conversationId,
              transcriptText,
              summary,
              durationSec: durationSec ? Number(durationSec) : null,
              recordingUrl,
            },
            update: {
              transcriptText:
                transcriptText && transcriptText !== '[]'
                  ? transcriptText
                  : undefined,
              summary,
              durationSec: durationSec ? Number(durationSec) : undefined,
              recordingUrl: recordingUrl || undefined,
            },
          },
        },
      },
    });

    // Eventos de tools legibles en el timeline
    await this.prisma.interactionEvent.deleteMany({
      where: { interactionId: interaction.id, type: 'TOOL' },
    });
    for (const turn of turns.filter((t) => t.role === 'tool')) {
      await this.prisma.interactionEvent.create({
        data: {
          interactionId: interaction.id,
          type: 'TOOL',
          provider: Provider.VOICE_AGENT,
          ts: new Date(startedAt.getTime() + (turn.t || 0) * 1000),
          payload: {
            label: turn.text,
            toolName: turn.toolName,
            appointmentId: turn.appointmentId,
          },
          idempotencyKey: `${providerConversationId}:tool:${turn.t}:${turn.text.slice(0, 40)}`,
        },
      });
    }

    // Nunca vincular por “última cita del paciente” / ventana temporal ambigua.
    return {
      ok: true,
      type: type || 'post_call_transcription',
      interactionId: interaction.id,
      appointmentId: appointmentIdFromTools || null,
      conversationId: providerConversationId,
      resultCode,
      tools: executedTools,
    };
  }
}
