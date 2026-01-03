import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { OtpPurpose, OtpStatus, Channel, Direction, InteractionStatus, Provider } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OtpService {
  private readonly OTP_TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS || '300');
  private readonly OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
  private readonly RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.OTP_RATE_LIMIT_WINDOW_SECONDS || '900');
  private readonly RATE_LIMIT_MAX = parseInt(process.env.OTP_RATE_LIMIT_MAX || '3');

  constructor(
    private prisma: PrismaService,
    @InjectQueue('sms') private smsQueue: Queue,
    private auditService: AuditService,
  ) {}

  async createOtp(data: {
    phone: string;
    purpose: OtpPurpose;
    correlationId: string;
    templateData?: Record<string, any>;
  }) {
    // Rate limiting
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW_SECONDS * 1000);
    const recentChallenges = await this.prisma.otpChallenge.count({
      where: {
        phone: data.phone,
        purpose: data.purpose,
        createdAt: { gte: windowStart },
      },
    });

    if (recentChallenges >= this.RATE_LIMIT_MAX) {
      throw new HttpException(
        `Rate limit exceeded. Maximum ${this.RATE_LIMIT_MAX} OTP requests per ${this.RATE_LIMIT_WINDOW_SECONDS} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generar OTP de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await argon2.hash(otp);

    const expiresAt = new Date(Date.now() + this.OTP_TTL_SECONDS * 1000);

    // Crear Interaction SMS OUTBOUND
    const interaction = await this.prisma.interaction.create({
      data: {
        channel: Channel.SMS,
        direction: Direction.OUTBOUND,
        provider: Provider.TWILIO,
        from: process.env.TWILIO_FROM_NUMBER || '',
        to: data.phone,
        status: InteractionStatus.NEW,
        startedAt: new Date(),
      },
    });

    // Crear OTP Challenge
    const otpChallenge = await this.prisma.otpChallenge.create({
      data: {
        phone: data.phone,
        purpose: data.purpose,
        otpHash,
        expiresAt,
        maxAttempts: this.OTP_MAX_ATTEMPTS,
        status: OtpStatus.PENDING,
        correlationId: data.correlationId,
        interactionId: interaction.id,
      },
    });

    // Encolar job para envío de SMS
    await this.smsQueue.add('sendOtp', {
      otpChallengeId: otpChallenge.id,
      interactionId: interaction.id,
      phone: data.phone,
      purpose: data.purpose,
      otp,
      templateData: data.templateData,
    });

    // Audit log
    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'otp.create',
      entityType: 'OtpChallenge',
      entityId: otpChallenge.id,
      metadata: {
        phone: data.phone,
        purpose: data.purpose,
        correlationId: data.correlationId,
      },
    });

    return {
      correlationId: data.correlationId,
      interactionId: interaction.id,
      expiresAt,
      message: 'OTP created and queued for sending',
    };
  }

  async verifyOtp(correlationId: string, otp: string) {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { correlationId },
    });

    if (!challenge) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'otp.verify',
        entityType: 'OtpChallenge',
        entityId: correlationId,
        metadata: { success: false, reason: 'not_found' },
      });
      throw new BadRequestException('Invalid correlation ID');
    }

    // Verificar expiración
    if (challenge.expiresAt < new Date()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: OtpStatus.EXPIRED },
      });
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'otp.verify',
        entityType: 'OtpChallenge',
        entityId: challenge.id,
        metadata: { success: false, reason: 'expired' },
      });
      throw new BadRequestException('OTP has expired');
    }

    // Verificar intentos
    if (challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: OtpStatus.LOCKED },
      });
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'otp.verify',
        entityType: 'OtpChallenge',
        entityId: challenge.id,
        metadata: { success: false, reason: 'locked' },
      });
      throw new BadRequestException('OTP challenge locked due to too many attempts');
    }

    // Verificar OTP
    const isValid = await argon2.verify(challenge.otpHash, otp);

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: challenge.attempts + 1,
        status: isValid ? OtpStatus.VERIFIED : challenge.status,
        verifiedAt: isValid ? new Date() : null,
      },
    });

    if (!isValid) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'otp.verify',
        entityType: 'OtpChallenge',
        entityId: challenge.id,
        metadata: { success: false, reason: 'invalid_otp', attempts: challenge.attempts + 1 },
      });
      throw new BadRequestException('Invalid OTP');
    }

    // Actualizar Interaction
    if (challenge.interactionId) {
      await this.prisma.interaction.update({
        where: { id: challenge.interactionId },
        data: {
          status: InteractionStatus.COMPLETED,
          outcome: 'RESOLVED',
          endedAt: new Date(),
        },
      });
    }

    await this.auditService.log({
      actorType: 'SYSTEM',
      action: 'otp.verify',
      entityType: 'OtpChallenge',
      entityId: challenge.id,
      metadata: { success: true },
    });

    return {
      success: true,
      correlationId,
      verifiedAt: new Date(),
    };
  }
}
