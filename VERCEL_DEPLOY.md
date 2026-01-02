# Configuración de Vercel para el Frontend

## Variable de Entorno Necesaria

El frontend **SOLO** necesita **UNA** variable de entorno en Vercel:

### `NEXT_PUBLIC_API_URL`
Esta variable debe contener la URL de tu backend desplegado en Railway.

**Ejemplo:**
```
NEXT_PUBLIC_API_URL=https://tu-backend-railway.up.railway.app
```

## ❌ Variables que NO necesita el frontend:

- ❌ Variables de ElevenLabs (ELEVENLABS_API_KEY, etc.)
- ❌ Variables de la base de datos (DATABASE_URL)
- ❌ Variables de Twilio
- ❌ Variables de Redis

**Todas esas variables solo las necesita el backend en Railway.**

## 📝 Pasos para configurar Vercel:

### 1. Obtén la URL de tu backend
1. Ve a Railway Dashboard
2. Abre tu servicio `cc-backend`
3. Ve a la pestaña "Settings"
4. Busca la sección "Domains" o "Public Networking"
5. Copia la URL pública (ejemplo: `https://cc-backend-production.up.railway.app`)

### 2. Configura la variable en Vercel
1. Ve a tu proyecto en Vercel Dashboard
2. Click en "Settings" → "Environment Variables"
3. Agrega la siguiente variable:
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** La URL de tu backend (ejemplo: `https://cc-backend-production.up.railway.app`)
   - **Environment:** Production, Preview, Development (selecciona todos)
4. Click en "Save"

### 3. Redespliega tu frontend
1. Ve a la pestaña "Deployments"
2. Click en los tres puntos (⋮) del deployment más reciente
3. Click en "Redeploy"
4. Espera a que termine el deployment

## 🔍 Verificación

Una vez desplegado, abre tu frontend en el navegador y:

1. Abre las Developer Tools (F12)
2. Ve a la pestaña "Console"
3. Deberías ver las llamadas API hacia tu backend
4. Si hay errores de CORS, necesitas configurar el backend para aceptar el dominio de Vercel

## 🔧 Configuración adicional del Backend (si hay problemas de CORS)

Si el frontend no puede conectarse al backend por problemas de CORS, necesitas configurar en Railway:

1. En el servicio `cc-backend` en Railway
2. Agrega o actualiza la variable:
   - **Name:** `ALLOWED_ORIGINS`
   - **Value:** `https://tu-dominio-vercel.vercel.app`

O en el código del backend (`main.ts`), asegúrate de que CORS esté habilitado:

```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
});
```

## 📊 Estructura de las llamadas API

El frontend hace llamadas a:
- `GET /api/interactions` - Obtiene todas las interacciones
- `GET /api/interactions/:id` - Obtiene una interacción específica

Estas rutas deben estar disponibles en tu backend.

## ✅ Checklist de deployment

- [ ] Backend desplegado en Railway y funcionando
- [ ] URL del backend copiada
- [ ] Variable `NEXT_PUBLIC_API_URL` configurada en Vercel
- [ ] Frontend redesplegado en Vercel
- [ ] Console del navegador sin errores de conexión
- [ ] Llamadas visibles en el dashboard

---

**Fecha:** 2 de enero 2026
**Última actualización:** Configuración inicial
