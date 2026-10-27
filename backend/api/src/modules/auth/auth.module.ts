import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseJwtGuard],
  exports: [SupabaseJwtGuard],
})
export class AuthModule {}
