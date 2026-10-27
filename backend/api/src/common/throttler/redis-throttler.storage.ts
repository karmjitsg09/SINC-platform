import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true
    });

    this.redis.on('error', (err) => {
      this.logger.warn(`Redis Throttler error: ${err.message}`);
    });
  }

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    try {
      const redisKey = `sinc:throttler:${key}`;
      const pipeline = this.redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.ttl(redisKey);
      const results = await pipeline.exec();

      if (!results || results.length < 2) {
        return { totalHits: 1, timeToExpire: Math.ceil(ttl / 1000) };
      }

      const totalHits = (results[0][1] as number) || 1;
      let timeToExpire = results[1][1] as number;

      // Set expiry on first hit
      if (timeToExpire === -1) {
        const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
        await this.redis.expire(redisKey, ttlSeconds);
        timeToExpire = ttlSeconds;
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, timeToExpire)
      };
    } catch (err: any) {
      this.logger.warn(`Redis throttler increment failed: ${err.message}. Failing open for availability.`);
      return { totalHits: 1, timeToExpire: Math.ceil(ttl / 1000) };
    }
  }
}
