import { Logger } from '@nestjs/common';

export function validateEnvironment() {
  const logger = new Logger('ConfigValidation');
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  const minioAccessKey = process.env.MINIO_ACCESS_KEY;
  const minioSecretKey = process.env.MINIO_SECRET_KEY;

  if (isProd) {
    if (!databaseUrl) {
      logger.error('CRITICAL: DATABASE_URL is missing in production!');
      throw new Error('DATABASE_URL environment variable is required in production.');
    }

    if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes('super-secret-jwt-key-change-in-production')) {
      logger.error('CRITICAL: JWT_SECRET is missing or weak in production!');
      throw new Error('A strong JWT_SECRET (at least 32 chars) is required in production.');
    }

    if (!minioAccessKey || !minioSecretKey || minioAccessKey === 'minioadmin') {
      logger.error('CRITICAL: MinIO credentials are missing or default in production!');
      throw new Error('Valid MinIO accessKey and secretKey are required in production.');
    }
  }
}

export default () => {
  validateEnvironment();

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mercado_nusali?schema=public',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min-32-chars',
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
      origin: (process.env.CORS_ORIGIN || '*').split(','),
    },
  };
};
