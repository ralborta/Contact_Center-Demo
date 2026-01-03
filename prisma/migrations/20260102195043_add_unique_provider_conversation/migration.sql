-- Primero: Eliminar duplicados, manteniendo solo el más reciente de cada provider+providerConversationId
DELETE FROM "interactions"
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY provider, "providerConversationId" 
             ORDER BY "createdAt" DESC
           ) AS rn
    FROM "interactions"
    WHERE "providerConversationId" IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Segundo: Crear el índice único
CREATE UNIQUE INDEX "interactions_provider_providerConversationId_key" 
ON "interactions"("provider", "providerConversationId")
WHERE "providerConversationId" IS NOT NULL;
