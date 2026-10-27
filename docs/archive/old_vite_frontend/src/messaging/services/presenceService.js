import { supabase, isSupabaseConfigured } from '../../lib/supabase';

const activePresenceState = new Map();
const presenceListeners = new Set();

const notifyPresence = () => {
  presenceListeners.forEach((fn) => fn(activePresenceState));
};

export const initPresenceTracking = (currentUserId) => {
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
              const u = presences[0];
              activePresenceState.set(u.user_id || key, {
                status: 'online',
                lastSeen: new Date().toISOString()
              });
            }
          });
          notifyPresence();
        })
        .on('presence', { event: 'leave', key: currentUserId }, () => {
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

export const subscribeToPresence = (userId, callback) => {
  const listener = (state) => {
    const info = state.get(userId) || { status: 'online', lastSeen: 'recently' };
    callback(info);
  };

  presenceListeners.add(listener);
  listener(activePresenceState);

  return () => {
    presenceListeners.delete(listener);
  };
};
