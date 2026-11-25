import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  normalizePhone(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.startsWith('591') && digits.length >= 11) return digits;
    if (digits.length === 8) return `591${digits}`;
    return digits;
  }

  async findByPhoneOrCi(phone?: string, documentId?: string) {
    if (documentId) {
      const byCi = await this.prisma.patient.findUnique({
        where: { documentId: documentId.replace(/\D/g, '') },
      });
      if (byCi) return byCi;
    }
    if (phone) {
      const normalized = this.normalizePhone(phone);
      const byPhone = await this.prisma.patient.findFirst({
        where: {
          OR: [{ phone }, { normalizedPhone: normalized }, { phone: normalized }],
        },
      });
      if (byPhone) return byPhone;
    }
    return null;
  }

  async identifyOrRegister(params: {
    phone?: string;
    documentId?: string;
    firstName?: string;
    lastName?: string;
    insurance?: string;
  }) {
    const existing = await this.findByPhoneOrCi(params.phone, params.documentId);
    if (existing) {
      return { patient: existing, created: false };
    }
    if (!params.documentId || !params.firstName || !params.lastName || !params.phone) {
      return {
        patient: null,
        created: false,
        missing: ['documentId', 'firstName', 'lastName', 'phone'].filter(
          (k) => !(params as any)[k],
        ),
      };
    }
    const normalizedPhone = this.normalizePhone(params.phone);
    const patient = await this.prisma.patient.create({
      data: {
        firstName: params.firstName.trim(),
        lastName: params.lastName.trim(),
        documentId: params.documentId.replace(/\D/g, ''),
        phone: params.phone,
        normalizedPhone,
        insurance: params.insurance,
      },
    });
    return { patient, created: true };
  }

  async list(q?: string) {
    return this.prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { documentId: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { lastName: 'asc' },
      take: 100,
    });
  }

  async getById(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          include: {
            doctor: { include: { specialty: true } },
            specialty: true,
            slot: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        interactions: {
          include: { callDetail: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    return patient;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    documentId: string;
    phone: string;
    email?: string;
    insurance?: string;
    dateOfBirth?: string;
    notes?: string;
  }) {
    return this.prisma.patient.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        documentId: data.documentId.replace(/\D/g, ''),
        phone: data.phone,
        normalizedPhone: this.normalizePhone(data.phone),
        email: data.email,
        insurance: data.insurance,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        notes: data.notes,
      },
    });
  }

  async update(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    insurance: string;
    notes: string;
    active: boolean;
  }>) {
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...data,
        ...(data.phone ? { normalizedPhone: this.normalizePhone(data.phone) } : {}),
      },
    });
  }

  formatForVoice(p: {
    id: string;
    firstName: string;
    lastName: string;
    documentId: string;
    phone: string;
    insurance: string | null;
  }) {
    const ciMasked = p.documentId.length > 3
      ? `${'*'.repeat(p.documentId.length - 3)}${p.documentId.slice(-3)}`
      : p.documentId;
    return {
      id: p.id,
      nombre: `${p.firstName} ${p.lastName}`,
      ci: p.documentId,
      ciEnmascarado: ciMasked,
      telefono: p.phone,
      seguro: p.insurance || 'sin seguro registrado',
      mensaje: `Paciente ${p.firstName} ${p.lastName}, carnet terminado en ${p.documentId.slice(-3)}.`,
    };
  }
}
