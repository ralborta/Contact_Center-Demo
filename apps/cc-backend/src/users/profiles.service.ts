import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.profile.findMany({
      orderBy: { slug: 'asc' },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado');
    }
    return profile;
  }
}
