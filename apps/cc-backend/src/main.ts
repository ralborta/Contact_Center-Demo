import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

if (typeof globalThis.crypto === 'undefined') {
  const crypto = require('crypto');
  (globalThis as any).crypto = {
    randomUUID: () => crypto.randomUUID(),
  };
}

async function runMigrations() {
  console.log('Ejecutando migraciones Prisma...');
  const projectRoot = path.join(__dirname, '../../..');
  const schemaPath = path.join(projectRoot, 'prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema no encontrado en ${schemaPath}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurada');
  }
  execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
    cwd: projectRoot,
    env: { ...process.env },
    stdio: 'inherit',
    timeout: 120000,
  });
  console.log('Migraciones OK');
}

async function maybeSeed() {
  const flag = (process.env.RUN_SEED || '').toLowerCase();
  if (flag !== 'true' && flag !== '1' && flag !== 'always') {
    console.log('Seed omitido (RUN_SEED no activo)');
    return;
  }
  console.log('Ejecutando seed hospitalario (RUN_SEED)...');
  try {
    const seedPath = path.join(__dirname, 'seed.js');
    const seedTs = path.join(__dirname, 'seed.ts');
    if (fs.existsSync(seedPath)) {
      require(seedPath);
    } else {
      execSync(
        `npx ts-node -r tsconfig-paths/register ${seedTs}`,
        {
          cwd: path.join(__dirname, '..'),
          env: { ...process.env },
          stdio: 'inherit',
          timeout: 300000,
        },
      );
    }
  } catch (e: any) {
    console.error('Error en seed (no bloqueante):', e.message);
  }
}

async function bootstrap() {
  await runMigrations();
  await maybeSeed();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
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
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: allowedOrigins.length
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (!origin) return callback(null, true);
          const allowed =
            allowedOrigins.includes(origin) ||
            origin.endsWith('.easypanel.host');
          callback(null, allowed);
        }
      : true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Centro de Citas Hospitalarias API')
    .setDescription('API para gestión de citas médicas y agente de voz')
    .setVersion('2.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Agent-Secret', in: 'header' }, 'agent-secret')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.APP_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API citas hospitalarias en http://0.0.0.0:${port}`);
  console.log(`Docs: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
