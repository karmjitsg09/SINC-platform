import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { users as mockUsers } from '../../data/mockData';

// Reactive local notifications storage
export let localNotifications = [
  {
    id: 'n-1',
    recipient_id: 'u1',
    actor_id: 'u2',
    type: 'follow_request',
    title: 'Follow Request',
    message: 'sent you a follow request',
    entity_type: 'user',
    entity_id: 'u2',
    is_read: false,
    created_at: new Date(Date.now() - 120000).toISOString(),
    actor: {
      id: 'u2',
      name: 'Rahul Sharma',
      username: 'rahul_dev',
      role: 'Software Developer',
      avatarUrl: null
    }
  },
  {
    id: 'n-2',
    recipient_id: 'u1',
    actor_id: 'u3',
    type: 'post_like',
    title: 'Post Liked',
    message: 'liked your post in Tech domain',
    entity_type: 'post',
    entity_id: 'post-1',
    is_read: false,
    created_at: new Date(Date.now() - 600000).toISOString(),
    actor: {
      id: 'u3',
      name: 'Maya Patel',
      username: 'mayap',
      role: 'Digital Marketer',
      avatarUrl: null
    }
  },
  {
    id: 'n-3',
    recipient_id: 'u1',
    actor_id: 'u4',
    type: 'post_comment',
    title: 'New Comment',
    message: 'commented: "Great architectural pattern!"',
    entity_type: 'post',
    entity_id: 'post-1',
    is_read: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    actor: {
      id: 'u4',
      name: 'Arun Kumar',
      username: 'arunkumar',
      role: 'Frontend Developer',
      avatarUrl: null
    }
  },
  {
    id: 'n-4',
    recipient_id: 'u1',
    actor_id: 'u6',
    type: 'message',
    title: 'New Message',
    message: 'sent you a message: "Hey, are you joining..."',
    entity_type: 'conversation',
    entity_id: 'c-u1-u6',
    is_read: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    actor: {
      id: 'u6',
      name: 'Jordan Vance',
      username: 'jordanv',
      role: 'Product Designer',
      avatarUrl: null
    }
  }
];

const notificationListeners = new Set();
export const notifyNotificationStateChange = () => {
  notificationListeners.forEach((fn) => fn());
};

export const subscribeToNotificationState = (fn) => {
  notificationListeners.add(fn);
  return () => notificationListeners.delete(fn);
};

export const getNotifications = async (recipientId) => {
  if (!recipientId) return [];

  if (isSupabaseConfigured) {
    try {
      console.log('LOADING NOTIFICATIONS FOR', recipientId);
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:actor_id(id, name, username, role, avatar_url)')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Fetch missing actor profiles if join returned null for any notification
        const missingActorIds = Array.from(
          new Set(data.filter((n) => !n.actor && n.actor_id).map((n) => n.actor_id))
        );
        const fetchedActors = {};
        if (missingActorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, name, username, role, avatar_url')
            .in('id', missingActorIds);
          if (profilesData) {
            profilesData.forEach((p) => {
              fetchedActors[p.id] = {
                id: p.id,
                name: p.name || 'User',
                username: p.username || 'user',
                role: p.role || 'Member',
                avatarUrl: p.avatar_url || null,
                avatar_url: p.avatar_url || null
              };
            });
          }
        }

        const dbList = data.map((n) => {
          let actorObj = null;
          if (n.actor) {
            actorObj = {
              id: n.actor.id,
              name: n.actor.name || 'User',
              username: n.actor.username || 'user',
              role: n.actor.role || 'Member',
              avatarUrl: n.actor.avatar_url || null,
              avatar_url: n.actor.avatar_url || null
            };
          } else if (fetchedActors[n.actor_id]) {
            actorObj = fetchedActors[n.actor_id];
          } else {
            actorObj = mockUsers.find((u) => u.id === n.actor_id) || { id: n.actor_id, name: 'User', username: 'user' };
          }
          return {
            ...n,
            actor: actorObj
          };
        });

        console.log('NOTIFICATIONS LOADED', dbList);

        // Merge with local notifications for recipient
        const localList = localNotifications.filter((n) => n.recipient_id === recipientId);
        const map = new Map();
        dbList.forEach((n) => map.set(n.id, n));
        localList.forEach((n) => {
          if (!map.has(n.id)) map.set(n.id, n);
        });

        return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (error) {
        console.error('NOTIFICATION QUERY ERROR:', error);
      }
    } catch (e) {
      console.warn('Supabase getNotifications error, using local fallback.', e);
    }
  }

  return localNotifications
    .filter((n) => n.recipient_id === recipientId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

export const getUnreadNotificationCount = async (recipientId) => {
  const list = await getNotifications(recipientId);
  return list.filter((n) => !n.is_read).length;
};

export const markNotificationAsRead = async (notificationId, recipientId) => {
  if (!notificationId) return;

  if (isSupabaseConfigured && !notificationId.startsWith('n-')) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .match({ id: notificationId, recipient_id: recipientId });
    } catch (e) {
      console.warn('Supabase markNotificationAsRead error.', e);
    }
  }

  const target = localNotifications.find((n) => n.id === notificationId);
  if (target) {
    target.is_read = true;
  }
  notifyNotificationStateChange();
};

