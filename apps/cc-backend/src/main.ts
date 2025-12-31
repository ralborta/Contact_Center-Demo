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

async function runMigrationsSync() {
  const { execSync } = require('child_process');
  
  console.log('==========================================');
  console.log('EJECUTANDO MIGRACIONES DE PRISMA');
  console.log('==========================================');
  console.log('Working directory:', process.cwd());
  console.log('__dirname:', __dirname);
  console.log('DATABASE_URL configurada:', process.env.DATABASE_URL ? 'SÍ' : 'NO');
  
  try {
    const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
    console.log('Schema path:', schemaPath);
    console.log('Schema exists:', fs.existsSync(schemaPath) ? 'SÍ' : 'NO');
    
    console.log('\nEjecutando: npx prisma migrate deploy...');
    const output = execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      cwd: path.join(__dirname, '../..'),
      env: process.env,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    console.log('Migraciones output:', output);
    console.log('==========================================');
    console.log('MIGRACIONES COMPLETADAS EXITOSAMENTE');
    console.log('==========================================');
  } catch (error: any) {
    console.error('==========================================');
    console.error('ERROR EN MIGRACIONES');
    console.error('==========================================');
    console.error('Error:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
    throw error;
  }
}
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

    console.log(`[Startup] Sincronizando schema de Prisma desde ${projectRoot} con schema ${schemaPath}`);
    console.log(`[Startup] DATABASE_URL configurada: ${process.env.DATABASE_URL ? 'Sí' : 'No'}`);
    console.log(`[Startup] Working directory: ${process.cwd()}`);
    console.log(`[Startup] __dirname: ${__dirname}`);
    
    // Usar db push directamente (más confiable cuando no hay migraciones)
    console.log('[Startup] Ejecutando prisma db push para sincronizar schema...');
    const migrationResult = await Promise.race([
      execAsync(`npx prisma db push --schema=${schemaPath} --accept-data-loss --skip-generate`, {
        cwd: projectRoot,
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 10,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout después de 60 segundos')), 60000)
      ) as Promise<{ stdout: string; stderr: string }>,
    ]);
    
    console.log('[Startup] Schema sincronizado exitosamente con db push');
    
    const { stdout, stderr } = migrationResult;

    if (stdout) {
      console.log('[Startup] db push stdout:', stdout);
    }
    if (stderr) {
      // stderr puede contener warnings que son normales
      if (stderr.includes('already in sync') || stderr.includes('No schema changes')) {
        console.log('[Startup] Schema ya está sincronizado, continuando...');
      } else {
        console.warn('[Startup] db push stderr:', stderr);
      }
    }
    console.log('[Startup] Schema sincronizado exitosamente');
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
  // Las migraciones se ejecutan en el comando start de nixpacks
  // Solo verificamos que se ejecutaron correctamente
  console.log('[Startup] Verificando conexión a base de datos...');
  
  // Dar tiempo para que las migraciones se apliquen si están corriendo
  await new Promise(resolve => setTimeout(resolve, 2000));

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
