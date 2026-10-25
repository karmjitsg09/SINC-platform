/**
 * SINC Platform — Server-Side Authentication & Authorization Helper
 *
 * Provides cryptographic and session-level validation for Next.js API route handlers.
 * Enforces:
 * - Presence of Authorization: Bearer <token> header
 * - Token structural validity
 * - Token expiration
 * - Subject (userId) claim integrity
 * - Cryptographic signature check (when SUPABASE_JWT_SECRET is configured)
 */

import crypto from 'crypto';

export type ServerAuthResult =
  | {
      authenticated: true;
      userId: string;
      role: string;
      token: string;
    }
  | {
      authenticated: false;
      status: number;
      error: string;
    };

export function verifyServerAuth(req: Request): ServerAuthResult {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing Authorization header'
    };
  }

  const clean = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!clean) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Empty or invalid Bearer token'
    };
  }

  const parts = clean.split('.');
  if (parts.length !== 3) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Malformed JWT token structure'
    };
  }

  let payload: any;
  try {
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Failed to parse token payload'
    };
  }

  // 1. Expiration validation
  if (!payload.exp || typeof payload.exp !== 'number') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Token missing exp claim'
    };
  }

  if (payload.exp * 1000 < Date.now()) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Session token has expired'
    };
  }

  // 2. Subject (userId) validation
  if (!payload.sub || typeof payload.sub !== 'string') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing subject (sub) claim in token'
    };
  }

  // 3. Cryptographic signature check if secret configured
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', jwtSecret)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(parts[2], 'utf8');

      if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        return {
          authenticated: false,
          status: 401,
          error: 'Unauthorized: Invalid token signature'
        };
      }
    } catch {
      return {
        authenticated: false,
        status: 401,
        error: 'Unauthorized: Cryptographic signature verification failed'
      };
    }
  } else if (process.env.NODE_ENV === 'production') {
    return {
      authenticated: false,
      status: 500,
      error: 'Server configuration error: SUPABASE_JWT_SECRET required in production'
    };
  }

  return {
    authenticated: true,
    userId: String(payload.sub),
    role: payload.role || 'authenticated',
    token: clean
  };
}
