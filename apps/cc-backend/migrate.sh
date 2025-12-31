#!/bin/bash
set -e

echo "=== Ejecutando migraciones de Prisma ==="
echo "Working directory: $(pwd)"
echo "DATABASE_URL configurada: ${DATABASE_URL:+Sí}"

cd /app/apps/cc-backend || cd apps/cc-backend || true

echo "Ejecutando prisma migrate deploy..."
npx prisma migrate deploy --schema=../../prisma/schema.prisma

echo "=== Migraciones completadas exitosamente ==="
