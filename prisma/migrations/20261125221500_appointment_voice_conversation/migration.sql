-- AlterTable
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "voiceConversationId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_voiceConversationId_idx" ON "appointments"("voiceConversationId");
