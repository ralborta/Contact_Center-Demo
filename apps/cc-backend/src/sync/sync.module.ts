import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { InteractionsModule } from '../interactions/interactions.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    InteractionsModule,
    PrismaModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
