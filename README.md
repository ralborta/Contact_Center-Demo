# Contact Center - Backend API

Backend para Centro de Gestión de Contact Center Bancario con soporte para llamadas (ElevenLabs), WhatsApp (builderbot.cloud) y SMS transaccional (Twilio).

## Stack Tecnológico

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS
- **ORM**: Prisma
- **Base de Datos**: PostgreSQL
- **Cola de Trabajos**: Redis + BullMQ
- **Documentación**: Swagger OpenAPI
- **Logging**: Winston (JSON estructurado)

## Estructura del Proyecto

```
/
  apps/
    cc-backend/          # API NestJS
    cc-worker/           # Worker BullMQ para procesar jobs SMS
  packages/
    core/                # Dominio y utilidades (PII masking, enums)
    adapters/            # Integraciones: ElevenLabs, BuilderBot, Twilio
  prisma/
    schema.prisma        # Schema de base de datos
  docker/
    docker-compose.yml   # Postgres + Redis local
```

## Configuración Local

### Prerrequisitos

- Node.js 18+
- Docker y Docker Compose
- npm o yarn

### Pasos

1. **Clonar e instalar dependencias**

```bash
npm install
```

2. **Configurar variables de entorno**

Copia `.env.example` a `.env` y completa las variables:

```bash
cp .env.example .env
```

Variables importantes:
- `DATABASE_URL`: URL de conexión a PostgreSQL
- `REDIS_HOST`, `REDIS_PORT`: Configuración de Redis
- `ELEVENLABS_WEBHOOK_TOKEN`: Token para validar webhooks de ElevenLabs
- `BUILDERBOT_WEBHOOK_TOKEN`, `BUILDERBOT_API_URL`, `BUILDERBOT_API_KEY`: Configuración de builderbot
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: Credenciales de Twilio
- `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_RATE_LIMIT_*`: Configuración de OTP

3. **Levantar servicios con Docker**

```bash
cd docker
docker-compose up -d
```

Esto levanta:
- PostgreSQL en puerto 5432
- Redis en puerto 6379

4. **Generar cliente Prisma**

```bash
npm run prisma:generate
```

5. **Ejecutar migraciones**

```bash
npm run prisma:migrate
```

6. **Iniciar backend**

En una terminal:
```bash
npm run dev:backend
```

En otra terminal (para el worker):
```bash
npm run dev:worker
```

El API estará disponible en `http://localhost:3000`
La documentación Swagger en `http://localhost:3000/api/docs`

## Deploy en Railway

### 1. Crear Proyecto en Railway

