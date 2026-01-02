# 🔴 Configuración de Redis en Railway (URGENTE)

## Problema detectado:
El worker está crasheando constantemente porque no puede conectarse a Redis.

```
Error: connect ECONNREFUSED ::1:6379
```

---

## ✅ Solución: Agregar Redis a Railway

### Paso 1: Agregar servicio Redis

1. **Abre tu proyecto en Railway Dashboard**
2. **Click en "New" → "Database" → "Add Redis"**
3. Railway creará automáticamente el servicio Redis
4. Espera a que se despliegue (toma 1-2 minutos)

### Paso 2: Verificar que la variable REDIS_URL se creó

Railway automáticamente crea una variable `REDIS_URL` compartida entre todos los servicios.

**Verifica:**
1. Ve al servicio `cc-backend`
2. Pestaña "Variables"
3. Busca `REDIS_URL` (debe aparecer con un ícono de "shared")
4. Debe tener un valor como: `redis://default:password@hostname:6379`

Si NO aparece:
1. Ve al servicio Redis
2. Pestaña "Connect"
3. Copia la URL de conexión
4. Agrégala manualmente en `cc-backend` y `cc-worker`:
   - Name: `REDIS_URL`
   - Value: `redis://...` (la URL copiada)

### Paso 3: Redeploy los servicios

**No es necesario hacer nada**, Railway redeployará automáticamente cuando agregues Redis.

Pero si quieres forzar el redeploy:
1. Ve a cada servicio (`cc-backend` y `cc-worker`)
2. Pestaña "Deployments"
3. Click en "Deploy" o los tres puntos (⋮) → "Redeploy"

---

## 🔍 Verificar que funcionó

### Logs del worker

Después del redeploy, abre los logs del `cc-worker`:

**Antes (con error):**
```
Error: connect ECONNREFUSED ::1:6379
Error: connect ECONNREFUSED ::1:6379
Error: connect ECONNREFUSED ::1:6379
...
```

**Después (correcto):**
```
{"level":"info","message":"Worker started and listening for jobs...","timestamp":"..."}
```

Sin errores ECONNREFUSED ✅

### Logs del backend

El backend también debe iniciar sin problemas de Redis:

```
Application is running on: http://0.0.0.0:3000
Swagger docs available at: http://0.0.0.0:3000/api/docs
```

---

## 🆘 Alternativa: Usar Redis externo (Upstash)

Si Railway no permite agregar Redis (por límites de plan), usa Upstash:

### Paso 1: Crear cuenta en Upstash

1. Ve a https://upstash.com/
2. Regístrate gratis
3. Crea una nueva database Redis
4. Selecciona la región más cercana

### Paso 2: Copiar la URL de conexión

1. En tu database de Upstash
2. Click en "Details"
3. Copia el valor de **"Redis URL"** o **"UPSTASH_REDIS_REST_URL"**
4. Debe ser algo como: `redis://default:xxxxx@global-xxxxx.upstash.io:6379`

### Paso 3: Agregar la variable en Railway

Para cada servicio (`cc-backend` y `cc-worker`):

1. Settings → Variables
2. Add Variable:
   - Name: `REDIS_URL`
   - Value: `redis://default:xxxxx@global-xxxxx.upstash.io:6379`
3. Click "Add"

Railway redeployará automáticamente.

---

## ✅ Corrección del código ya aplicada

Ya actualicé el código del worker para usar `REDIS_URL` correctamente.

**Archivo:** `apps/cc-worker/src/worker.ts`

**Cambio aplicado:**
```typescript
// Conectar a Redis usando REDIS_URL (formato de Railway/Upstash)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
```

**Ahora necesitas:**
1. Hacer commit de este cambio
2. Push a GitHub
3. Railway redeployará automáticamente

---

## 📋 Comandos Git

```bash
# Verificar cambios
git status

# Agregar el archivo modificado
git add apps/cc-worker/src/worker.ts

# Commit
git commit -m "fix(worker): Use REDIS_URL for Railway/Upstash compatibility"

# Push
git push origin main
```

Railway detectará el push y redeployará automáticamente.

---

## 🎯 Resumen de lo que necesitas hacer AHORA

1. [ ] **Agregar Redis en Railway** (New → Database → Redis)
   - O crear cuenta en Upstash y copiar URL
   
2. [ ] **Verificar que `REDIS_URL` existe** en variables de entorno
   - Debe estar en `cc-backend` y `cc-worker`
   
3. [ ] **Hacer commit y push del código corregido:**
```bash
git add apps/cc-worker/src/worker.ts
git commit -m "fix(worker): Use REDIS_URL for Railway compatibility"
git push origin main
```

4. [ ] **Esperar a que Railway redesplegue** (1-3 minutos)

5. [ ] **Verificar logs del worker** - NO debe tener errores ECONNREFUSED

---

**Tiempo estimado:** 5-10 minutos

**Prioridad:** 🚨 **URGENTE** - El worker no funcionará hasta que esto esté arreglado

---

**Siguiente paso después de esto:** Configurar webhook de ElevenLabs para que las llamadas se registren automáticamente.
