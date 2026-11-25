# Deploy en Easypanel — Centro de Citas Hospitalarias

**Branch de deploy: `citas-hospital`** (no usar `master`/`main` para este producto).

Proyecto Easypanel sugerido: `citas-hospital` con servicios:

| Servicio | Tipo | Dockerfile | Puerto |
|---|---|---|---|
| `postgres` | Database | imagen `postgres:16` | 5432 |
| `api` | App | `Dockerfile.api` (contexto: raíz del repo) | 3000 |
| `web` | App | `Dockerfile.web` (contexto: raíz del repo) | 3000 |

Redis **no es obligatorio** en esta rama (colas de campaña viven en Postgres).

## 1. Postgres

- DB: `citas_hospital`
- Usuario/password propios (no commitear)
- Conectar el servicio `api` con la URL interna de Easypanel

## 2. API (`api`)

- **Source**: Git → branch `citas-hospital`
- **Dockerfile**: `Dockerfile.api`
- **Build context**: raíz del repositorio
- Variables (ver `env.example`):

```
DATABASE_URL=postgresql://USER:PASS@postgres:5432/citas_hospital?schema=public
JWT_SECRET=...
AGENT_API_SECRET=...
ELEVENLABS_WEBHOOK_TOKEN=...   # puede ser el mismo que AGENT_API_SECRET
CORS_ORIGIN=https://TU-WEB.easypanel.host
RUN_SEED=true                  # solo el primer deploy / demos; luego false
SEED_ADMIN_PASSWORD=...        # requerido si RUN_SEED crea el usuario admin
TZ=America/Argentina/Buenos_Aires
APP_PORT=3000
PORT=3000
```

Al arrancar, `main.ts` ejecuta `prisma migrate deploy`. Si `RUN_SEED=true`, carga datos demo (especialidades, doctores, Juan Pérez DNI 1234567, etc.) y crea `admin` solo si `SEED_ADMIN_PASSWORD` está definido.

Health: `GET /api/health`  
Docs: `GET /api/docs`

## 3. Web (`web`)

- **Source**: Git → branch `citas-hospital`
- **Dockerfile**: `Dockerfile.web`
- **Build arg**:

```
NEXT_PUBLIC_API_URL=https://TU-API.easypanel.host
```

- Puerto 3000

Login demo tras seed: usuario `admin` con la contraseña de `SEED_ADMIN_PASSWORD`.

## 4. Dominios

Ejemplo:

- Web: `citas-hospital.wd75db.easypanel.host`
- API: `citas-hospital-api.wd75db.easypanel.host`

Agregar el origen web a `CORS_ORIGIN`.

## 5. Agente de voz

Configurar el agente **después** del deploy (fuera de este repo). Ver `docs/elevenlabs-agent.md`:

- Server tools → `https://TU-API/.../api/agent/*` con header `X-Agent-Secret`
- Call initiation → `POST /api/webhooks/voice/call-init`
- Post-call → `POST /api/webhooks/voice/post-call`

## 6. Qué no usar

En esta rama **no** se despliega a Railway ni Vercel. Los archivos legacy de esos proveedores se eliminaron o se ignoran.
