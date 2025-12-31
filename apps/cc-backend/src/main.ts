import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigrations() {
  try {
    console.log('[Startup] Ejecutando migraciones de Prisma...');
    const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
    
    // Verificar que el schema existe
    const fs = await import('fs');
    if (!fs.existsSync(schemaPath)) {
      console.warn(`[Startup] Schema no encontrado en ${schemaPath}, saltando migraciones`);
      return;
    }

    await execAsync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      cwd: __dirname,
    });
    console.log('[Startup] Migraciones ejecutadas exitosamente');
  } catch (error: any) {
    console.error('[Startup] Error ejecutando migraciones:', error.message);
    // No fallar el inicio si las migraciones fallan (puede ser que ya estén aplicadas)
    console.log('[Startup] Continuando con el inicio de la aplicación...');
  }
}

async function bootstrap() {
  // Ejecutar migraciones en background (no bloqueante)
  // Si fallan, la app continúa (las migraciones pueden ejecutarse manualmente)
  runMigrations().catch(err => {
    console.error('[Startup] Error en migraciones (no crítico, continuando):', err.message);
  });

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
