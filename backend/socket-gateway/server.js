/**
 * SINC Platform — Standalone Node.js Socket.IO Gateway
 * Phase 7: Realtime Architecture & Auxiliary Transport
 *
 * Provides strictly authenticated, room-based realtime event relay for:
 * - Ephemeral typing indicators (`typing:start`, `typing:stop`)
 * - Presence states (`presence:update`, `presence:query`)
 * - Fast user-to-user notification dispatch (`notification:send`, `notification:received`)
 *
 * Coexists cleanly with Supabase Realtime without duplicating or replacing
 * Supabase Postgres database-level message persistence.
 */

try {
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (_) {}

const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const PORT = process.env.SOCKET_PORT || 3001;
const ALLOWED_ORIGIN = process.env.SOCKET_CORS_ORIGIN || '*';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || null;
const IS_PROD = process.env.NODE_ENV === 'production';

let cachedGatewayJWKS = null;
let cachedGatewayJWKSUrl = null;
let customGatewayJwksOverride = null;

function setCustomJwksOverride(jwks) {
  customGatewayJwksOverride = jwks;
}

function getGatewayRemoteJWKSet(jwksUrl) {
  if (customGatewayJwksOverride) {
    return customGatewayJwksOverride;
  }
  if (cachedGatewayJWKS && cachedGatewayJWKSUrl === jwksUrl) {
    return cachedGatewayJWKS;
  }
  cachedGatewayJWKS = createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 30000,
    cacheMaxAge: 600000
  });
  cachedGatewayJWKSUrl = jwksUrl;
  return cachedGatewayJWKS;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'sinc-socket-gateway', timestamp: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 10000
});

// Ephemeral in-memory presence tracking: userId -> Set of socketIds
const onlineUsers = new Map();

/**
 * Validates and decodes a Supabase JWT token.
 * Supports asymmetric ES256 (via remote JWKS) and symmetric HS256 (when secret configured).
 *
 * @param {string} token - Raw JWT string
 * @param {object} [options] - Optional custom verifier options (jwks, jwtSecret, supabaseUrl)
 * @returns {Promise<{ valid: boolean, payload?: object, error?: string }>}
 */
