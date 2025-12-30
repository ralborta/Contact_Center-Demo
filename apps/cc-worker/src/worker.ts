import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import * as winston from 'winston';
import Redis from 'ioredis';
import twilio from 'twilio';

// TwilioAdapter inline para evitar problemas de paths en build
class TwilioAdapter {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly webhookToken: string;
  private client: twilio.Twilio;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';
    this.webhookToken = process.env.TWILIO_WEBHOOK_TOKEN || '';

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  verifyToken(token: string): boolean {
    return token === this.webhookToken;
  }

  normalizeStatusPayload(payload: any): {
    messageSid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  } {
    return {
      messageSid: payload.MessageSid || payload.message_sid || payload.SmsSid || payload.sms_sid || '',
      status: payload.MessageStatus || payload.message_status || payload.Status || payload.status || 'unknown',
      errorCode: payload.ErrorCode || payload.error_code,
      errorMessage: payload.ErrorMessage || payload.error_message,
    };
  }

  async sendSms(to: string, body: string): Promise<{ providerMessageId: string }> {
    if (!this.client) {
      throw new Error('Twilio client not initialized');
    }

    const message = await this.client.messages.create({
      body,
      from: this.fromNumber,
      to,
    });

    return {
      providerMessageId: message.sid,
    };
  }
}

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

const prisma = new PrismaClient();
const twilioAdapter = new TwilioAdapter();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

const worker = new Worker(
  'sms',
  async (job: Job) => {
    const { otpChallengeId, interactionId, phone, purpose, otp, templateData } = job.data;

    logger.info('Processing SMS OTP job', { jobId: job.id, otpChallengeId, phone, purpose });

    try {
      // Construir texto del SMS según el propósito
      let smsText = '';
      switch (purpose) {
        case 'PASSWORD_RESET':
          smsText = `Su código de verificación es: ${otp}. Válido por 5 minutos. No comparta este código.`;
          break;
        case 'TX_CONFIRMATION':
          smsText = `Confirme su transacción con el código: ${otp}. Válido por 5 minutos.`;
          break;
        case 'IDENTITY_VERIFICATION':
          smsText = `Código de verificación de identidad: ${otp}. Válido por 5 minutos.`;
          break;
        case 'LOGIN_2FA':
          smsText = `Su código de acceso es: ${otp}. Válido por 5 minutos.`;
          break;
        default:
          smsText = `Su código de verificación es: ${otp}. Válido por 5 minutos.`;
      }

      // Enviar SMS vía Twilio
      const result = await twilioAdapter.sendSms(phone, smsText);

      // Crear Message
      await prisma.message.create({
        data: {
          interactionId,
          channel: 'SMS',
          direction: 'OUTBOUND',
          providerMessageId: result.providerMessageId,
          text: smsText,
          providerStatus: 'queued',
          sentAt: new Date(),
        },
      });

      // Actualizar OTPChallenge
      await prisma.otpChallenge.update({
        where: { id: otpChallengeId },
        data: { status: 'SENT' },
      });

      // Actualizar Interaction
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { status: 'IN_PROGRESS' },
      });

      // Crear InteractionEvent
      await prisma.interactionEvent.create({
        data: {
          interactionId,
          type: 'sms.sent',
          provider: 'TWILIO',
          providerEventId: result.providerMessageId,
          payload: {
            phone,
            purpose,
            messageSid: result.providerMessageId,
          },
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          ts: new Date(),
          actorType: 'SYSTEM',
          action: 'sms.send',
          entityType: 'OtpChallenge',
          entityId: otpChallengeId,
          metadata: {
            phone,
            purpose,
            messageSid: result.providerMessageId,
          },
        },
      });

      logger.info('SMS OTP sent successfully', { jobId: job.id, messageSid: result.providerMessageId });
      return { success: true, messageSid: result.providerMessageId };
    } catch (error) {
      logger.error('Failed to send SMS OTP', { jobId: job.id, error: error.message, stack: error.stack });

      // Actualizar OTPChallenge a FAILED
      await prisma.otpChallenge.update({
        where: { id: otpChallengeId },
        data: { status: 'FAILED' },
      });

      // Actualizar Interaction a FAILED
      await prisma.interaction.update({
        where: { id: interactionId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  },
);

worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job?.id, error: err.message });
});

logger.info('Worker started and listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
