import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentConfigService {
  constructor(private prisma: PrismaService) {}

  async get() {
    return this.prisma.agentConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  async update(data: {
    hospitalName?: string;
    greeting?: string;
    businessHoursStart?: string;
    businessHoursEnd?: string;
    transferMessage?: string;
    closedMessage?: string;
    transferEnabled?: boolean;
  }) {
    return this.prisma.agentConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
  }
}
