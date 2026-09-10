import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsOriginEnv = config.get<string>('corsOrigin') || process.env.CORS_ORIGIN || '*';
  const corsOrigins = corsOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origin =
    corsOrigins.includes('*') || corsOrigins.length === 0
      ? true
      : corsOrigins.length === 1
      ? corsOrigins[0]
      : corsOrigins;

  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Pragma', 'Cache-Control'],
  });

  // Custom report uploads can be sizeable JSON payloads.
  app.use(json({ limit: '25mb' }));
  const port = config.get<number>('port') || parseInt(process.env.PORT || '4018', 10);
  await app.listen(port);
  console.log(`Backend server successfully listening on port ${port}`);
}
bootstrap();
