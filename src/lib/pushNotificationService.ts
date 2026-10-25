// SINC Platform — Web Push Notification Service
// Manages Service Worker registration, PushManager subscriptions,
// permission states, and secure server delivery triggers.

import { supabase, isSupabaseConfigured } from './supabase';

const SW_PATH = '/sw.js';
const SW_SCOPE = '/';
const LOCAL_SUB_KEY_PREFIX = 'sinc_push_sub_';

// Convert a base64url string to a Uint8Array for PushManager applicationServerKey
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('Invalid VAPID public key string');
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if browser supports modern Web Push APIs
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Reactive listeners for push subscription status changes
const pushListeners = new Set<() => void>();
export const subscribeToPushState = (fn: () => void): (() => boolean) => {
  pushListeners.add(fn);
  return () => pushListeners.delete(fn);
};

export const notifyPushStateChange = (): void => {
  pushListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[PushService] Listener error:', e);
    }
  });
};

export type PushSubscriptionStatus =
  | 'unsupported'
  | 'denied'
  | 'granted_subscribed'
  | 'granted_unsubscribed'
  | 'default';

/**
 * Returns the current push status:
 * 'unsupported' | 'denied' | 'granted_subscribed' | 'granted_unsubscribed' | 'default'
 */
export async function getPushSubscriptionState(): Promise<PushSubscriptionStatus> {
  if (!isPushNotificationSupported()) {
    return 'unsupported';
  }

  const permission = Notification.permission;
  if (permission === 'denied') {
    return 'denied';
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (!registration) {
      return permission === 'granted' ? 'granted_unsubscribed' : 'default';
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return 'granted_subscribed';
    }

    return permission === 'granted' ? 'granted_unsubscribed' : 'default';
  } catch (err) {
    console.warn('[PushService] Error querying subscription state:', err);
    return permission === 'granted' ? 'granted_unsubscribed' : 'default';
  }
}

/**
 * Registers the SINC Service Worker without immediately prompting for permission.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: SW_SCOPE
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error('[PushService] Service worker registration failed:', err);
    return null;
  }
}

export interface SubscribeToPushResult {
  success: boolean;
  error?: string;
  status?: NotificationPermission;
  subscription?: PushSubscription;
  savedToDb?: boolean;
}

/**
 * Requests push permission and subscribes the user device to Web Push.
 * Must only be called as a result of an explicit user interaction (e.g. Settings toggle).
 */
export async function subscribeToPush(userId: string): Promise<SubscribeToPushResult> {
  if (!userId) {
    return { success: false, error: 'User must be authenticated to subscribe' };
  }

  if (!isPushNotificationSupported()) {
    return { success: false, error: 'Web Push is not supported in this browser' };
  }

  // 1. Request notification permission explicitly
  let permission = Notification.permission;
  if (permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch (e: any) {
      return { success: false, error: 'Failed to request notification permission: ' + e?.message };
    }
  }

  if (permission !== 'granted') {
    notifyPushStateChange();
    return {
      success: false,
      status: permission,
      error: permission === 'denied'
        ? 'Notification permission was denied in your browser settings. Please enable notifications for SINC in site permissions.'
        : 'Notification permission was dismissed.'
    };
  }

  // 2. Ensure Service Worker is registered and active
  let registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!registration) {
    const reg = await registerServiceWorker();
    if (reg) registration = reg;
  }
  await navigator.serviceWorker.ready;

  if (!registration) {
    return { success: false, error: 'Service worker registration unavailable' };
  }

  // 3. Resolve VAPID Public Key
  const rawVapidKey =
    (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY)) ||
    'BKd8ugnmQaYtu0mReGLVHEqLvyEBG9EOPWsV2bh8QctlG1GTfN4IkOl0NVTBKUtzWZsi36BIoYfCFQiGdslZ6FQ';

  let applicationServerKey: Uint8Array;
  try {
    applicationServerKey = urlBase64ToUint8Array(rawVapidKey);
  } catch (err) {
    return { success: false, error: 'Invalid VAPID public key configuration' };
  }

  // 4. Create or retrieve PushSubscription from PushManager
  let subscription: PushSubscription | null = null;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });
    }
  } catch (subErr: any) {
    console.warn('[PushService] PushManager.subscribe error:', subErr);
    return {
      success: false,
      error: 'Browser Push service subscription failed: ' + (subErr?.message || 'Permission denied by push service')
    };
  }

  if (!subscription) {
    return { success: false, error: 'Failed to obtain push subscription' };
  }

  // 5. Serialize subscription keys
  const rawP256dh = subscription.getKey('p256dh');
  const rawAuth = subscription.getKey('auth');

  const p256dh = rawP256dh
    ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawP256dh))))
    : '';
  const auth = rawAuth
    ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))))
    : '';

  const subscriptionPayload = {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    user_agent: typeof navigator !== 'undefined' ? (navigator.userAgent || 'Web Browser') : 'Web Browser',
    is_active: true
  };

  // 6. Securely persist subscription in Supabase database
  let savedToDb = false;
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionPayload, { onConflict: 'endpoint' })
        .select()
        .single();

      if (!error && data) {
        savedToDb = true;
        console.log('[PushService] Push subscription persisted in Supabase:', data.id);
      } else if (error) {
        console.warn('[PushService] Supabase push_subscriptions upsert note:', error.message);
      }
    } catch (e) {
      console.warn('[PushService] Exception persisting to Supabase:', e);
    }
  }

  // 7. Store in client local cache & notify local dev server bridge
  try {
    localStorage.setItem(
      `${LOCAL_SUB_KEY_PREFIX}${userId}`,
      JSON.stringify({
        ...subscriptionPayload,
        savedToDb,
        subscribedAt: new Date().toISOString()
      })
    );

    // Sync with local dev server if available
    let authToken: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      authToken = sessionData?.session?.access_token ? `Bearer ${sessionData.session.access_token}` : null;
    } catch (_) {}

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = authToken;

    fetch('/api/register-web-push', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, subscription: subscriptionPayload })
    }).catch(() => {});
  } catch (e) {
    // Ignore storage issues
  }

  notifyPushStateChange();
  return {
    success: true,
    subscription,
    savedToDb
  };
}

