# 📱 Integración WhatsApp con BuilderBot.cloud

## ✅ Implementación completada

Se agregó soporte completo para WhatsApp usando BuilderBot.cloud API v2.

---

## 🔧 Variables de Entorno Necesarias

Agrega estas variables en Railway (servicio `cc-backend`):

```bash
# BuilderBot.cloud API
BUILDERBOT_BOT_ID=tu_bot_id           # ID del bot en BuilderBot.cloud
BUILDERBOT_API_KEY=tu_api_key         # API Key de tu cuenta
BUILDERBOT_BASE_URL=https://app.builderbot.cloud  # URL base (opcional, este es el default)
```

### ¿Dónde encontrar estos valores?

1. **BUILDERBOT_BOT_ID** y **BUILDERBOT_API_KEY**:
   - Ve a tu dashboard de BuilderBot.cloud
   - Settings → API Keys
   - Copia el Bot ID y crea/copia un API Key

2. **BUILDERBOT_BASE_URL** (opcional):
   - Solo si BuilderBot.cloud cambió su dominio
   - Default: `https://app.builderbot.cloud`

---

## 🔗 Configurar Webhook en BuilderBot.cloud

1. **Ve a tu dashboard de BuilderBot.cloud**
2. **Settings → Webhooks**
3. **Configura:**
   - **URL:** `https://tu-backend-railway.up.railway.app/api/webhooks/builderbot/whatsapp`
   - **Events:** Selecciona `message.incoming`

**Nota:** BuilderBot.cloud NO requiere autenticación especial para webhooks, solo la URL.

---

## 📊 Cómo Funciona

### 1. Recibir Mensajes (Webhook)

Cuando un cliente envía un mensaje por WhatsApp:

```
Cliente WhatsApp
    ↓
BuilderBot.cloud
    ↓ (webhook)
POST /api/webhooks/builderbot/whatsapp
    ↓
Backend crea/actualiza Interaction
    ↓
Guarda Message en la DB
    ↓
Frontend muestra en el dashboard
```

**Datos guardados:**
- ✅ Interaction con `channel: WHATSAPP`
- ✅ Message con el texto y adjuntos
- ✅ Event con payload completo
- ✅ Audit log

### 2. Enviar Mensajes (API)

Para enviar un mensaje desde el backend/dashboard:

```typescript
POST /api/whatsapp/send
{
  "providerConversationId": "5491112345678",
  "to": "5491112345678",
  "text": "Hola, tu ticket ha sido actualizado"
}
```

**El backend:**
1. Llama a BuilderBot.cloud API v2
2. Crea Interaction OUTBOUND
3. Guarda Message en la DB
4. Registra en audit log

---

## 🧪 Probar la Integración

### 1. Verificar variables de entorno

```bash
# En Railway → cc-backend → Variables
BUILDERBOT_BOT_ID=✅
BUILDERBOT_API_KEY=✅
BUILDERBOT_WEBHOOK_TOKEN=✅
```

### 2. Enviar mensaje de prueba

Envía un mensaje de WhatsApp al número conectado en BuilderBot.cloud.

### 3. Verificar en logs del backend (Railway)

Busca en los logs:
```
📩 Webhook recibido de BuilderBot: {...}
✅ Mensaje procesado: Interaction xxx, Customer: ...
```

### 4. Verificar en el API

```bash
curl https://tu-backend-railway.up.railway.app/api/interactions?channel=WHATSAPP
```

Deberías ver la interacción creada.

### 5. Verificar en el Frontend

Abre el dashboard y busca la interacción de WhatsApp en la tabla.

---

## 📋 Endpoints Disponibles

### Webhook (Recibir)
```
POST /api/webhooks/builderbot/whatsapp
Body: (payload de BuilderBot.cloud)
```

### Enviar Mensaje
```
POST /api/whatsapp/send
{
  "providerConversationId": "549XXXXXXXXX",
  "to": "549XXXXXXXXX",
  "text": "Tu mensaje"
}
```

### Listar Interacciones de WhatsApp
```
GET /api/interactions?channel=WHATSAPP
```

---

## 🔍 Formato del Webhook de BuilderBot.cloud

BuilderBot.cloud envía webhooks con este formato:

```json
{
  "eventName": "message.incoming",
  "data": {
    "body": "Hola, necesito ayuda",
    "name": "Juan Pérez",
    "from": "5491112345678",
    "attachment": [],
    "urlTempFile": "https://...",
    "projectId": "xxx"
  }
}
```

**El backend procesa:**
- ✅ `body` → Texto del mensaje
- ✅ `from` → Teléfono del cliente
- ✅ `name` → Nombre del contacto (para `customerRef`)
- ✅ `urlTempFile` → URL de archivos multimedia
- ✅ `attachment` → Array de adjuntos

---

## 🚀 Próximos Pasos

### Opcional: Auto-respuestas
Puedes agregar lógica para auto-responder:

```typescript
// En builderbot-webhook.controller.ts
// Después de crear el mensaje entrante:

if (messageText.toLowerCase().includes('hola')) {
  await this.builderBotAdapter.sendMessage(
    providerConversationId,
    customerPhone,
    'Hola! Hemos recibido tu mensaje. Un agente te responderá pronto.',
  );
}
```

### Opcional: Notificaciones
Integrar notificaciones cuando llega un nuevo mensaje (email, Slack, etc.)

### Opcional: Frontend para responder
Agregar una UI en el frontend para que los agentes respondan desde el dashboard.

---

## 📝 Archivos Creados/Modificados

```
apps/cc-backend/src/
  ├── adapters/
  │   └── builderbot.adapter.ts          (✅ Actualizado - API v2)
  ├── webhooks/
  │   ├── builderbot-webhook.controller.ts  (✅ Nuevo - Recibe mensajes)
  │   ├── webhooks.module.ts              (✅ Actualizado - Importa controller)
  │   └── whatsapp.controller.ts          (Ya existía - Envía mensajes)
```

---

## ✅ Checklist de Deployment

- [ ] Variables de entorno configuradas en Railway:
  - [ ] `BUILDERBOT_BOT_ID`
  - [ ] `BUILDERBOT_API_KEY`
  - [ ] `BUILDERBOT_BASE_URL` (opcional)
- [ ] Webhook configurado en BuilderBot.cloud
- [ ] Deploy realizado en Railway
- [ ] Mensaje de prueba enviado por WhatsApp
- [ ] Mensaje aparece en logs del backend
- [ ] Interaction creada en `/api/interactions`
- [ ] Mensaje visible en el frontend

---

**Fecha:** 3 de enero 2026  
**Estado:** ✅ Listo para usar
