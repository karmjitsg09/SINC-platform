import { useState, useEffect } from 'react';
import { initPresenceTracking, subscribeToPresence } from '../services/presenceService';

export function usePresence(userId, currentUserId) {
  const [presence, setPresence] = useState({ status: 'online', lastSeen: 'recently' });

  useEffect(() => {
    const unsubTracking = initPresenceTracking(currentUserId);
    const unsubPresence = subscribeToPresence(userId, (statusInfo) => {
      setPresence(statusInfo);
    });

    return () => {
      unsubTracking();
      unsubPresence();
    };
  }, [userId, currentUserId]);

  return presence;
}
