import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const certsDir = resolve(process.cwd(), 'certs');
  const app = await NestFactory.create(AppModule, {
    httpsOptions: {
      key: readFileSync(resolve(certsDir, 'localhost-key.pem')),
      cert: readFileSync(resolve(certsDir, 'localhost.pem')),
    },
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: ['https://localhost:3000'], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on https://localhost:${port}`);
}

bootstrap();
