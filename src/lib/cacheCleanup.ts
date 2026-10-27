/**
 * Utility to purge user-specific read-caches and offline entities from localStorage on logout.
 * Ensures the next user on the same device never sees stale or previous account data.
 */
export function clearAllUserLocalCache(userId?: string): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Match all user read-caches and data prefixes
      if (
        key.startsWith('sync_') ||
        key.startsWith('read_') ||
        key.startsWith('push_sub_') ||
        (userId && key.includes(userId))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    });
  } catch (err) {
    console.warn('[CacheCleanup] Error clearing local caches on logout:', err);
  }
}
