import { useState, useEffect } from 'react';
import { initPresenceTracking, subscribeToPresence } from '../services/presenceService';

export interface PresenceInfo {
  status: 'online' | 'offline';
  lastSeen?: string;
  [key: string]: any;
}

export function usePresence(userId?: string | null, currentUserId?: string | null): PresenceInfo {
  const [presence, setPresence] = useState<PresenceInfo>({ status: 'online', lastSeen: 'recently' });

  useEffect(() => {
    if (!userId || !currentUserId) return;

    const unsubTracking = initPresenceTracking(currentUserId);
    const unsubPresence = subscribeToPresence(userId, (statusInfo: PresenceInfo) => {
      setPresence(statusInfo);
    });

    return () => {
      if (typeof unsubTracking === 'function') unsubTracking();
      if (typeof unsubPresence === 'function') unsubPresence();
    };
  }, [userId, currentUserId]);

  return presence;
}
