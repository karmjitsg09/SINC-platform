// SINC Platform Service Worker — Web Push Notifications & Client Navigation
// Scope: '/'

const SINC_FALLBACK_ICON = '/images/sinc-corporate-logo.png';
const SINC_BADGE_ICON = '/images/sinc-corporate-logo.png';

self.addEventListener('install', (event) => {
  // Activate updated service worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of uncontrolled clients immediately
  event.waitUntil(self.clients.claim());
});

/**
 * Validates that a navigation target URL is strictly safe and points to the same origin
 * to prevent open-redirect vulnerabilities.
 */
function getSafeNavigationUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return self.location.origin + '/notifications';
  }

  try {
    const parsed = new URL(rawUrl, self.location.origin);
    // Only permit navigation within the same origin
    if (parsed.origin === self.location.origin) {
      return parsed.href;
    }
  } catch (e) {
    // URL parsing failed
  }

  return self.location.origin + '/notifications';
}

// Push Event Listener
self.addEventListener('push', (event) => {
  let payload = {
    title: 'SINC Notification',
    body: 'You have a new update on SINC.',
    icon: SINC_FALLBACK_ICON,
    badge: SINC_BADGE_ICON,
    data: {
      url: '/notifications',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const parsedData = event.data.json();
      payload = {
        title: parsedData.title || payload.title,
        body: parsedData.body || parsedData.message || payload.body,
        icon: parsedData.icon || SINC_FALLBACK_ICON,
        badge: parsedData.badge || SINC_BADGE_ICON,
        data: {
          url: parsedData.url || parsedData.data?.url || '/notifications',
          entityType: parsedData.entityType || parsedData.data?.entityType || null,
          entityId: parsedData.entityId || parsedData.data?.entityId || null,
          timestamp: Date.now()
        }
      };
    } catch (err) {
      // If payload is plain text rather than JSON
      try {
        const textData = event.data.text();
        if (textData) {
          payload.body = textData;
        }
      } catch (textErr) {
        // Fallback remains in place
      }
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    data: payload.data,
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: payload.data?.url || 'sinc-general-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = getSafeNavigationUrl(event.notification.data?.url);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Try to find a window client with the exact target URL
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // 2. Otherwise, find any window on the same origin and navigate it
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      // 3. If no existing client window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
