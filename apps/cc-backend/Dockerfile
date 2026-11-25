# API — Centro de Citas Hospitalarias (Easypanel)
# Build context: raíz del monorepo. Branch de deploy: citas-hospital
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY apps/cc-backend/package.json ./apps/cc-backend/
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/
COPY prisma ./prisma
RUN npm ci --workspace=apps/cc-backend --include-workspace-root
COPY apps/cc-backend ./apps/cc-backend
COPY packages ./packages
COPY tsconfig.json ./
RUN npx prisma generate --schema=prisma/schema.prisma
WORKDIR /app/apps/cc-backend
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV APP_PORT=3000
COPY package.json package-lock.json ./
COPY apps/cc-backend/package.json ./apps/cc-backend/
COPY packages/core/package.json ./packages/core/
COPY packages/adapters/package.json ./packages/adapters/
COPY prisma ./prisma
RUN npm ci --workspace=apps/cc-backend --include-workspace-root --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/cc-backend/dist ./apps/cc-backend/dist
COPY apps/cc-backend/package.json ./apps/cc-backend/
COPY prisma ./prisma
WORKDIR /app/apps/cc-backend
EXPOSE 3000
# Migraciones al arrancar (main.ts). Seed solo si RUN_SEED=true
CMD ["node", "dist/main.js"]
