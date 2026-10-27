import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './common/config/configuration';
import { validate } from './common/config/env.validation';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessPolicyModule } from './modules/access-policy/access-policy.module';

@Module({
  imports: [
    // Global environment configuration with fail-closed validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate
    }),

    // Redis-backed distributed rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('throttle.ttl', 60) * 1000,
            limit: config.get<number>('throttle.limit', 100)
          }
        ],
        storage: new RedisThrottlerStorage()
      })
    }),

    // Core database & health modules
    PrismaModule,
    HealthModule,
    AuthModule,
    AccessPolicyModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
