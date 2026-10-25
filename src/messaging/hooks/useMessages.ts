import { useState, useEffect, useCallback } from 'react';
import { getMessages, sendMessage as sendMessageApi } from '../services/messageService';
import { subscribeToRealtimeMessages, subscribeToTyping, sendTypingNotification } from '../services/realtimeService';
import { Message } from '../../types';

export interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  sendMessage: (text: string, messageType?: string) => Promise<Message | null>;
  setTyping: (isTyping: boolean) => void;
  isTyping: boolean;
}

export function useMessages(conversationId?: string | null, currentUserId?: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    // Immediately reset messages and typing state on conversation switch to prevent stale display
    setMessages([]);
    setTypingUsers(new Set());

    async function load() {
      if (!conversationId || !currentUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const msgs = await getMessages(conversationId, currentUserId);
      if (isMounted) {
        setMessages(msgs || []);
        setLoading(false);
      }
    }

    load();

    // Throttled fallback check (10s) to reconcile state if a WebSocket event drops
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
    }, 10000);

    const unsubMessages = subscribeToRealtimeMessages(conversationId, currentUserId, (newMsg: any) => {
      if (!isMounted) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    const unsubTyping = subscribeToTyping(conversationId, ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
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
      if (typeof unsubMessages === 'function') unsubMessages();
      if (typeof unsubTyping === 'function') unsubTyping();
    };
  }, [conversationId, currentUserId]);

  const sendMessage = useCallback(
    async (text: string, messageType: string = 'text'): Promise<Message | null> => {
      if (!text || !text.trim() || !conversationId) return null;

      // Send typing stop broadcast
      sendTypingNotification(conversationId, currentUserId, false);

      const sentMsg = await sendMessageApi(conversationId, currentUserId, text, messageType);
      if (sentMsg && !sentMsg.error) {
        const castMsg = sentMsg as any as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === castMsg.id)) return prev;
          return [...prev, castMsg];
        });
        return castMsg;
      } else if (sentMsg && sentMsg.error) {
        console.error('FAILED TO PERSIST MESSAGE TO SUPABASE DB:', sentMsg.error);
        return null;
      }
      return (sentMsg as any as Message) || null;
    },
    [conversationId, currentUserId]
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (conversationId && currentUserId) {
        sendTypingNotification(conversationId, currentUserId, isTyping);
      }
    },
    [conversationId, currentUserId]
  );

  return { messages, loading, sendMessage, setTyping, isTyping: typingUsers.size > 0 };
}
