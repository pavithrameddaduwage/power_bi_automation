import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  // Allow the configured origin plus the common Angular dev ports (the
  // frontend's `npm start` uses 4301). Comma-separated values are supported.
  const configured = (config.get<string>('corsOrigin') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = Array.from(
    new Set([
      ...configured,
      'http://localhost:4200',
      'http://localhost:4301',
    ]),
  );
  app.enableCors({ origin });
  // Custom report uploads can be sizeable JSON payloads.
  app.use(json({ limit: '25mb' }));
  const port = config.get<number>('port')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
}
bootstrap();
