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
    const [firstName, ...rest] = (body.nombre || '').trim().split(/\s+/);
    const lastName = body.apellido || rest.join(' ') || undefined;
    const result = await this.patients.identifyOrRegister({
      phone: body.telefono,
      documentId: body.ci,
      firstName: firstName || undefined,
      lastName,
      insurance: body.seguro,
    });
    if (!result.patient) {
      return {
        ok: false,
        encontrado: false,
        mensaje:
          'No encontré al paciente. Necesito nombre completo, carnet de identidad y teléfono para registrarlo.',
        faltantes: result.missing,
      };
    }
    const voice = this.patients.formatForVoice(result.patient);
    const citas = await this.appointments.listPatientAppointments(result.patient.id);
    return {
      ok: true,
      encontrado: true,
      creado: result.created,
      paciente: voice,
      citasProximas: citas.map((c) => this.appointments.formatForVoice(c)),
      mensaje: result.created
        ? `Registré a ${voice.nombre}. ¿En qué especialidad desea su cita?`
        : `Hola ${result.patient.firstName}. ${voice.mensaje}`,
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

  async searchDoctors(body: { especialidad?: string; especialidadId?: string; nombre?: string }) {
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
    const doctors = await this.prisma.doctor.findMany({
      where: {
        status: 'ACTIVE',
        ...(specialtyId ? { specialtyId } : {}),
        ...(body.nombre
          ? {
              OR: [
                { firstName: { contains: body.nombre, mode: 'insensitive' } },
                { lastName: { contains: body.nombre, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { specialty: true },
      orderBy: { lastName: 'asc' },
      take: 15,
    });
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
    desde?: string;
    hasta?: string;
    periodo?: 'manana' | 'tarde' | 'cualquiera';
  }) {
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
    const from = body.desde ? new Date(body.desde) : new Date();
    const to = body.hasta
      ? new Date(body.hasta)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const periodMap = {
      manana: 'morning' as const,
      tarde: 'afternoon' as const,
      cualquiera: 'any' as const,
    };
    const slots = await this.availability.findAvailable({
      specialtyId,
      doctorId: body.doctorId,
      from,
      to,
      period: periodMap[body.periodo || 'cualquiera'],
      limit: 5,
    });
    return {
      ok: true,
      disponibles: slots,
      mensaje:
        slots.length === 0
          ? 'No hay horarios libres en ese rango. ¿Quiere que busque en otras fechas?'
          : `Tengo estas opciones: ${slots.map((s, i) => `${i + 1}) ${s.mensaje}`).join('; ')}.`,
    };
  }

  async reserve(body: {
    pacienteId: string;
    slotId: string;
    motivo?: string;
  }) {
    try {
      const appt = await this.appointments.reserve({
        patientId: body.pacienteId,
        slotId: body.slotId,
        channel: AppointmentChannel.PHONE_IN,
        origin: ChangeOrigin.VOICE_AGENT,
        reason: body.motivo,
      });
      const voice = this.appointments.formatForVoice(appt);
      return {
        ok: true,
        cita: voice,
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
  }) {
    try {
      const appt = await this.appointments.reschedule({
        appointmentId: body.citaId,
        newSlotId: body.nuevoSlotId,
        origin: ChangeOrigin.VOICE_AGENT,
        reason: body.motivo,
      });
      const voice = this.appointments.formatForVoice(appt);
      return {
        ok: true,
        cita: voice,
        mensaje: `Reprogramé su cita. ${voice.mensaje}`,
      };
    } catch (e: any) {
      return { ok: false, mensaje: e.message || 'No pude reprogramar.' };
    }
  }

  async cancel(body: { citaId: string; motivo?: string }) {
    try {
      const appt = await this.appointments.cancelByPatient({
        appointmentId: body.citaId,
        origin: ChangeOrigin.VOICE_AGENT,
        reason: body.motivo || 'Cancelada por el paciente vía teléfono',
      });
      return {
        ok: true,
        citaId: appt.id,
        mensaje: 'Su cita quedó cancelada. Si desea otra fecha, puedo ayudarle a reservar.',
      };
    } catch (e: any) {
      return { ok: false, mensaje: e.message || 'No pude cancelar la cita.' };
    }
  }

  async handleCallInit(payload: any) {
    const phone =
      payload?.caller_id ||
      payload?.from ||
      payload?.phone ||
      payload?.metadata?.phone ||
      '';
    const patient = phone
      ? await this.patients.findByPhoneOrCi(String(phone))
      : null;
    const config = await this.prisma.agentConfig.findUnique({ where: { id: 'default' } });

    if (!patient) {
      return {
        type: 'conversation_initiation_client_data',
        dynamic_variables: {
          paciente_conocido: 'false',
          hospital_nombre: config?.hospitalName || 'Hospital Central La Paz',
          saludo: config?.greeting || '',
        },
      };
    }
    const citas = await this.appointments.listPatientAppointments(patient.id);
    return {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        paciente_conocido: 'true',
        paciente_id: patient.id,
        paciente_nombre: patient.firstName,
        paciente_nombre_completo: `${patient.firstName} ${patient.lastName}`,
        paciente_ci_mask: patient.documentId.slice(-3),
        citas_proximas_count: String(citas.length),
        citas_resumen:
          citas.length === 0
            ? 'sin citas próximas'
            : citas
                .slice(0, 3)
                .map((c) => this.appointments.formatForVoice(c).mensaje)
                .join('; '),
        hospital_nombre: config?.hospitalName || 'Hospital Central La Paz',
        saludo: config?.greeting || '',
      },
    };
  }

  async handlePostCall(payload: any) {
    const conversationId =
      payload?.data?.conversation_id ||
      payload?.conversation_id ||
      payload?.cid ||
      null;
    const from =
      payload?.data?.metadata?.phone_call?.external_number ||
      payload?.data?.metadata?.caller_id ||
      payload?.caller_id ||
      'unknown';
    const to =
      payload?.data?.metadata?.phone_call?.agent_number ||
      payload?.to ||
      'hospital';
    const transcript =
      payload?.data?.transcript ||
      payload?.transcript ||
      (Array.isArray(payload?.data?.transcript)
        ? payload.data.transcript.map((t: any) => `${t.role}: ${t.message}`).join('\n')
        : null);
    const summary =
      payload?.data?.analysis?.transcript_summary ||
      payload?.data?.analysis?.call_summary_title ||
      payload?.summary ||
      null;
    const durationSec =
      payload?.data?.metadata?.call_duration_secs ||
      payload?.duration_secs ||
      null;
    const recordingUrl =
      payload?.data?.metadata?.recording_url ||
      payload?.recording_url ||
      null;
    const direction =
      (payload?.data?.metadata?.phone_call?.direction || '').toLowerCase() === 'outbound'
        ? Direction.OUTBOUND
        : Direction.INBOUND;

    let transcriptText = '';
    if (typeof transcript === 'string') transcriptText = transcript;
    else if (Array.isArray(transcript)) {
      transcriptText = transcript
        .map((t: any) => `${t.role || t.speaker || '?'}: ${t.message || t.text || ''}`)
        .join('\n');
    }

    const patient = await this.patients.findByPhoneOrCi(String(from));

    const interaction = await this.prisma.interaction.upsert({
      where: {
        provider_providerConversationId: {
          provider: Provider.VOICE_AGENT,
          providerConversationId: conversationId || `anon-${Date.now()}`,
        },
      },
      create: {
        channel: 'CALL',
        direction,
        status: InteractionStatus.COMPLETED,
        startedAt: new Date(Date.now() - (durationSec || 0) * 1000),
        endedAt: new Date(),
        from: String(from),
        to: String(to),
        patientId: patient?.id,
        aiHandled: true,
        outcome: Outcome.RESOLVED,
        provider: Provider.VOICE_AGENT,
        providerConversationId: conversationId || `anon-${Date.now()}`,
        callDetail: {
          create: {
            externalCallId: conversationId,
            transcriptText,
            summary: typeof summary === 'string' ? summary : JSON.stringify(summary),
            durationSec: durationSec ? Number(durationSec) : null,
            recordingUrl,
          },
        },
      },
      update: {
        status: InteractionStatus.COMPLETED,
        endedAt: new Date(),
        patientId: patient?.id || undefined,
        callDetail: {
          upsert: {
            create: {
              externalCallId: conversationId,
              transcriptText,
              summary: typeof summary === 'string' ? summary : null,
              durationSec: durationSec ? Number(durationSec) : null,
              recordingUrl,
            },
            update: {
              transcriptText: transcriptText || undefined,
              summary: typeof summary === 'string' ? summary : undefined,
              durationSec: durationSec ? Number(durationSec) : undefined,
              recordingUrl: recordingUrl || undefined,
            },
          },
        },
      },
    });

    return { ok: true, interactionId: interaction.id };
  }
}
