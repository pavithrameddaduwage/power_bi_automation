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
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, postman)
      if (!requestOrigin) return callback(null, true);

      // If '*' is configured or empty, allow all origins
      if (corsOrigins.includes('*') || corsOrigins.length === 0) {
        return callback(null, true);
      }

      const lowerOrigin = requestOrigin.toLowerCase();
      const isAllowed =
        corsOrigins.some((allowed) => lowerOrigin === allowed || allowed === '*') ||
        lowerOrigin.includes('localhost') ||
        lowerOrigin.includes('127.0.0.1') ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(lowerOrigin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(lowerOrigin) ||
        /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(lowerOrigin);

      return callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Pragma', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition', 'Content-Type'],
  });

  // Custom report uploads can be sizeable JSON payloads.
  app.use(json({ limit: '25mb' }));
  const port = config.get<number>('port') || parseInt(process.env.PORT || '4018', 10);
  await app.listen(port);
  console.log(`Backend server successfully listening on port ${port}`);
}
bootstrap();