async function verifySupabaseToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing access token in handshake auth' };
  }

  const clean = token.replace(/^Bearer\s+/i, '').trim();
  const parts = clean.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    return { valid: false, error: 'Malformed token structure (expected header.payload.signature)' };
  }

  // 1. Decode & validate header
  let header;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (parseErr) {
    return { valid: false, error: 'Failed to decode token header JSON' };
  }

  if (!header || typeof header !== 'object') {
    return { valid: false, error: 'Invalid token header structure' };
  }

  if (!header.alg || header.alg.toLowerCase() === 'none') {
    return { valid: false, error: 'Algorithm "none" is not permitted' };
  }

  const alg = String(header.alg).toUpperCase();
  if (alg !== 'ES256' && alg !== 'HS256') {
    return { valid: false, error: `Unsupported signing algorithm "${header.alg}". Expected ES256 or HS256.` };
  }

  if (!parts[2]) {
    return { valid: false, error: 'Missing token signature' };
  }

  let payload;

  if (alg === 'HS256') {
    const secret = options.jwtSecret || process.env.SUPABASE_JWT_SECRET;
    if (!secret || typeof secret !== 'string' || secret.trim() === '') {
      return { valid: false, error: 'Server configuration error: SUPABASE_JWT_SECRET required' };
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(parts[2], 'utf8');

      if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        return { valid: false, error: 'Invalid token signature' };
      }

      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch (sigErr) {
      return { valid: false, error: 'Cryptographic signature verification failed' };
    }
  } else if (alg === 'ES256') {
    const supabaseUrl =
      options.supabaseUrl ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;

    let keySource = options.jwks;
    if (!keySource) {
      if (!supabaseUrl || typeof supabaseUrl !== 'string' || supabaseUrl.trim() === '') {
        return { valid: false, error: 'Server configuration error: SUPABASE_URL required for JWKS verification' };
      }
      const jwksUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
      keySource = getGatewayRemoteJWKSet(jwksUrl);
    }

    try {
      const verifyOpts = {
        algorithms: ['ES256']
      };
      if (!customGatewayJwksOverride && !options.jwks && supabaseUrl) {
        verifyOpts.issuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
      } else if (options.supabaseUrl) {
        verifyOpts.issuer = `${options.supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
      }

      const verified = await jwtVerify(clean, keySource, verifyOpts);
      payload = verified.payload;
    } catch (err) {
      const errMsg = err?.message || 'Verification failed';
      if (errMsg.toLowerCase().includes('expired') || err.code === 'ERR_JWT_EXPIRED') {
        return { valid: false, error: 'Expired authentication token' };
      }
      return { valid: false, error: `Invalid token signature (${errMsg})` };
    }
  }

  // 2. Decode & validate payload claims
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid token payload structure' };
  }

  // Expiration validation
  if (!payload.exp || typeof payload.exp !== 'number') {
    return { valid: false, error: 'Token missing exp claim' };
  }
  if (payload.exp * 1000 < Date.now()) {
    return { valid: false, error: 'Expired authentication token' };
  }

  // Subject claim (authoritative user ID)
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    return { valid: false, error: 'Missing or invalid sub claim in token' };
  }

  // Role & audience validation
  if (payload.role && payload.role !== 'authenticated' && payload.role !== 'service_role') {
    return { valid: false, error: 'Invalid token role' };
  }
  if (payload.aud && payload.aud !== 'authenticated') {
    return { valid: false, error: 'Invalid token audience' };
  }

  return { valid: true, payload };
}

// Connection Authentication Middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  const clientUserId = socket.handshake.auth?.userId;

  // Token is strictly required — client-supplied user IDs without signed tokens are rejected
  if (!token) {
    return next(new Error('Authentication failed: Missing access token in handshake auth'));
  }

  const result = await verifySupabaseToken(token);
  if (!result.valid || !result.payload) {
    return next(new Error(`Authentication failed: ${result.error || 'Token verification failed'}`));
  }

  const authoritativeUserId = String(result.payload.sub);

  // If client also passed clientUserId, enforce that it matches the token identity
  if (clientUserId && String(clientUserId) !== authoritativeUserId) {
    return next(new Error('Authentication failed: Client userId mismatch with token identity'));
  }

  // Authoritatively bind verified identity to socket instance
  socket.userId = authoritativeUserId;
  socket.authenticatedToken = token;
  next();
});

io.on('connection', (socket) => {
  const userId = socket.userId;

  // Track online sockets for this user
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Automatically join personal user notification room
  socket.join(`user:${userId}`);

  // Broadcast user presence update
  io.emit('presence:update', {
    userId,
    status: 'online',
    timestamp: Date.now()
  });

  // 1. Join Conversation Room
  socket.on('conversation:join', (data) => {
    if (data?.conversationId && typeof data.conversationId === 'string') {
      socket.join(`conversation:${data.conversationId}`);
    }
  });

  // 2. Leave Conversation Room
  socket.on('conversation:leave', (data) => {
    if (data?.conversationId && typeof data.conversationId === 'string') {
      socket.leave(`conversation:${data.conversationId}`);
    }
  });

  // 3. User Room Join Protection: Users may only join their own user room
  socket.on('user:join', (data) => {
    if (data?.userId && String(data.userId) !== socket.userId) {
      socket.emit('error', { message: 'Unauthorized: Cannot join another user private room' });
      return;
    }
    if (data?.userId) {
      socket.join(`user:${data.userId}`);
    }
  });

  // 4. Ephemeral Typing Indicator — authoritatively sets sender userId
  socket.on('typing:start', (data) => {
    if (data?.conversationId && typeof data.conversationId === 'string') {
      socket.to(`conversation:${data.conversationId}`).emit('typing:status', {
        conversationId: data.conversationId,
        userId: socket.userId,
        isTyping: true,
        timestamp: Date.now()
      });
    }
  });

  socket.on('typing:stop', (data) => {
    if (data?.conversationId && typeof data.conversationId === 'string') {
      socket.to(`conversation:${data.conversationId}`).emit('typing:status', {
        conversationId: data.conversationId,
        userId: socket.userId,
        isTyping: false,
        timestamp: Date.now()
      });
    }
  });

  // 5. Client Notification Relay Dispatch — authoritatively sets senderId
  socket.on('notification:send', (data) => {
    if (data?.recipientId && typeof data.recipientId === 'string') {
      io.to(`user:${data.recipientId}`).emit('notification:received', {
        ...data,
        senderId: socket.userId,
        timestamp: Date.now()
      });
    }
  });

  // 6. Query Online Presence List
  socket.on('presence:query', (callback) => {
    if (typeof callback === 'function') {
      const activeList = Array.from(onlineUsers.keys());
      callback({ onlineUserIds: activeList });
    }
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit('presence:update', {
          userId,
          status: 'offline',
          timestamp: Date.now()
        });
      }
    }
    socket.removeAllListeners();
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[sinc-socket-gateway] Realtime Socket.IO Gateway listening on port ${PORT}`);
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (url) {
      console.log(`[sinc-socket-gateway] JWKS verification active (ES256) via ${url}/auth/v1/.well-known/jwks.json`);
    }
    if (secret) {
      console.log('[sinc-socket-gateway] HS256 symmetric verification fallback enabled.');
    } else if (!url) {
      console.warn('[sinc-socket-gateway] WARNING: Neither SUPABASE_URL nor SUPABASE_JWT_SECRET configured. Handshakes will fail closed.');
    }
  });
}

module.exports = { server, io, verifySupabaseToken, setCustomJwksOverride };
