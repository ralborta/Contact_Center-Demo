/**
 * Seed hospitalario demo — Bolivia / America/La_Paz
 * Pacientes ficticios (ej. Juan Pérez 1234567). Sin datos reales.
 */
import { PrismaClient, SlotStatus, AppointmentStatus, ChangeOrigin, Direction, InteractionStatus, Outcome, Provider, AppointmentChannel } from '@prisma/client';
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

const DOCTOR_NAMES = [
  ['Ana', 'Quispe'], ['Carlos', 'Mamani'], ['María', 'Condori'], ['José', 'Vargas'],
  ['Lucía', 'Flores'], ['Pedro', 'Rojas'], ['Elena', 'Choque'], ['Miguel', 'Paredes'],
  ['Sofía', 'Gutierrez'], ['Andrés', 'Cruz'], ['Patricia', 'López'], ['Diego', 'Salazar'],
  ['Valeria', 'Torrez'], ['Fernando', 'Miranda'], ['Camila', 'Aguilar'], ['Ricardo', 'Mendoza'],
  ['Gabriela', 'Silva'], ['Héctor', 'Navarro'], ['Daniela', 'Castro'], ['Óscar', 'Rivera'],
  ['Natalia', 'Paz'], ['Bruno', 'Arias'], ['Jimena', 'Suárez'], ['Esteban', 'Villca'],
  ['Adriana', 'Mejía'],
];

const CONSULTORIOS = ['101', '102', '201', '202', '301', '302', 'A-1', 'A-2', 'B-1', 'B-2'];

function laPazLocalToUtc(day: Date, hour: number, minute: number): Date {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour + 4, minute, 0, 0));
}

