#!/bin/sh
set -e

echo "=========================================="
echo "EJECUTANDO MIGRACIONES DE PRISMA"
echo "=========================================="
echo "Working directory: $(pwd)"
echo "Listing contents:"
ls -la

echo ""
echo "Looking for schema..."
find . -name "schema.prisma" -type f

echo ""
echo "Looking for migrations..."
find . -name "migrations" -type d

echo ""
echo "DATABASE_URL set: ${DATABASE_URL:+YES}"

echo ""
echo "Attempting to run migrations..."

# Try multiple paths
if [ -f "../../prisma/schema.prisma" ]; then
  echo "Found schema at ../../prisma/schema.prisma"
  npx prisma migrate deploy --schema=../../prisma/schema.prisma
elif [ -f "./prisma/schema.prisma" ]; then
  echo "Found schema at ./prisma/schema.prisma"
  npx prisma migrate deploy --schema=./prisma/schema.prisma
else
  echo "ERROR: Could not find schema.prisma"
  exit 1
fi

echo ""
echo "=========================================="
echo "MIGRACIONES COMPLETADAS"
echo "=========================================="
