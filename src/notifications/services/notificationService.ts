import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { users as mockUsers } from '../../data/mockData';
import { dispatchServerPushNotification } from '../../lib/pushNotificationService';

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    name: string;
    username: string;
    role?: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
  };
  followRequestStatus?: 'accepted' | 'rejected' | 'pending' | null;
}

export interface CreateNotificationParams {
  recipientId: string;
  actorId: string;
  type: string;
  title?: string;
  message?: string;
  entityType?: string;
  entityId: string | number;
  actorObj?: any;
}

// Reactive local notifications storage
export let localNotifications: NotificationItem[] = [
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

const notificationListeners = new Set<() => void>();
export const notifyNotificationStateChange = (): void => {
  notificationListeners.forEach((fn) => fn());
};

export const subscribeToNotificationState = (fn: () => void): (() => void) => {
  notificationListeners.add(fn);
  return () => {
    notificationListeners.delete(fn);
  };
};

export const getNotifications = async (recipientId: string | null): Promise<NotificationItem[]> => {
  if (!recipientId) return [];

  if (isSupabaseConfigured) {
    try {
      // 1. Fetch direct notifications from public.notifications
      const { data: directNotifs, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false });

      if (notifErr) {
        console.error('[NotificationService] Error querying notifications table:', notifErr);
      }

      const existingNotifs = directNotifs || [];

      // 2. Query follow_requests directed to recipient from public.follow_requests
      let dbFollowRequests: any[] = [];
      try {
        const { data: frData, error: frErr } = await supabase
          .from('follow_requests')
          .select('*')
          .eq('following_user_id', recipientId)
          .order('created_at', { ascending: false });

        if (!frErr && frData) {
          dbFollowRequests = frData;
        }
      } catch (frErr) {
        console.warn('[NotificationService] Error querying follow_requests:', frErr);
      }

      // 3. Batch lookup actor profiles from public.profiles
      const allActorIds = Array.from(
        new Set([
          ...existingNotifs.map((n: any) => n.actor_id).filter(Boolean),
          ...dbFollowRequests.map((fr: any) => fr.follower_user_id).filter(Boolean)
        ])
      );

      const profilesMap: Record<string, any> = {};
      if (allActorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, username, role, avatar_url')
          .in('id', allActorIds);

        if (profilesData) {
          profilesData.forEach((p: any) => {
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

      // Map existing entity_ids to prevent duplicates
      const existingEntityIds = new Set(
        existingNotifs.filter((n: any) => n.type === 'follow_request').map((n: any) => n.entity_id)
      );

      // 4. Synthesize follow-request notifications for any follow_requests not yet in notifications
      const followRequestsMap: Record<string, string> = {};
      dbFollowRequests.forEach((fr: any) => {
        followRequestsMap[fr.id] = fr.status;
        followRequestsMap[`${fr.follower_user_id}_${fr.following_user_id}`] = fr.status;
      });

      const synthesizedNotifs: NotificationItem[] = [];
      for (const fr of dbFollowRequests) {
        if (fr.status === 'rejected') continue;
        if (!existingEntityIds.has(fr.id)) {
          const actorProfile =
            profilesMap[fr.follower_user_id] ||
            mockUsers.find((u) => u.id === fr.follower_user_id) || {
              id: fr.follower_user_id,
              name: 'User',
              username: 'user',
              role: 'Member',
              avatarUrl: null
            };
          const actorUsername = actorProfile.username ? `@${actorProfile.username}` : (actorProfile.name || 'user');

          const newNotifItem: NotificationItem = {
            id: `fr-notif-${fr.id}`,
            recipient_id: recipientId,
            actor_id: fr.follower_user_id,
            type: 'follow_request',
            title: 'Follow Request',
            message: `${actorUsername} sent you a follow request.`,
            entity_type: 'follow_request',
            entity_id: fr.id,
            is_read: fr.status !== 'pending',
            created_at: fr.created_at || new Date().toISOString(),
            actor: actorProfile,
            followRequestStatus: fr.status as 'accepted' | 'rejected' | 'pending'
          };

          synthesizedNotifs.push(newNotifItem);

          supabase
            .from('notifications')
            .insert([
              {
                recipient_id: recipientId,
                actor_id: fr.follower_user_id,
                type: 'follow_request',
                title: 'Follow Request',
                message: `${actorUsername} sent you a follow request.`,
                entity_type: 'follow_request',
                entity_id: fr.id,
                is_read: fr.status !== 'pending'
              }
            ])
            .then(() => {});
        }
      }

      // 5. Enrich existing database notifications with actor profiles & latest follow request statuses
      const enrichedDirectList: NotificationItem[] = existingNotifs.map((n: any) => {
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

        let followRequestStatus: 'accepted' | 'rejected' | 'pending' | null = null;
        if (n.type === 'follow_request') {
          followRequestStatus = (followRequestsMap[n.entity_id] ||
            followRequestsMap[`${n.actor_id}_${n.recipient_id}`] ||
            'pending') as 'accepted' | 'rejected' | 'pending';
        }

        return {
          ...n,
          actor,
          followRequestStatus
        };
      });

      const mergedMap = new Map<string, NotificationItem>();
      enrichedDirectList.forEach((n) => {
        const key = n.entity_id || n.id;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, n);
        }
      });
      synthesizedNotifs.forEach((n) => {
        const key = n.entity_id || n.id;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, n);
        }
      });

      // Merge with any fresh local notifications for recipient
      const localList = localNotifications.filter((n) => n.recipient_id === recipientId);
      localList.forEach((n) => {
        if (!mergedMap.has(n.entity_id || n.id)) {
          mergedMap.set(n.entity_id || n.id, n);
        }
      });

      const finalList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return finalList;
    } catch (e) {
      console.warn('[NotificationService] Supabase getNotifications exception, using local fallback:', e);
    }
  }

  return localNotifications
    .filter((n) => n.recipient_id === recipientId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const getUnreadNotificationCount = async (recipientId: string | null): Promise<number> => {
  const list = await getNotifications(recipientId);
  return list.filter((n) => !n.is_read).length;
};

export const markNotificationAsRead = async (notificationId: string, recipientId: string): Promise<void> => {
  if (!notificationId) return;

  if (isSupabaseConfigured && !notificationId.startsWith('n-') && !notificationId.startsWith('fr-notif-')) {
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

export const markAllNotificationsAsRead = async (recipientId: string | null): Promise<void> => {
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
}: CreateNotificationParams): Promise<any> => {
  if (!recipientId || !actorId || recipientId === actorId) {
    return null;
  }

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
      // Duplicate prevention check: only skip if an active unread notification already exists
      if (entityId) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', recipientId)
          .eq('actor_id', actorId)
          .eq('type', type)
          .eq('entity_id', String(entityId))
          .eq('is_read', false)
          .maybeSingle();

        if (existingNotif) {
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

      if (data) {
        const fullNotif = {
          ...data,
          actor,
          followRequestStatus: type === 'follow_request' ? 'pending' : null
        };
        localNotifications.unshift(fullNotif);
        notifyNotificationStateChange();

        // Dispatch Web Push notification to recipient
        const notifTitle = title || (type === 'follow_request' ? 'Follow Request' : type === 'follow_accepted' ? 'Follow Accepted' : 'Notification');
        const notifUrl = entityType === 'conversation' ? `/messages/${entityId}` : '/notifications';
        dispatchServerPushNotification({
          recipientId,
          type,
          title: notifTitle,
          message: finalMessage,
          url: notifUrl,
          entityType,
          entityId: String(entityId)
        }).catch(() => {});

        return { success: true, notification: fullNotif };
      }
    } catch (e) {
      console.warn('[NotificationService] Supabase createNotification exception:', e);
    }
  }

  // Local state cache
  const newNotif: NotificationItem = {
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

  const notifTitle = title || (type === 'follow_request' ? 'Follow Request' : type === 'follow_accepted' ? 'Follow Accepted' : 'Notification');
  const notifUrl = entityType === 'conversation' ? `/messages/${entityId}` : '/notifications';
  dispatchServerPushNotification({
    recipientId,
    type,
    title: notifTitle,
    message: finalMessage,
    url: notifUrl,
    entityType,
    entityId: String(entityId)
  }).catch(() => {});

  return { success: true, notification: newNotif };
};

export const subscribeToRealtimeNotifications = (
  recipientId: string | null,
  callback: (payload?: any) => void
): (() => void) => {
  if (!recipientId) return () => {};

  let pollTimer: NodeJS.Timeout | null = null;
  const channelName = `notifs_hub_${recipientId}_${Math.random().toString(36).substring(2, 7)}`;

  if (isSupabaseConfigured) {
    try {
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
          (payload: any) => {
            if (callback) callback(payload);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'follow_requests',
            filter: `following_user_id=eq.${recipientId}`
          },
          (payload: any) => {
            if (callback) callback(payload);
          }
        )
        .subscribe();

      pollTimer = setInterval(() => {
        if (callback) callback();
      }, 4000);

      return () => {
        if (pollTimer) clearInterval(pollTimer);
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('[NotificationService] Realtime notifications subscription error:', e);
    }
  }

  const unsubscribeLocal = subscribeToNotificationState(() => {
    if (callback) callback();
  });

  return () => {
    if (pollTimer) clearInterval(pollTimer);
    unsubscribeLocal();
  };
};
