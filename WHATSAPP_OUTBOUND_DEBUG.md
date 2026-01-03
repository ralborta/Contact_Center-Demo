# 🔍 Debug: Mensajes OUTBOUND no aparecen

## Problema
Los mensajes OUTBOUND (del agente) no aparecen en el historial de WhatsApp.

## Pasos para Debugging

### 1. Verificar que el mensaje se está enviando

**Revisa los logs de Railway después de enviar un mensaje:**

Busca estos logs en Railway → `cc-backend` → Logs:

```
📤 Enviando mensaje WhatsApp a +54 11 3378 8190 (normalized: +5491133788190, conversationId: +5491133788190)
✅ Usando interacción existente: abc123-def456-...
💬 Mensaje OUTBOUND guardado: MessageId=xyz789, InteractionId=abc123-def456-..., Direction=OUTBOUND, Text="Hola! ¿En qué puedo ayudarte?..."
✅ Verificación: Interaction abc123-def456-... tiene 5 mensajes totales (INBOUND: 3, OUTBOUND: 2)
```

**Si NO ves estos logs:**
- El endpoint `/api/whatsapp/send` no se está llamando
- Verifica que el frontend esté llamando correctamente al endpoint

### 2. Verificar que el mensaje se guardó en la DB

**Consulta directa a la base de datos:**

```sql
-- Ver todos los mensajes de una interacción específica
SELECT 
  m.id,
  m.direction,
  m.text,
  m."sentAt",
  m."createdAt",
  i."providerConversationId"
FROM messages m
JOIN interactions i ON m."interactionId" = i.id
WHERE i.id = 'TU_INTERACTION_ID'
ORDER BY m."createdAt" ASC;
```

**O verificar por número de teléfono:**

```sql
-- Ver todas las interacciones y mensajes de un número
SELECT 
  i.id as interaction_id,
  i."providerConversationId",
  i.from,
  i.to,
  m.id as message_id,
  m.direction,
  m.text,
  m."sentAt"
FROM interactions i
LEFT JOIN messages m ON m."interactionId" = i.id
WHERE i."providerConversationId" LIKE '%5491133788190%'
  AND i.channel = 'WHATSAPP'
ORDER BY i."createdAt" DESC, m."createdAt" ASC;
```

### 3. Verificar que el frontend está recuperando los mensajes

**Abre la consola del navegador (F12) y verifica:**

1. Ve a la página de detalle de interacción
2. Abre la pestaña "Network"
3. Busca la llamada a `/api/interactions/[id]`
4. Revisa la respuesta JSON

**La respuesta debería incluir:**

```json
{
  "id": "abc123-def456-...",
  "channel": "WHATSAPP",
  "messages": [
    {
      "id": "msg1",
      "direction": "INBOUND",
      "text": "Hola",
      "sentAt": "2024-01-01T10:00:00Z"
    },
    {
      "id": "msg2",
      "direction": "OUTBOUND",
      "text": "Hola! ¿En qué puedo ayudarte?",
      "sentAt": "2024-01-01T10:01:00Z"
    }
  ]
}
```

**Si los mensajes OUTBOUND NO están en la respuesta:**
- El problema está en el backend (no se están guardando o no se están recuperando)
- Revisa los logs del backend

**Si los mensajes OUTBOUND SÍ están en la respuesta pero no se muestran:**
- El problema está en el frontend
- Revisa la consola del navegador para errores de JavaScript

### 4. Verificar el providerConversationId

**El problema más común es que el `providerConversationId` no coincide:**

**Mensaje INBOUND (del cliente):**
- `providerConversationId = "+5491133788190"` (normalizado)

**Mensaje OUTBOUND (del agente):**
- Debe usar el mismo `providerConversationId = "+5491133788190"`

**Cómo verificar:**

```sql
-- Ver todas las interacciones de WhatsApp y sus providerConversationId
SELECT 
  id,
  "providerConversationId",
  from,
  to,
  direction,
  "createdAt",
  (SELECT COUNT(*) FROM messages WHERE "interactionId" = i.id) as message_count
FROM interactions i
WHERE channel = 'WHATSAPP'
ORDER BY "createdAt" DESC
LIMIT 20;
```

**Si ves interacciones duplicadas con `providerConversationId` similares pero diferentes:**
- El problema es la normalización del número
- Ejemplo:
  - Interacción 1: `providerConversationId = "5491133788190"` (sin +)
  - Interacción 2: `providerConversationId = "+5491133788190"` (con +)