export const markAllNotificationsAsRead = async (recipientId) => {
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', recipientId);
    } catch (e) {
      console.warn('Supabase markAllNotificationsAsRead error.', e);
    }
  }

  localNotifications.forEach((n) => {
    if (n.recipient_id === recipientId) {
      n.is_read = true;
    }
  });
  notifyNotificationStateChange();
};

export const createNotification = async ({
  recipientId,
  actorId,
  type,
  title,
  message,
  entityType = 'user',
  entityId,
  actorObj = null
}) => {
  if (!recipientId || !actorId || recipientId === actorId) return null;

  const createdAt = new Date().toISOString();
  console.log('CREATING FOLLOW NOTIFICATION', { recipientId, actorId, entityId, type });

  // Fetch real actor details from Supabase if not provided
  let actor = actorObj;
  if (!actor && isSupabaseConfigured) {
    try {
      const { data: dbActor } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', actorId)
        .single();
      if (dbActor) {
        actor = {
          id: dbActor.id,
          name: dbActor.name || 'User',
          username: dbActor.username || 'user',
          role: dbActor.role || 'Member',
          avatarUrl: dbActor.avatar_url || null,
          avatar_url: dbActor.avatar_url || null
        };
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!actor) {
    actor = mockUsers.find((u) => u.id === actorId) || {
      id: actorId,
      name: 'User',
      username: 'user'
    };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            recipient_id: recipientId,
            actor_id: actorId,
            type,
            title,
            message,
            entity_type: entityType,
            entity_id: String(entityId)
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('NOTIFICATION INSERT ERROR', error);
      } else if (data) {
        console.log('NOTIFICATION CREATED', data);
        const fullNotif = { ...data, actor };
        localNotifications.unshift(fullNotif);
        notifyNotificationStateChange();
        return fullNotif;
      }
    } catch (e) {
      console.warn('Supabase createNotification exception:', e);
    }
  }

  const newNotif = {
    id: `n-${Date.now()}`,
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    title,
    message,
    entity_type: entityType,
    entity_id: String(entityId),
    is_read: false,
    created_at: createdAt,
    actor
  };

  localNotifications.unshift(newNotif);
  notifyNotificationStateChange();
  return newNotif;
};

export const subscribeToRealtimeNotifications = (recipientId, callback) => {
  if (isSupabaseConfigured) {
    try {
      const channel = supabase
        .channel(`notifications:${recipientId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${recipientId}`
          },
          (payload) => {
            if (payload.new) {
              callback(payload.new);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime notifications subscription error.', e);
    }
  }

  return subscribeToNotificationState(() => {
    callback();
  });
};
