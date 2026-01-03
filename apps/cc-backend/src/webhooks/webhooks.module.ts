import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WhatsAppController } from './whatsapp.controller';
import { BuilderBotWebhookController } from './builderbot-webhook.controller';
import { InteractionsModule } from '../interactions/interactions.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [InteractionsModule, AuditModule, PrismaModule],
  controllers: [WebhooksController, WhatsAppController, BuilderBotWebhookController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
