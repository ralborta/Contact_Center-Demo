import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { ElevenLabsController } from './elevenlabs.controller';
import { InteractionsService } from './interactions.service';
import { AISummaryService } from './ai-summary.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InteractionsController, ElevenLabsController],
  providers: [InteractionsService, AISummaryService],
  exports: [InteractionsService, AISummaryService],
})
export class InteractionsModule {}
