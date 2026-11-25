/**
 * Seed hospitalario demo — Argentina / America/Argentina/Buenos_Aires
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
  // Argentina (sin DST) = UTC-3
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour + 3, minute, 0, 0));
}

async function main() {
  console.log('=== Seed Centro de Turnos (idempotente) ===');

  const profiles = [
    { name: 'Administrador', slug: 'ADMIN', description: 'Acceso total' },
    { name: 'Operador', slug: 'AGENT', description: 'Mesa de turnos / call center' },
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
    update: {
      hospitalName: 'Hospital Santa María',
      greeting:
        'Buenos días, habla el asistente de turnos del Hospital Santa María. ¿En qué te puedo ayudar?',
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      locale: 'es-AR',
    },
    create: {
      id: 'default',
      hospitalName: 'Hospital Santa María',
      greeting:
        'Buenos días, habla el asistente de turnos del Hospital Santa María. ¿En qué te puedo ayudar?',
      businessHoursStart: '07:00',
      businessHoursEnd: '20:00',
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      locale: 'es-AR',
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

  const TARGET_PER_SPECIALTY = 3;
  const doctors: Array<{ id: string; specialtyId: string; defaultDurationMin: number }> = [];
  let doctorsCreated = 0;

  for (let si = 0; si < DOCTORS_BY_SPECIALTY.length; si++) {
    const specialtyId = specialtyIds[si];
    const names = DOCTORS_BY_SPECIALTY[si];
    const activeInSpecialty = await prisma.doctor.count({
      where: { specialtyId, status: 'ACTIVE' },
    });

    for (let di = 0; di < names.length; di++) {
      const [firstName, lastName] = names[di];
      // Unicidad global por nombre: evita duplicar "Fernando Miranda" en otra especialidad
      const existingAny = await prisma.doctor.findFirst({
        where: { firstName, lastName },
        orderBy: { createdAt: 'asc' },
      });
      if (existingAny) {
        if (existingAny.status === 'ACTIVE') doctors.push(existingAny);
        continue;
      }

      const currentActive = await prisma.doctor.count({
        where: { specialtyId, status: 'ACTIVE' },
      });
      if (currentActive >= TARGET_PER_SPECIALTY && activeInSpecialty >= TARGET_PER_SPECIALTY) {
        continue;
      }

      const globalIndex = si * 3 + di;
      const schedules = SCHEDULE_VARIANTS[globalIndex % SCHEDULE_VARIANTS.length];
      const emailBase = `${firstName
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()}.${lastName
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()}`;
      const d = await prisma.doctor.create({
        data: {
          firstName,
          lastName,
          specialtyId,
          consultorio: CONSULTORIOS[globalIndex % CONSULTORIOS.length],
          phone: `54911555${String(1000 + globalIndex).slice(-4)}`,
          email: `${emailBase}@hospital.demo.bo`,
          defaultDurationMin: schedules[0].slotDuration || 30,
          status: 'ACTIVE',
          schedules: { create: schedules },
        },
      });
      doctors.push(d);
      doctorsCreated++;
    }
  }

  // Desactiva duplicados exactos de nombre sin citas activas (no destructivo para datos vivos)
  const allActive = await prisma.doctor.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  const seenName = new Set<string>();
  let deactivatedDupes = 0;
  for (const d of allActive) {
    const key = `${d.firstName}|${d.lastName}`.toLowerCase();
    if (!seenName.has(key)) {
      seenName.add(key);
      continue;
    }
    const activeAppts = await prisma.appointment.count({
      where: {
        doctorId: d.id,
        status: {
          in: ['RESERVED', 'CONFIRMED', 'RESCHEDULED', 'NEEDS_RESCHEDULE'],
        },
      },
    });
    if (activeAppts > 0) continue;
    await prisma.doctor.update({
      where: { id: d.id },
      data: { status: 'INACTIVE' },
    });
    deactivatedDupes++;
  }
  // Completar especialidades que quedaron con < 3 tras dedupe
  const FILL_NAMES: [string, string][] = [
    ['Laura', 'Benitez'],
    ['Mateo', 'Quinteros'],
    ['Rosa', 'Arce'],
    ['Sebastián', 'Ledezma'],
    ['Verónica', 'Céspedes'],
    ['Tomás', 'Almanza'],
    ['Julia', 'Peña'],
    ['Nicolás', 'Roca'],
    ['Andrea', 'Saavedra'],
    ['Felipe', 'Montero'],
  ];
  let fillIdx = 0;
  for (let si = 0; si < specialtyIds.length; si++) {
    const specialtyId = specialtyIds[si];
    while (
      (await prisma.doctor.count({ where: { specialtyId, status: 'ACTIVE' } })) <
        TARGET_PER_SPECIALTY &&
      fillIdx < FILL_NAMES.length
    ) {
      const [firstName, lastName] = FILL_NAMES[fillIdx++];
      const clash = await prisma.doctor.findFirst({ where: { firstName, lastName } });
      if (clash) continue;
      const schedules = SCHEDULE_VARIANTS[fillIdx % SCHEDULE_VARIANTS.length];
      const emailBase = `${firstName
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()}.${lastName
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()}`;
      await prisma.doctor.create({
        data: {
          firstName,
          lastName,
          specialtyId,
          consultorio: CONSULTORIOS[fillIdx % CONSULTORIOS.length],
          phone: `54911556${String(1000 + fillIdx).slice(-4)}`,
          email: `${emailBase}@hospital.demo.bo`,
          defaultDurationMin: schedules[0].slotDuration || 30,
          status: 'ACTIVE',
          schedules: { create: schedules },
        },
      });
      doctorsCreated++;
    }
  }

  console.log(
    `${await prisma.doctor.count({ where: { status: 'ACTIVE' } })} doctores ACTIVE (${doctorsCreated} nuevos, ${deactivatedDupes} duplicados inactivados)`,
  );

  // Slots próximas 3 semanas para TODOS los activos (solo crea faltantes)
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const daysAhead = 21;
  let slotsCreated = 0;
  const doctorsForSlots = await prisma.doctor.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, specialtyId: true, defaultDurationMin: true },
  });
  for (const doctor of doctorsForSlots) {
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

  // documentId se conserva (no romper citas existentes); teléfonos/seguro se actualizan a formato AR.
  const patientsData = [
    { firstName: 'Juan', lastName: 'Pérez', documentId: '1234567', phone: '5491155551234', insurance: 'OSDE' },
    { firstName: 'María', lastName: 'García', documentId: '2345678', phone: '5491155552233', insurance: 'Swiss Medical' },
    { firstName: 'Luis', lastName: 'Fernández', documentId: '3456789', phone: '5491155553344', insurance: null as string | null },
    { firstName: 'Carmen', lastName: 'Rojas', documentId: '4567890', phone: '5491155554455', insurance: 'PAMI' },
    { firstName: 'Roberto', lastName: 'Mendoza', documentId: '5678901', phone: '5491155555566', insurance: null },
    { firstName: 'Patricia', lastName: 'Aliaga', documentId: '6789012', phone: '5491155556677', insurance: 'Galeno' },
    { firstName: 'Andrés', lastName: 'Choque', documentId: '7890123', phone: '5491155557788', insurance: null },
    { firstName: 'Elena', lastName: 'Vargas', documentId: '8901234', phone: '5491155558899', insurance: 'Medicus' },
    { firstName: 'Hugo', lastName: 'Soria', documentId: '9012345', phone: '5491155559001', insurance: null },
    { firstName: 'Isabel', lastName: 'Calle', documentId: '9123456', phone: '5491155559002', insurance: 'OSDE' },
  ];

  const patients = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { documentId: p.documentId },
      update: {
        phone: p.phone,
        normalizedPhone: p.phone,
        insurance: p.insurance || null,
      },
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

  // Una cita cancelada de ejemplo (para la agenda) si aún no hay
  const cancelledCount = await prisma.appointment.count({
    where: {
      status: { in: ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR'] },
    },
  });
  if (cancelledCount === 0) {
    const freeForCancel = await prisma.slot.findFirst({
      where: { status: SlotStatus.FREE, startsAt: { gt: now } },
      include: { doctor: true },
      orderBy: { startsAt: 'asc' },
    });
    if (freeForCancel) {
      const patient = patients[1] || patients[0];
      const claimed = await prisma.slot.updateMany({
        where: { id: freeForCancel.id, status: SlotStatus.FREE },
        data: { status: SlotStatus.RESERVED },
      });
      if (claimed.count === 1) {
        const appt = await prisma.appointment.create({
          data: {
            patientId: patient.id,
            doctorId: freeForCancel.doctorId,
            specialtyId: freeForCancel.doctor.specialtyId,
            slotId: freeForCancel.id,
            status: AppointmentStatus.RESERVED,
            channel: AppointmentChannel.CONSOLE,
          },
        });
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { status: AppointmentStatus.CANCELLED_BY_PATIENT },
        });
        await prisma.appointmentChange.create({
          data: {
            appointmentId: appt.id,
            fromStatus: AppointmentStatus.RESERVED,
            toStatus: AppointmentStatus.CANCELLED_BY_PATIENT,
            fromSlotId: freeForCancel.id,
            toSlotId: freeForCancel.id,
            origin: ChangeOrigin.OPERATOR,
            reason: 'Cancelación demo seed',
          },
        });
        await prisma.slot.update({
          where: { id: freeForCancel.id },
          data: { status: SlotStatus.FREE },
        });
        console.log('1 cita cancelada demo creada');
      }
    }
  }

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
        to: '+541148000000',
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
