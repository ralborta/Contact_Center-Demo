# 🔧 Solución a los Problemas Detectados

**Fecha:** 2 de enero 2026  
**Análisis basado en:** Screenshots de logs y console del navegador

---

## 🔴 PROBLEMA 1: Worker no puede conectarse a Redis

### Error detectado:
```
Error: connect ECONNREFUSED ::1:6379
```

Este error se repite constantemente en los logs de Railway del servicio `cc-worker`.

### Causa:
El worker está intentando conectarse a Redis en `localhost:6379` porque las variables de entorno de Redis no están configuradas correctamente.

### ✅ SOLUCIÓN:

#### Opción A: Si Railway tiene Redis como servicio (recomendado)

1. **En Railway Dashboard:**
   - Ve al proyecto
   - Click en "New" → "Database" → "Add Redis"
   - Railway creará automáticamente la variable `REDIS_URL`

2. **Conecta el Redis al worker:**
   - Ve al servicio `cc-worker`
   - Settings → "Variables"
   - Verifica que exista `REDIS_URL` (Railway la agrega automáticamente)
   - Si no existe, agrégala manualmente copiándola del servicio Redis

3. **Actualiza el código del worker** para usar `REDIS_URL`:

**Archivo:** `apps/cc-worker/src/worker.ts`

**Líneas 72-77, CAMBIAR DE:**
```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});
```

**A:**
```typescript
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
```

4. **Haz commit y push:**
```bash
git add apps/cc-worker/src/worker.ts
git commit -m "fix: Use REDIS_URL instead of separate host/port/password"
git push
```

Railway redeployará automáticamente.

#### Opción B: Si usas Redis externo (Upstash, etc.)

1. Obtén la URL de conexión de tu Redis (formato: `redis://...` o `rediss://...`)
2. En Railway, servicio `cc-worker`:
   - Settings → Variables
   - Agregar: `REDIS_URL=redis://tu-redis-url:6379`
3. Aplicar el cambio de código de la Opción A

---

## 🔴 PROBLEMA 2: Verificar configuración del Frontend

### Síntomas:
- El Network tab muestra requests a `/calls`, `/whatsapp`, `/sms`
- Algunos requests dan 200, otros 304

### Verificación necesaria:

1. **Abre el frontend en el navegador**
2. **F12 → Console**
3. **Busca el mensaje que dice qué URL está usando:**

En `api.ts` hay un log que debería mostrar la URL. Si no, agrégalo temporalmente.

4. **Verifica que `NEXT_PUBLIC_API_URL` en Vercel sea:**
```
https://tu-backend-railway.up.railway.app
```

**NO debe tener** `/api` al final:
- ✅ Correcto: `https://contact-center-demo-cc-backend.up.railway.app`
- ❌ Incorrecto: `https://contact-center-demo-cc-backend.up.railway.app/api`

El código ya agrega `/api` automáticamente.

---

## 🔴 PROBLEMA 3: ¿Dónde están las llamadas?

Para verificar si hay llamadas en la base de datos:

### Paso 1: Verifica el endpoint directamente

Abre en el navegador:
```
https://tu-backend-railway.up.railway.app/api/interactions
```

**Resultados posibles:**

✅ **Devuelve array con datos:**
```json
[
  {
    "id": "...",
    "channel": "CALL",
    "from": "+...",
    ...
  }
]
```
→ **HAY DATOS**, el problema es del frontend

❌ **Devuelve array vacío `[]`:**
→ **NO HAY DATOS**, necesitas:
  - Configurar webhook de ElevenLabs
  - O hacer una llamada de prueba

❌ **Error 500:**
→ Problema con la base de datos

### Paso 2: Si NO hay datos (array vacío)

**Necesitas configurar el webhook de ElevenLabs:**

1. Ve a tu dashboard de ElevenLabs
2. Busca la sección de "Webhooks" o "Conversations API"
3. Configura:
   - **URL:** `https://tu-backend-railway.up.railway.app/api/webhooks/elevenlabs`
   - **Events:** Selecciona todos, especialmente:
     - `conversation.initiation`
     - `conversation.ended`
4. Guarda

5. **Haz una llamada de prueba** a tu número de ElevenLabs

6. **Verifica los logs del backend en Railway:**
```
Webhook received from ElevenLabs
Created interaction: ...
```

7. **Refresca** `https://tu-backend-railway.up.railway.app/api/interactions`

Ahora debería aparecer la llamada.

---

## 📋 Resumen de Acciones

### 🚨 URGENTE (Worker crasheando):

1. [ ] Agregar servicio Redis en Railway
2. [ ] Actualizar código del worker para usar `REDIS_URL`
3. [ ] Commit y push
4. [ ] Verificar logs del worker (deben desaparecer los errores ECONNREFUSED)

### 🔧 Verificación Frontend:

1. [ ] Confirmar valor de `NEXT_PUBLIC_API_URL` en Vercel
2. [ ] Verificar que sea sin `/api` al final
3. [ ] Redeploy frontend si es necesario

### 📞 Crear llamadas de prueba:

1. [ ] Configurar webhook de ElevenLabs
2. [ ] Hacer llamada de prueba
3. [ ] Verificar en `/api/interactions` que aparezca
4. [ ] Verificar en el frontend

---

## 🔍 Comandos útiles para debugging

### Ver logs del worker en tiempo real:
```bash
# Si tienes Railway CLI instalado
railway logs -s cc-worker --follow
```

### Ver logs del backend:
```bash
railway logs -s cc-backend --follow
```

### Verificar estado de Redis:
```bash
# Si tienes acceso al Redis
redis-cli ping
# Debe responder: PONG
```

---

## ✅ Estado esperado después de las correcciones

### Worker:
- ✅ Sin errores en los logs
- ✅ Mensaje: "Worker started and listening for jobs..."
- ✅ Sin "ECONNREFUSED"

### Backend:
- ✅ Responde en `/api/interactions`
- ✅ Swagger docs en `/api/docs`
- ✅ Sin errores 500

### Frontend:
- ✅ Sin errores en console del navegador
- ✅ Dashboard muestra datos
- ✅ Llamadas aparecen en la tabla

---

**Próximos pasos:**
1. Aplica la corrección del worker (URGENTE)
2. Verifica la configuración del frontend
3. Configura el webhook de ElevenLabs
4. Haz una llamada de prueba
5. Reporta los resultados
