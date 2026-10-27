import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToRealtimeNotifications
} from '../services/notificationService';

export function useNotifications(currentUserId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const list = await getNotifications(currentUserId);
    setNotifications(list);
    const unread = list.filter((n) => !n.is_read).length;
    setUnreadCount(unread);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadNotifications();

    const unsubscribe = subscribeToRealtimeNotifications(currentUserId, () => {
      loadNotifications();
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, loadNotifications]);

  const markAsRead = async (notificationId) => {
    await markNotificationAsRead(notificationId, currentUserId);
    loadNotifications();
  };

  const markAllAsRead = async () => {
    await markAllNotificationsAsRead(currentUserId);
    loadNotifications();
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