### 5. Verificar la normalización del número

**El código normaliza los números así:**

```typescript
// Entrada: "+54 11 3378 8190" o "5491133788190"
// Salida: "+5491133788190"
```

**Problemas comunes:**

1. **Número con formato diferente:**
   - Cliente envía: `"5491133788190"` (sin +)
   - Agente envía: `"+5491133788190"` (con +)
   - **Solución:** El código ahora normaliza ambos, pero si hay datos antiguos, pueden estar en formatos diferentes

2. **Número con espacios:**
   - Cliente envía: `"+54 11 3378 8190"` (con espacios)
   - Agente envía: `"+5491133788190"` (sin espacios)
   - **Solución:** El código ahora remueve espacios automáticamente

### 6. Solución: Migrar datos existentes

**Si tienes interacciones con formatos diferentes, puedes migrarlas:**

```sql
-- Normalizar todos los providerConversationId de WhatsApp
UPDATE interactions
SET "providerConversationId" = REPLACE(REPLACE(REPLACE(REPLACE("providerConversationId", ' ', ''), '-', ''), '(', ''), ')', '')
WHERE channel = 'WHATSAPP'
  AND "providerConversationId" IS NOT NULL;

-- Agregar + si no lo tiene y empieza con 54
UPDATE interactions
SET "providerConversationId" = '+' || "providerConversationId"
WHERE channel = 'WHATSAPP'
  AND "providerConversationId" IS NOT NULL
  AND "providerConversationId" LIKE '54%'
  AND "providerConversationId" NOT LIKE '+%';
```

**⚠️ CUIDADO:** Haz un backup antes de ejecutar estas queries.

### 7. Verificar el endpoint de envío

**Cómo llamar al endpoint correctamente:**

```bash
POST /api/whatsapp/send
Content-Type: application/json

{
  "to": "+54 11 3378 8190",  // Puede tener espacios, se normaliza
  "text": "Hola! ¿En qué puedo ayudarte?",
  "assignedAgent": "Juan Pérez" // Opcional
}
```

**O con providerConversationId explícito:**

```bash
POST /api/whatsapp/send
Content-Type: application/json

{
  "providerConversationId": "+5491133788190",  // Debe coincidir con el de los mensajes INBOUND
  "to": "+54 11 3378 8190",
  "text": "Hola! ¿En qué puedo ayudarte?"
}
```

### 8. Checklist de Verificación

- [ ] Los logs muestran que el mensaje se está guardando
- [ ] El mensaje aparece en la base de datos (consulta SQL)
- [ ] El mensaje aparece en la respuesta del API (`/api/interactions/[id]`)
- [ ] El `providerConversationId` coincide entre mensajes INBOUND y OUTBOUND
- [ ] Los números están normalizados correctamente
- [ ] No hay errores en la consola del navegador
- [ ] El frontend está mostrando todos los mensajes (sin filtrar por dirección)

### 9. Logs Esperados

**Cuando envías un mensaje OUTBOUND, deberías ver:**

```
[WhatsAppController] 📤 Enviando mensaje WhatsApp a +54 11 3378 8190 (normalized: +5491133788190, conversationId: +5491133788190)
[WhatsAppController] ✅ Usando interacción existente: abc123-def456-...
[WhatsAppController] 💬 Mensaje OUTBOUND guardado: MessageId=xyz789, InteractionId=abc123-def456-..., Direction=OUTBOUND, Text="Hola! ¿En qué puedo ayudarte?..."
[WhatsAppController] ✅ Verificación: Interaction abc123-def456-... tiene 5 mensajes totales (INBOUND: 3, OUTBOUND: 2)
```

**Cuando recuperas una interacción, deberías ver:**

```
[InteractionsService] findOne: Interaction abc123-def456-... tiene 5 mensajes (INBOUND: 3, OUTBOUND: 2)
```

## Solución Rápida

Si los mensajes OUTBOUND no aparecen:

1. **Verifica los logs de Railway** después de enviar un mensaje
2. **Consulta la base de datos** para ver si el mensaje se guardó
3. **Verifica que el `providerConversationId` coincida** entre mensajes INBOUND y OUTBOUND
4. **Revisa la respuesta del API** en el navegador (Network tab)
5. **Verifica la consola del navegador** para errores de JavaScript

Si después de estos pasos aún no aparecen, comparte:
- Los logs de Railway
- El resultado de la consulta SQL
- La respuesta del API (Network tab)
- Cualquier error en la consola del navegador
