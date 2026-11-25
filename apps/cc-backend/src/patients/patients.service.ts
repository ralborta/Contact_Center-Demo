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
    return this.registerNew({
      phone: params.phone,
      documentId: params.documentId,
      firstName: params.firstName,
      lastName: params.lastName,
      insurance: params.insurance,
    });
  }

  /**
   * Alta idempotente: si ya existe por DNI o por teléfono, reutiliza (sin duplicar).
   */
  async registerNew(params: {
    phone: string;
    documentId: string;
    firstName: string;
    lastName: string;
    insurance?: string;
    dateOfBirth?: string | Date | null;
  }) {
    const documentId = String(params.documentId || '').replace(/\D/g, '');
    const phone = String(params.phone || '').trim();
    const firstName = String(params.firstName || '').trim();
    const lastName = String(params.lastName || '').trim();
    if (!documentId || !phone || !firstName || !lastName) {
      return {
        patient: null as null,
        created: false,
        missing: [
          !firstName && 'firstName',
          !lastName && 'lastName',
          !documentId && 'documentId',
          !phone && 'phone',
        ].filter(Boolean) as string[],
      };
    }

    const byCi = await this.prisma.patient.findUnique({ where: { documentId } });
    if (byCi) {
      return { patient: byCi, created: false, missing: [] as string[] };
    }
    const normalizedPhone = this.normalizePhone(phone);
    const byPhone = await this.prisma.patient.findFirst({
      where: {
        OR: [{ phone }, { normalizedPhone }, { phone: normalizedPhone }],
      },
    });
    if (byPhone) {
      return { patient: byPhone, created: false, missing: [] as string[] };
    }

    let dateOfBirth: Date | undefined;
    if (params.dateOfBirth) {
      const d = params.dateOfBirth instanceof Date
        ? params.dateOfBirth
        : new Date(String(params.dateOfBirth));
      if (!Number.isNaN(d.getTime())) dateOfBirth = d;
    }

    const patient = await this.prisma.patient.create({
      data: {
        firstName,
        lastName,
        documentId,
        phone,
        normalizedPhone,
        insurance: params.insurance,
        dateOfBirth,
      },
    });
    return { patient, created: true, missing: [] as string[] };
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
            interactions: {
              select: { id: true, startedAt: true, resultCode: true },
              take: 1,
              orderBy: { startedAt: 'desc' },
            },
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
      mensaje: `Paciente ${p.firstName} ${p.lastName}, DNI terminado en ${p.documentId.slice(-3)}.`,
    };
  }
}
