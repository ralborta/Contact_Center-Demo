# Centro de Turnos — Hospital Santa María

Producto de demos en la rama **`citas-hospital`**: call center de turnos por teléfono con agente de voz y consola de gestión hospitalaria (Argentina, español, ARS, `America/Argentina/Buenos_Aires`).

> Esta rama **no** es el contact center bancario. No mergear a `master` sin revisión explícita.

## Stack

- `apps/cc-frontend` — consola Next.js
- `apps/cc-backend` — API NestJS + Prisma
- `prisma/` — PostgreSQL

Deploy: **Easypanel** (web + api + Postgres). Ver [README_DEPLOY.md](./README_DEPLOY.md).

Agente de voz: [docs/elevenlabs-agent.md](./docs/elevenlabs-agent.md).

## Desarrollo local

```bash
# Postgres local y:
export DATABASE_URL=postgresql://citas:citas@localhost:5432/citas_hospital?schema=public
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run db:seed
npm run dev:backend   # :3000
npm run dev:frontend  # :3001 (o next default)
```

Login seed: usuario `admin` con contraseña definida en `SEED_ADMIN_PASSWORD` (ver `env.example`).

## API del agente (resumen)

| Endpoint | Uso |
|---|---|
| `POST /api/agent/identificar-paciente` | Teléfono/DNI |
| `GET  /api/agent/especialidades` | Listado |
| `POST /api/agent/buscar-doctores` | Por especialidad/nombre |
| `POST /api/agent/disponibilidad` | Slots libres |
| `POST /api/agent/reservar` | Reserva atómica |
| `POST /api/agent/citas-paciente` | Citas activas |
| `POST /api/agent/reprogramar` | Cambio de slot |
| `POST /api/agent/cancelar` | Cancelación paciente |
| `POST /api/webhooks/voice/call-init` | Variables dinámicas |
| `POST /api/webhooks/voice/post-call` | Transcripción/resumen |

Auth: header `X-Agent-Secret`.

## Tests

```bash
export DATABASE_URL=...
npm test --workspace=apps/cc-backend
```

Cubre disponibilidad, doble reserva, reprogramar y cancelación por doctor.
