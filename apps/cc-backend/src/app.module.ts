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
      connection: (() => {
        // Si hay REDIS_URL, parsearla
        if (process.env.REDIS_URL) {
          try {
            const url = new URL(process.env.REDIS_URL);
            return {
              host: url.hostname,
              port: parseInt(url.port || '6379'),
              password: url.password || undefined,
              maxRetriesPerRequest: null,
            };
          } catch (e) {
            console.warn('Error parsing REDIS_URL, usando valores individuales');
          }
        }
        // Valores individuales
        return {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null, // Requerido por BullMQ
        };
      })(),
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
