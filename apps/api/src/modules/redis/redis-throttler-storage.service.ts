import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttler:${throttlerName}:${key}`;
    const blockKey = `throttler:block:${throttlerName}:${key}`;

    const client = this.redisService.getClient();

    if (!client) {
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const isBlocked = await client.exists(blockKey);
    if (isBlocked) {
      const timeToBlockExpire = await client.ttl(blockKey);
      return {
        totalHits: limit + 1,
        timeToExpire: ttl,
        isBlocked: true,
        timeToBlockExpire: timeToBlockExpire > 0 ? timeToBlockExpire * 1000 : 0,
      };
    }

    const totalHits = await client.incr(redisKey);
    if (totalHits === 1) {
      await client.pexpire(redisKey, ttl);
    }

    const timeToExpire = await client.pttl(redisKey);

    if (totalHits > limit) {
      await client.psetex(blockKey, blockDuration, 'blocked');
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: blockDuration,
      };
    }

    return {
      totalHits,
      timeToExpire: timeToExpire > 0 ? timeToExpire : ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
