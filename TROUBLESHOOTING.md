# 🔍 Troubleshooting - Llamadas no aparecen en el Frontend

## Problema: El frontend no muestra las llamadas

Si `NEXT_PUBLIC_API_URL` está configurada correctamente, hay 3 causas principales:

---

## ✅ 1. Verificar que el Backend esté respondiendo

### Prueba directa del API:
Abre en tu navegador o usa curl:

```bash
# Reemplaza con tu URL de Railway
curl https://tu-backend.up.railway.app/api/interactions
```

**Respuestas esperadas:**

✅ **Si devuelve `[]` (array vacío):** El backend funciona pero NO HAY DATOS
❌ **Si da error 500:** Hay un problema con la base de datos
❌ **Si no responde:** El backend no está corriendo

---

## ✅ 2. Verificar que HAY DATOS en la Base de Datos

El problema más común es que **NO HAY LLAMADAS REGISTRADAS**.

### ¿Cómo se crean las llamadas?

Las llamadas se crean de 2 formas:

#### A. Webhook de ElevenLabs (POST /api/webhooks/elevenlabs)
- ElevenLabs debe estar configurado para enviar webhooks a tu backend
- URL del webhook debe ser: `https://tu-backend.up.railway.app/api/webhooks/elevenlabs`

#### B. Worker de sincronización (cc-worker)
- El worker debe estar corriendo en Railway
- Sincroniza llamadas automáticamente cada X minutos

### Verifica en Railway:
1. Ve al servicio `cc-backend`
2. Revisa los logs (pestaña "Deployments" → último deployment → "View Logs")
3. Busca mensajes como:
   - `"Webhook received from ElevenLabs"` ✅
   - `"Created interaction"` ✅
   - `"Error"` ❌

---

## ✅ 3. Filtro de Fecha demasiado restrictivo

**IMPORTANTE:** El frontend solo muestra llamadas de HOY:

```typescript
// Dashboard.tsx línea 18-22
const today = new Date()
today.setHours(0, 0, 0, 0)
const data = await interactionsApi.getAll({
  dateFrom: today.toISOString(),
})
```

### Solución: Quitar el filtro temporalmente

Si quieres ver TODAS las llamadas históricas (no solo de hoy), cambia:

**Antes:**
```typescript
const data = await interactionsApi.getAll({
  dateFrom: today.toISOString(),
})
```

**Después:**
```typescript
const data = await interactionsApi.getAll({
  // Sin filtros - muestra todas las llamadas
})
```

O cambia a últimos 30 días:
```typescript
const last30Days = new Date()
last30Days.setDate(last30Days.getDate() - 30)
const data = await interactionsApi.getAll({
  dateFrom: last30Days.toISOString(),
})
```

---

## 📋 Checklist de Diagnóstico

Sigue estos pasos en orden:

### Paso 1: Verificar Backend
- [ ] Abre `https://tu-backend.up.railway.app/api/docs` (Swagger)
- [ ] ¿Se carga la documentación? → Backend funciona ✅
- [ ] Si no carga → Revisa logs en Railway

### Paso 2: Verificar Endpoint de Interactions
- [ ] Abre `https://tu-backend.up.railway.app/api/interactions`
- [ ] ¿Devuelve `[]`? → No hay datos, ve al Paso 3
- [ ] ¿Devuelve un array con objetos? → Hay datos, ve al Paso 4
- [ ] ¿Da error? → Problema de base de datos, revisa `DATABASE_URL`

### Paso 3: Si NO hay datos (devuelve `[]`)
**Causa:** No se han registrado llamadas

**Soluciones:**
1. Configura el webhook de ElevenLabs:
   - URL: `https://tu-backend.up.railway.app/api/webhooks/elevenlabs`
   - Events: `conversation.initiation`, `conversation.ended`

2. Verifica que el worker esté corriendo:
   - Railway → Servicio `cc-worker`
   - Revisa logs para ver si sincroniza

3. Haz una llamada de prueba a tu número de ElevenLabs

### Paso 4: Si HAY datos pero no aparecen en frontend
**Causa:** Filtro de fecha restrictivo

**Solución:**
1. Abre `https://tu-backend.up.railway.app/api/interactions` en el navegador
2. ¿Ves llamadas? Copia una fecha de `startedAt`
3. Compara con la fecha de hoy
4. Si las llamadas son de días anteriores, quita o ajusta el filtro de fecha en el frontend

### Paso 5: Verificar CORS
Abre el frontend en el navegador:
1. F12 → Console
2. ¿Ves errores de CORS?
3. Si sí → Agrega tu dominio de Vercel a `ALLOWED_ORIGINS` en Railway:
   ```
   ALLOWED_ORIGINS=https://tu-dominio.vercel.app
   ```

---

## 🔧 Comandos Útiles para Debugging

### Ver logs del backend en tiempo real (Railway):
```bash
railway logs -s cc-backend --follow
```

### Ver logs del worker:
```bash
railway logs -s cc-worker --follow
```

### Probar el endpoint con todos los parámetros:
```bash
curl "https://tu-backend.up.railway.app/api/interactions?channel=CALL"
```

### Ver datos sin filtro de fecha:
```bash
curl "https://tu-backend.up.railway.app/api/interactions?limit=10"
```

---

## 💡 Solución Rápida - Ver TODAS las llamadas

Para debugging, cambia temporalmente el frontend para mostrar todas las llamadas:

**Archivo:** `apps/cc-frontend/src/components/Dashboard.tsx`

**Línea 15-30, cambia de:**
```typescript
useEffect(() => {
  const fetchData = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const data = await interactionsApi.getAll({
        dateFrom: today.toISOString(),
      })
```

**A:**
```typescript
useEffect(() => {
  const fetchData = async () => {
    try {
      // Mostrar llamadas de los últimos 30 días para debugging
      const last30Days = new Date()
      last30Days.setDate(last30Days.getDate() - 30)
      const data = await interactionsApi.getAll({
        dateFrom: last30Days.toISOString(),
      })
```

Guarda, haz commit y redespliega en Vercel.

---

## 📊 Estado esperado

### Backend funcionando:
```bash
$ curl https://tu-backend.up.railway.app/api/interactions
[
  {
    "id": "abc-123",
    "channel": "CALL",
    "direction": "INBOUND",
    "status": "COMPLETED",
    "from": "+1234567890",
    "to": "+0987654321",
    ...
  }
]
```

### Frontend funcionando:
- Dashboard muestra métricas con números > 0
- Tabla de agentes muestra agentes
- Sección "Llamadas Recientes" muestra llamadas

---

**Última actualización:** 2 de enero 2026
