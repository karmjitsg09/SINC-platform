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
import { createRemoteJWKSet, jwtVerify } from 'jose';
type JWTVerifyGetKey = ReturnType<typeof createRemoteJWKSet>;

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

export interface VerifyServerAuthOptions {
  jwks?: any;
  jwtSecret?: string;
  supabaseUrl?: string;
  allowedAlgorithms?: string[];
}

/**
 * Supported Supabase JWT Signing Modes:
 * - Asymmetric: ES256 (Staging project standard ECDSA P-256 via public JWKS)
 * - Symmetric: HS256 (Supported when SUPABASE_JWT_SECRET is explicitly configured)
 */
export const SUPPORTED_JWT_SIGNING_ALGORITHMS = ['ES256', 'HS256'] as const;
export const CONFIRMED_JWT_SIGNING_ALGORITHM = 'ES256' as const;

let cachedJWKS: JWTVerifyGetKey | null = null;
let cachedJWKSUrl: string | null = null;

export function getRemoteJWKSet(jwksUrl: string): JWTVerifyGetKey {
  if (cachedJWKS && cachedJWKSUrl === jwksUrl) {
    return cachedJWKS;
  }
  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 30000,
    cacheMaxAge: 600000 // 10 minutes
  });
  cachedJWKSUrl = jwksUrl;
  return cachedJWKS;
}

export function resetRemoteJWKSetCache(): void {
  cachedJWKS = null;
  cachedJWKSUrl = null;
}

let hasLoggedJwtModeNotice = false;
export function assertJwtConfiguration(): void {
  if (hasLoggedJwtModeNotice) return;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!url && !secret) {
    console.warn('[ServerAuth] WARNING: Neither SUPABASE_URL (for JWKS) nor SUPABASE_JWT_SECRET is configured. Verification will fail closed.');
  } else {
    console.log(
      `[ServerAuth] JWT verification configured: ES256 (JWKS via ${url || 'unconfigured'})` +
      (secret ? ' + HS256 (Symmetric HMAC fallback)' : ' (asymmetric only; HS256 disabled)')
    );
  }
  hasLoggedJwtModeNotice = true;
}

