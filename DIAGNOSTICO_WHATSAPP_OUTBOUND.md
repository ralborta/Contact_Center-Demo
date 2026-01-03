# 🔍 Diagnóstico Completo: Mensajes OUTBOUND no aparecen

## Pasos para Diagnosticar el Problema

### Paso 1: Verificar que el mensaje se está enviando

**1.1. Abre la consola del navegador (F12 → Console)**

**1.2. Envía un mensaje desde el formulario**

**1.3. Busca estos logs:**

```
[WhatsApp] Enviando mensaje: {
  providerConversationId: "...",
  to: "...",
  text: "...",
  interactionId: "..."
}
```

**Si NO ves este log:**
- ❌ El botón no está funcionando
- ❌ Hay un error en el frontend

**Si SÍ ves este log, continúa al Paso 2.**

---

### Paso 2: Verificar que el backend recibe la petición

**2.1. Ve a Railway → `cc-backend` → Logs**

**2.2. Envía un mensaje desde el frontend**

**2.3. Busca estos logs INMEDIATAMENTE después de enviar:**

```
[WhatsAppController] 📤 Enviando mensaje WhatsApp a ... (normalized: ..., conversationId: ...)
```

**Si NO ves este log:**
- ❌ La petición no está llegando al backend
- ❌ Hay un error de red/CORS
- ❌ El endpoint `/api/whatsapp/send` no está funcionando

**Si SÍ ves este log, continúa al Paso 3.**

---

### Paso 3: Verificar que se encuentra la interacción correcta

**3.1. En los logs de Railway, busca:**

```
[WhatsAppController] ✅ Usando interacción existente: abc123...
```

**O:**

```
[WhatsAppController] 📝 Creando nueva interacción para ...
```

**Si ves "Creando nueva interacción":**
- ⚠️ El `providerConversationId` NO coincide con el de los mensajes INBOUND
- ⚠️ Los mensajes OUTBOUND se están guardando en una interacción DIFERENTE

**Si ves "Usando interacción existente":**
- ✅ La interacción se encontró correctamente
- Continúa al Paso 4

---

### Paso 4: Verificar que el mensaje se guarda en la DB

**4.1. En los logs de Railway, busca:**

```
[WhatsAppController] 💬 Mensaje OUTBOUND guardado: MessageId=..., InteractionId=..., Direction=OUTBOUND
[WhatsAppController] ✅ Verificación: Interaction ... tiene X mensajes totales (INBOUND: Y, OUTBOUND: Z)
```

**Si NO ves "Mensaje OUTBOUND guardado":**
- ❌ El mensaje NO se está guardando
- ❌ Hay un error en `createMessage`

**Si SÍ ves "Mensaje OUTBOUND guardado" pero OUTBOUND sigue siendo 0:**
- ❌ El mensaje se está guardando en otra interacción
- ❌ El `interactionId` no coincide

**Si SÍ ves que OUTBOUND aumenta (ej: OUTBOUND: 1, 2, 3...):**
- ✅ El mensaje SE ESTÁ GUARDANDO correctamente
- Continúa al Paso 5

---

### Paso 5: Verificar directamente en la Base de Datos

**5.1. Ve a Railway → Database → Query**

**5.2. Ejecuta esta query (reemplaza el ID de la interacción):**

```sql
-- Ver todos los mensajes de una interacción específica
SELECT 
  m.id,
  m.direction,
  m.text,
  m."sentAt",
  m."createdAt",
  i."providerConversationId",
  i.from,
  i.to
FROM messages m
JOIN interactions i ON m."interactionId" = i.id
WHERE i.id = 'TU_INTERACTION_ID'  -- Reemplaza con el ID real de la interacción
ORDER BY m."createdAt" ASC;
```

**Si NO ves mensajes OUTBOUND en la query:**
- ❌ Los mensajes NO se están guardando en la DB
- ❌ Hay un problema con `createMessage` o la transacción

**Si SÍ ves mensajes OUTBOUND en la query:**
- ✅ Los mensajes SE ESTÁN GUARDANDO en la DB
- Continúa al Paso 6

---

### Paso 6: Verificar que el frontend recupera los mensajes

**6.1. Abre la consola del navegador (F12 → Console)**