async function main() {
  console.log('=== Seed Centro de Citas Hospitalarias ===');

  // Perfiles
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
      console.log(
        'SEED_ADMIN_PASSWORD no definido o muy corto: se omite creación de admin.',
      );
    } else {
      await prisma.user.create({
        data: {
          username: adminUsername,
          passwordHash: await argon2.hash(adminPassword),
          profileId: adminProfile.id,
          active: true,
        },
      });
      console.log(`Usuario admin creado: ${adminUsername} (password desde SEED_ADMIN_PASSWORD)`);
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

  // Especialidades
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

  // Doctores (~25)
  const doctors = [];
  for (let i = 0; i < DOCTOR_NAMES.length; i++) {
    const [firstName, lastName] = DOCTOR_NAMES[i];
    const specialtyId = specialtyIds[i % specialtyIds.length];
    const existing = await prisma.doctor.findFirst({
      where: { firstName, lastName, specialtyId },
    });
    if (existing) {
      doctors.push(existing);
      continue;
    }
    const d = await prisma.doctor.create({
      data: {
        firstName,
        lastName,
        specialtyId,
        consultorio: CONSULTORIOS[i % CONSULTORIOS.length],
        phone: `5917000${String(1000 + i).slice(-4)}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hospital.demo.bo`,
        defaultDurationMin: i % 5 === 0 ? 45 : 30,
        status: 'ACTIVE',
        schedules: {
          create: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
            { dayOfWeek: 1, startTime: '14:00', endTime: '18:00', slotDuration: 30 },
            { dayOfWeek: 2, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
            { dayOfWeek: 3, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
            { dayOfWeek: 3, startTime: '14:00', endTime: '17:00', slotDuration: 30 },
            { dayOfWeek: 4, startTime: '09:00', endTime: '13:00', slotDuration: 30 },
            { dayOfWeek: 5, startTime: '08:00', endTime: '12:00', slotDuration: 30 },
          ],
        },
      },
    });
    doctors.push(d);
  }
  console.log(`${doctors.length} doctores`);

  // Slots 4 semanas
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let slotsCreated = 0;
  for (const doctor of doctors) {
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: doctor.id, active: true },
    });
    const duration = doctor.defaultDurationMin;
    const cursor = new Date(start);
    for (let day = 0; day < 28; day++) {
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
              /* unique */
            }
          }
          mins += slotDur;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  console.log(`${slotsCreated} slots generados`);

  // Pacientes demo
  const patientsData = [
    { firstName: 'Juan', lastName: 'Pérez', documentId: '1234567', phone: '59170111222', insurance: 'Caja Nacional de Salud' },
    { firstName: 'María', lastName: 'García', documentId: '2345678', phone: '59170222333', insurance: 'Seguro Social Universitario' },
    { firstName: 'Luis', lastName: 'Fernández', documentId: '3456789', phone: '59170333444', insurance: null },
    { firstName: 'Carmen', lastName: 'Rojas', documentId: '4567890', phone: '59170444555', insurance: 'Caja Petrolera' },
    { firstName: 'Roberto', lastName: 'Mendoza', documentId: '5678901', phone: '59170555666', insurance: null },
    { firstName: 'Patricia', lastName: 'Aliaga', documentId: '6789012', phone: '59170666777', insurance: 'Caja Nacional de Salud' },
    { firstName: 'Andrés', lastName: 'Choque', documentId: '7890123', phone: '59170777888', insurance: null },
    { firstName: 'Elena', lastName: 'Vargas', documentId: '8901234', phone: '59170888999', insurance: 'Seguro Privado Demo' },
  ];

  const patients = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { documentId: p.documentId },
      update: { phone: p.phone, firstName: p.firstName, lastName: p.lastName },
      create: {
        ...p,
        insurance: p.insurance || undefined,
        normalizedPhone: p.phone,
      },
    });
    patients.push(patient);
  }
  console.log(`${patients.length} pacientes`);

  // Citas de muestra
  const freeSlots = await prisma.slot.findMany({
    where: { status: SlotStatus.FREE, startsAt: { gt: now } },
    include: { doctor: true },
    orderBy: { startsAt: 'asc' },
    take: 40,
  });

  let appts = 0;
  for (let i = 0; i < Math.min(12, freeSlots.length); i++) {
    const slot = freeSlots[i];
    const patient = patients[i % patients.length];
    const claimed = await prisma.slot.updateMany({
      where: { id: slot.id, status: SlotStatus.FREE },
      data: { status: SlotStatus.RESERVED },
    });
    if (claimed.count !== 1) continue;
    const status =
      i % 5 === 0
        ? AppointmentStatus.CONFIRMED
        : i % 7 === 0
          ? AppointmentStatus.NEEDS_RESCHEDULE
          : AppointmentStatus.RESERVED;
    await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: slot.doctorId,
        specialtyId: slot.doctor.specialtyId,
        slotId: slot.id,
        status,
        channel: i % 2 === 0 ? AppointmentChannel.PHONE_IN : AppointmentChannel.CONSOLE,
        needsReschedule: status === AppointmentStatus.NEEDS_RESCHEDULE,
        changes: {
          create: {
            toStatus: status,
            toSlotId: slot.id,
            origin: i % 2 === 0 ? ChangeOrigin.VOICE_AGENT : ChangeOrigin.OPERATOR,
            reason: 'Cita demo',
          },
        },
      },
    });
    appts++;
  }
  console.log(`${appts} citas demo`);

  // Llamadas de muestra
  for (let i = 0; i < 6; i++) {
    const patient = patients[i % patients.length];
    await prisma.interaction.create({
      data: {
        channel: 'CALL',
        direction: i % 3 === 0 ? Direction.OUTBOUND : Direction.INBOUND,
        status: InteractionStatus.COMPLETED,
        startedAt: new Date(Date.now() - (i + 1) * 3600_000),
        endedAt: new Date(Date.now() - (i + 1) * 3600_000 + 180_000),
        from: patient.phone,
        to: '+59122000000',
        patientId: patient.id,
        aiHandled: true,
        outcome: i === 2 ? Outcome.TRANSFERRED : Outcome.RESOLVED,
        intent: i % 2 === 0 ? 'reservar_cita' : 'consultar_cita',
        resultCode: i % 2 === 0 ? 'APPOINTMENT_BOOKED' : 'INFO',
        provider: Provider.VOICE_AGENT,
        providerConversationId: `demo-call-${i}-${Date.now()}`,
        callDetail: {
          create: {
            externalCallId: `demo-${i}`,
            durationSec: 120 + i * 30,
            transcriptText: `Agente: Buenos días, Hospital Central La Paz.\nPaciente: Hola, soy ${patient.firstName} ${patient.lastName}.\nAgente: ¿En qué puedo ayudarle?\nPaciente: Quiero una cita.\nAgente: Perfecto, déjeme verificar disponibilidad.`,
            summary: `Paciente ${patient.firstName} ${patient.lastName} consultó por cita médica. Gestión ${i % 2 === 0 ? 'con reserva' : 'informativa'}.`,
          },
        },
      },
    });
  }
  console.log('6 llamadas demo');

  // Campaña saliente demo
  const upcoming = await prisma.appointment.findMany({
    where: { status: { in: ['RESERVED', 'CONFIRMED'] } },
    include: { patient: true },
    take: 3,
  });
  if (upcoming.length) {
    await prisma.outboundCampaign.create({
      data: {
        name: 'Recordatorio 24h — demo',
        type: 'REMINDER',
        status: 'QUEUED',
        scheduledAt: new Date(),
        jobs: {
          create: upcoming.map((a) => ({
            patientId: a.patientId,
            appointmentId: a.id,
            phone: a.patient.phone,
            status: 'PENDING',
          })),
        },
      },
    });
    console.log('Campaña recordatorio demo');
  }

  console.log('=== Seed completado ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
