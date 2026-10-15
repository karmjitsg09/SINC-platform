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
      console.log('[NotificationService] Fetching notifications for recipient:', recipientId);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[NotificationService] Error querying notifications from DB:', error);
      } else if (data) {
        // 1. Fetch missing actor profiles in a single batch query
        const actorIds = Array.from(
          new Set(data.map((n) => n.actor_id).filter(Boolean))
        );
        const profilesMap = {};
        if (actorIds.length > 0) {
          const { data: profilesData, error: profErr } = await supabase
            .from('profiles')
            .select('id, name, username, role, avatar_url')
            .in('id', actorIds);

          if (!profErr && profilesData) {
            profilesData.forEach((p) => {
              profilesMap[p.id] = {
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

        // 2. Fetch follow request statuses for all follow_request notifications
        const followRequestsMap = {};
        const followReqEntityIds = data
          .filter((n) => n.type === 'follow_request' && n.entity_id)
          .map((n) => n.entity_id);
        const followReqActorIds = data
          .filter((n) => n.type === 'follow_request' && n.actor_id)
          .map((n) => n.actor_id);

        if (followReqEntityIds.length > 0 || followReqActorIds.length > 0) {
          try {
            // Check by request ID
            if (followReqEntityIds.length > 0) {
              const { data: frData } = await supabase
                .from('follow_requests')
                .select('id, follower_user_id, following_user_id, status')
                .in('id', followReqEntityIds);
              if (frData) {
                frData.forEach((fr) => {
                  followRequestsMap[fr.id] = fr.status;
                  followRequestsMap[`${fr.follower_user_id}_${fr.following_user_id}`] = fr.status;
                });
              }
            }

            // Also check by follower/following pairs
            if (followReqActorIds.length > 0) {
              const { data: frPairs } = await supabase
                .from('follow_requests')
                .select('id, follower_user_id, following_user_id, status')
                .eq('following_user_id', recipientId)
                .in('follower_user_id', followReqActorIds);
              if (frPairs) {
                frPairs.forEach((fr) => {
                  followRequestsMap[fr.id] = fr.status;
                  followRequestsMap[`${fr.follower_user_id}_${fr.following_user_id}`] = fr.status;
                });
              }
            }
          } catch (frErr) {
            console.warn('[NotificationService] Error loading follow request statuses:', frErr);
          }
        }

        // 3. Assemble enriched notification objects
        const dbList = data.map((n) => {
          const actor =
            profilesMap[n.actor_id] ||
            mockUsers.find((u) => u.id === n.actor_id) || {
              id: n.actor_id,
              name: 'User',
              username: 'user',
              role: 'Member',
              avatarUrl: null,
              avatar_url: null
            };

          let followRequestStatus = null;
          if (n.type === 'follow_request') {
            followRequestStatus =
              followRequestsMap[n.entity_id] ||
              followRequestsMap[`${n.actor_id}_${n.recipient_id}`] ||
              'pending';
          }

          return {
            ...n,
            actor,
            followRequestStatus
          };
        });

        // Merge with any fresh local notifications for recipient
        const localList = localNotifications.filter((n) => n.recipient_id === recipientId);
        const map = new Map();
        dbList.forEach((n) => map.set(n.id, n));
        localList.forEach((n) => {
          if (!map.has(n.id)) map.set(n.id, n);
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        console.log('[NotificationService] Returning notifications count:', merged.length);
        return merged;
      }
    } catch (e) {
      console.warn('[NotificationService] Supabase getNotifications exception, using fallback:', e);
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
      console.warn('[NotificationService] Supabase markNotificationAsRead error:', e);
    }
  }

  const target = localNotifications.find((n) => n.id === notificationId);
  if (target) {
    target.is_read = true;
  }
  notifyNotificationStateChange();
};

export const markAllNotificationsAsRead = async (recipientId) => {
  if (!recipientId) return;

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', recipientId);
    } catch (e) {
      console.warn('[NotificationService] Supabase markAllNotificationsAsRead error:', e);
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
  entityType = 'follow_request',
  entityId,
  actorObj = null
}) => {
  if (!recipientId || !actorId || recipientId === actorId) {
    console.warn('[NotificationService] Skipped invalid or self-notification:', { recipientId, actorId });
    return null;
  }

  console.log('[NotificationService] Creating notification:', { recipientId, actorId, type, entityId });

  // Resolve actor profile details
  let actor = actorObj;
  if (!actor && isSupabaseConfigured) {
    try {
      const { data: dbActor } = await supabase
        .from('profiles')
        .select('id, name, username, role, avatar_url')
        .eq('id', actorId)
        .maybeSingle();
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
      username: 'user',
      avatarUrl: null
    };
  }

  // Construct standard notification message
  const actorName = actor.username ? `@${actor.username}` : (actor.name || 'User');
  let finalMessage = message;
  if (!finalMessage) {
    if (type === 'follow_request') {
      finalMessage = `${actorName} sent you a follow request.`;
    } else if (type === 'follow_accepted') {
      finalMessage = `${actorName} accepted your follow request.`;
    } else {
      finalMessage = `${actorName} sent you a notification.`;
    }
  }

  if (isSupabaseConfigured) {
    try {
      // Duplicate prevention check: do not insert duplicate notification for the same entity event
      if (entityId) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', recipientId)
          .eq('actor_id', actorId)
          .eq('type', type)
          .eq('entity_id', String(entityId))
          .maybeSingle();

        if (existingNotif) {
          console.log('[NotificationService] Notification already exists in DB:', existingNotif.id);
          const fullExisting = {
            ...existingNotif,
            actor,
            followRequestStatus: type === 'follow_request' ? 'pending' : null
          };
          return { success: true, notification: fullExisting, duplicate: true };
        }
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert([
          {
            recipient_id: recipientId,
            actor_id: actorId,
            type,
            title: title || (type === 'follow_request' ? 'Follow Request' : 'Notification'),
            message: finalMessage,
            entity_type: entityType,
            entity_id: String(entityId),
            is_read: false
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('[NotificationService] DB Insert Notification Error:', error);
        return { success: false, error };
      }

      if (data) {
        console.log('[NotificationService] Notification successfully stored in DB:', data.id);
        const fullNotif = {
          ...data,
          actor,
          followRequestStatus: type === 'follow_request' ? 'pending' : null
        };
        localNotifications.unshift(fullNotif);
        notifyNotificationStateChange();
        return { success: true, notification: fullNotif };
      }
    } catch (e) {
      console.warn('[NotificationService] Supabase createNotification exception:', e);
      return { success: false, error: e };
    }
  }

  // Local fallback
  const newNotif = {
    id: `n-${Date.now()}`,
    recipient_id: recipientId,
    actor_id: actorId,
    type,
    title: title || 'Follow Request',
    message: finalMessage,
    entity_type: entityType,
    entity_id: String(entityId),
    is_read: false,
    created_at: new Date().toISOString(),
    actor,
    followRequestStatus: type === 'follow_request' ? 'pending' : null
  };

  localNotifications.unshift(newNotif);
  notifyNotificationStateChange();
  return { success: true, notification: newNotif };
};

export const subscribeToRealtimeNotifications = (recipientId, callback) => {
  if (!recipientId) return () => {};

  if (isSupabaseConfigured) {
    try {
      const channelName = `notifications_${recipientId}_${Math.random().toString(36).substring(2, 8)}`;
      console.log('[NotificationService] Subscribing to realtime channel:', channelName);

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${recipientId}`
          },
          (payload) => {
            console.log('[NotificationService] Realtime notifications change detected:', payload);
            if (callback) {
              callback(payload);
            }
          }
        )
        .subscribe((status) => {
          console.log('[NotificationService] Realtime channel status:', channelName, status);
        });

      return () => {
        console.log('[NotificationService] Unsubscribing realtime channel:', channelName);
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('[NotificationService] Realtime notifications subscription error:', e);
    }
  }

  return subscribeToNotificationState(() => {
    if (callback) callback();
  });
};