**6.2. Recarga la página de detalle de la interacción**

**6.3. Busca este log:**

```
[API] getById: Interaction ... - Total messages: X, INBOUND: Y, OUTBOUND: Z
```

**Si OUTBOUND es 0 pero en la DB hay mensajes OUTBOUND:**
- ❌ El backend NO está devolviendo los mensajes OUTBOUND
- ❌ Hay un problema en `findOne` o en el filtro de mensajes

**Si OUTBOUND coincide con la DB:**
- ✅ El backend SÍ está devolviendo los mensajes
- Continúa al Paso 7

---

### Paso 7: Verificar que el frontend muestra los mensajes

**7.1. En la consola del navegador, busca:**

```
[InteractionDetail] WhatsApp messages: Total=X, INBOUND=Y, OUTBOUND=Z
```

**Si OUTBOUND es 0:**
- ❌ El frontend no está recibiendo los mensajes OUTBOUND
- ❌ Hay un problema en cómo se pasan los datos al componente

**Si OUTBOUND > 0 pero no se muestran:**
- ❌ Hay un problema en el renderizado
- ❌ Los mensajes están siendo filtrados en el frontend

---

## Query SQL para Verificar Todo

```sql
-- 1. Ver todas las interacciones de WhatsApp con conteo de mensajes
SELECT 
  i.id,
  i."providerConversationId",
  i.from,
  i.to,
  i.direction as interaction_direction,
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

-- 2. Ver todos los mensajes OUTBOUND de WhatsApp (últimos 50)
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

-- 3. Verificar si hay interacciones duplicadas (problema de normalización)
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
```

---

## Problemas Comunes y Soluciones

### Problema 1: Mensajes OUTBOUND se guardan en interacción diferente

**Síntomas:**
- Los logs muestran "Creando nueva interacción" en lugar de "Usando interacción existente"
- En la DB hay mensajes OUTBOUND pero en otra interacción

**Causa:**
- El `providerConversationId` no coincide entre mensajes INBOUND y OUTBOUND

**Solución:**
- Verificar que el `providerConversationId` sea exactamente el mismo
- Ejecutar la query #3 para ver si hay interacciones duplicadas
- Migrar los mensajes a la interacción correcta

### Problema 2: Mensajes OUTBOUND no se guardan

**Síntomas:**
- Los logs muestran "Mensaje OUTBOUND guardado" pero en la DB no hay mensajes
- El conteo de mensajes no aumenta

**Causa:**
- Error en `createMessage` que no se está mostrando
- Problema con la transacción de la DB

**Solución:**
- Revisar los logs de Railway para errores de Prisma
- Verificar que la DB esté funcionando correctamente

### Problema 3: Mensajes OUTBOUND se guardan pero no se recuperan

**Síntomas:**
- En la DB hay mensajes OUTBOUND
- Pero el API no los devuelve

**Causa:**
- Problema en `findOne` que filtra los mensajes
- Problema con la relación en Prisma

**Solución:**
- Verificar que `findOne` incluya todos los mensajes
- Verificar que no haya filtros por dirección

---

## Checklist de Verificación

Usa este checklist para identificar exactamente dónde está el problema:

- [ ] **Paso 1:** El frontend envía la petición (log en consola del navegador)
- [ ] **Paso 2:** El backend recibe la petición (log en Railway)
- [ ] **Paso 3:** Se encuentra la interacción correcta (log en Railway)
- [ ] **Paso 4:** El mensaje se guarda en la DB (log en Railway + query SQL)
- [ ] **Paso 5:** Los mensajes están en la DB (query SQL directa)
- [ ] **Paso 6:** El backend devuelve los mensajes (log en consola del navegador)
- [ ] **Paso 7:** El frontend muestra los mensajes (log en consola del navegador)

**El problema está en el primer paso que falle.**

---

## Qué Hacer Ahora

1. **Ejecuta el Paso 1** y comparte qué ves en la consola del navegador
2. **Ejecuta el Paso 2** y comparte qué ves en los logs de Railway
3. **Ejecuta la query SQL #1** y comparte el resultado
4. **Ejecuta la query SQL #2** y comparte si hay mensajes OUTBOUND

Con esta información podremos identificar EXACTAMENTE dónde está el problema.
