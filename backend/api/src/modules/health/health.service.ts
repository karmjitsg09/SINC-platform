import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  errors?: Record<string, string>;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly redisClient: Redis;

  constructor(private readonly prisma: PrismaService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true
    });
  }

  async check(): Promise<HealthCheckResult> {
    const checks: { database: 'up' | 'down'; redis: 'up' | 'down' } = {
      database: 'down',
      redis: 'down'
    };
    const errors: Record<string, string> = {};

    // 1. Check PostgreSQL Database via Prisma
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.database = 'up';
    } catch (err: any) {
      checks.database = 'down';
      errors.database = err.message || 'Database ping failed';
      this.logger.error(`Database health check failed: ${err.message}`);
    }

    // 2. Check Redis
    try {
      if (this.redisClient.status !== 'ready') {
        await this.redisClient.connect();
      }
      const pong = await this.redisClient.ping();
      if (pong === 'PONG') {
        checks.redis = 'up';
      } else {
        checks.redis = 'down';
        errors.redis = `Unexpected ping response: ${pong}`;
      }
    } catch (err: any) {
      checks.redis = 'down';
      errors.redis = err.message || 'Redis ping failed';
      this.logger.warn(`Redis health check failed: ${err.message}`);
    }

    const isHealthy = checks.database === 'up' && checks.redis === 'up';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      ...(Object.keys(errors).length > 0 ? { errors } : {})
    };
  }
}
