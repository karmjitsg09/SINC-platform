import { useState, useEffect, useCallback } from 'react';
import { getMessages, sendMessage as sendMessageApi } from '../services/messageService';
import { subscribeToRealtimeMessages, subscribeToTyping, sendTypingNotification } from '../services/realtimeService';

export function useMessages(conversationId, currentUserId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!conversationId || !currentUserId) {
        setMessages([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const msgs = await getMessages(conversationId, currentUserId);
      if (isMounted) {
        setMessages(msgs);
        setLoading(false);
      }
    }

    load();

    const pollInterval = setInterval(async () => {
      if (!isMounted || !conversationId || !currentUserId) return;
      const latest = await getMessages(conversationId, currentUserId);
      if (isMounted && latest) {
        setMessages((prev) => {
          if (latest.length !== prev.length || (latest.length > 0 && latest[latest.length - 1]?.id !== prev[prev.length - 1]?.id)) {
            return latest;
          }
          return prev;
        });
      }
    }, 2500);

    const unsubMessages = subscribeToRealtimeMessages(conversationId, currentUserId, (newMsg) => {
      if (!isMounted) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    const unsubTyping = subscribeToTyping(conversationId, ({ userId, isTyping }) => {
      if (!isMounted || userId === currentUserId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      unsubMessages();
      unsubTyping();
    };
  }, [conversationId, currentUserId]);

  const sendMessage = useCallback(
    async (text, messageType = 'text') => {
      if (!text || !text.trim() || !conversationId) return null;

      // Send typing stop broadcast
      sendTypingNotification(conversationId, currentUserId, false);

      const sentMsg = await sendMessageApi(conversationId, currentUserId, text, messageType);
      if (sentMsg && !sentMsg.error) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        return sentMsg;
      } else if (sentMsg && sentMsg.error) {
        console.error('FAILED TO PERSIST MESSAGE TO SUPABASE DB:', sentMsg.error);
        return null;
      }
      return sentMsg;
    },
    [conversationId, currentUserId]
  );

  const setTyping = useCallback(
    (isTyping) => {
      if (conversationId && currentUserId) {
        sendTypingNotification(conversationId, currentUserId, isTyping);
      }
    },
    [conversationId, currentUserId]
  );

  return { messages, loading, sendMessage, setTyping, isTyping: typingUsers.size > 0 };
}
