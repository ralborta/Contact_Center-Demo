import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

// Asegurar que crypto esté disponible globalmente para @nestjs/schedule
if (typeof globalThis.crypto === 'undefined') {
  const crypto = require('crypto');
  (globalThis as any).crypto = {
    randomUUID: () => crypto.randomUUID(),
  };
}

async function runMigrations() {
  console.log('==========================================');
  console.log('EJECUTANDO MIGRACIONES DE PRISMA');
  console.log('==========================================');
  
  try {
    // En Railway, __dirname = /app/apps/cc-backend/dist
    // Necesitamos ir a /app (3 niveles arriba)
    const projectRoot = path.join(__dirname, '../../..');
    const schemaPath = path.join(projectRoot, 'prisma/schema.prisma');

    console.log(`Working directory: ${process.cwd()}`);
    console.log(`__dirname: ${__dirname}`);
    console.log(`DATABASE_URL configurada: ${process.env.DATABASE_URL ? 'SÍ' : 'NO'}`);
    console.log(`Schema path: ${schemaPath}`);
    console.log(`Schema exists: ${fs.existsSync(schemaPath) ? 'SÍ' : 'NO'}`);

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema no encontrado en ${schemaPath}`);
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no configurada');
    }

    console.log('Ejecutando: npx prisma migrate deploy...');
    const result = execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: 'inherit',
      timeout: 120000,
    });

    console.log('==========================================');
    console.log('MIGRACIONES COMPLETADAS EXITOSAMENTE');
    console.log('==========================================');
  } catch (error: any) {
    console.error('==========================================');
    console.error('ERROR CRÍTICO EN MIGRACIONES');
    console.error('==========================================');
    console.error('Mensaje de error:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
    console.error('La aplicación no puede iniciar sin las tablas de la base de datos.');
    console.error('Por favor, verifica la configuración de DATABASE_URL y los logs de Prisma.');
    process.exit(1);
  }
}

async function runSeed() {
  console.log('Ejecutando seed inicial (perfiles y usuario admin)...');
  const prisma = new PrismaClient();
  try {
    const profiles = [
      { name: 'Administrador', slug: 'ADMIN', description: 'Acceso total' },
      { name: 'Agente', slug: 'AGENT', description: 'Operador del contact center' },
      { name: 'Solo lectura', slug: 'VIEWER', description: 'Solo consulta' },
    ];
    for (const p of profiles) {
      await prisma.profile.upsert({
        where: { slug: p.slug },
        update: { name: p.name },
        create: p,
      });
    }
    const adminProfile = await prisma.profile.findUnique({ where: { slug: 'ADMIN' } });
    if (!adminProfile) throw new Error('Perfil ADMIN no encontrado después del seed');

    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (!existing) {
      const hash = await argon2.hash('Admin123!');
      await prisma.user.create({
        data: { username: 'admin', passwordHash: hash, profileId: adminProfile.id, active: true },
      });
      console.log('Usuario admin creado: admin / Admin123!');
    } else {
      console.log('Usuario admin ya existe, saltando creación.');
    }
    console.log('Seed completado.');
  } catch (e: any) {
    console.error('Error en seed (no crítico):', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function bootstrap() {
  // Ejecutar migraciones ANTES de iniciar la app
  await runMigrations();

  // Crear perfiles y usuario admin si no existen
  await runSeed();

  console.log('\nIniciando aplicación NestJS...');
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: frontend suele estar en Vercel. Permitir orígenes explícitos (CORS_ORIGIN) o *.vercel.app
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: allowedOrigins.length
      ? (origin, callback) => {
          if (!origin) return callback(null, true);
          const allowed = allowedOrigins.some(
            (o) => origin === o || origin.endsWith('.vercel.app')
          );
          callback(null, allowed);
        }
      : true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Contact Center API')
    .setDescription('API para Centro de Gestión - Contact Center Bancario')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.APP_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
  console.log(`Swagger docs available at: http://0.0.0.0:${port}/api/docs`);
  console.log(`[Deploy] Version: 1.0.1 - WhatsApp OUTBOUND support enabled`);
}

bootstrap();
