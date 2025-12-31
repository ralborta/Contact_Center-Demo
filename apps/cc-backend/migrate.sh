#!/bin/bash
set -e

echo "=== Ejecutando migraciones de Prisma ==="
echo "Working directory: $(pwd)"
echo "DATABASE_URL configurada: ${DATABASE_URL:+Sí}"

cd /app/apps/cc-backend || cd apps/cc-backend || true

echo "Ejecutando prisma db push..."
npx prisma db push --schema=../../prisma/schema.prisma --accept-data-loss --skip-generate

echo "=== Migraciones completadas exitosamente ==="
