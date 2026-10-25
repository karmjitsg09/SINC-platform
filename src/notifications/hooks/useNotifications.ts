import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToRealtimeNotifications
} from '../services/notificationService';

export interface NotificationActor {
  id: string;
  name?: string;
  username?: string;
  role?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
}

export interface SincNotification {
  id: string;
  recipient_id?: string;
  actor_id?: string;
  type: string;
  title?: string;
  message?: string;
  entity_type?: string;
  entity_id?: string;
  is_read?: boolean;
  read?: boolean;
  created_at: string;
  actor?: NotificationActor;
  followRequestStatus?: 'accepted' | 'rejected' | 'pending' | null;
  [key: string]: any;
}

export interface UseNotificationsResult {
  notifications: SincNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

export function useNotifications(currentUserId?: string | null): UseNotificationsResult {
  const [notifications, setNotifications] = useState<SincNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const list: SincNotification[] = await getNotifications(currentUserId);
    setNotifications(list || []);
    const unread = (list || []).filter((n) => !n.is_read && !n.read).length;
    setUnreadCount(unread);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadNotifications();

    if (!currentUserId) return;

    const unsubscribe = subscribeToRealtimeNotifications(currentUserId, () => {
      loadNotifications();
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUserId, loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    if (!currentUserId) return;
    await markNotificationAsRead(notificationId, currentUserId);
    await loadNotifications();
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    await markAllNotificationsAsRead(currentUserId);
    await loadNotifications();
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refreshNotifications: loadNotifications
  };
}
