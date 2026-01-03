-- Script SQL para verificar mensajes OUTBOUND de WhatsApp
-- Ejecuta estas queries en tu base de datos PostgreSQL

-- 1. Ver todas las interacciones de WhatsApp con conteo de mensajes
SELECT 
  i.id,
  i."providerConversationId",
  i.from,
  i.to,
  i.direction as interaction_direction,
  i.status,
  i."createdAt",
  COUNT(m.id) as total_messages,
  COUNT(CASE WHEN m.direction = 'INBOUND' THEN 1 END) as inbound_count,
  COUNT(CASE WHEN m.direction = 'OUTBOUND' THEN 1 END) as outbound_count
FROM interactions i
LEFT JOIN messages m ON m."interactionId" = i.id
WHERE i.channel = 'WHATSAPP'
GROUP BY i.id
ORDER BY i."createdAt" DESC
LIMIT 20;

-- 2. Ver todos los mensajes de una interacción específica (reemplaza 'TU_INTERACTION_ID')
SELECT 
  m.id,
  m.direction,
  m.text,
  m."sentAt",
  m."createdAt",
  m."providerMessageId",
  i."providerConversationId",
  i.from,
  i.to
FROM messages m
JOIN interactions i ON m."interactionId" = i.id
WHERE i.id = 'TU_INTERACTION_ID'  -- Reemplaza con el ID real
ORDER BY m."createdAt" ASC;

-- 3. Ver todas las interacciones de un número específico (reemplaza el número)
SELECT 
  i.id,
  i."providerConversationId",
  i.from,
  i.to,
  i.direction,
  i."createdAt",
  COUNT(m.id) as total_messages,
  COUNT(CASE WHEN m.direction = 'INBOUND' THEN 1 END) as inbound_count,
  COUNT(CASE WHEN m.direction = 'OUTBOUND' THEN 1 END) as outbound_count
FROM interactions i
LEFT JOIN messages m ON m."interactionId" = i.id
WHERE i."providerConversationId" LIKE '%5491133788190%'  -- Reemplaza con el número que buscas
  AND i.channel = 'WHATSAPP'
GROUP BY i.id
ORDER BY i."createdAt" DESC;

-- 4. Ver todos los mensajes OUTBOUND de WhatsApp (últimos 50)
SELECT 
  m.id,
  m.direction,
  m.text,
  m."sentAt",
  m."createdAt",
  i."providerConversationId",
  i.from,
  i.to,
  i.id as interaction_id
FROM messages m
JOIN interactions i ON m."interactionId" = i.id
WHERE m.direction = 'OUTBOUND'
  AND i.channel = 'WHATSAPP'
ORDER BY m."createdAt" DESC
LIMIT 50;

-- 5. Verificar si hay interacciones duplicadas para el mismo número (problema de normalización)
SELECT 
  "providerConversationId",
  COUNT(*) as interaction_count,
  STRING_AGG(id::text, ', ') as interaction_ids,
  STRING_AGG(direction::text, ', ') as directions
FROM interactions
WHERE channel = 'WHATSAPP'
  AND "providerConversationId" IS NOT NULL
GROUP BY "providerConversationId"
HAVING COUNT(*) > 1
ORDER BY interaction_count DESC;

-- 6. Ver mensajes de una conversación específica por providerConversationId
SELECT 
  m.id as message_id,
  m.direction,
  m.text,
  m."sentAt",
  m."createdAt",
  i.id as interaction_id,
  i."providerConversationId",
  i.from,
  i.to
FROM interactions i
LEFT JOIN messages m ON m."interactionId" = i.id
WHERE i."providerConversationId" = '+5491133788190'  -- Reemplaza con el número normalizado
  AND i.channel = 'WHATSAPP'
ORDER BY m."createdAt" ASC;
