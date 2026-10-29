import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { supuestosPendientes } from '@petrolero/shared';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);

  const logger = new Logger('Arranque');
  logger.log(`API escuchando en http://localhost:${puerto}/api`);

  // Recordatorio en cada arranque de lo que quedó asumido sin confirmación del cliente.
  const pendientes = supuestosPendientes();
  if (pendientes.length > 0) {
    logger.warn(
      `${pendientes.length} definiciones siguen pendientes del cliente: ${pendientes
        .map((s) => s.id)
        .join(', ')}`,
    );
    logger.warn('Detalle completo en PENDIENTES-CLIENTE.md (regenerar con: npm run pendientes)');
  }
}

void bootstrap();
