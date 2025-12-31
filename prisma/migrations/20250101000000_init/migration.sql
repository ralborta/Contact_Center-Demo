-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('CALL', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('RESOLVED', 'ESCALATED', 'TICKETED', 'TRANSFERRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('ELEVENLABS', 'BUILDERBOT', 'TWILIO', 'GENERIC');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('PASSWORD_RESET', 'TX_CONFIRMATION', 'IDENTITY_VERIFICATION', 'LOGIN_2FA');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'SENT', 'VERIFIED', 'EXPIRED', 'LOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'AGENT');

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "direction" "Direction" NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'NEW',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "customerRef" TEXT,
    "queue" TEXT,
    "assignedAgent" TEXT,
    "aiHandled" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "Outcome",
    "intent" TEXT,
    "provider" "Provider" NOT NULL,
    "providerConversationId" TEXT,
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
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "direction" "Direction" NOT NULL,
    "providerMessageId" TEXT,
    "text" TEXT,
    "mediaUrl" TEXT,
    "providerStatus" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_details" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "elevenCallId" TEXT,
    "recordingUrl" TEXT,
    "transcriptText" TEXT,
    "transcriptId" TEXT,
    "summary" TEXT,
    "durationSec" INTEGER,
    "hangupReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "correlationId" TEXT NOT NULL,
    "interactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "interactions_channel_startedAt_idx" ON "interactions"("channel", "startedAt");

-- CreateIndex
CREATE INDEX "interactions_status_startedAt_idx" ON "interactions"("status", "startedAt");

-- CreateIndex
CREATE INDEX "interactions_from_idx" ON "interactions"("from");

-- CreateIndex
CREATE INDEX "interactions_to_idx" ON "interactions"("to");

-- CreateIndex
CREATE INDEX "interactions_providerConversationId_idx" ON "interactions"("providerConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_events_idempotencyKey_key" ON "interaction_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "interaction_events_interactionId_ts_idx" ON "interaction_events"("interactionId", "ts");

-- CreateIndex
CREATE INDEX "interaction_events_idempotencyKey_idx" ON "interaction_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "messages_providerMessageId_idx" ON "messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "messages_interactionId_idx" ON "messages"("interactionId");

-- CreateIndex
CREATE UNIQUE INDEX "call_details_interactionId_key" ON "call_details"("interactionId");

-- CreateIndex
CREATE UNIQUE INDEX "otp_challenges_correlationId_key" ON "otp_challenges"("correlationId");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_purpose_createdAt_idx" ON "otp_challenges"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_challenges_correlationId_idx" ON "otp_challenges"("correlationId");

-- CreateIndex
CREATE INDEX "otp_challenges_status_expiresAt_idx" ON "otp_challenges"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_ts_idx" ON "audit_logs"("ts");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_details" ADD CONSTRAINT "call_details_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

