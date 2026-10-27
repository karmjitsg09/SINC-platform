import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
  user_metadata?: Record<string, any>;
  [key: string]: any;
}

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly jwtSecret: string;
  private readonly supabaseUrl: string;
  private jwksCache: Map<string, string> = new Map();

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET') || '';
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException('Invalid Authorization format. Expected Bearer <token>');
    }

    const token = parts[1].trim();
    const user = await this.verifyToken(token);
    request.user = user;
    return true;
  }

  public async verifyToken(token: string): Promise<AuthenticatedUser> {
    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('Malformed JWT structure');
    }

    const [headerB64, payloadB64, signatureB64] = segments;

    let header: JwtHeader;
    let payload: JwtPayload;

    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Malformed JWT content');
    }

    if (!header.alg || header.alg.toLowerCase() === 'none') {
      throw new UnauthorizedException('Algorithm "none" is not permitted');
    }

    // Expiration check
    if (payload.exp && typeof payload.exp === 'number') {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        throw new UnauthorizedException('JWT token is expired');
      }
    }

    const signingInput = `${headerB64}.${payloadB64}`;

    if (header.alg === 'HS256') {
      if (!this.jwtSecret) {
        throw new InternalServerErrorException('SUPABASE_JWT_SECRET is not configured on the server');
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(signingInput)
        .digest('base64url');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(signatureB64, 'utf8');

      if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        throw new UnauthorizedException('Invalid JWT cryptographic signature');
      }
    } else if (header.alg === 'RS256' || header.alg === 'ES256') {
      // Asymmetric signature verification
      const verified = await this.verifyAsymmetric(header, signingInput, signatureB64);
      if (!verified) {
        throw new UnauthorizedException(`Invalid ${header.alg} signature`);
      }
    } else {
      throw new UnauthorizedException(`Unsupported signing algorithm: ${header.alg}`);
    }

    if (!payload.sub) {
      throw new UnauthorizedException('JWT missing subject (sub) claim');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'authenticated',
      user_metadata: payload.user_metadata || {},
    };
  }

  private async verifyAsymmetric(
    header: JwtHeader,
    signingInput: string,
    signatureB64: string,
  ): Promise<boolean> {
    try {
      const publicKey = await this.resolvePublicKey(header.kid);
      if (!publicKey) {
        return false;
      }

      const verifier = crypto.createVerify(header.alg === 'RS256' ? 'RSA-SHA256' : 'SHA256');
      verifier.update(signingInput);
      return verifier.verify(publicKey, Buffer.from(signatureB64, 'base64url'));
    } catch {
      return false;
    }
  }

  private async resolvePublicKey(kid?: string): Promise<string | null> {
    if (kid && this.jwksCache.has(kid)) {
      return this.jwksCache.get(kid)!;
    }

    // Attempt to fetch from Supabase JWKS if configured
    if (this.supabaseUrl) {
      try {
        const jwksUrl = `${this.supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
        const res = await fetch(jwksUrl);
        if (res.ok) {
          const data: any = await res.json();
          if (Array.isArray(data.keys)) {
            for (const key of data.keys) {
              if (key.kid && key.x5c && key.x5c[0]) {
                const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
                this.jwksCache.set(key.kid, cert);
              }
            }
            if (kid && this.jwksCache.has(kid)) {
              return this.jwksCache.get(kid)!;
            }
          }
        }
      } catch {
        // Fail closed if JWKS resolution fails
        return null;
      }
    }

    return null;
  }
}
