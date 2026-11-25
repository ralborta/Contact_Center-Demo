import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SpecialtiesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.specialty.findMany({
      include: { _count: { select: { doctors: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(data: { code: string; name: string; description?: string }) {
    return this.prisma.specialty.create({ data });
  }

  update(id: string, data: { name?: string; description?: string; active?: boolean }) {
    return this.prisma.specialty.update({ where: { id }, data });
  }
}
