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
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || process.env.REDIS_URL?.split('@')[1]?.split(':')[0] || 'localhost',
        port: parseInt(process.env.REDIS_PORT || process.env.REDIS_URL?.split(':')[2]?.split('/')[0] || '6379'),
        password: process.env.REDIS_PASSWORD || process.env.REDIS_URL?.split('@')[0]?.split(':')[2] || undefined,
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
    SyncModule,
  ],
})
export class AppModule {}
