-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_archived_lastMessageAt_idx" ON "whatsapp_conversations"("archived", "lastMessageAt");
