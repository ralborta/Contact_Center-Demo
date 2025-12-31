import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { ElevenLabsController } from './elevenlabs.controller';
import { InteractionsService } from './interactions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InteractionsController, ElevenLabsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
