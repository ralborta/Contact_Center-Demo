# 🔧 Configuración: Mensajes Automáticos del Bot de BuilderBot

## Problema
Los mensajes que envía el **bot automáticamente** desde BuilderBot (respuestas automáticas del bot) **NO se están registrando** en el historial.

Los mensajes que envías **desde la app** (el formulario) SÍ funcionan correctamente.

## Causa
BuilderBot necesita estar configurado para enviar webhooks de `message.outgoing` (mensajes salientes del bot).

## Solución: Configurar BuilderBot

### Paso 1: Verificar Webhook en BuilderBot

1. Ve a [BuilderBot.cloud Dashboard](https://builderbot.cloud)
2. Selecciona tu proyecto/bot
3. Ve a **Settings** → **Webhooks** o **Integrations**

### Paso 2: Configurar el Webhook

**URL del Webhook:**
```
https://tu-backend-railway.up.railway.app/api/webhooks/builderbot/whatsapp
```

**Eventos que DEBE enviar:**
- ✅ `message.incoming` (mensajes del cliente) - Ya configurado
- ✅ `message.outgoing` (mensajes del bot automático) - **DEBE estar activado**

### Paso 3: Verificar que `message.outgoing` esté activado

Asegúrate de que BuilderBot esté configurado para enviar eventos de `message.outgoing` cuando el bot responde automáticamente.

---

## Verificación: ¿Está llegando el webhook?

### Paso 1: Revisar Logs de Railway

1. Ve a Railway → `cc-backend` → Logs
2. Cuando el bot responda automáticamente, busca estos logs:

```
📩 WEBHOOK BUILDERBOT: MENSAJE SALIENTE (bot automático)
═══════════════════════════════════════════════════════
EventName: message.outgoing
```

**Si NO ves este log:**
- ❌ BuilderBot NO está enviando webhooks de `message.outgoing`
- ❌ Necesitas configurar BuilderBot para que envíe estos eventos

**Si SÍ ves este log:**
- ✅ El webhook está llegando
- Continúa al Paso 2

### Paso 2: Verificar que se está guardando

En los logs de Railway, después del webhook, busca:

```
💬 Mensaje OUTBOUND guardado en Interaction ...
📊 Estado final: Total=X, INBOUND=Y, OUTBOUND=Z
```

**Si OUTBOUND aumenta:**
- ✅ El mensaje se está guardando correctamente

**Si OUTBOUND no aumenta:**
- ❌ Hay un problema al guardar el mensaje
- Revisa los logs para errores

---

## Estructura del Payload de BuilderBot

Cuando BuilderBot envía un `message.outgoing`, el payload debería tener esta estructura:

```json
{
  "eventName": "message.outgoing",
  "data": {
    "body": "Texto del mensaje del bot",
    "to": "+5491133788190",  // Número del cliente (destinatario)
    "remoteJid": "5491133788190@s.whatsapp.net",
    "phone": "+5491133788190",
    // ... otros campos
  }
}
```

**Campos importantes:**
- `to`: Número del cliente (destinatario del mensaje del bot)
- `remoteJid`: JID completo de WhatsApp
- `body`: Texto del mensaje

---

## Debugging: Ver qué está llegando

### Opción 1: Ver logs de Railway

Cuando el bot responda automáticamente, revisa los logs de Railway:

```
📩 WEBHOOK BUILDERBOT: MENSAJE SALIENTE (bot automático)
Data completa: {
  "body": "...",
  "to": "...",
  "remoteJid": "...",
  ...
}
📞 Número extraído: ... (OUTBOUND - mensaje del bot automático)
📋 Campos disponibles: from=..., to=..., remoteJid=..., phone=...
```

### Opción 2: Verificar en la Base de Datos

Ejecuta esta query para ver si hay mensajes OUTBOUND del bot:

```sql
-- Ver todos los mensajes OUTBOUND de WhatsApp
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
WHERE m.direction = 'OUTBOUND'
  AND i.channel = 'WHATSAPP'
ORDER BY m."createdAt" DESC
LIMIT 20;
```

---

## Problemas Comunes

### Problema 1: BuilderBot no envía `message.outgoing`

**Síntoma:**
- No ves logs de "MENSAJE SALIENTE" en Railway
- Solo ves "MENSAJE ENTRANTE"

**Solución:**
- Verifica la configuración de webhooks en BuilderBot
- Asegúrate de que `message.outgoing` esté activado
- Contacta a BuilderBot support si no está disponible

### Problema 2: El webhook llega pero no se guarda

**Síntoma:**
- Ves el log "MENSAJE SALIENTE" pero no ves "Mensaje OUTBOUND guardado"

**Solución:**
- Revisa los logs de Railway para errores
- Verifica que el número del cliente se esté extrayendo correctamente
- Verifica que la interacción se esté encontrando

### Problema 3: El mensaje se guarda en otra interacción

**Síntoma:**
- El mensaje se guarda pero no aparece en la conversación correcta

**Solución:**
- Verifica que el `providerConversationId` coincida
- Ejecuta la query SQL para ver en qué interacción se guardó

---

## Checklist de Verificación

- [ ] BuilderBot está configurado para enviar `message.outgoing`
- [ ] El webhook URL está correcto en BuilderBot
- [ ] Los logs muestran "MENSAJE SALIENTE" cuando el bot responde
- [ ] Los logs muestran "Mensaje OUTBOUND guardado"
- [ ] Los mensajes OUTBOUND aparecen en la base de datos
- [ ] Los mensajes OUTBOUND aparecen en el frontend

---

## Próximos Pasos

1. **Verifica la configuración de BuilderBot:**
   - Asegúrate de que `message.outgoing` esté activado en los webhooks

2. **Haz que el bot responda automáticamente:**
   - Envía un mensaje desde tu WhatsApp personal
   - Espera a que el bot responda automáticamente

3. **Revisa los logs de Railway:**
   - Busca los logs de "MENSAJE SALIENTE"
   - Verifica que el mensaje se esté guardando

4. **Verifica en la base de datos:**
   - Ejecuta la query SQL para ver si hay mensajes OUTBOUND

Si después de estos pasos aún no aparecen los mensajes, comparte:
- Los logs de Railway cuando el bot responde
- La configuración de webhooks en BuilderBot (si es posible)
- El resultado de la query SQL
