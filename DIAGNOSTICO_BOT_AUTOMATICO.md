# 🔍 Diagnóstico: Mensajes del Bot Automático NO Aparecen

## El Problema

Los mensajes que envía el **bot automáticamente** desde BuilderBot (respuestas automáticas del bot) **NO aparecen** en el historial.

**IMPORTANTE:**
- ✅ Los mensajes que envías **desde la app** (formulario) SÍ aparecen
- ❌ Los mensajes que envía el **bot automáticamente** NO aparecen

---

## ¿Por qué pasa esto?

**BuilderBot necesita estar configurado para enviar webhooks de `message.outgoing`** cuando el bot responde automáticamente.

Si BuilderBot NO está configurado para enviar estos webhooks, **nunca sabremos** que el bot envió un mensaje, y por lo tanto no lo podemos guardar en la base de datos.

---

## Verificación Paso a Paso

### Paso 1: Verificar si BuilderBot está enviando webhooks

**1.1. Revisa los logs de Railway:**

1. Ve a Railway → `cc-backend` → Logs
2. Haz que el bot responda automáticamente (envía un mensaje desde tu WhatsApp personal)
3. Busca estos logs:

```
🔍 Evento recibido: message.outgoing
🤖 IMPORTANTE: Mensaje saliente del BOT AUTOMÁTICO detectado!
📩 WEBHOOK BUILDERBOT: MENSAJE SALIENTE (bot automático)
```

**Si NO ves estos logs:**
- ❌ **BuilderBot NO está enviando webhooks de `message.outgoing`**
- ❌ Necesitas configurar BuilderBot para que envíe estos eventos

**Si SÍ ves estos logs:**
- ✅ El webhook está llegando
- Continúa al Paso 2

---

### Paso 2: Verificar que el mensaje se está guardando

En los logs de Railway, después del webhook, busca:

```
💬 Mensaje OUTBOUND guardado: MessageId=..., InteractionId=...
📊 Estado final: Total=X, INBOUND=Y, OUTBOUND=Z
```

**Si OUTBOUND aumenta:**
- ✅ El mensaje se está guardando correctamente
- El problema puede estar en el frontend (no se está mostrando)

**Si OUTBOUND no aumenta:**
- ❌ Hay un problema al guardar el mensaje
- Revisa los logs para errores

---

### Paso 3: Usar el endpoint de diagnóstico

**3.1. Verificar mensajes en la DB:**

Haz una petición GET a:
```
https://tu-backend-railway.up.railway.app/api/webhooks/builderbot/diagnostic
```

O con un número específico:
```
https://tu-backend-railway.up.railway.app/api/webhooks/builderbot/diagnostic?phone=5491133788190
```

**Respuesta esperada:**
```json
{
  "summary": {
    "totalOutboundMessages": 5,
    "totalInboundMessages": 10,
    "totalInteractions": 3
  },
  "interactions": [
    {
      "interactionId": "...",
      "providerConversationId": "+5491133788190",
      "inboundCount": 3,
      "outboundCount": 2,
      "messages": [
        {
          "direction": "INBOUND",
          "text": "..."
        },
        {
          "direction": "OUTBOUND",
          "text": "..."
        }
      ]
    }
  ]
}
```

**Si `outboundCount` es 0 en todas las interacciones:**
- ❌ Los mensajes del bot NO se están guardando
- Verifica los logs de Railway para ver qué está pasando

---

### Paso 4: Probar el endpoint de test

**4.1. Simular un webhook de `message.outgoing`:**

Haz una petición POST a:
```
POST https://tu-backend-railway.up.railway.app/api/webhooks/builderbot/test-outgoing
Content-Type: application/json

{
  "phone": "+5491133788190",
  "message": "Este es un mensaje de prueba del bot automático"
}
```

**Esto debería:**
1. Simular un webhook de `message.outgoing`
2. Guardar el mensaje como OUTBOUND
3. Mostrar logs detallados en Railway

**Si este test funciona:**
- ✅ El código está bien
- ❌ El problema es que BuilderBot NO está enviando los webhooks reales

**Si este test NO funciona:**
- ❌ Hay un problema en el código
- Revisa los logs de Railway para ver el error

---

## Soluciones Posibles

### Solución 1: Configurar BuilderBot para enviar `message.outgoing`

