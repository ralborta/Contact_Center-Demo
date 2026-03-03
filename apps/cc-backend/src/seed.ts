/**
 * Seed: crea perfiles (ADMIN, AGENT, VIEWER) y usuario admin inicial.
 * Ejecutar: npm run seed (desde repo root) o desde apps/cc-backend: npx ts-node -r tsconfig-paths/register src/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PROFILES = [
  { name: 'Administrador', slug: 'ADMIN', description: 'Acceso total: ver todo, borrar, gestionar usuarios y perfiles' },
  { name: 'Agente', slug: 'AGENT', description: 'Operador del contact center' },
  { name: 'Solo lectura', slug: 'VIEWER', description: 'Solo consulta' },
];

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

async function main() {
  console.log('Creando perfiles...');
  for (const p of PROFILES) {
    await prisma.profile.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description ?? undefined },
      create: p,
    });
  }
  console.log('Perfiles listos.');

  const adminProfile = await prisma.profile.findUnique({ where: { slug: 'ADMIN' } });
  if (!adminProfile) throw new Error('Perfil ADMIN no encontrado');

  const existingAdmin = await prisma.user.findUnique({
    where: { username: DEFAULT_ADMIN_USERNAME },
  });
  if (existingAdmin) {
    console.log('Usuario admin ya existe. Saltando creación.');
  } else {
    const hash = await argon2.hash(DEFAULT_ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        username: DEFAULT_ADMIN_USERNAME,
        passwordHash: hash,
        profileId: adminProfile.id,
        active: true,
      },
    });
    console.log(`Usuario admin creado: ${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('IMPORTANTE: Cambiar la contraseña después del primer inicio de sesión.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
