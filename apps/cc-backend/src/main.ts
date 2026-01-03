import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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

async function bootstrap() {
  // Ejecutar migraciones ANTES de iniciar la app
  await runMigrations();

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

  app.enableCors();

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
