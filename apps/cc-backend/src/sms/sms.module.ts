import { Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import { InteractionsModule } from '../interactions/interactions.module';
import { AuditModule } from '../audit/audit.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [InteractionsModule, AuditModule, OtpModule],
  controllers: [SmsController],
})
export class SmsModule {}
