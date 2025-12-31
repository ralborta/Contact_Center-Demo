import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { execSync } from 'child_process';
import * as path from 'path';

async function runMigrations() {
  try {
    console.log('[Startup] Ejecutando migraciones de Prisma...');
    const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
    execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      stdio: 'inherit',
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
  // Ejecutar migraciones antes de iniciar la app
  await runMigrations();

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
