import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerStatus, CustomerTagType, Channel } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Normaliza un número de teléfono para búsqueda
   */
  private normalizePhone(phone: string): string {
    let normalized = decodeURIComponent(phone);
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '');
    normalized = normalized.replace(/^\+/, '');
    return normalized;
  }

  /**
   * Crear un nuevo cliente
   */
  async create(data: {
    phone: string;
    name?: string;
    email?: string;
    dni?: string;
    status?: CustomerStatus;
    segment?: string;
    preferredChannel?: Channel;
    createdBy?: string;
  }) {
    const normalizedPhone = this.normalizePhone(data.phone);

    // Verificar si ya existe
    const existing = await this.prisma.customer.findUnique({
      where: { phone: data.phone },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un cliente con este número de teléfono');
    }

    return this.prisma.customer.create({
      data: {
        phone: data.phone,
        normalizedPhone,
        name: data.name,
        email: data.email,
        dni: data.dni,
        status: data.status || CustomerStatus.ACTIVE,
        segment: data.segment,
        preferredChannel: data.preferredChannel,
        createdBy: data.createdBy,
      },
      include: {
        tags: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Actualizar un cliente existente
   */
  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      dni?: string;
      status?: CustomerStatus;
      segment?: string;
      preferredChannel?: Channel;
      updatedBy?: string;
    }
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...data,
        updatedBy: data.updatedBy,
      },
      include: {
        tags: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Buscar cliente por teléfono
   */
  async findByPhone(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);

    return this.prisma.customer.findFirst({
      where: {
        OR: [
          { phone: { contains: phone } },
          { normalizedPhone: { contains: normalizedPhone } },
        ],
      },
      include: {
        tags: true,
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Obtener cliente por ID
   */
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        tags: true,
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  /**
   * Listar todos los clientes con filtros
   */
  async findAll(filters: {
    status?: CustomerStatus;
    segment?: string;
    search?: string;
    limit?: number;
    skip?: number;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.segment) {
      where.segment = filters.segment;
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { dni: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          tags: true,
          _count: {
            select: {
              notes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100,
        skip: filters.skip || 0,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      customers,
      total,
      limit: filters.limit || 100,
      skip: filters.skip || 0,
    };
  }

  /**
   * Eliminar un cliente (soft delete cambiando status a INACTIVE)
   */
  async delete(id: string, deletedBy?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        status: CustomerStatus.INACTIVE,
        updatedBy: deletedBy,
      },
    });
  }

  /**
   * Bloquear un cliente
   */
  async block(id: string, blockedBy?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        status: CustomerStatus.BLOCKED,
        updatedBy: blockedBy,
      },
    });
  }

  /**
   * Agregar etiqueta a un cliente
   */
  async addTag(
    customerId: string,
    data: {
      type: CustomerTagType;
      label: string;
      description?: string;
      color?: string;
      createdBy?: string;
    }
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    try {
      return await this.prisma.customerTag.create({
        data: {
          customerId,
          type: data.type,
          label: data.label,
          description: data.description,
          color: data.color,
          createdBy: data.createdBy,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Esta etiqueta ya existe para este cliente');
      }
      throw error;
    }
  }

  /**
   * Eliminar etiqueta de un cliente
   */
  async removeTag(customerId: string, tagId: string) {
    const tag = await this.prisma.customerTag.findFirst({
      where: {
        id: tagId,
        customerId,
      },
    });

    if (!tag) {
      throw new NotFoundException('Etiqueta no encontrada');
    }

    return this.prisma.customerTag.delete({
      where: { id: tagId },
    });
  }

  /**
   * Agregar nota a un cliente
   */
  async addNote(
    customerId: string,
    data: {
      title?: string;
      content: string;
      isInternal?: boolean;
      createdBy?: string;
    }
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return this.prisma.customerNote.create({
      data: {
        customerId,
        title: data.title,
        content: data.content,
        isInternal: data.isInternal || false,
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Actualizar nota
   */
  async updateNote(noteId: string, data: { title?: string; content?: string }) {
    const note = await this.prisma.customerNote.findUnique({ where: { id: noteId } });

    if (!note) {
      throw new NotFoundException('Nota no encontrada');
    }

    return this.prisma.customerNote.update({
      where: { id: noteId },
      data,
    });
  }

  /**
   * Eliminar nota
   */
  async deleteNote(noteId: string) {
    const note = await this.prisma.customerNote.findUnique({ where: { id: noteId } });

    if (!note) {
      throw new NotFoundException('Nota no encontrada');
    }

    return this.prisma.customerNote.delete({
      where: { id: noteId },
    });
  }

  /**
   * Obtener estadísticas de un cliente
   */
  async getCustomerStats(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Buscar interacciones del cliente
    const interactions = await this.prisma.interaction.findMany({
      where: {
        OR: [
          { from: { contains: customer.normalizedPhone } },
          { to: { contains: customer.normalizedPhone } },
        ],
      },
    });

    const stats = {
      totalInteractions: interactions.length,
      calls: interactions.filter((i) => i.channel === 'CALL').length,
      whatsapp: interactions.filter((i) => i.channel === 'WHATSAPP').length,
      sms: interactions.filter((i) => i.channel === 'SMS').length,
      resolved: interactions.filter((i) => i.outcome === 'RESOLVED').length,
      lastInteraction: interactions.length > 0 ? interactions[0].startedAt || interactions[0].createdAt : null,
    };

    return {
      customer,
      stats,
    };
  }
}
