# Configuración de SMS con Twilio

## 🔴 Problema: Error 500 al enviar SMS

Si ves errores `500` al intentar enviar SMS, es porque **faltan las variables de entorno de Twilio** en Railway.

## ✅ Solución: Configurar Variables en Railway

### 1. Ve a Railway Dashboard

1. Abre tu proyecto en [Railway](https://railway.app)
2. Selecciona el servicio `cc-backend`
3. Ve a **Settings** → **Variables**

### 2. Agrega estas 3 variables:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+541152382487
```

**Importante:**
- `TWILIO_ACCOUNT_SID`: Tu Account SID de Twilio (empieza con `AC`)
- `TWILIO_AUTH_TOKEN`: Tu Auth Token de Twilio
- `TWILIO_FROM_NUMBER`: Tu número de Twilio con formato internacional (ej: `+541152382487`)

### 3. Dónde encontrar estas credenciales:

1. Ve a [Twilio Console](https://console.twilio.com)
2. En el dashboard principal verás:
   - **Account SID**: En la parte superior
   - **Auth Token**: Haz click en "Show" para verlo
3. Para el número:
   - Ve a **Phone Numbers** → **Manage** → **Active numbers**
   - Copia el número en formato internacional (ej: `+541152382487`)

### 4. Variable Opcional (para links):

Si quieres que los links de verificación y onboarding funcionen, agrega también:

```bash
FRONTEND_URL=https://tu-frontend-real.vercel.app
```

**Nota:** Esta debe ser la URL de tu **frontend** en Vercel, NO del backend.

### 5. Redesplegar

Después de agregar las variables:

1. Railway debería detectar el cambio automáticamente
2. O ve a **Deployments** → Click en los 3 puntos → **Redeploy**

## 🔍 Verificación

### 1. Verificar en los logs de Railway:

Después de agregar las variables y redesplegar, intenta enviar un SMS y revisa los logs:

```
[SmsController] 📤 Enviando SMS personalizado a +541234567890
[Twilio] Enviando SMS: { to: '+541234567890', from: '+541152382487', bodyLength: 35 }
[Twilio] ✅ SMS enviado exitosamente: { messageSid: 'SM...', status: 'queued', to: '+541234567890' }
[SmsController] ✅ SMS enviado exitosamente: Interaction abc123, MessageId: SM...
```

### 2. Si ves este error:

```
❌ Error al enviar SMS: Twilio client not initialized. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN
```

→ **Las variables no están configuradas correctamente**

### 3. Si ves este error:

```
❌ Error al enviar SMS: TWILIO_FROM_NUMBER no configurado
```

→ **Falta la variable `TWILIO_FROM_NUMBER`**

## 📝 Resumen de Variables Necesarias

### Backend (Railway) - `cc-backend`:

**Obligatorias para SMS:**
- ✅ `TWILIO_ACCOUNT_SID`
- ✅ `TWILIO_AUTH_TOKEN`
- ✅ `TWILIO_FROM_NUMBER`

**Opcional:**
- `FRONTEND_URL` (solo si usas links de verificación/onboarding)

### Frontend (Vercel) - `cc-frontend`:

**Obligatoria:**
- ✅ `NEXT_PUBLIC_API_URL` (URL del backend en Railway)

**NO necesita:**
- ❌ Variables de Twilio (solo el backend las necesita)
- ❌ Variables de base de datos
- ❌ Variables de Redis

## 🧪 Probar el Envío

1. Ve a tu frontend: `https://tu-frontend.vercel.app/sms`
2. Ingresa un número de teléfono
3. Haz click en "Enviar SMS" (SMS Personalizado)
4. Deberías ver un mensaje de éxito
5. El SMS debería llegar al teléfono en unos segundos

## ❌ Errores Comunes

### Error 500: "Twilio client not initialized"
**Causa:** Faltan `TWILIO_ACCOUNT_SID` o `TWILIO_AUTH_TOKEN`  
**Solución:** Agrega ambas variables en Railway

### Error 500: "TWILIO_FROM_NUMBER no configurado"
**Causa:** Falta `TWILIO_FROM_NUMBER`  
**Solución:** Agrega la variable con tu número de Twilio

### Error 400: "Invalid 'To' Phone Number"
**Causa:** El número de teléfono no tiene formato correcto  
**Solución:** Usa formato internacional: `+541234567890` (con `+` y código de país)

### Error 400: "The number +54... is not a valid mobile number"
**Causa:** El número no es un móvil válido o no está verificado en Twilio (si estás en trial)  
**Solución:** Verifica el número en Twilio Console o usa un número verificado
