import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { PrismaClient } from '../generated/prisma/client';

async function runStartupMigrations() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma = new (PrismaClient as any)();
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "UserStory" ADD COLUMN IF NOT EXISTS "environment" TEXT');
    console.log('Startup migrations applied.');
  } catch {
    console.warn('Startup migration skipped (column may already exist).');
  } finally {
    await prisma.$disconnect().catch(() => null);
  }
}

async function bootstrap() {
  await runStartupMigrations();
  const isProduction = process.env.NODE_ENV === 'production';

  const httpsOptions = isProduction
    ? undefined
    : (() => {
        const certsDir = resolve(process.cwd(), 'certs');
        return {
          key: readFileSync(resolve(certsDir, 'localhost-key.pem')),
          cert: readFileSync(resolve(certsDir, 'localhost.pem')),
        };
      })();

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    bodyParser: true,
  });

  // Limit JSON payload size to 1 MB
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  const allowedOrigin = process.env.CORS_ORIGIN ?? 'https://localhost:3000';
  app.enableCors({ origin: [allowedOrigin], credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  const scheme = isProduction ? 'http' : 'https';
  console.log(`API running on ${scheme}://localhost:${port}`);
}

bootstrap();