1. Ve a [Railway](https://railway.app) y crea una cuenta
2. Crea un nuevo proyecto
3. Conecta tu repositorio Git

### 2. Agregar Servicios de Base de Datos

#### PostgreSQL

1. En tu proyecto Railway, haz clic en "New" → "Database" → "Add PostgreSQL"
2. Railway creará automáticamente una instancia de PostgreSQL
3. Copia la variable `DATABASE_URL` que Railway genera automáticamente

#### Redis

1. En tu proyecto Railway, haz clic en "New" → "Database" → "Add Redis"
2. Railway creará automáticamente una instancia de Redis
3. Copia las variables `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` que Railway genera

### 3. Configurar Variables de Entorno

En Railway, ve a tu proyecto → "Variables" y agrega todas las variables del `.env.example`:

**Base de datos y Redis:**
- `DATABASE_URL`: (generado automáticamente por Railway para PostgreSQL)
- `REDIS_HOST`: (generado automáticamente por Railway para Redis)
- `REDIS_PORT`: (generado automáticamente por Railway para Redis)
- `REDIS_PASSWORD`: (generado automáticamente por Railway para Redis)

**App:**
- `APP_PORT=3000`

**ElevenLabs:**
- `ELEVENLABS_WEBHOOK_TOKEN`: Tu token de webhook de ElevenLabs
- `ELEVENLABS_PROVIDER_NAME=elevenlabs`

**BuilderBot:**
- `BUILDERBOT_WEBHOOK_TOKEN`: Token para validar webhooks
- `BUILDERBOT_API_URL`: URL de la API de builderbot (ej: `https://api.builderbot.cloud`)
- `BUILDERBOT_API_KEY`: API key de builderbot

**Twilio:**
- `TWILIO_ACCOUNT_SID`: Tu Account SID de Twilio
- `TWILIO_AUTH_TOKEN`: Tu Auth Token de Twilio
- `TWILIO_FROM_NUMBER`: Número de teléfono de Twilio (formato: `+1234567890`)
- `TWILIO_WEBHOOK_TOKEN`: Token para validar webhooks de Twilio

**OTP:**
- `OTP_TTL_SECONDS=300` (5 minutos)
- `OTP_MAX_ATTEMPTS=5`
- `OTP_RATE_LIMIT_WINDOW_SECONDS=900` (15 minutos)
- `OTP_RATE_LIMIT_MAX=3`

**PII:**
- `PII_MASKING_ENABLED=true`

### 4. Deploy del Backend (API)

1. En Railway, haz clic en "New" → "GitHub Repo" (o conecta tu repo)
2. Selecciona el directorio raíz del proyecto (o `apps/cc-backend` si Railway lo permite)
3. Railway detectará automáticamente que es un proyecto Node.js
4. Si usas el directorio raíz, Railway usará el `railway.json` o puedes configurar manualmente:
   - **Root Directory**: `apps/cc-backend` (si Railway lo permite)
   - **Build Command**: `npm install && npm run build --workspace=apps/cc-backend`
   - **Start Command**: `cd apps/cc-backend && node dist/main.js`
5. Railway generará automáticamente un dominio público (ej: `your-app.up.railway.app`)
6. Guarda este dominio para configurar los webhooks

**Nota**: Si Railway no detecta correctamente el workspace, puedes crear un servicio separado apuntando a `apps/cc-backend` o usar el `railway.json` en la raíz.

### 5. Deploy del Worker

1. En Railway, dentro del mismo proyecto, haz clic en "New" → "GitHub Repo" (o "New Service")
2. Selecciona el mismo repositorio pero apunta al directorio `apps/cc-worker`
3. Configura el comando de build:
   - **Root Directory**: `apps/cc-worker` (si Railway lo permite)
   - **Build Command**: `npm install && npm run build --workspace=apps/cc-worker`
   - **Start Command**: `cd apps/cc-worker && node dist/worker.js`
4. **IMPORTANTE**: Asegúrate de que tenga acceso a las mismas variables de entorno (DATABASE_URL, REDIS_*, etc.)
   - En Railway, puedes compartir variables entre servicios del mismo proyecto

### 6. Ejecutar Migraciones

Antes de que el backend esté completamente funcional, necesitas ejecutar las migraciones de Prisma:

1. En Railway, ve a tu servicio del backend
2. Abre la pestaña "Deployments"
3. Haz clic en el deployment más reciente → "View Logs"
4. O puedes usar Railway CLI:

```bash
railway run --service cc-backend npx prisma migrate deploy
```

O conectarte vía SSH y ejecutar:

```bash
railway shell
cd apps/cc-backend
npx prisma migrate deploy
```

### 7. Configurar Webhooks

Una vez que tengas el dominio público de Railway (ej: `https://your-app.up.railway.app`), configura los webhooks:

#### ElevenLabs

1. Ve a la configuración de Webhook Tools en ElevenLabs
2. URL: `https://your-app.up.railway.app/webhooks/elevenlabs/call`
3. Header: `X-Webhook-Token: <tu ELEVENLABS_WEBHOOK_TOKEN>`

#### BuilderBot

1. Ve a la configuración de webhooks en builderbot.cloud
2. URL: `https://your-app.up.railway.app/webhooks/builderbot/whatsapp`
3. Header: `X-Webhook-Token: <tu BUILDERBOT_WEBHOOK_TOKEN>`

#### Twilio (Status Callback)

1. En Twilio Console, configura el status callback URL para tus mensajes SMS
2. URL: `https://your-app.up.railway.app/webhooks/twilio/sms/status`
3. Header: `X-Webhook-Token: <tu TWILIO_WEBHOOK_TOKEN>` (opcional, Twilio también puede usar firma)

### 8. Verificar Deploy

1. Verifica que el backend esté corriendo:
   ```bash
   curl https://your-app.up.railway.app/api/health
   ```

2. Verifica Swagger:
   - Abre `https://your-app.up.railway.app/api/docs`

3. Verifica logs:
   - En Railway, ve a cada servicio → "View Logs"

## Endpoints Principales

### Health
- `GET /api/health` - Health check

### Interactions
- `GET /api/interactions` - Listar interacciones (con filtros)
- `GET /api/interactions/:id` - Detalle de interacción

### OTP
- `POST /api/otp` - Crear OTP challenge y encolar envío SMS
- `POST /api/otp/verify` - Verificar código OTP

### Webhooks
- `POST /webhooks/elevenlabs/call` - Webhook de llamadas ElevenLabs
- `POST /webhooks/builderbot/whatsapp` - Webhook de WhatsApp builderbot
- `POST /webhooks/twilio/sms/status` - Webhook de status SMS Twilio

## Modelo de Datos

### Interaction
Registra todas las interacciones (llamadas, WhatsApp, SMS) con estado, timestamps, agente asignado, etc.

### InteractionEvent
Eventos asociados a cada interacción (raw JSONB + normalizado).

### Message
Mensajes individuales dentro de una interacción (WhatsApp, SMS).

### CallDetail
Detalles específicos de llamadas: grabación, transcripción, duración.

### OtpChallenge
Desafíos OTP para autenticación/verificación con rate limiting y expiración.

### AuditLog
Logs de auditoría para todas las acciones importantes.

## Seguridad

- **Webhooks**: Validación de tokens en todos los webhooks
- **Idempotencia**: Los eventos tienen `idempotencyKey` único
- **PII Masking**: Por defecto se enmascaran teléfonos en listados (configurable)
- **Rate Limiting**: OTP tiene rate limiting por teléfono + propósito
- **Audit Logs**: Todas las acciones críticas se registran

## Desarrollo

### Scripts Disponibles

```bash
# Desarrollo
npm run dev:backend    # Iniciar backend en modo watch
npm run dev:worker     # Iniciar worker en modo watch

# Build
npm run build          # Build de todos los workspaces

# Prisma
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Ejecutar migraciones
npm run prisma:studio    # Abrir Prisma Studio
```

### Estructura de Adapters

Los adapters en `packages/adapters` normalizan los payloads de diferentes proveedores:

- **ElevenLabsAdapter**: Normaliza eventos de llamadas (tolerante a diferentes formatos)
- **BuilderBotAdapter**: Normaliza mensajes WhatsApp y permite enviar mensajes
- **TwilioAdapter**: Envía SMS y normaliza status callbacks

## Notas Importantes

1. **Worker separado**: El worker BullMQ debe correr en un proceso separado (servicio separado en Railway)
2. **Migraciones**: Ejecutar migraciones antes del primer deploy
3. **Variables de entorno**: Todas las variables deben estar configuradas en Railway
4. **HTTPS**: Railway proporciona HTTPS automáticamente
5. **Logs**: Los logs están en formato JSON estructurado para fácil parsing

## Troubleshooting

### El worker no procesa jobs
- Verifica que Redis esté conectado correctamente
- Verifica las variables `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Revisa los logs del worker en Railway

### Webhooks no llegan
- Verifica que el dominio público esté correcto
- Verifica que el token en el header coincida con la variable de entorno
- Revisa los logs del backend para ver errores de autenticación

### OTP no se envía
- Verifica credenciales de Twilio
- Verifica que el worker esté corriendo
- Revisa los logs del worker para errores de Twilio

## Despliegue en Vercel (UI - Futuro)

**Nota**: La UI en Next.js se desplegará en Vercel más adelante. Por ahora solo el backend está listo.

Cuando implementes la UI:
1. Crea un proyecto Next.js en Vercel
2. Configura la variable de entorno `NEXT_PUBLIC_API_URL` apuntando a tu dominio de Railway
3. La UI consumirá los endpoints de esta API

## Próximos Pasos

- [ ] Implementar UI en Next.js (Vercel) consumiendo esta API
- [ ] Agregar autenticación JWT para endpoints de consola
- [ ] Implementar métricas agregadas (endpoints de dashboard)
- [ ] Agregar más validaciones y tests
