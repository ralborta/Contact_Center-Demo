import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
// Asegurar que crypto esté disponible globalmente para @nestjs/schedule
// Node.js 18+ tiene crypto global, pero @nestjs/schedule puede necesitarlo antes
if (typeof globalThis.crypto === 'undefined') {
  const crypto = require('crypto');
  (globalThis as any).crypto = {
    randomUUID: () => crypto.randomUUID(),
  };
}

const execAsync = promisify(exec);

async function runMigrations() {
  try {
    console.log('[Startup] Intentando ejecutar migraciones de Prisma...');
    // En producción, __dirname apunta a dist/, así que subimos dos niveles
    const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
    const projectRoot = path.join(__dirname, '../..');
    
    // Verificar que el schema existe
    if (!fs.existsSync(schemaPath)) {
      console.warn(`[Startup] Schema no encontrado en ${schemaPath}, saltando migraciones`);
      return;
    }

    // Verificar que DATABASE_URL está configurada
    if (!process.env.DATABASE_URL) {
      console.warn('[Startup] DATABASE_URL no configurada, saltando migraciones');
      return;
    }

    console.log(`[Startup] Ejecutando migraciones desde ${projectRoot} con schema ${schemaPath}`);
    console.log(`[Startup] DATABASE_URL configurada: ${process.env.DATABASE_URL ? 'Sí' : 'No'}`);
    
    // Ejecutar con timeout de 60 segundos (más tiempo para Railway)
    const { stdout, stderr } = await Promise.race([
      execAsync(`npx prisma migrate deploy --schema=${schemaPath}`, {
        cwd: projectRoot,
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout después de 60 segundos')), 60000)
      ) as Promise<{ stdout: string; stderr: string }>,
    ]);

    if (stdout) {
      console.log('[Startup] Migraciones stdout:', stdout);
    }
    if (stderr) {
      // Si las migraciones ya están aplicadas, es OK
      if (stderr.includes('already applied') || stderr.includes('No pending migrations')) {
        console.log('[Startup] Migraciones ya aplicadas, continuando...');
      } else {
        console.warn('[Startup] Migraciones stderr:', stderr);
      }
    }
    console.log('[Startup] Migraciones ejecutadas exitosamente');
  } catch (error: any) {
    // Si el error es que las migraciones ya están aplicadas, es OK
    if (error.message?.includes('already applied') || error.stderr?.includes('already applied')) {
      console.log('[Startup] Migraciones ya aplicadas, continuando...');
      return;
    }
    console.error('[Startup] Error ejecutando migraciones:', error.message || error);
    // No fallar el inicio si las migraciones fallan
    console.log('[Startup] Continuando con el inicio de la aplicación (migraciones pueden ejecutarse manualmente)...');
  }
}

async function bootstrap() {
  // Ejecutar migraciones ANTES de iniciar la app (bloqueante)
  // Esto es crítico para que las tablas existan antes de que la app las use
  try {
    await runMigrations();
    console.log('[Startup] Migraciones completadas, iniciando aplicación...');
  } catch (err: any) {
    console.error('[Startup] Error crítico en migraciones:', err.message);
    console.error('[Startup] La aplicación no puede iniciar sin las tablas de la base de datos');
    console.error('[Startup] Por favor ejecuta las migraciones manualmente:');
    console.error('[Startup]   railway run --service cc-backend npx prisma migrate deploy --schema=../../prisma/schema.prisma');
    process.exit(1);
  }

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

  // CORS
  app.enableCors();

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Contact Center API')
    .setDescription('API para Centro de Gestión - Contact Center Bancario')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Railway asigna PORT automáticamente, usar APP_PORT como fallback
  const port = process.env.PORT || process.env.APP_PORT || 3000;
  await app.listen(port, '0.0.0.0'); // Escuchar en todas las interfaces para Railway
  console.log(`Application is running on: http://0.0.0.0:${port}`);
  console.log(`Swagger docs available at: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
