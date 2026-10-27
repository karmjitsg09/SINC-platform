import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logger/structured-logger.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { globalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, {
    logger
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3001);
  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('cors.origins', ['http://localhost:3000']);

  // 1. Helmet security headers
  app.use(helmet());

  // 2. CORS policy enforcement from environment
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  // 3. API Versioning prefix (/api/v1)
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health']
  });

  // 4. Global validation pipe & exception filter
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new AllExceptionsFilter());

  // 5. Graceful shutdown hooks
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`SINC NestJS API Server listening on port ${port} with prefix /${apiPrefix}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  process.stderr.write(`FATAL BOOTSTRAP FAILURE: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