export async function verifyServerAuth(req: Request, options?: VerifyServerAuthOptions): Promise<ServerAuthResult> {
  assertJwtConfiguration();

  const authHeader = req.headers.get('authorization');
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing Authorization header'
    };
  }

  if (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer ')) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Bearer token format required'
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
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Malformed JWT token structure'
    };
  }

  // 1. Decode and validate header
  let header: any;
  try {
    const headerStr = Buffer.from(parts[0], 'base64url').toString('utf8');
    header = JSON.parse(headerStr);
  } catch {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Failed to parse token header'
    };
  }

  if (!header || typeof header !== 'object') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Invalid token header structure'
    };
  }

  if (!header.alg || header.alg.toLowerCase() === 'none') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Algorithm "none" is not permitted'
    };
  }

  const alg = String(header.alg).toUpperCase();
  if (alg !== 'ES256' && alg !== 'HS256') {
    return {
      authenticated: false,
      status: 401,
      error: `Unauthorized: Unsupported signing algorithm "${header.alg}". Expected ES256 or HS256.`
    };
  }

  if (!parts[2]) {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing token signature'
    };
  }

  let payload: any;

  // 2. Cryptographic signature check
  if (alg === 'HS256') {
    const jwtSecret = options?.jwtSecret || process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
      return {
        authenticated: false,
        status: 500,
        error: 'Server configuration error: SUPABASE_JWT_SECRET required'
      };
    }

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

      const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
      payload = JSON.parse(jsonStr);
    } catch {
      return {
        authenticated: false,
        status: 401,
        error: 'Unauthorized: Cryptographic signature verification failed'
      };
    }
  } else if (alg === 'ES256') {
    const supabaseUrl =
      options?.supabaseUrl ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;

    let keySource: any = options?.jwks;
    if (!keySource) {
      if (!supabaseUrl || typeof supabaseUrl !== 'string' || supabaseUrl.trim() === '') {
        return {
          authenticated: false,
          status: 500,
          error: 'Server configuration error: SUPABASE_URL required for JWKS verification'
        };
      }
      const jwksUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
      keySource = getRemoteJWKSet(jwksUrl);
    }

    try {
      const verifyOpts: any = {
        algorithms: ['ES256']
      };
      if (!options?.jwks && supabaseUrl) {
        verifyOpts.issuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
      } else if (options?.supabaseUrl) {
        verifyOpts.issuer = `${options.supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
      }

      const verified = await jwtVerify(clean, keySource, verifyOpts);
      payload = verified.payload;
    } catch (err: any) {
      const errMsg = err?.message || 'Verification failed';
      if (errMsg.toLowerCase().includes('expired') || err.code === 'ERR_JWT_EXPIRED') {
        return {
          authenticated: false,
          status: 401,
          error: 'Unauthorized: Session token has expired'
        };
      }
      return {
        authenticated: false,
        status: 401,
        error: `Unauthorized: Invalid token signature (${errMsg})`
      };
    }
  }

  // 3. Validate payload claims
  if (!payload || typeof payload !== 'object') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Invalid token payload structure'
    };
  }

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

  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Missing subject (sub) claim in token'
    };
  }

  if (payload.aud && payload.aud !== 'authenticated') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Invalid token audience'
    };
  }

  if (payload.role && payload.role !== 'authenticated' && payload.role !== 'service_role') {
    return {
      authenticated: false,
      status: 401,
      error: 'Unauthorized: Invalid token role'
    };
  }

  return {
    authenticated: true,
    userId: String(payload.sub).trim(),
    role: payload.role || 'authenticated',
    token: clean
  };
}

export const ALLOWED_NOTIFICATION_TYPES = [
  'message',
  'follow_request',
  'follow_accepted',
  'like',
  'comment',
  'mention',
  'system',
  'test',
  'notification'
] as const;

export type AllowedNotificationType = (typeof ALLOWED_NOTIFICATION_TYPES)[number];

export interface AuthorizedPushPayload {
  callerId: string;
  recipientId: string;
  type: AllowedNotificationType;
  title: string;
  message: string;
  url: string;
  entityType?: string;
  entityId?: string;
  eventId?: string;
  idempotencyKey?: string;
}

export type PushAuthorizationResult =
  | {
      authorized: true;
      payload: AuthorizedPushPayload;
    }
  | {
      authorized: false;
      status: number;
      error: string;
      stale?: boolean;
      suppressed?: boolean;
      reason?: string;
    };

/**
 * Authorizes and sanitizes a Web Push notification dispatch request.
 * Enforces:
 * - Recipient presence and format
 * - Allowed notification types derived from SINC service contracts
 * - Role/Targeting restrictions (e.g. system/test notifications strictly scoped to self; messaging cannot target self)
 * - Anti-spoofing: Caller ID authoritatively set from authenticated identity
 * - Anti-targeting: Caller-supplied endpoints and subscription objects are strictly ignored
 * - Content sanitization: URL protocol constraints, length boundaries
 * - Event and Idempotency key extraction for replay protection
 */
export function authorizePushNotificationRequest(callerId: string, body: any): PushAuthorizationResult {
  if (!body || typeof body !== 'object') {
    return {
      authorized: false,
      status: 400,
      error: 'Request body must be an object'
    };
  }

  const { recipientId, type, title, message, url, entityType, entityId, eventId, idempotencyKey } = body;

  if (!recipientId || typeof recipientId !== 'string' || recipientId.trim() === '') {
    return {
      authorized: false,
      status: 400,
      error: 'Missing or invalid recipientId'
    };
  }
  const targetRecipientId = recipientId.trim();

  const notifType = (type || 'notification').toLowerCase().trim() as AllowedNotificationType;
  if (!ALLOWED_NOTIFICATION_TYPES.includes(notifType)) {
    return {
      authorized: false,
      status: 400,
      error: `Invalid or unauthorized notification type "${type}". Allowed types: ${ALLOWED_NOTIFICATION_TYPES.join(', ')}`
    };
  }

  // Role & Targeting Rules:
  // 1. "system" and "test" notifications can only be dispatched by users to their own devices
  if ((notifType === 'system' || notifType === 'test') && callerId !== targetRecipientId) {
    return {
      authorized: false,
      status: 403,
      error: 'Forbidden: Cannot dispatch system or test notifications to other users'
    };
  }

  // 2. Direct messaging and follow requests cannot be dispatched to oneself
  if ((notifType === 'message' || notifType === 'follow_request') && callerId === targetRecipientId) {
    return {
      authorized: false,
      status: 400,
      error: 'Bad Request: Cannot send message or follow request notifications to self'
    };
  }

  // Content sanitization:
  const cleanTitle = (typeof title === 'string' && title.trim())
    ? title.trim().slice(0, 100)
    : 'SINC Notification';

  const cleanMessage = (typeof message === 'string' && message.trim())
    ? message.trim().slice(0, 500)
    : 'You have a new update on SINC.';

  let cleanUrl = '/notifications';
  if (
    typeof url === 'string' &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.includes('javascript:') &&
    !url.includes('data:')
  ) {
    cleanUrl = url.trim().slice(0, 200);
  }

  return {
    authorized: true,
    payload: {
      callerId,
      recipientId: targetRecipientId,
      type: notifType,
      title: cleanTitle,
      message: cleanMessage,
      url: cleanUrl,
      entityType: typeof entityType === 'string' ? entityType.slice(0, 50) : undefined,
      entityId: typeof entityId === 'string' ? entityId.slice(0, 100) : undefined,
      eventId: typeof eventId === 'string' ? eventId.trim().slice(0, 100) : undefined,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey.trim().slice(0, 100) : undefined
    }
  };
}

export const PUSH_EVENT_FRESHNESS_WINDOW_SECONDS =
  Number(process.env.PUSH_EVENT_FRESHNESS_WINDOW_SECONDS) || 600; // default 10 minutes (600s)

export function isEventWithinFreshnessWindow(
  timestamp: number | string | Date | null | undefined,
  windowSeconds: number = PUSH_EVENT_FRESHNESS_WINDOW_SECONDS
): boolean {
  if (timestamp === undefined || timestamp === null) return true;
  const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(ms)) return true;
  const ageSeconds = (Date.now() - ms) / 1000;
  return ageSeconds <= windowSeconds;
}

export interface PushEventDbResolver {
  // Freshness Window & Event Timestamps
  getEventTimestamp?(params: {
    type: AllowedNotificationType;
    callerId: string;
    recipientId: string;
    entityId?: string;
    eventId?: string;
    entityType?: string;
  }): Promise<number | string | Date | null | undefined> | number | string | Date | null | undefined;

  // Social Blocks Interlock (No push if either user has blocked the other)
  isBlocked?(callerId: string, recipientId: string): Promise<boolean> | boolean;

  // Content Visibility & Private Profile Rules (owner or accepted follower)
  isPrivateProfile?(userId: string): Promise<boolean> | boolean;
  canViewContent?(viewerId: string, authorId: string, entityId?: string): Promise<boolean> | boolean;

  // 1. Message: Verifies that an actual message record exists, was created by callerId, belongs to conversationId, and recipient is in conversation.
  hasMessageEvent?(params: {
    messageId?: string;
    conversationId?: string;
    callerId: string;
    recipientId: string;
  }): Promise<boolean | { verified: boolean; createdAt?: number | string | Date }> | boolean | { verified: boolean; createdAt?: number | string | Date };
  hasConversationMembership?(conversationId: string, callerId: string, recipientId: string): Promise<boolean> | boolean;

  // 2. Follow Request: Verifies actual pending follow request, requester (callerId), target (recipientId), and requestId.
  hasPendingFollowRequest?(
    paramsOrCallerId: { requestId?: string; callerId: string; recipientId: string } | string,
    recipientId?: string
  ): Promise<boolean | { verified: boolean; createdAt?: number | string | Date }> | boolean | { verified: boolean; createdAt?: number | string | Date };

  // 3. Follow Accepted: Verifies actual acceptance event or state transition (callerId accepted recipientId's request).
  hasFollowAcceptedEvent?(
    paramsOrCallerId: { requestId?: string; callerId: string; recipientId: string } | string,
    recipientId?: string
  ): Promise<boolean | { verified: boolean; updatedAt?: number | string | Date; acceptedAt?: number | string | Date }> | boolean | { verified: boolean; updatedAt?: number | string | Date; acceptedAt?: number | string | Date };
  hasAcceptedFollowRelationship?(followerId: string, followingId: string): Promise<boolean> | boolean;

  // 4. Like: Verifies specific like event, liker (callerId), target content author (recipientId), contentId (entityId), freshness.
  hasLikeEvent?(
    paramsOrCallerId: { likeId?: string; callerId: string; recipientId: string; entityId: string } | string,
    recipientId?: string,
    entityId?: string
  ): Promise<boolean | { verified: boolean; createdAt?: number | string | Date }> | boolean | { verified: boolean; createdAt?: number | string | Date };

  // 5. Comment: Verifies specific persisted comment, author (callerId), target post author (recipientId), and commentId.
  hasCommentEvent?(
    paramsOrCallerId: { commentId?: string; callerId: string; recipientId: string; entityId: string } | string,
    recipientId?: string,
    entityId?: string
  ): Promise<boolean | { verified: boolean; createdAt?: number | string | Date }> | boolean | { verified: boolean; createdAt?: number | string | Date };

  // 6. Mention: Verifies persisted content mentions recipient and was authored by callerId.
  hasMentionEvent?(
    paramsOrCallerId: { contentId?: string; callerId: string; recipientId: string; entityId: string } | string,
    recipientId?: string,
    entityId?: string
  ): Promise<boolean | { verified: boolean; createdAt?: number | string | Date }> | boolean | { verified: boolean; createdAt?: number | string | Date };

  // 7. Notification: Verifies specific notification record, actor (callerId), recipient (recipientId).
  hasNotificationRecord?(
    paramsOrNotifId: { notificationId?: string; actorId: string; recipientId: string } | string,
    actorId?: string,
    recipientId?: string
  ): Promise<boolean | { verified: boolean; createdAt?: number | string | Date }> | boolean | { verified: boolean; createdAt?: number | string | Date };
}

export type AuthoritativeEventVerificationResult =
  | { verified: true }
  | {
      verified: false;
      status: number;
      error: string;
      stale?: boolean;
      suppressed?: boolean;
      reason?: string;
    };

/**
 * Server-only Supabase Admin Client Factory.
 * Strict rules:
 * - Uses ONLY server-only environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY.
 * - NEVER reads or falls back to NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * - NEVER exposes the secret key in return values, errors, or logs.
 * - Returns null if required server configuration is missing.
 */
let cachedServerAdminClient: any = null;

export function getServerSupabaseAdminClient(): any | null {
  if (cachedServerAdminClient) return cachedServerAdminClient;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey || typeof url !== 'string' || typeof secretKey !== 'string' || url.trim() === '' || secretKey.trim() === '') {
    return null;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    cachedServerAdminClient = createClient(url.trim(), secretKey.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return cachedServerAdminClient;
  } catch (err: any) {
    console.error('[ServerAuth] Failed to initialize server Supabase admin client:', err?.message || 'Unknown error');
    return null;
  }
}

/**
 * Server-side Push Event Database Resolver.
 * Executes authoritative database lookups using the server-only Supabase admin client.
 * Fails closed if the client is missing or if any database query errors.
 */
export function createServerPushEventDbResolver(customClient?: any): PushEventDbResolver {
  const client = customClient || getServerSupabaseAdminClient();

  return {
    isBlocked: async (callerId: string, recipientId: string): Promise<boolean> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const { data, error } = await client
        .from('blocked_users')
        .select('blocker_user_id, blocked_user_id')
        .or(
          `and(blocker_user_id.eq.${callerId},blocked_user_id.eq.${recipientId}),and(blocker_user_id.eq.${recipientId},blocked_user_id.eq.${callerId})`
        );
      if (error) {
        console.error('[ServerAuth] Social block lookup database error:', error.message);
        throw new Error(`Database error during block check: ${error.message}`);
      }
      return Boolean(data && data.length > 0);
    },

    isPrivateProfile: async (userId: string): Promise<boolean> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const { data, error } = await client
        .from('profiles')
        .select('is_private')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('[ServerAuth] Profile lookup database error:', error.message);
        throw new Error(`Database error during profile privacy check: ${error.message}`);
      }
      return Boolean(data?.is_private);
    },

    canViewContent: async (viewerId: string, authorId: string, _entityId?: string): Promise<boolean> => {
      if (viewerId === authorId) return true;
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const { data: profile, error: profErr } = await client
        .from('profiles')
        .select('is_private')
        .eq('id', authorId)
        .maybeSingle();
      if (profErr) {
        console.error('[ServerAuth] Profile lookup database error:', profErr.message);
        throw new Error(`Database error during profile privacy check: ${profErr.message}`);
      }
      if (!profile?.is_private) return true;

      const { data: rel, error: relErr } = await client
        .from('follow_requests')
        .select('id')
        .eq('follower_user_id', viewerId)
        .eq('following_user_id', authorId)
        .eq('status', 'accepted')
        .maybeSingle();
      if (relErr) {
        console.error('[ServerAuth] Follow relationship lookup database error:', relErr.message);
        throw new Error(`Database error during relationship check: ${relErr.message}`);
      }
      return Boolean(rel);
    },

    hasAcceptedFollowRelationship: async (followerId: string, followingId: string): Promise<boolean> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const { data, error } = await client
        .from('follow_requests')
        .select('id')
        .eq('follower_user_id', followerId)
        .eq('following_user_id', followingId)
        .eq('status', 'accepted')
        .maybeSingle();
      if (error) {
        console.error('[ServerAuth] Follow relationship lookup database error:', error.message);
        throw new Error(`Database error during relationship check: ${error.message}`);
      }
      return Boolean(data);
    },

    hasMessageEvent: async ({ messageId, conversationId, callerId, recipientId }): Promise<{ verified: boolean; createdAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      if (conversationId) {
        const { data: members, error: memErr } = await client
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', conversationId);
        if (memErr) {
          console.error('[ServerAuth] Conversation member lookup error:', memErr.message);
          throw new Error(`Database error checking conversation members: ${memErr.message}`);
        }
        const memberIds = (members || []).map((m: any) => m.user_id);
        if (!memberIds.includes(callerId) || !memberIds.includes(recipientId)) {
          return { verified: false };
        }
      }
      let query = client
        .from('messages')
        .select('id, created_at, sender_id, conversation_id');
      if (messageId) query = query.eq('id', messageId);
      if (conversationId) query = query.eq('conversation_id', conversationId);
      query = query.eq('sender_id', callerId);
      const { data: msg, error: msgErr } = await query.maybeSingle();
      if (msgErr) {
        console.error('[ServerAuth] Message lookup error:', msgErr.message);
        throw new Error(`Database error verifying message: ${msgErr.message}`);
      }
      if (!msg) return { verified: false };
      return { verified: true, createdAt: msg.created_at };
    },

    hasPendingFollowRequest: async (paramsOrCallerId, recipientId): Promise<{ verified: boolean; createdAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const caller = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
      const target = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
      const reqId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.requestId : undefined;

      let query = client
        .from('follow_requests')
        .select('id, created_at')
        .eq('follower_user_id', caller)
        .eq('following_user_id', target)
        .eq('status', 'pending');
      if (reqId) query = query.eq('id', reqId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error('[ServerAuth] Follow request lookup error:', error.message);
        throw new Error(`Database error checking follow request: ${error.message}`);
      }
      if (!data) return { verified: false };
      return { verified: true, createdAt: data.created_at };
    },

    hasFollowAcceptedEvent: async (paramsOrCallerId, recipientId): Promise<{ verified: boolean; updatedAt?: string; acceptedAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const caller = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
      const target = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.recipientId : recipientId;
      const reqId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.requestId : undefined;

      let query = client
        .from('follow_requests')
        .select('id, updated_at, accepted_at')
        .eq('following_user_id', caller)
        .eq('follower_user_id', target)
        .eq('status', 'accepted');
      if (reqId) query = query.eq('id', reqId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error('[ServerAuth] Follow acceptance lookup error:', error.message);
        throw new Error(`Database error checking follow acceptance: ${error.message}`);
      }
      if (!data) return { verified: false };
      return {
        verified: true,
        updatedAt: data.updated_at,
        acceptedAt: data.accepted_at || data.updated_at
      };
    },

    hasLikeEvent: async (paramsOrCallerId, recipientId, entityId): Promise<{ verified: boolean; createdAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const caller = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
      const ent = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.entityId : entityId;
      const likeId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.likeId : undefined;

      let query = client
        .from('post_likes')
        .select('id, created_at')
        .eq('user_id', caller)
        .eq('post_id', ent);
      if (likeId) query = query.eq('id', likeId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error('[ServerAuth] Like lookup error:', error.message);
        throw new Error(`Database error checking like: ${error.message}`);
      }
      if (!data) return { verified: false };
      return { verified: true, createdAt: data.created_at };
    },

    hasCommentEvent: async (paramsOrCallerId, recipientId, entityId): Promise<{ verified: boolean; createdAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const caller = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
      const ent = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.entityId : entityId;
      const commentId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.commentId : undefined;

      let query = client
        .from('post_comments')
        .select('id, created_at')
        .eq('user_id', caller);
      if (commentId) query = query.eq('id', commentId);
      if (ent) query = query.eq('post_id', ent);
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error('[ServerAuth] Comment lookup error:', error.message);
        throw new Error(`Database error checking comment: ${error.message}`);
      }
      if (!data) return { verified: false };
      return { verified: true, createdAt: data.created_at };
    },

    hasMentionEvent: async (paramsOrCallerId, recipientId, entityId): Promise<{ verified: boolean; createdAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const caller = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.callerId : paramsOrCallerId;
      const ent = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.entityId : entityId;
      const contentId = typeof paramsOrCallerId === 'object' ? paramsOrCallerId.contentId : undefined;
      const targetId = contentId || ent;

      const { data, error } = await client
        .from('posts')
        .select('id, created_at, content, author_id')
        .eq('id', targetId)
        .eq('author_id', caller)
        .maybeSingle();
      if (error) {
        console.error('[ServerAuth] Mention lookup error:', error.message);
        throw new Error(`Database error checking mention: ${error.message}`);
      }
      if (!data) return { verified: false };
      return { verified: true, createdAt: data.created_at };
    },

    hasNotificationRecord: async (paramsOrNotifId, actorId, recipientId): Promise<{ verified: boolean; createdAt?: string }> => {
      if (!client) {
        throw new Error('Server configuration error: SUPABASE_SECRET_KEY required to perform security checks');
      }
      const notifId = typeof paramsOrNotifId === 'object' ? paramsOrNotifId.notificationId : paramsOrNotifId;
      const actId = typeof paramsOrNotifId === 'object' ? paramsOrNotifId.actorId : actorId;
      const recId = typeof paramsOrNotifId === 'object' ? paramsOrNotifId.recipientId : recipientId;

      const { data, error } = await client
        .from('notifications')
        .select('id, created_at')
        .eq('id', notifId)
        .eq('actor_id', actId)
        .eq('recipient_id', recId)
        .maybeSingle();
      if (error) {
        console.error('[ServerAuth] Notification lookup error:', error.message);
        throw new Error(`Database error checking notification record: ${error.message}`);
      }
      if (!data) return { verified: false };
      return { verified: true, createdAt: data.created_at };
    }
  };
}

/**
 * Verifies that the underlying authoritative event exists in the database
 * and belongs to the authenticated sender before dispatching a push notification.
 * Enforces:
 * - Block interlock: No push if either user has blocked the other (fails closed on lookup error)
 * - Content visibility: Recipient must be authorized to view private content (owner or accepted follower)
 * - Event freshness: Reject push if event is older than freshness window (default 10m)
 * - Specific database event existence & authorship
 */
export async function verifyAuthoritativePushEvent(
  payload: AuthorizedPushPayload,
  resolver?: PushEventDbResolver | null
): Promise<AuthoritativeEventVerificationResult> {
  const { callerId, recipientId, type, entityId } = payload;

  // 1. Self-targeted notifications (system and test) require no external event
  if (type === 'system' || type === 'test') {
    if (callerId !== recipientId) {
      return {
        verified: false,
        status: 403,
        error: 'Forbidden: Cannot dispatch system or test notifications to other users'
      };
    }
    return { verified: true };
  }

  // Resolve effective database resolver
  let effectiveResolver: PushEventDbResolver;
  if (resolver !== undefined && resolver !== null) {
    effectiveResolver = resolver;
  } else {
    // If no custom resolver is injected, check if server client can be created
    const serverClient = getServerSupabaseAdminClient();
    if (!serverClient) {
      console.error('[ServerAuth] Security check failed closed: SUPABASE_SECRET_KEY is missing or unconfigured.');
      return {
        verified: false,
        status: 500,
        error: 'Server configuration error: SUPABASE_SECRET_KEY required for server-side authorization lookups'
      };
    }
    effectiveResolver = createServerPushEventDbResolver(serverClient);
  }

  // 2. Social Blocks Interlock: No push if either user has blocked the other
  // A block check that cannot run must NOT be treated as "not blocked"
  if (effectiveResolver.isBlocked) {
    try {
      const isBlocked = await effectiveResolver.isBlocked(callerId, recipientId);
      if (isBlocked) {
        return {
          verified: false,
          status: 200,
          suppressed: true,
          error: 'Push suppressed: Users have an active blocked relationship',
          reason: 'blocked_relationship'
        };
      }
    } catch (err: any) {
      console.error('[ServerAuth] Social block lookup encountered an error; failing closed.');
      return {
        verified: false,
        status: 500,
        error: 'Authorization error: Failed to verify relationship security status'
      };
    }
  } else {
    // A block check that cannot run must not be treated as "not blocked"
    console.error('[ServerAuth] Block check capability missing on resolver; failing closed.');
    return {
      verified: false,
      status: 500,
      error: 'Security requirement: Block check capability required for social push dispatch'
    };
  }

  // 3. Content Visibility Check for mention, comment, like:
  // Confirm recipient is allowed to view the content under existing private-profile rules (owner or accepted follower).
  if (type === 'mention' || type === 'comment' || type === 'like') {
    const authorToCheck = (type === 'mention') ? callerId : recipientId;

    try {
      if (effectiveResolver.canViewContent) {
        const canView = await effectiveResolver.canViewContent(recipientId, authorToCheck, entityId);
        if (!canView) {
          return {
            verified: false,
            status: 200,
            suppressed: true,
            error: 'Push suppressed: Recipient is not authorized to view private content',
            reason: 'content_visibility_restricted'
          };
        }
      } else if (effectiveResolver.isPrivateProfile) {
        const isPrivate = await effectiveResolver.isPrivateProfile(authorToCheck);
        if (isPrivate && recipientId !== authorToCheck) {
          const isFollower = effectiveResolver.hasAcceptedFollowRelationship
            ? await effectiveResolver.hasAcceptedFollowRelationship(recipientId, authorToCheck)
            : false;
          if (!isFollower) {
            return {
              verified: false,
              status: 200,
              suppressed: true,
              error: 'Push suppressed: Recipient is not authorized to view private content',
              reason: 'content_visibility_restricted'
            };
          }
        }
      }
    } catch (err: any) {
      console.error('[ServerAuth] Content visibility lookup error; failing closed.');
      return {
        verified: false,
        status: 500,
        error: 'Authorization error: Failed to verify content visibility'
      };
    }
  }

  // Helper to extract timestamp and verify event freshness
  const verifyFreshness = async (customTs?: any): Promise<AuthoritativeEventVerificationResult | null> => {
    let ts = customTs;
    if (ts === undefined && effectiveResolver.getEventTimestamp) {
      try {
        ts = await effectiveResolver.getEventTimestamp({
          type,
          callerId,
          recipientId,
          entityId,
          eventId: payload.eventId,
          entityType: payload.entityType
        });
      } catch (err: any) {
        console.error('[ServerAuth] Event timestamp lookup error; failing closed.');
        return {
          verified: false,
          status: 500,
          error: 'Authorization error: Failed to verify event timestamp'
        };
      }
    }
    if (ts !== undefined && ts !== null) {
      if (!isEventWithinFreshnessWindow(ts)) {
        return {
          verified: false,
          stale: true,
          suppressed: true,
          status: 200,
          error: `Push suppressed: Authoritative event is older than freshness window (${PUSH_EVENT_FRESHNESS_WINDOW_SECONDS}s)`,
          reason: 'stale_event'
        };
      }
    }
    return null;
  };

  try {
    // 4. Direct messaging: requires entityId or eventId representing conversation/message
    if (type === 'message') {
      if (!entityId || entityId.trim() === '') {
        return {
          verified: false,
          status: 400,
          error: 'Bad Request: Missing conversation entityId for message notification'
        };
      }

      const conversationId = payload.entityType === 'conversation' ? entityId : (payload.eventId ? undefined : entityId);
      const messageId = payload.eventId || (payload.entityType === 'message' ? entityId : undefined);

      if (effectiveResolver.hasMessageEvent) {
        const msgRes = await effectiveResolver.hasMessageEvent({
          messageId,
          conversationId,
          callerId,
          recipientId
        });
        const isMsgValid = typeof msgRes === 'object' && msgRes !== null ? msgRes.verified : Boolean(msgRes);
        if (!isMsgValid) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: Authoritative message record not found, caller is not message author, or recipient is not in conversation'
          };
        }
        const customTs = (typeof msgRes === 'object' && msgRes !== null) ? msgRes.createdAt : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      } else if (effectiveResolver.hasConversationMembership) {
        const isMember = await effectiveResolver.hasConversationMembership(entityId, callerId, recipientId);
        if (!isMember) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: Caller and recipient do not share an authorized mutual conversation'
          };
        }
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }

    // 5. Follow request: requires active pending follow request from caller to recipient
    if (type === 'follow_request') {
      if (effectiveResolver.hasPendingFollowRequest) {
        const reqId = payload.eventId || payload.entityId;
        const frRes = await (effectiveResolver.hasPendingFollowRequest as any)(
          { requestId: reqId, callerId, recipientId },
          recipientId
        );
        const hasRequest = typeof frRes === 'object' && frRes !== null ? frRes.verified : Boolean(frRes);
        if (!hasRequest) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No pending follow request exists from caller to recipient'
          };
        }
        const customTs = (typeof frRes === 'object' && frRes !== null) ? frRes.createdAt : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }

    // 6. Follow accepted: requires accepted follow relationship where recipient follows caller (authoritative state transition)
    if (type === 'follow_accepted') {
      if (effectiveResolver.hasFollowAcceptedEvent) {
        const reqId = payload.eventId || payload.entityId;
        const faRes = await (effectiveResolver.hasFollowAcceptedEvent as any)(
          { requestId: reqId, callerId, recipientId },
          recipientId
        );
        const hasAccepted = typeof faRes === 'object' && faRes !== null ? faRes.verified : Boolean(faRes);
        if (!hasAccepted) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No authoritative follow acceptance event exists between users'
          };
        }
        // Follow accepted uses transition time: accepted_at with updated_at as fallback
        const customTs = (typeof faRes === 'object' && faRes !== null)
          ? (faRes.acceptedAt || faRes.updatedAt)
          : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      } else if (effectiveResolver.hasAcceptedFollowRelationship) {
        const isAccepted = await effectiveResolver.hasAcceptedFollowRelationship(recipientId, callerId);
        if (!isAccepted) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No accepted follow relationship exists between users'
          };
        }
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }

    // 7. Like: requires entityId (post/comment) and verified like action by caller on recipient content
    if (type === 'like') {
      if (!entityId || entityId.trim() === '') {
        return {
          verified: false,
          status: 400,
          error: 'Bad Request: Missing entityId for like notification'
        };
      }
      if (effectiveResolver.hasLikeEvent) {
        const likeRes = typeof effectiveResolver.hasLikeEvent === 'function' && effectiveResolver.hasLikeEvent.length === 1
          ? await (effectiveResolver.hasLikeEvent as any)({ likeId: payload.eventId, callerId, recipientId, entityId })
          : await (effectiveResolver.hasLikeEvent as any)(callerId, recipientId, entityId);
        const hasLike = typeof likeRes === 'object' && likeRes !== null ? likeRes.verified : Boolean(likeRes);
        if (!hasLike) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No verified like event exists for caller on recipient content'
          };
        }
        const customTs = (typeof likeRes === 'object' && likeRes !== null) ? likeRes.createdAt : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }

    // 8. Comment: requires entityId and verified comment action by caller on recipient post
    if (type === 'comment') {
      if (!entityId || entityId.trim() === '') {
        return {
          verified: false,
          status: 400,
          error: 'Bad Request: Missing entityId for comment notification'
        };
      }
      if (effectiveResolver.hasCommentEvent) {
        const comRes = typeof effectiveResolver.hasCommentEvent === 'function' && effectiveResolver.hasCommentEvent.length === 1
          ? await (effectiveResolver.hasCommentEvent as any)({ commentId: payload.eventId || entityId, callerId, recipientId, entityId })
          : await (effectiveResolver.hasCommentEvent as any)(callerId, recipientId, entityId);
        const hasComment = typeof comRes === 'object' && comRes !== null ? comRes.verified : Boolean(comRes);
        if (!hasComment) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No verified comment event exists for caller on recipient content'
          };
        }
        const customTs = (typeof comRes === 'object' && comRes !== null) ? comRes.createdAt : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }

    // 9. Mention: requires entityId and verified mention action where caller mentions recipient
    if (type === 'mention') {
      if (!entityId || entityId.trim() === '') {
        return {
          verified: false,
          status: 400,
          error: 'Bad Request: Missing entityId for mention notification'
        };
      }
      if (effectiveResolver.hasMentionEvent) {
        const menRes = typeof effectiveResolver.hasMentionEvent === 'function' && effectiveResolver.hasMentionEvent.length === 1
          ? await (effectiveResolver.hasMentionEvent as any)({ contentId: payload.eventId || entityId, callerId, recipientId, entityId })
          : await (effectiveResolver.hasMentionEvent as any)(callerId, recipientId, entityId);
        const hasMention = typeof menRes === 'object' && menRes !== null ? menRes.verified : Boolean(menRes);
        if (!hasMention) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No verified mention event exists for caller on recipient'
          };
        }
        const customTs = (typeof menRes === 'object' && menRes !== null) ? menRes.createdAt : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }

    // 10. General notification: requires entityId and verified notification record
    if (type === 'notification') {
      if (!entityId || entityId.trim() === '') {
        return {
          verified: false,
          status: 400,
          error: 'Bad Request: Missing entityId for notification dispatch'
        };
      }
      if (effectiveResolver.hasNotificationRecord) {
        const notifRes = typeof effectiveResolver.hasNotificationRecord === 'function' && effectiveResolver.hasNotificationRecord.length === 1
          ? await (effectiveResolver.hasNotificationRecord as any)({ notificationId: entityId, actorId: callerId, recipientId })
          : await (effectiveResolver.hasNotificationRecord as any)(entityId, callerId, recipientId);
        const hasRecord = typeof notifRes === 'object' && notifRes !== null ? notifRes.verified : Boolean(notifRes);
        if (!hasRecord) {
          return {
            verified: false,
            status: 403,
            error: 'Forbidden: No matching authoritative notification record exists'
          };
        }
        const customTs = (typeof notifRes === 'object' && notifRes !== null) ? notifRes.createdAt : undefined;
        const staleCheck = await verifyFreshness(customTs);
        if (staleCheck) return staleCheck;
      }
      const staleCheck = await verifyFreshness();
      if (staleCheck) return staleCheck;
      return { verified: true };
    }
  } catch (lookupErr: any) {
    console.error('[ServerAuth] Database query error during authoritative event lookup; failing closed.');
    return {
      verified: false,
      status: 500,
      error: 'Authorization error: Failed to verify authoritative event record'
    };
  }

  return { verified: true };
}

/**
 * Full end-to-end authorization and event-verification pipeline.
 */
export async function authorizeAndVerifyPushNotification(
  callerId: string,
  body: any,
  resolver?: PushEventDbResolver | null
): Promise<PushAuthorizationResult> {
  const reqAuth = authorizePushNotificationRequest(callerId, body);
  if (!reqAuth.authorized) {
    return reqAuth;
  }

  const eventAuth = await verifyAuthoritativePushEvent(reqAuth.payload, resolver);
  if (!eventAuth.verified) {
    return {
      authorized: false,
      status: eventAuth.status,
      error: eventAuth.error,
      stale: eventAuth.stale,
      suppressed: eventAuth.suppressed,
      reason: eventAuth.reason
    };
  }

  return reqAuth;
}

// ==========================================
// PUSH EVENT REPLAY & IDEMPOTENCY PROTECTION
// ==========================================

export type IdempotencyLockResult =
  | { state: 'ACQUIRED' }
  | { state: 'IN_PROGRESS' }
  | { state: 'DISPATCHED'; cachedResult?: any };

export interface PushIdempotencyStore {
  acquireLock(key: string, ttlMs?: number): Promise<IdempotencyLockResult> | IdempotencyLockResult;
  markDispatched(key: string, result: any, retentionMs?: number): Promise<void> | void;
  markFailed(key: string, error: string): Promise<void> | void;
  getRecord?(key: string): Promise<any> | any;
  clear?(): void;
}

export class MemoryPushIdempotencyStore implements PushIdempotencyStore {
  private records = new Map<string, {
    state: 'IN_PROGRESS' | 'DISPATCHED' | 'FAILED';
    result?: any;
    error?: string;
    createdAt: number;
    expiresAt: number;
  }>();

  acquireLock(key: string, ttlMs: number = 30000): IdempotencyLockResult {
    const now = Date.now();
    const existing = this.records.get(key);

    if (existing) {
      if (existing.expiresAt > now) {
        if (existing.state === 'DISPATCHED') {
          return { state: 'DISPATCHED', cachedResult: existing.result };
        }
        if (existing.state === 'IN_PROGRESS') {
          return { state: 'IN_PROGRESS' };
        }
        // FAILED: lock released so retry can acquire and proceed
      } else {
        this.records.delete(key);
      }
    }

    this.records.set(key, {
      state: 'IN_PROGRESS',
      createdAt: now,
      expiresAt: now + ttlMs
    });
    return { state: 'ACQUIRED' };
  }

  markDispatched(key: string, result: any, retentionMs: number = 86400000): void {
    const now = Date.now();
    this.records.set(key, {
      state: 'DISPATCHED',
      result,
      createdAt: now,
      expiresAt: now + retentionMs
    });
  }

  markFailed(key: string, error: string): void {
    const now = Date.now();
    this.records.set(key, {
      state: 'FAILED',
      error,
      createdAt: now,
      expiresAt: now + 60000
    });
  }

  getRecord(key: string) {
    return this.records.get(key);
  }

  clear() {
    this.records.clear();
  }
}

export class PostgresPushIdempotencyStore implements PushIdempotencyStore {
  private customClient: any;

  constructor(customClient?: any) {
    this.customClient = customClient;
  }

  private getClient(): any {
    if (this.customClient) return this.customClient;
    return getServerSupabaseAdminClient();
  }

  async acquireLock(key: string, ttlMs: number = 30000): Promise<IdempotencyLockResult> {
    const client = this.getClient();
    if (!client) {
      console.error('[ServerAuth] Postgres idempotency store failed: SUPABASE_URL or SUPABASE_SECRET_KEY missing');
      throw new Error('Server configuration error: Unable to create database client for postgres idempotency store');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    try {
      // 1. Atomic INSERT ON CONFLICT DO NOTHING
      const { data: inserted, error: insertErr } = await client
        .from('push_idempotency_keys')
        .insert([{ key, status: 'IN_PROGRESS', expires_at: expiresAt }])
        .select('key')
        .maybeSingle();

      if (!insertErr && inserted) {
        return { state: 'ACQUIRED' };
      }

      // 2. Row exists; query current status & expiration
      const { data: existing, error: selectErr } = await client
        .from('push_idempotency_keys')
        .select('status, result, expires_at')
        .eq('key', key)
        .maybeSingle();

      if (selectErr) {
        console.error('[ServerAuth] Postgres idempotency select error:', selectErr.message);
        throw new Error(`Database error querying idempotency lock: ${selectErr.message}`);
      }

      if (existing) {
        const rowExpiresAt = new Date(existing.expires_at).getTime();
        if (rowExpiresAt > now.getTime()) {
          if (existing.status === 'DISPATCHED') {
            return { state: 'DISPATCHED', cachedResult: existing.result };
          }
          if (existing.status === 'IN_PROGRESS') {
            return { state: 'IN_PROGRESS' };
          }
        }

        // Lock expired or marked FAILED: update atomically to re-acquire
        const { data: updated, error: updateErr } = await client
          .from('push_idempotency_keys')
          .update({ status: 'IN_PROGRESS', expires_at: expiresAt })
          .eq('key', key)
          .select('key')
          .maybeSingle();

        if (updateErr) {
          console.error('[ServerAuth] Postgres idempotency update error:', updateErr.message);
          throw new Error(`Database error acquiring idempotency lock: ${updateErr.message}`);
        }

        if (updated) {
          return { state: 'ACQUIRED' };
        }
      }

      return { state: 'IN_PROGRESS' };
    } catch (err: any) {
      console.error('[ServerAuth] Postgres idempotency store failure; failing closed:', err?.message || 'Unknown database error');
      throw err;
    }
  }

  async markDispatched(key: string, result: any, retentionMs: number = 604800000): Promise<void> {
    // Retain dispatched event state for at least 7 days (604,800,000 ms)
    const effectiveRetention = Math.max(retentionMs, 604800000);
    const client = this.getClient();
    if (!client) {
      console.error('[ServerAuth] Postgres idempotency markDispatched failed: Client missing');
      throw new Error('Server configuration error: Unable to create database client for postgres idempotency store');
    }
    const expiresAt = new Date(Date.now() + effectiveRetention).toISOString();
    try {
      const { error } = await client
        .from('push_idempotency_keys')
        .update({ status: 'DISPATCHED', result, expires_at: expiresAt })
        .eq('key', key);
      if (error) {
        console.error('[ServerAuth] Postgres idempotency markDispatched error:', error.message);
        throw new Error(`Database error marking idempotency dispatched: ${error.message}`);
      }
    } catch (err: any) {
      console.error('[ServerAuth] Exception marking idempotency dispatched:', err?.message);
      throw err;
    }
  }

  async markFailed(key: string, error: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      console.error('[ServerAuth] Postgres idempotency markFailed failed: Client missing');
      return;
    }
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    try {
      await client
        .from('push_idempotency_keys')
        .update({ status: 'FAILED', expires_at: expiresAt })
        .eq('key', key);
    } catch (err: any) {
      console.error('[ServerAuth] Exception marking idempotency failed:', err?.message);
    }
  }

  async getRecord(key: string): Promise<any> {
    const client = this.getClient();
    if (!client) return null;
    try {
      const { data } = await client
        .from('push_idempotency_keys')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      return data;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.from('push_idempotency_keys').delete().neq('key', '');
    } catch {}
  }
}

export const defaultMemoryPushIdempotencyStore = new MemoryPushIdempotencyStore();
export const defaultPushIdempotencyStore = defaultMemoryPushIdempotencyStore; // backward compatible alias
export const defaultPostgresPushIdempotencyStore = new PostgresPushIdempotencyStore();

export function getActivePushIdempotencyStore(): PushIdempotencyStore {
  const storeType = (process.env.PUSH_IDEMPOTENCY_STORE || 'memory').toLowerCase().trim();
  if (storeType === 'postgres' || storeType === 'database') {
    return defaultPostgresPushIdempotencyStore;
  }
  return defaultMemoryPushIdempotencyStore;
}

/**
 * Computes a stable event idempotency key for Web Push deduplication and replay protection.
 * The authoritative event identity strictly controls deduplication.
 * Client-supplied `idempotencyKey` is NEVER permitted to override or bypass a verified event identity.
 */
export function computePushEventIdempotencyKey(payload: AuthorizedPushPayload): string {
  const { type, callerId, recipientId, eventId, entityId, idempotencyKey } = payload;

  // 1. Authoritative Event Key for Social & Messaging Notifications:
  // Must be strictly bound to: type + authoritative event/entity identifier + recipientId (+ callerId)
  if (type === 'message') {
    const canonicalMessageId = eventId || entityId || 'unknown_msg';
    return `event:message:${canonicalMessageId.trim()}:${recipientId.trim()}`;
  }

  if (type === 'follow_request') {
    const canonicalReqId = eventId || `${callerId}:${recipientId}`;
    return `event:follow_request:${canonicalReqId.trim()}:${recipientId.trim()}`;
  }

  if (type === 'follow_accepted') {
    const canonicalTransitionId = eventId || `${callerId}:${recipientId}`;
    return `event:follow_accepted:${canonicalTransitionId.trim()}:${recipientId.trim()}`;
  }

  if (type === 'like') {
    // In SINC, a like is unique per (callerId, entityId). Client idempotency keys cannot bypass this.
    const canonicalLikeId = eventId || `${callerId}:${entityId || 'none'}`;
    return `event:like:${canonicalLikeId.trim()}:${recipientId.trim()}`;
  }

  if (type === 'comment') {
    const canonicalCommentId = eventId || entityId || 'unknown_comment';
    return `event:comment:${canonicalCommentId.trim()}:${recipientId.trim()}`;
  }

  if (type === 'mention') {
    const canonicalMentionId = eventId || entityId || 'unknown_mention';
    return `event:mention:${canonicalMentionId.trim()}:${callerId.trim()}:${recipientId.trim()}`;
  }

  if (type === 'notification') {
    const canonicalNotifId = eventId || entityId || 'unknown_notif';
    return `event:notification:${canonicalNotifId.trim()}:${recipientId.trim()}`;
  }

  // 2. Self-Only Notifications (system, test):
  // Restricted strictly to caller's own account (callerId === recipientId).
  const clientKey = idempotencyKey ? idempotencyKey.trim() : (eventId ? eventId.trim() : 'default');
  return `event:${type}:${callerId.trim()}:${clientKey}`;
}

export type SubscriptionValidationResult =
  | {
      valid: true;
      cleanSubscription: {
        endpoint: string;
        keys?: {
          p256dh: string;
          auth: string;
        };
      };
    }
  | {
      valid: false;
      status: number;
      error: string;
    };

/**
 * Validates a push subscription registration request against caller identity and URL safety.
 */
export function validatePushSubscription(callerId: string, targetUserId: string, subscription: any): SubscriptionValidationResult {
  if (callerId !== targetUserId) {
    return {
      valid: false,
      status: 403,
      error: 'Forbidden: Cannot register push subscription for another user'
    };
  }

  if (!subscription || typeof subscription !== 'object' || !subscription.endpoint || typeof subscription.endpoint !== 'string') {
    return {
      valid: false,
      status: 400,
      error: 'Missing or invalid subscription.endpoint'
    };
  }

  const endpoint = subscription.endpoint.trim();
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid subscription endpoint: Web Push endpoints must be secure HTTPS URLs'
    };
  }

  return {
    valid: true,
    cleanSubscription: {
      ...subscription,
      endpoint
    }
  };
}

