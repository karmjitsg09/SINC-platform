import { useState, useEffect } from 'react';
import { getConversations, markConversationAsRead } from '../services/conversationService';
import { subscribeToMessagingState, subscribeToAllNewMessages } from '../services/realtimeService';

export interface ConversationItem {
  id: string;
  name?: string;
  lastMessage?: string;
  time?: string;
  unreadCount?: number;
  isUnread?: boolean;
  otherUser?: any;
  targetUserId?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface UseConversationsResult {
  conversations: ConversationItem[];
  loading: boolean;
  markAsRead: (conversationId: string) => Promise<void>;
  unreadTotal: number;
  unreadCount: number;
  hasUnreadMessages: boolean;
}

export function useConversations(currentUserId?: string | null): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function load() {
      const list = await getConversations(currentUserId);
      if (isMounted) {
        setConversations(list || []);
        setLoading(false);
      }
    }

    load();

    const unsubState = subscribeToMessagingState(() => {
      load();
    });

    const unsubRealtime = subscribeToAllNewMessages(currentUserId, (newMsg: any) => {
      if (!isMounted) return;
      if (newMsg?.type === 'local_update') {
        load();
        return;
      }

      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === newMsg.conversation_id);
        if (index === -1) {
          load();
          return prev;
        }

        const target = prev[index];
        const updatedTarget = {
          ...target,
          lastMessage: newMsg.content || newMsg.text || target.lastMessage,
          time: 'Just now',
          unreadCount: (target.unreadCount || 0) + 1,
          isUnread: true
        };

        const remaining = prev.filter((_, i) => i !== index);
        return [updatedTarget, ...remaining];
      });
    });

    return () => {
      isMounted = false;
      if (typeof unsubState === 'function') unsubState();
      if (typeof unsubRealtime === 'function') unsubRealtime();
    };
  }, [currentUserId]);

  const markAsRead = async (conversationId: string) => {
    if (!conversationId) return;
    await markConversationAsRead(conversationId, currentUserId);
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0, isUnread: false } : c))
    );
  };

  const unreadTotal = conversations.filter((c) => c.isUnread || (c.unreadCount ?? 0) > 0).length;
  const hasUnreadMessages = unreadTotal > 0;

  return { conversations, loading, markAsRead, unreadTotal, unreadCount: unreadTotal, hasUnreadMessages };
}
