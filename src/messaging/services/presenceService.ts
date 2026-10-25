import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export interface UserPresenceInfo {
  status: 'online' | 'offline';
  lastSeen: string;
}

const activePresenceState = new Map<string, UserPresenceInfo>();
const presenceListeners = new Set<(state: Map<string, UserPresenceInfo>) => void>();

const notifyPresence = (): void => {
  presenceListeners.forEach((fn) => fn(activePresenceState));
};

export const initPresenceTracking = (currentUserId: string | null): (() => void) => {
  if (!currentUserId) return () => {};

  activePresenceState.set(currentUserId, { status: 'online', lastSeen: new Date().toISOString() });

  if (isSupabaseConfigured) {
    try {
      const channel = supabase.channel('room:global-presence');

      channel
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          Object.keys(newState).forEach((key) => {
            const presences = newState[key];
            if (presences && presences.length > 0) {
              const u = presences[0] as any;
              activePresenceState.set(u.user_id || key, {
                status: 'online',
                lastSeen: new Date().toISOString()
              });
            }
          });
          notifyPresence();
        })
        .on('presence' as any, { event: 'leave' }, () => {
          activePresenceState.set(currentUserId, { status: 'offline', lastSeen: new Date().toISOString() });
          notifyPresence();
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Supabase presence setup error.', e);
    }
  }

  return () => {};
};

export const subscribeToPresence = (
  userId: string,
  callback: (info: UserPresenceInfo) => void
): (() => void) => {
  const listener = (state: Map<string, UserPresenceInfo>) => {
    const info = state.get(userId) || { status: 'online', lastSeen: 'recently' };
    callback(info);
  };

  presenceListeners.add(listener);
  listener(activePresenceState);

  return () => {
    presenceListeners.delete(listener);
  };
};
