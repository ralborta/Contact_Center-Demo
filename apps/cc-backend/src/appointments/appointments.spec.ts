/**
 * Tests de dominio: disponibilidad, doble reserva, reprogramar, cancelar por doctor.
 * Ejecutar: npm test --workspace=apps/cc-backend
 */
import { ConflictException } from '@nestjs/common';
import {
  AppointmentChannel,
  AppointmentStatus,
  ChangeOrigin,
  PrismaClient,
  SlotStatus,
} from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

const prisma = new PrismaClient() as unknown as PrismaService;

describe('Citas hospitalarias', () => {
  let appointments: AppointmentsService;
  let availability: AvailabilityService;
  let patientId: string;
  let doctorId: string;
  let specialtyId: string;
  let slotA: string;
  let slotB: string;

  beforeAll(async () => {
    appointments = new AppointmentsService(prisma);
    availability = new AvailabilityService(prisma);

    const specialty = await prisma.specialty.findFirst({ where: { active: true } });
    const doctor = await prisma.doctor.findFirst({ where: { status: 'ACTIVE' } });
    const patient = await prisma.patient.findFirst({ where: { documentId: '1234567' } });
    if (!specialty || !doctor || !patient) {
      throw new Error('Seed requerido: especialidad, doctor y Juan Pérez 1234567');
    }
    specialtyId = specialty.id;
    doctorId = doctor.id;
    patientId = patient.id;

    // Liberar o crear 2 slots futuros del doctor para tests
    const future = new Date(Date.now() + 3 * 86400000);
    future.setMinutes(0, 0, 0);
    const startsA = new Date(future);
    startsA.setUTCHours(12 + 4, 0, 0, 0); // 12:00 La Paz
    const endsA = new Date(startsA.getTime() + 30 * 60000);
    const startsB = new Date(startsA.getTime() + 60 * 60000);
    const endsB = new Date(startsB.getTime() + 30 * 60000);

    const upsertSlot = async (startsAt: Date, endsAt: Date) => {
      const existing = await prisma.slot.findUnique({
        where: { doctorId_startsAt: { doctorId, startsAt } },
        include: { appointment: true },
      });
      if (existing?.appointment) {
        await prisma.appointmentChange.deleteMany({ where: { appointmentId: existing.appointment.id } });
        await prisma.appointment.delete({ where: { id: existing.appointment.id } });
      }
      if (existing) {
        await prisma.slot.update({ where: { id: existing.id }, data: { status: SlotStatus.FREE } });
        return existing.id;
      }
      const created = await prisma.slot.create({
        data: { doctorId, startsAt, endsAt, status: SlotStatus.FREE },
      });
      return created.id;
    };

    slotA = await upsertSlot(startsA, endsA);
    slotB = await upsertSlot(startsB, endsB);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('consulta disponibilidad por especialidad', async () => {
    const slots = await availability.findAvailable({
      specialtyId,
      from: new Date(),
      to: new Date(Date.now() + 14 * 86400000),
      limit: 5,
    });
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].slotId).toBeTruthy();
    expect(slots[0].mensaje).toMatch(/con Dr/);
  });

  it('impide doble reserva del mismo slot', async () => {
    await appointments.reserve({
      patientId,
      slotId: slotA,
      channel: AppointmentChannel.CONSOLE,
      origin: ChangeOrigin.OPERATOR,
      reason: 'test-reserva-1',
    });

    await expect(
      appointments.reserve({
        patientId,
        slotId: slotA,
        channel: AppointmentChannel.CONSOLE,
        origin: ChangeOrigin.OPERATOR,
        reason: 'test-doble',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reprograma a otro slot libre', async () => {
    const appt = await prisma.appointment.findFirst({
      where: { slotId: slotA, status: { in: ['RESERVED', 'CONFIRMED', 'RESCHEDULED'] } },
    });
    expect(appt).toBeTruthy();
    const updated = await appointments.reschedule({
      appointmentId: appt!.id,
      newSlotId: slotB,
      origin: ChangeOrigin.OPERATOR,
      reason: 'test-reprogramar',
    });
    expect(updated.slotId).toBe(slotB);
    expect(updated.status).toBe(AppointmentStatus.RESCHEDULED);

    const oldSlot = await prisma.slot.findUnique({ where: { id: slotA } });
    expect(oldSlot?.status).toBe(SlotStatus.FREE);
  });

  it('cancela por doctor, marca needsReschedule y crea campaña', async () => {
    const appt = await prisma.appointment.findFirst({
      where: { slotId: slotB, status: { in: ['RESERVED', 'CONFIRMED', 'RESCHEDULED'] } },
    });
    expect(appt).toBeTruthy();
    const result = await appointments.cancelByDoctor({
      appointmentId: appt!.id,
      reason: 'Doctor de licencia (test)',
      createOutboundNotice: true,
    });
    expect(result.status).toBe(AppointmentStatus.CANCELLED_BY_DOCTOR);
    expect(result.needsReschedule).toBe(true);

    const campaign = await prisma.outboundCampaign.findFirst({
      where: {
        type: 'DOCTOR_CANCEL_NOTICE',
        jobs: { some: { appointmentId: appt!.id } },
      },
    });
    expect(campaign).toBeTruthy();
  });
});