/**
 * Disables Web Push notifications for the current browser device and removes subscription.
 */
export async function unsubscribeFromPush(userId: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) return { success: true };

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // 1. Mark inactive or delete from Supabase
        if (isSupabaseConfigured && userId) {
          try {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', endpoint)
              .eq('user_id', userId);
          } catch (e) {
            console.warn('[PushService] Database unsubscribe note:', e);
          }
        }

        // 2. Notify local dev server
        let unregAuthToken: string | null = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          unregAuthToken = sessionData?.session?.access_token ? `Bearer ${sessionData.session.access_token}` : null;
        } catch (_) {}

        const unregHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (unregAuthToken) unregHeaders['Authorization'] = unregAuthToken;

        fetch('/api/unregister-web-push', {
          method: 'POST',
          headers: unregHeaders,
          body: JSON.stringify({ userId, endpoint })
        }).catch(() => {});
      }
    }

    if (userId) {
      localStorage.removeItem(`${LOCAL_SUB_KEY_PREFIX}${userId}`);
    }

    notifyPushStateChange();
    return { success: true };
  } catch (err: any) {
    console.error('[PushService] Unsubscribe error:', err);
    return { success: false, error: err?.message };
  }
}

export interface DispatchServerPushParams {
  recipientId: string;
  type?: string;
  title?: string;
  message?: string;
  url?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Triggers server-side push notification dispatch.
 * Invokes Supabase Edge Function in production or local dev middleware in development.
 */
export async function dispatchServerPushNotification({
  recipientId,
  type,
  title,
  message,
  url,
  entityType,
  entityId
}: DispatchServerPushParams): Promise<any> {
  if (!recipientId) return;

  const payload = {
    recipientId,
    type,
    title,
    message,
    url,
    entityType,
    entityId
  };

  // Get current session token for authentication
  let authToken: string | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    authToken = sessionData?.session?.access_token ? `Bearer ${sessionData.session.access_token}` : null;
  } catch (e) {}

  // 1. Try Supabase Edge Function if deployed
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('send-web-push', {
        body: payload
      });

      if (!error && data?.success) {
        console.log('[PushService] Edge Function dispatched push successfully:', data);
        return data;
      }
    } catch (e) {
      // Fallback to local dev API
    }
  }

  // 2. Fallback to local dev server middleware (/api/send-web-push)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = authToken;
    }
    const res = await fetch('/api/send-web-push', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      console.log('[PushService] Local dev server dispatched push:', data);
      return data;
    }
  } catch (devErr: any) {
    console.warn('[PushService] Local dev dispatch unreachable:', devErr?.message);
  }

  return { success: false, reason: 'dispatch_endpoint_unavailable' };
}
