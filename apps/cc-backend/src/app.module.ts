import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { InteractionsModule } from './interactions/interactions.module';
import { OtpModule } from './otp/otp.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AuditModule } from './audit/audit.module';
import { PiiModule } from './pii/pii.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null, // Requerido por BullMQ
      },
    }),
    BullModule.registerQueue({
      name: 'sms',
    }),
    PrismaModule,
    HealthModule,
    InteractionsModule,
    OtpModule,
    WebhooksModule,
    AuditModule,
    PiiModule,
  ],
})
export class AppModule {}
