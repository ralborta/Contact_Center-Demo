import { Module } from '@nestjs/common';
import { InteractionsModule } from '../interactions/interactions.module';
import { PatientsModule } from '../patients/patients.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [PatientsModule, InteractionsModule],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
