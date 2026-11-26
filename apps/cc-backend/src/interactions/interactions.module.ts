import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { RecordingsService } from './recordings.service';

@Module({
  controllers: [InteractionsController],
  providers: [InteractionsService, RecordingsService],
  exports: [InteractionsService, RecordingsService],
})
export class InteractionsModule {}
