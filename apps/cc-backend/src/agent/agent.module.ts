import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { InteractionsModule } from '../interactions/interactions.module';
import { PatientsModule } from '../patients/patients.module';
import { AgentAuthGuard } from './agent-auth.guard';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentWebhooksController } from './agent-webhooks.controller';

@Module({
  imports: [AppointmentsModule, PatientsModule, InteractionsModule],
  controllers: [AgentController, AgentWebhooksController],
  providers: [AgentService, AgentAuthGuard],
  exports: [AgentService],
})
export class AgentModule {}
