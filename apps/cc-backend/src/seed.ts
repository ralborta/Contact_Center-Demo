/**
 * Seed hospitalario demo — Bolivia / America/La_Paz
 * IDEMPOTENTE y NO destructivo: solo agrega lo que falta.
 * Conserva a Juan Pérez 1234567 y sus citas existentes.
 */
import {
  PrismaClient,
  SlotStatus,
  AppointmentStatus,
  ChangeOrigin,
  Direction,
  InteractionStatus,
  Outcome,
  Provider,
  AppointmentChannel,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SPECIALTIES = [
  { code: 'MG', name: 'Medicina General', description: 'Atención primaria' },
  { code: 'PED', name: 'Pediatría', description: 'Niños y adolescentes' },
  { code: 'GIN', name: 'Ginecología', description: 'Salud de la mujer' },
  { code: 'CARD', name: 'Cardiología', description: 'Corazón y circulación' },
  { code: 'TRA', name: 'Traumatología', description: 'Huesos y articulaciones' },
  { code: 'DER', name: 'Dermatología', description: 'Piel' },
  { code: 'OFT', name: 'Oftalmología', description: 'Vista' },
  { code: 'NEU', name: 'Neurología', description: 'Sistema nervioso' },
  { code: 'ODO', name: 'Odontología', description: 'Salud bucal' },
  { code: 'PSI', name: 'Psiquiatría', description: 'Salud mental' },
];

/** 30 médicos: 3 por especialidad (orden = specialty index). */
const DOCTORS_BY_SPECIALTY: Array<[string, string][]> = [
  [['Ana', 'Quispe'], ['Patricia', 'López'], ['Ricardo', 'Mendoza']], // MG
  [['Carlos', 'Mamani'], ['Bruno', 'Arias'], ['Jimena', 'Suárez']], // PED
  [['María', 'Condori'], ['Lucía', 'Flores'], ['Camila', 'Aguilar']], // GIN
  [['José', 'Vargas'], ['Diego', 'Salazar'], ['Héctor', 'Navarro']], // CARD
  [['Pedro', 'Rojas'], ['Valeria', 'Torrez'], ['Óscar', 'Rivera']], // TRA
  [['Elena', 'Choque'], ['Sofía', 'Gutierrez'], ['Natalia', 'Paz']], // DER
  [['Miguel', 'Paredes'], ['Fernando', 'Miranda'], ['Adriana', 'Mejía']], // OFT
  [['Andrés', 'Cruz'], ['Gabriela', 'Silva'], ['Esteban', 'Villca']], // NEU
  [['Daniela', 'Castro'], ['Roberto', 'Calle'], ['Paola', 'Núñez']], // ODO
  [['Iván', 'Barrientos'], ['Claudia', 'Zambrana'], ['Mauricio', 'Pinto']], // PSI
];

const CONSULTORIOS = ['101', '102', '103', '201', '202', '203', '301', '302', 'A-1', 'A-2', 'B-1', 'B-2'];

const SCHEDULE_VARIANTS = [
  [
    { dayOfWeek: 1, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
    { dayOfWeek: 1, startTime: '14:00', endTime: '18:00', slotDuration: 30 },
    { dayOfWeek: 3, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
    { dayOfWeek: 5, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
  ],
  [
    { dayOfWeek: 2, startTime: '09:00', endTime: '13:00', slotDuration: 30 },
    { dayOfWeek: 2, startTime: '15:00', endTime: '19:00', slotDuration: 30 },
    { dayOfWeek: 4, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
    { dayOfWeek: 4, startTime: '14:00', endTime: '17:00', slotDuration: 30 },
  ],
  [
    { dayOfWeek: 1, startTime: '07:00', endTime: '11:00', slotDuration: 45 },
    { dayOfWeek: 3, startTime: '14:00', endTime: '18:00', slotDuration: 45 },
    { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', slotDuration: 45 },
  ],
  [
    { dayOfWeek: 2, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
    { dayOfWeek: 3, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
    { dayOfWeek: 4, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
    { dayOfWeek: 5, startTime: '14:00', endTime: '18:00', slotDuration: 30 },
  ],
];

function laPazLocalToUtc(day: Date, hour: number, minute: number): Date {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour + 4, minute, 0, 0));
}

async function main() {
  console.log('=== Seed Centro de Citas (idempotente) ===');

  const profiles = [
    { name: 'Administrador', slug: 'ADMIN', description: 'Acceso total' },
    { name: 'Operador', slug: 'AGENT', description: 'Mesa de citas / call center' },
    { name: 'Doctor', slug: 'DOCTOR', description: 'Gestiona su agenda' },
    { name: 'Solo lectura', slug: 'VIEWER', description: 'Solo consulta' },
  ];
  for (const p of profiles) {
    await prisma.profile.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description },
      create: p,
    });
  }

  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || '';
  const adminProfile = await prisma.profile.findUniqueOrThrow({ where: { slug: 'ADMIN' } });
  const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    if (!adminPassword || adminPassword.length < 8) {
      console.log('SEED_ADMIN_PASSWORD no definido: se omite creación de admin.');
    } else {
      await prisma.user.create({
        data: {
          username: adminUsername,
          passwordHash: await argon2.hash(adminPassword),
          profileId: adminProfile.id,
          active: true,
        },
      });
      console.log(`Usuario admin creado: ${adminUsername}`);
    }
  }

  await prisma.agentConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      hospitalName: 'Hospital Central La Paz',
      greeting:
        'Buenos días, habla el asistente de citas del Hospital Central La Paz. ¿En qué puedo ayudarle?',
      businessHoursStart: '07:00',
      businessHoursEnd: '20:00',
      timezone: 'America/La_Paz',
      currency: 'Bs',
      locale: 'es-BO',
    },
  });

  const specialtyIds: string[] = [];
  for (const s of SPECIALTIES) {
    const sp = await prisma.specialty.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description, active: true },
      create: s,
    });
    specialtyIds.push(sp.id);
  }
  console.log(`${specialtyIds.length} especialidades`);

  const doctors: Array<{ id: string; specialtyId: string; defaultDurationMin: number }> = [];
  let doctorsCreated = 0;
  for (let si = 0; si < DOCTORS_BY_SPECIALTY.length; si++) {
    const specialtyId = specialtyIds[si];
    const names = DOCTORS_BY_SPECIALTY[si];
    for (let di = 0; di < names.length; di++) {
      const [firstName, lastName] = names[di];
      const existing = await prisma.doctor.findFirst({
        where: { firstName, lastName, specialtyId },
      });
      if (existing) {
        doctors.push(existing);
        continue;
      }
      const globalIndex = si * 3 + di;
      const schedules = SCHEDULE_VARIANTS[globalIndex % SCHEDULE_VARIANTS.length];
      const d = await prisma.doctor.create({
        data: {
          firstName,
          lastName,
          specialtyId,
          consultorio: CONSULTORIOS[globalIndex % CONSULTORIOS.length],
          phone: `5917000${String(1000 + globalIndex).slice(-4)}`,
          email: `${firstName
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()}.${lastName
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()}@hospital.demo.bo`,
          defaultDurationMin: schedules[0].slotDuration || 30,
          status: 'ACTIVE',
          schedules: { create: schedules },
        },
      });
      doctors.push(d);
      doctorsCreated++;
    }
  }
  console.log(`${doctors.length} doctores (${doctorsCreated} nuevos)`);

  // Slots próximas 3 semanas (solo crea faltantes)
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const daysAhead = 21;
  let slotsCreated = 0;
  for (const doctor of doctors) {
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: doctor.id, active: true },
    });
    const duration = doctor.defaultDurationMin;
    const cursor = new Date(start);
    for (let day = 0; day < daysAhead; day++) {
      const dow = cursor.getDay();
      for (const sch of schedules.filter((s) => s.dayOfWeek === dow)) {
        const slotDur = sch.slotDuration || duration;
        const [sh, sm] = sch.startTime.split(':').map(Number);
        const [eh, em] = sch.endTime.split(':').map(Number);
        let mins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        while (mins + slotDur <= endMins) {
          const startsAt = laPazLocalToUtc(cursor, Math.floor(mins / 60), mins % 60);
          const endsAt = new Date(startsAt.getTime() + slotDur * 60_000);
          if (startsAt > now) {
            try {
              await prisma.slot.create({
                data: { doctorId: doctor.id, startsAt, endsAt, status: SlotStatus.FREE },
              });
              slotsCreated++;
            } catch {
              /* unique — ya existe */
            }
          }
          mins += slotDur;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  console.log(`${slotsCreated} slots nuevos generados`);

  const patientsData = [
    { firstName: 'Juan', lastName: 'Pérez', documentId: '1234567', phone: '59170111222', insurance: 'Caja Nacional de Salud' },
    { firstName: 'María', lastName: 'García', documentId: '2345678', phone: '59170222333', insurance: 'Seguro Social Universitario' },
    { firstName: 'Luis', lastName: 'Fernández', documentId: '3456789', phone: '59170333444', insurance: null as string | null },
    { firstName: 'Carmen', lastName: 'Rojas', documentId: '4567890', phone: '59170444555', insurance: 'Caja Petrolera' },
    { firstName: 'Roberto', lastName: 'Mendoza', documentId: '5678901', phone: '59170555666', insurance: null },
    { firstName: 'Patricia', lastName: 'Aliaga', documentId: '6789012', phone: '59170666777', insurance: 'Caja Nacional de Salud' },
    { firstName: 'Andrés', lastName: 'Choque', documentId: '7890123', phone: '59170777888', insurance: null },
    { firstName: 'Elena', lastName: 'Vargas', documentId: '8901234', phone: '59170888999', insurance: 'Seguro Privado Demo' },
    { firstName: 'Hugo', lastName: 'Soria', documentId: '9012345', phone: '59170999001', insurance: null },
    { firstName: 'Isabel', lastName: 'Calle', documentId: '9123456', phone: '59170999002', insurance: 'Caja Nacional de Salud' },
  ];

  const patients = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { documentId: p.documentId },
      update: {}, // no pisa datos existentes (protege a Juan Pérez)
      create: {
        firstName: p.firstName,
        lastName: p.lastName,
        documentId: p.documentId,
        phone: p.phone,
        insurance: p.insurance || undefined,
        normalizedPhone: p.phone,
      },
    });
    patients.push(patient);
  }
  console.log(`${patients.length} pacientes (upsert)`);

  // Solo agregar citas demo si hay pocas activas (no borra las de Juan)
  const activeCount = await prisma.appointment.count({
    where: {
      status: { in: ['RESERVED', 'CONFIRMED', 'RESCHEDULED', 'NEEDS_RESCHEDULE'] },
    },
  });
  let appts = 0;
  if (activeCount < 10) {
    const freeSlots = await prisma.slot.findMany({
      where: { status: SlotStatus.FREE, startsAt: { gt: now } },
      include: { doctor: true },
      orderBy: { startsAt: 'asc' },
      take: 20,
    });
    for (let i = 0; i < Math.min(10 - activeCount, freeSlots.length); i++) {
      const slot = freeSlots[i];
      const patient = patients[i % patients.length];
      const claimed = await prisma.slot.updateMany({
        where: { id: slot.id, status: SlotStatus.FREE },
        data: { status: SlotStatus.RESERVED },
      });
      if (claimed.count !== 1) continue;
      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: slot.doctorId,
          specialtyId: slot.doctor.specialtyId,
          slotId: slot.id,
          status: AppointmentStatus.RESERVED,
          channel: AppointmentChannel.CONSOLE,
          changes: {
            create: {
              toStatus: AppointmentStatus.RESERVED,
              toSlotId: slot.id,
              origin: ChangeOrigin.OPERATOR,
              reason: 'Cita demo seed',
            },
          },
        },
      });
      appts++;
    }
  }
  console.log(`${appts} citas demo nuevas (activas previas: ${activeCount})`);

  const callCount = await prisma.interaction.count();
  if (callCount < 3) {
    const patient = patients[0];
    await prisma.interaction.create({
      data: {
        channel: 'CALL',
        direction: Direction.INBOUND,
        status: InteractionStatus.COMPLETED,
        startedAt: new Date(Date.now() - 3600_000),
        endedAt: new Date(Date.now() - 3500_000),
        from: patient.phone,
        to: '+59122000000',
        patientId: patient.id,
        aiHandled: true,
        outcome: Outcome.RESOLVED,
        intent: 'reservar_cita',
        resultCode: 'APPOINTMENT_BOOKED',
        provider: Provider.VOICE_AGENT,
        providerConversationId: `demo-seed-${Date.now()}`,
        callDetail: {
          create: {
            externalCallId: `demo-seed`,
            durationSec: 150,
            transcriptText: `Agente: Buenos días.\nPaciente: Soy ${patient.firstName} ${patient.lastName}.`,
            summary: 'Llamada demo de seed.',
          },
        },
      },
    });
    console.log('1 llamada demo creada');
  }

  const totals = {
    specialties: await prisma.specialty.count({ where: { active: true } }),
    doctors: await prisma.doctor.count({ where: { status: 'ACTIVE' } }),
    patients: await prisma.patient.count(),
    freeSlots: await prisma.slot.count({ where: { status: 'FREE', startsAt: { gt: now } } }),
  };
  console.log('Totales:', totals);
  console.log('=== Seed completado (no destructivo) ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
