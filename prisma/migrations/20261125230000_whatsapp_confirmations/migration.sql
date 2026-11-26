-- Confirmación de citas por WhatsApp (no destructiva)

CREATE TYPE "WhatsappSendMode" AS ENUM ('SAME_DAY', 'DAY_BEFORE', 'BOTH');
CREATE TYPE "WhatsappChatStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "WhatsappMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND', 'SYSTEM');

CREATE TABLE "whatsapp_confirm_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" "WhatsappSendMode" NOT NULL DEFAULT 'SAME_DAY',
    "hoursBefore" INTEGER NOT NULL DEFAULT 3,
    "dayBeforeTime" TEXT NOT NULL DEFAULT '18:00',
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "sendWindowStart" TEXT NOT NULL DEFAULT '08:00',
    "sendWindowEnd" TEXT NOT NULL DEFAULT '20:00',
    "messageTemplate" TEXT NOT NULL DEFAULT 'Hola {{paciente}}, te escribimos del Hospital Central La Paz para confirmar tu cita de {{especialidad}} con el/la Dr(a). {{doctor}} el {{fecha}} a las {{hora}}. ¿Confirmás tu asistencia? Respondé CONFIRMAR, CANCELAR o CAMBIAR.',
    "provider" TEXT NOT NULL DEFAULT 'simulated',
    "timezone" TEXT NOT NULL DEFAULT 'America/La_Paz',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_confirm_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "phone" TEXT NOT NULL,
    "status" "WhatsappChatStatus" NOT NULL DEFAULT 'PENDING',
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'simulated',
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "WhatsappMessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_conversations_appointmentId_key" ON "whatsapp_conversations"("appointmentId");
CREATE INDEX "whatsapp_conversations_status_lastMessageAt_idx" ON "whatsapp_conversations"("status", "lastMessageAt");
CREATE INDEX "whatsapp_conversations_patientId_idx" ON "whatsapp_conversations"("patientId");
CREATE INDEX "whatsapp_messages_conversationId_createdAt_idx" ON "whatsapp_messages"("conversationId", "createdAt");

ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "whatsapp_confirm_config" ("id", "enabled", "updatedAt")
VALUES ('default', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
