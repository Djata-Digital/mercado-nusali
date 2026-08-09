import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check completo da API' })
  @ApiResponse({ status: 200, description: 'API e serviços operacionais' })
  async checkHealth() {
    let dbStatus = 'down';
    let redisStatus = 'down';
    let storageStatus = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === 'ready') {
      redisStatus = 'up';
    }

    storageStatus = (await this.storageService.checkHealth()) ? 'up' : 'down';

    return {
      status:
        dbStatus === 'up' && redisStatus === 'up' && storageStatus === 'up'
          ? 'ok'
          : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        objectStorage: storageStatus,
      },
    };
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (K8s/Docker)' })
  checkLiveness() {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (K8s/Docker)' })
  async checkReadiness(@Res() res: Response) {
    let isDbReady = false;
    let isRedisReady = false;
    let isStorageReady = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      isDbReady = true;
    } catch {
      isDbReady = false;
    }

    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === 'ready') {
      isRedisReady = true;
    }

    isStorageReady = await this.storageService.checkHealth();

    const isAllReady = isDbReady && isRedisReady && isStorageReady;
    const statusCode = isAllReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      success: isAllReady,
      data: {
        status: isAllReady ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        services: {
          database: isDbReady ? 'up' : 'down',
          redis: isRedisReady ? 'up' : 'down',
          objectStorage: isStorageReady ? 'up' : 'down',
        },
      },
    });
  }
}
