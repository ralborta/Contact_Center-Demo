import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InteractionsModule } from './interactions/interactions.module';
import { AuditModule } from './audit/audit.module';
import { AgentModule } from './agent/agent.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AgentConfigModule } from './agent-config/agent-config.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    InteractionsModule,
    AuditModule,
    AgentModule,
    AppointmentsModule,
    PatientsModule,
    DoctorsModule,
    SpecialtiesModule,
    CampaignsModule,
    AnalyticsModule,
    AgentConfigModule,
    VoiceModule,
  ],
})
export class AppModule {}
