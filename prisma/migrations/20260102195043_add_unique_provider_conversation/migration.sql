-- CreateIndex
CREATE UNIQUE INDEX "interactions_provider_providerConversationId_key" ON "interactions"("provider", "providerConversationId");
