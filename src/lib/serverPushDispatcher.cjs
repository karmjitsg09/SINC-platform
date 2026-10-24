// SINC Platform — Server-side Web Push Dispatcher
// For Vite Dev Server Middleware, Testing Scripts, and Local Dispatch

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@sinc.network';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    console.warn('[serverPushDispatcher] Failed to set VAPID details:', e.message);
  }
}

// In-memory rate limiting cache
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW_MS = 2500;

// Local fallback subscription storage for dev/testing when remote migration is pending
const localMemorySubscriptions = new Map(); // userId -> Array of subscriptions

function registerLocalSubscription(userId, subscription) {
  if (!userId || !subscription || !subscription.endpoint) return;
  const list = localMemorySubscriptions.get(userId) || [];
  const existingIdx = list.findIndex((s) => s.endpoint === subscription.endpoint);
  const record = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh || subscription.p256dh,
    auth: subscription.keys?.auth || subscription.auth,
    user_agent: subscription.user_agent || 'Browser',
    is_active: true,
    created_at: new Date().toISOString()
  };
  if (existingIdx !== -1) {
    list[existingIdx] = record;
  } else {
    list.push(record);
  }
  localMemorySubscriptions.set(userId, list);
  return record;
}

function unregisterLocalSubscription(userId, endpoint) {
  if (!userId || !endpoint) return;
  const list = localMemorySubscriptions.get(userId) || [];
  const filtered = list.filter((s) => s.endpoint !== endpoint);
  localMemorySubscriptions.set(userId, filtered);
}

function getLocalSubscriptions(userId) {
  return (localMemorySubscriptions.get(userId) || []).filter((s) => s.is_active);
}

/**
 * Dispatches a push notification to all active devices of the recipient.
 */
async function sendPushNotification({
  callerId,
  authToken,
  recipientId,
  type,
  title,
  message,
  url,
  entityType,
  entityId
}) {
  if (!recipientId) {
    return { success: false, error: 'recipientId is required' };
  }

  // Self-notification suppression
  if (callerId && callerId === recipientId) {
    return { success: true, delivered: 0, reason: 'self_notification_suppressed' };
  }

  // Rate limiting check
  const rateLimitKey = `${callerId || 'anon'}_${recipientId}_${type}_${entityId || ''}`;
  const now = Date.now();
  const lastTime = rateLimitCache.get(rateLimitKey);
  if (lastTime && now - lastTime < RATE_LIMIT_WINDOW_MS) {
    return { success: true, delivered: 0, throttled: true };
  }
  rateLimitCache.set(rateLimitKey, now);

  const supabaseAdmin = (supabaseUrl && supabaseSecretKey)
    ? createClient(supabaseUrl, supabaseSecretKey)
    : null;

  // 1. Authenticate caller if token provided
  let authenticatedUser = null;
  if (authToken && supabaseAdmin) {
    try {
      const cleanToken = authToken.replace('Bearer ', '').trim();
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(cleanToken);
      if (!authErr && user) {
        authenticatedUser = user;
      }
    } catch (e) {
      // Auth token check failed
    }
  }

  // 2. Fetch active subscriptions for recipient
  let subscriptions = [];

  if (supabaseAdmin) {
    try {
      const { data: dbSubs, error: dbErr } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', recipientId)
        .eq('is_active', true);

      if (!dbErr && dbSubs && dbSubs.length > 0) {
        subscriptions = dbSubs;
      }
    } catch (e) {
      // Fallback to local memory subscriptions
    }
  }

  // Merge with any active local memory subscriptions
  const localSubs = getLocalSubscriptions(recipientId);
  const existingEndpoints = new Set(subscriptions.map((s) => s.endpoint));
  localSubs.forEach((ls) => {
    if (!existingEndpoints.has(ls.endpoint)) {
      subscriptions.push(ls);
    }
  });

  if (subscriptions.length === 0) {
    return { success: true, delivered: 0, message: 'No active subscriptions for recipient' };
  }

  // Prepare payload
  const payload = JSON.stringify({
    title: title || 'SINC Notification',
    body: message || 'You have a new update on SINC.',
    icon: '/images/sinc-official-logo-transparent.png',
    badge: '/images/sinc-official-logo-transparent.png',
    data: {
      url: url || '/notifications',
      entityType: entityType || null,
      entityId: entityId || null,
      timestamp: Date.now()
    }
  });

  let deliveredCount = 0;
  const expiredEndpoints = [];

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSub, payload, {
        TTL: 60 * 60 * 24 // 24 hours
      });
      deliveredCount++;
    } catch (err) {
      console.warn('[serverPushDispatcher] Push delivery failed:', err?.statusCode, err?.message);
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredEndpoints.push(sub.endpoint);
        unregisterLocalSubscription(recipientId, sub.endpoint);
      }
    }
  }

  // Deactivate expired endpoints in Supabase if table is present
  if (expiredEndpoints.length > 0 && supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('endpoint', expiredEndpoints);
    } catch (e) {
      // Ignore
    }
  }

  return {
    success: true,
    delivered: deliveredCount,
    totalSubscriptions: subscriptions.length,
    deactivated: expiredEndpoints.length
  };
}

module.exports = {
  sendPushNotification,
  registerLocalSubscription,
  unregisterLocalSubscription,
  getLocalSubscriptions
};