**Pasos:**
1. Ve a [BuilderBot.cloud Dashboard](https://builderbot.cloud)
2. Selecciona tu proyecto/bot
3. Ve a **Settings** → **Webhooks** o **Integrations**
4. Verifica que el webhook esté configurado para enviar:
   - ✅ `message.incoming` (mensajes del cliente)
   - ✅ `message.outgoing` (mensajes del bot automático) ← **ESTO ES CRÍTICO**

**URL del Webhook:**
```
https://tu-backend-railway.up.railway.app/api/webhooks/builderbot/whatsapp
```

**Si BuilderBot NO tiene la opción de enviar `message.outgoing`:**
- Contacta a BuilderBot support
- O busca en la documentación de BuilderBot cómo activar estos webhooks

---

### Solución 2: Polling de la API de BuilderBot (si está disponible)

Si BuilderBot tiene una API para obtener el historial de mensajes, podríamos hacer polling periódico para obtener los mensajes enviados por el bot.

**Problema:** No sabemos si BuilderBot tiene esta API disponible.

---

### Solución 3: Guardar el mensaje cuando se envía desde nuestra app

**Ya lo hacemos:** Cuando envías un mensaje desde el formulario de la app, lo guardamos correctamente.

**El problema:** Los mensajes que el bot envía automáticamente (sin que nosotros lo llamemos) no se están guardando.

---

## Checklist de Verificación

- [ ] Revisé los logs de Railway cuando el bot responde automáticamente
- [ ] Verifiqué si veo logs de "MENSAJE SALIENTE (bot automático)"
- [ ] Verifiqué si veo logs de "Mensaje OUTBOUND guardado"
- [ ] Usé el endpoint `/api/webhooks/builderbot/diagnostic` para verificar mensajes en la DB
- [ ] Probé el endpoint `/api/webhooks/builderbot/test-outgoing` para simular un webhook
- [ ] Verifiqué la configuración de webhooks en BuilderBot
- [ ] Confirmé que BuilderBot está configurado para enviar `message.outgoing`

---

## Próximos Pasos

1. **Revisa los logs de Railway:**
   - Haz que el bot responda automáticamente
   - Busca los logs de "MENSAJE SALIENTE"
   - Comparte los logs que veas

2. **Usa el endpoint de diagnóstico:**
   - Haz una petición GET a `/api/webhooks/builderbot/diagnostic`
   - Comparte la respuesta

3. **Prueba el endpoint de test:**
   - Haz una petición POST a `/api/webhooks/builderbot/test-outgoing`
   - Revisa los logs de Railway
   - Comparte los resultados

4. **Verifica la configuración de BuilderBot:**
   - Revisa si BuilderBot está configurado para enviar `message.outgoing`
   - Si no está disponible, contacta a BuilderBot support

---

## Preguntas Frecuentes

### ¿Por qué los mensajes que envío desde la app SÍ aparecen?

Porque cuando envías un mensaje desde la app, nosotros llamamos directamente a la API de BuilderBot y **inmediatamente guardamos el mensaje** en nuestra base de datos. No dependemos de un webhook.

### ¿Por qué los mensajes del bot automático NO aparecen?

Porque cuando el bot responde automáticamente, **dependemos de que BuilderBot nos envíe un webhook** de `message.outgoing`. Si BuilderBot no envía este webhook, nunca sabemos que el bot envió un mensaje.

### ¿Hay alguna forma de obtener los mensajes sin webhooks?

Solo si BuilderBot tiene una API para obtener el historial de mensajes. Tendríamos que hacer polling periódico, pero esto no es ideal porque:
- Agrega latencia (los mensajes aparecerían con delay)
- Consume más recursos
- No es tiempo real

### ¿Qué pasa si BuilderBot no soporta `message.outgoing`?

En ese caso, los mensajes automáticos del bot **nunca aparecerán** en el historial, a menos que:
1. BuilderBot agregue soporte para estos webhooks
2. O implementemos polling de la API (si está disponible)

---

## Resumen

**El problema:** BuilderBot probablemente NO está enviando webhooks de `message.outgoing` cuando el bot responde automáticamente.

**La solución:** Configurar BuilderBot para que envíe estos webhooks, o encontrar otra forma de obtener los mensajes enviados por el bot.

**Para verificar:** Usa los endpoints de diagnóstico y revisa los logs de Railway para confirmar qué está pasando.
