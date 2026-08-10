import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('cors.origin', ['*']);
  const swaggerEnabled = configService.get<boolean>('swagger.enabled', false);
  const trustProxyHops = configService.get<number>('trustProxyHops', 1);

  // Proxy Configuration
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', trustProxyHops);

  // Security & Optimization Middlewares
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // CORS Configuration
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Request-ID, X-Country-Code',
  });

  // Global Prefix
  app.setGlobalPrefix(apiPrefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Graceful Shutdown Hooks
  app.enableShutdownHooks();

  // Swagger Documentation Setup
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mercado Nusali API')
      .setDescription(
        'Documentação da API de Fundação do Backend do Mercado Nusali (NestJS 11 + Prisma + PostgreSQL + Redis)',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Mercado Nusali API executando na porta ${port} com prefixo /${apiPrefix}`);
  if (swaggerEnabled) {
    logger.log(`📚 Swagger habilitado em /docs`);
  }
}

bootstrap();
