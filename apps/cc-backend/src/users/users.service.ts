import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }

  async create(dto: CreateUserDto) {
    const username = this.normalizeUsername(dto.username);
    const existing = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('El nombre de usuario ya existe');
    }
    const profile = await this.prisma.profile.findUnique({
      where: { id: dto.profileId },
    });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado');
    }
    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        username,
        passwordHash,
        profileId: dto.profileId,
        active: dto.active ?? true,
      },
      select: {
        id: true,
        username: true,
        profileId: true,
        profile: { select: { id: true, name: true, slug: true } },
        active: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        profileId: true,
        profile: { select: { id: true, name: true, slug: true } },
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.password !== undefined) {
      data.passwordHash = await argon2.hash(dto.password);
    }
    if (dto.profileId !== undefined) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: dto.profileId },
      });
      if (!profile) {
        throw new NotFoundException('Perfil no encontrado');
      }
      data.profileId = dto.profileId;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        profileId: true,
        profile: { select: { id: true, name: true, slug: true } },
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('No puede eliminarse a sí mismo');
    }
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
