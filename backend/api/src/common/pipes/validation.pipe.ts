import { ValidationPipe } from '@nestjs/common';

export const globalValidationPipe = new ValidationPipe({
  whitelist: true,              // Strip properties not present in the DTO
  forbidNonWhitelisted: true,  // Reject payloads with unwhitelisted properties
  transform: true,              // Automatically transform payloads to DTO instances
  transformOptions: {
    enableImplicitConversion: true
  }
});
