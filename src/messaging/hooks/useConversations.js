import { useState, useEffect } from 'react';
import { getConversations, markConversationAsRead } from '../services/conversationService';
import { subscribeToMessagingState, subscribeToAllNewMessages } from '../services/realtimeService';

export function useConversations(currentUserId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

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
        setConversations(list);
        setLoading(false);
      }
    }

    load();

    const unsubState = subscribeToMessagingState(() => {
      load();
    });

    const unsubRealtime = subscribeToAllNewMessages(currentUserId, (newMsg) => {
      if (!isMounted) return;
      if (newMsg.type === 'local_update') {
        load();
        return;
      }

      console.log('[REALTIME MESSAGE]', {
        conversationId: newMsg.conversation_id,
        senderId: newMsg.sender_id
      });

      console.log('[UNREAD MESSAGE]', {
        messageId: newMsg.id,
        conversationId: newMsg.conversation_id,
        senderId: newMsg.sender_id,
        currentUserId
      });

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
      unsubState();
      unsubRealtime();
    };
  }, [currentUserId]);

  const markAsRead = async (conversationId) => {
    if (!conversationId) return;
    console.log('[MARK CONVERSATION READ]', {
      conversationId,
      currentUserId
    });
    await markConversationAsRead(conversationId, currentUserId);
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0, isUnread: false } : c))
    );
  };

  const unreadTotal = conversations.filter((c) => c.isUnread || c.unreadCount > 0).length;
  const hasUnreadMessages = unreadTotal > 0;

  useEffect(() => {
    if (currentUserId && !loading) {
      console.log('[UNREAD STATE]', {
        unreadTotal,
        unreadConversations: conversations.filter((c) => c.isUnread || c.unreadCount > 0).map((c) => c.id)
      });
    }
  }, [unreadTotal, conversations, currentUserId, loading]);

  return { conversations, loading, markAsRead, unreadTotal, hasUnreadMessages };
}
