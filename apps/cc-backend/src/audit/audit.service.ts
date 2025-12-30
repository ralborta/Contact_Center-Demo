import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    actorType: ActorType;
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    ip?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        ts: new Date(),
        actorType: data.actorType,
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        ip: data.ip,
        userAgent: data.userAgent,
        metadata: data.metadata || {},
      },
    });
  }
}
