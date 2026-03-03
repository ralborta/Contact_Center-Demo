import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  username: string;
  profile: string; // slug del perfil: ADMIN, AGENT, VIEWER
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase(), active: true },
      include: { profile: true },
    });
    if (!user) {
      return null;
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return null;
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      profile: user.profile.slug,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        profile: user.profile.slug,
        profileName: user.profile.name,
      },
    };
  }
}
