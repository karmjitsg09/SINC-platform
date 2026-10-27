import { ExecutionContext, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

describe('SupabaseJwtGuard', () => {
  let guard: SupabaseJwtGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const testSecret = 'super-secret-test-jwt-signing-key-1234567890';

  beforeEach(() => {
    reflector = new Reflector();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_JWT_SECRET') return testSecret;
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        return null;
      }),
    } as any;

    guard = new SupabaseJwtGuard(reflector, configService);
  });

  function createToken(header: object, payload: object, secret: string = testSecret): string {
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
    return `${h}.${p}.${sig}`;
  }

  function mockContext(authHeader?: string, isPublic = false): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    const request: any = {
      headers: authHeader !== undefined ? { authorization: authHeader } : {},
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  it('allows public routes to bypass authentication', async () => {
    const ctx = mockContext(undefined, true);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('fails closed (401) when Authorization header is missing', async () => {
    const ctx = mockContext(undefined, false);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Missing Authorization header');
  });

  it('fails closed (401) when Authorization header is not Bearer', async () => {
    const ctx = mockContext('Basic dXNlcjpwYXNz', false);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid Authorization format');
  });

  it('fails closed (401) on malformed token structure', async () => {
    const ctx = mockContext('Bearer not.a.valid.jwt.token', false);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('fails closed (401) when algorithm is "none"', async () => {
    const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"user-1"}').toString('base64url')}.`;
    const ctx = mockContext(`Bearer ${token}`, false);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Algorithm "none" is not permitted');
  });

  it('fails closed (401) when token is expired', async () => {
    const expiredPayload = {
      sub: 'user-123',
      exp: Math.floor(Date.now() / 1000) - 100, // 100s in past
    };
    const token = createToken({ alg: 'HS256', typ: 'JWT' }, expiredPayload);
    const ctx = mockContext(`Bearer ${token}`, false);
    await expect(guard.canActivate(ctx)).rejects.toThrow('JWT token is expired');
  });

  it('fails closed (401) on invalid HMAC signature', async () => {
    const payload = { sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = createToken({ alg: 'HS256', typ: 'JWT' }, payload, 'wrong-secret');
    const ctx = mockContext(`Bearer ${token}`, false);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid JWT cryptographic signature');
  });

  it('succeeds (200/true) with valid HS256 token and attaches user to request', async () => {
    const payload = {
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'operator@sinc.local',
      role: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      user_metadata: { name: 'Operator' },
    };
    const token = createToken({ alg: 'HS256', typ: 'JWT' }, payload);
    const ctx = mockContext(`Bearer ${token}`, false);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);

    const request = ctx.switchToHttp().getRequest();
    expect(request.user).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'operator@sinc.local',
      role: 'authenticated',
      user_metadata: { name: 'Operator' },
    });
  });

  it('fails closed (500) if SUPABASE_JWT_SECRET is missing on server', async () => {
    (configService.get as jest.Mock).mockReturnValue('');
    const noSecretGuard = new SupabaseJwtGuard(reflector, configService);

    const payload = { sub: 'user-123', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = createToken({ alg: 'HS256', typ: 'JWT' }, payload);
    const ctx = mockContext(`Bearer ${token}`, false);

    await expect(noSecretGuard.canActivate(ctx)).rejects.toThrow(InternalServerErrorException);
    await expect(noSecretGuard.canActivate(ctx)).rejects.toThrow('SUPABASE_JWT_SECRET is not configured');
  });

  it('fails closed (401) on unsupported algorithm', async () => {
    const h = Buffer.from(JSON.stringify({ alg: 'UNKNOWN_ALG' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const token = `${h}.${p}.dummySig`;
    const ctx = mockContext(`Bearer ${token}`, false);

    await expect(guard.canActivate(ctx)).rejects.toThrow('Unsupported signing algorithm: UNKNOWN_ALG');
  });
});
