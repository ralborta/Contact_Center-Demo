import { Direction, InteractionStatus, Provider } from '@prisma/client';
import { AgentService } from './agent.service';

describe('AgentService patient ↔ call linking', () => {
  const interactions: any[] = [];
  const patientsDb: Record<string, any> = {
    'p-raul': {
      id: 'p-raul',
      firstName: 'Raúl',
      lastName: 'Test',
      documentId: '40999888',
      phone: '5491144443333',
      normalizedPhone: '5491144443333',
    },
    'p-juan': {
      id: 'p-juan',
      firstName: 'Juan',
      lastName: 'Pérez',
      documentId: '1234567',
      phone: '5491155551234',
      normalizedPhone: '5491155551234',
    },
  };
  const appointmentsDb: Record<string, any> = {
    'a-1': { id: 'a-1', patientId: 'p-raul', voiceConversationId: 'conv_test_1' },
  };

  const prisma = {
    patient: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return patientsDb[where.id] || null;
        if (where.documentId) {
          return (
            Object.values(patientsDb).find((p) => p.documentId === where.documentId) ||
            null
          );
        }
        return null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const or = where?.OR || [];
        for (const clause of or) {
          const hit = Object.values(patientsDb).find(
            (p) =>
              (clause.phone && p.phone === clause.phone) ||
              (clause.normalizedPhone && p.normalizedPhone === clause.normalizedPhone),
          );
          if (hit) return hit;
        }
        return null;
      }),
    },
    appointment: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.voiceConversationId) {
          return (
            Object.values(appointmentsDb).find(
              (a) => a.voiceConversationId === where.voiceConversationId,
            ) || null
          );
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => appointmentsDb[where.id] || null),
    },
    interaction: {
      findUnique: jest.fn(async ({ where }: any) => {
        const cid = where?.provider_providerConversationId?.providerConversationId;
        return interactions.find((i) => i.providerConversationId === cid) || null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `ix-${interactions.length + 1}`, ...data };
        interactions.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = interactions.find((i) => i.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const cid = where.provider_providerConversationId.providerConversationId;
        let row = interactions.find((i) => i.providerConversationId === cid);
        if (!row) {
          row = { id: `ix-${interactions.length + 1}`, ...create };
          interactions.push(row);
        } else {
          Object.assign(row, update);
        }
        return row;
      }),
    },
    interactionEvent: {
      create: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    agentConfig: {
      findUnique: jest.fn(async () => null),
    },
  } as any;

  const patients = {
    findByPhoneOrCi: jest.fn(async (phone?: string, ci?: string) => {
      if (ci) {
        return Object.values(patientsDb).find((p) => p.documentId === ci) || null;
      }
      if (phone) {
        const digits = String(phone).replace(/\D/g, '');
        return (
          Object.values(patientsDb).find(
            (p) => p.phone === phone || p.normalizedPhone === digits || p.phone === digits,
          ) || null
        );
      }
      return null;
    }),
    formatForVoice: jest.fn((p: any) => ({
      id: p.id,
      nombre: `${p.firstName} ${p.lastName}`,
      mensaje: `Paciente ${p.firstName}`,
    })),
    registerNew: jest.fn(),
  } as any;

  const appointments = {
    listPatientAppointments: jest.fn(async () => []),
    formatForVoice: jest.fn((c: any) => c),
  } as any;

  const availability = {} as any;
  const svc = new AgentService(patients, appointments, availability, prisma);

  beforeEach(() => {
    interactions.length = 0;
    jest.clearAllMocks();
  });

  it('identificar_paciente vincula patientId a la conversación', async () => {
    patients.findByPhoneOrCi.mockResolvedValueOnce(patientsDb['p-raul']);
    const r = await svc.identifyPatient({
      ci: '40999888',
      conversationId: 'conv_test_link',
    });
    expect(r.ok).toBe(true);
    expect(prisma.interaction.create).toHaveBeenCalled();
    const created = interactions[0];
    expect(created.patientId).toBe('p-raul');
    expect(created.providerConversationId).toBe('conv_test_link');
    expect(created.provider).toBe(Provider.VOICE_AGENT);
  });

  it('post-call usa paciente de la cita, no el del teléfono del emulador', async () => {
    interactions.push({
      id: 'ix-1',
      provider: Provider.VOICE_AGENT,
      providerConversationId: 'conv_test_1',
      patientId: 'p-raul',
      from: '5491155551234',
      status: InteractionStatus.IN_PROGRESS,
      direction: Direction.INBOUND,
    });
    patients.findByPhoneOrCi.mockResolvedValue(patientsDb['p-juan']);

    await svc.handlePostCall({
      type: 'post_call_transcription',
      data: {
        conversation_id: 'conv_test_1',
        transcript: [],
        analysis: { transcript_summary: 'El paciente reservó un turno.' },
        metadata: {
          call_duration_secs: 40,
          phone_call: { external_number: '5491155551234' },
        },
        dynamic_variables: { caller_phone: '5491155551234' },
      },
    });

    const row = interactions.find((i) => i.providerConversationId === 'conv_test_1');
    expect(row.patientId).toBe('p-raul');
    expect(row.patientId).not.toBe('p-juan');
  });
});
