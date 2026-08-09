import { Logger } from '@nestjs/common';

export function validateEnvironment() {
  const logger = new Logger('ConfigValidation');
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  const corsOrigin = process.env.CORS_ORIGIN;
  const redisHost = process.env.REDIS_HOST;
  const minioEndpoint = process.env.MINIO_ENDPOINT;
  const minioAccessKey = process.env.MINIO_ACCESS_KEY;
  const minioSecretKey = process.env.MINIO_SECRET_KEY;
  const logisticsEncryptionKey = process.env.LOGISTICS_ENCRYPTION_KEY;

  if (!jwtSecret || jwtSecret.trim() === '') {
    logger.error('CRITICAL: JWT_SECRET environment variable is missing!');
    throw new Error('JWT_SECRET environment variable is strictly required in .env.');
  }

  if (jwtSecret.length < 32 || jwtSecret.includes('super-secret-jwt-key-change-in-production')) {
    if (isProd) {
      logger.error('CRITICAL: JWT_SECRET is weak in production!');
      throw new Error('A strong JWT_SECRET (at least 32 characters) is required in production.');
    } else {
      logger.warn('WARNING: JWT_SECRET should ideally be at least 32 characters long.');
    }
  }

  if (isProd) {
    if (!databaseUrl) {
      logger.error('CRITICAL: DATABASE_URL is missing in production!');
      throw new Error('DATABASE_URL environment variable is required in production.');
    }

    if (process.env.DEMO_MODE === 'true') {
      logger.error('CRITICAL: DEMO_MODE cannot be enabled in production!');
      throw new Error('DEMO_MODE=true is strictly prohibited in production environments.');
    }

    if (!corsOrigin || corsOrigin.split(',').map((v) => v.trim()).includes('*')) {
      logger.error('CRITICAL: CORS_ORIGIN precisa ser explícito em produção.');
      throw new Error('CORS_ORIGIN explícito e sem wildcard (*) é obrigatório em produção.');
    }

    if (!redisHost) {
      logger.error('CRITICAL: REDIS_HOST is missing in production!');
      throw new Error('REDIS_HOST é obrigatório em produção.');
    }

    if (!minioEndpoint || !minioAccessKey || !minioSecretKey) {
      logger.error('CRITICAL: Object storage configuration is incomplete in production!');
      throw new Error(
        'MINIO_ENDPOINT, MINIO_ACCESS_KEY e MINIO_SECRET_KEY são obrigatórios em produção.',
      );
    }

    if (minioAccessKey === 'minioadmin' || minioSecretKey === 'minioadmin') {
      logger.error('CRITICAL: Default MinIO credentials are forbidden in production!');
      throw new Error('Credenciais padrão minioadmin são proibidas em produção.');
    }

    if (!logisticsEncryptionKey) {
      logger.error('CRITICAL: LOGISTICS_ENCRYPTION_KEY is missing in production!');
      throw new Error('LOGISTICS_ENCRYPTION_KEY é obrigatória em produção.');
    }
  }
}

export default () => {
  validateEnvironment();

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const demoMode = !isProd && process.env.DEMO_MODE === 'true';

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv,
    demoMode,
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mercado_nusali?schema=public',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      publicBucket: process.env.MINIO_PUBLIC_BUCKET || 'nusali-public',
      privateBucket: process.env.MINIO_PRIVATE_BUCKET || 'nusali-private',
    },
    cors: {
      origin: (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
    swagger: {
      enabled:
        process.env.SWAGGER_ENABLED === 'true' ||
        (!isProd && process.env.SWAGGER_ENABLED !== 'false'),
    },
    trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS || '1', 10),
  };
};
