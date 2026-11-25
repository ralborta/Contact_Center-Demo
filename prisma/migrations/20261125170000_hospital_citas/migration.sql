-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'AGENT', 'PATIENT', 'DOCTOR');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('CALL');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('RESOLVED', 'ESCALATED', 'TRANSFERRED', 'NO_ANSWER', 'VOICEMAIL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('VOICE_AGENT', 'GENERIC');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('BLOCK', 'EXTRA', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('FREE', 'RESERVED', 'BLOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'COMPLETED', 'NO_SHOW', 'NEEDS_RESCHEDULE');

-- CreateEnum
CREATE TYPE "ChangeOrigin" AS ENUM ('PATIENT', 'DOCTOR', 'VOICE_AGENT', 'OPERATOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AppointmentChannel" AS ENUM ('PHONE_IN', 'PHONE_OUT', 'CONSOLE');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('REMINDER', 'CONFIRMATION', 'DOCTOR_CANCEL_NOTICE', 'RESCHEDULE_NOTICE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignJobStatus" AS ENUM ('PENDING', 'CALLING', 'CONFIRMED', 'RESCHEDULED', 'NO_ANSWER', 'VOICEMAIL', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "doctorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'CALL',
    "direction" "Direction" NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'NEW',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "patientId" TEXT,
    "queue" TEXT,
    "assignedAgent" TEXT,
    "aiHandled" BOOLEAN NOT NULL DEFAULT true,
    "outcome" "Outcome",
    "intent" TEXT,
    "resultCode" TEXT,
    "provider" "Provider" NOT NULL DEFAULT 'VOICE_AGENT',
    "providerConversationId" TEXT,
    "appointmentId" TEXT,
    "campaignJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_events" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerEventId" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_details" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "externalCallId" TEXT,
    "recordingUrl" TEXT,
    "transcriptText" TEXT,
    "summary" TEXT,
    "durationSec" INTEGER,
    "hangupReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "consultorio" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 30,
    "status" "DoctorStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "type" "ExceptionType" NOT NULL DEFAULT 'BLOCK',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "email" TEXT,
    "insurance" TEXT,
    "dateOfBirth" DATE,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'RESERVED',
    "channel" "AppointmentChannel" NOT NULL DEFAULT 'CONSOLE',
    "reason" TEXT,
    "notes" TEXT,
    "needsReschedule" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_changes" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "fromStatus" "AppointmentStatus",
    "toStatus" "AppointmentStatus" NOT NULL,
    "fromSlotId" TEXT,
    "toSlotId" TEXT,
    "origin" "ChangeOrigin" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_campaign_jobs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "phone" TEXT NOT NULL,
    "status" "CampaignJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "resultNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_campaign_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "hospitalName" TEXT NOT NULL DEFAULT 'Hospital Central La Paz',
    "greeting" TEXT NOT NULL DEFAULT 'Buenos días, habla el asistente de citas del Hospital Central La Paz. ¿En qué puedo ayudarle?',
    "businessHoursStart" TEXT NOT NULL DEFAULT '07:00',
    "businessHoursEnd" TEXT NOT NULL DEFAULT '20:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/La_Paz',
    "transferMessage" TEXT NOT NULL DEFAULT 'Lo derivo con un operador humano, un momento por favor.',
    "closedMessage" TEXT NOT NULL DEFAULT 'Nuestro horario de atención telefónica es de 7:00 a 20:00. Puede volver a llamar en ese horario.',
    "transferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'Bs',
    "locale" TEXT NOT NULL DEFAULT 'es-BO',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_slug_key" ON "profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_doctorId_key" ON "users"("doctorId");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_profileId_idx" ON "users"("profileId");

-- CreateIndex
CREATE INDEX "audit_logs_ts_idx" ON "audit_logs"("ts");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "interactions_channel_startedAt_idx" ON "interactions"("channel", "startedAt");

-- CreateIndex
CREATE INDEX "interactions_status_startedAt_idx" ON "interactions"("status", "startedAt");

-- CreateIndex
CREATE INDEX "interactions_from_idx" ON "interactions"("from");

-- CreateIndex
CREATE INDEX "interactions_patientId_idx" ON "interactions"("patientId");

-- CreateIndex
CREATE INDEX "interactions_appointmentId_idx" ON "interactions"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "interactions_provider_providerConversationId_key" ON "interactions"("provider", "providerConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_events_idempotencyKey_key" ON "interaction_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "interaction_events_interactionId_ts_idx" ON "interaction_events"("interactionId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "call_details_interactionId_key" ON "call_details"("interactionId");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");

-- CreateIndex
CREATE INDEX "doctors_specialtyId_idx" ON "doctors"("specialtyId");

-- CreateIndex
CREATE INDEX "doctors_status_idx" ON "doctors"("status");

-- CreateIndex
CREATE INDEX "doctors_lastName_firstName_idx" ON "doctors"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "doctor_schedules_doctorId_dayOfWeek_idx" ON "doctor_schedules"("doctorId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "schedule_exceptions_doctorId_date_idx" ON "schedule_exceptions"("doctorId", "date");

-- CreateIndex
CREATE INDEX "schedule_exceptions_date_idx" ON "schedule_exceptions"("date");

-- CreateIndex
CREATE INDEX "slots_doctorId_startsAt_status_idx" ON "slots"("doctorId", "startsAt", "status");

-- CreateIndex
CREATE INDEX "slots_status_startsAt_idx" ON "slots"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "slots_doctorId_startsAt_key" ON "slots"("doctorId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "patients_documentId_key" ON "patients"("documentId");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_normalizedPhone_idx" ON "patients"("normalizedPhone");

-- CreateIndex
CREATE INDEX "patients_lastName_firstName_idx" ON "patients"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_slotId_key" ON "appointments"("slotId");

-- CreateIndex
CREATE INDEX "appointments_patientId_status_idx" ON "appointments"("patientId", "status");

-- CreateIndex
CREATE INDEX "appointments_doctorId_status_idx" ON "appointments"("doctorId", "status");

-- CreateIndex
CREATE INDEX "appointments_specialtyId_idx" ON "appointments"("specialtyId");

-- CreateIndex
CREATE INDEX "appointments_status_createdAt_idx" ON "appointments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "appointments_needsReschedule_idx" ON "appointments"("needsReschedule");

-- CreateIndex
CREATE INDEX "appointment_changes_appointmentId_createdAt_idx" ON "appointment_changes"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "outbound_campaign_jobs_campaignId_status_idx" ON "outbound_campaign_jobs"("campaignId", "status");

-- CreateIndex
CREATE INDEX "outbound_campaign_jobs_status_idx" ON "outbound_campaign_jobs"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_campaignJobId_fkey" FOREIGN KEY ("campaignJobId") REFERENCES "outbound_campaign_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_details" ADD CONSTRAINT "call_details_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_changes" ADD CONSTRAINT "appointment_changes_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_campaign_jobs" ADD CONSTRAINT "outbound_campaign_jobs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "outbound_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_campaign_jobs" ADD CONSTRAINT "outbound_campaign_jobs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_campaign_jobs" ADD CONSTRAINT "outbound_campaign_jobs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

