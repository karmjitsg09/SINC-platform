import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { users as mockUsers } from '../../data/mockData';

// Shared local reactive state
export let localConversations = [
  {
    id: 'c-u1-u6',
    type: 'direct',
    members: ['u1', 'u6'],
    otherUser: { id: 'u6', name: 'Jordan Vance', username: 'jordanv', role: 'Product Designer', avatarUrl: null },
    lastMessage: 'Hey, are you joining the design review?',
    time: '2m',
    unreadCount: 1,
    updated_at: new Date(Date.now() - 120000).toISOString()
  },
  {
    id: 'c-u1-u3',
    type: 'direct',
    members: ['u1', 'u3'],
    otherUser: { id: 'u3', name: 'Maya Patel', username: 'mayap', role: 'Digital Marketer', avatarUrl: null },
    lastMessage: "Let's discuss the project marketing strategy",
    time: '1h',
    unreadCount: 0,
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '1',
    type: 'direct',
    name: 'Rahul Sharma',
    members: ['u1', 'u2'],
    otherUser: { id: 'u2', name: 'Rahul Sharma', username: 'rahul_dev', role: 'Software Developer', avatarUrl: null },
    lastMessage: 'Thanks! Exciting to be here.',
    time: '1h',
    unreadCount: 0,
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '2',
    type: 'direct',
    name: 'Arun Kumar',
    members: ['u1', 'u4'],
    otherUser: { id: 'u4', name: 'Arun Kumar', username: 'arunkumar', role: 'Frontend Developer', avatarUrl: null },
    lastMessage: 'Are you joining the event tomorrow?',
    time: '1h',
    unreadCount: 0,
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '3',
    type: 'direct',
    name: 'Sarah Jenkins',
    members: ['u1', 'u7'],
    otherUser: { id: 'u7', name: 'Sarah Jenkins', username: 'sarahj', role: 'Brand Strategist', avatarUrl: null },
    lastMessage: 'Thanks for the help!',
    time: '3h',
    unreadCount: 0,
    updated_at: new Date(Date.now() - 10800000).toISOString()
  }
];

export let localMessages = {
  '1': [
    { id: 'm-10', conversation_id: '1', sender_id: 'u2', text: 'Hi Alex, welcome to the platform!', type: 'received', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 'm-11', conversation_id: '1', sender_id: 'u1', text: 'Thanks! Exciting to be here.', type: 'sent', created_at: new Date(Date.now() - 3600000).toISOString() }
  ],
  '2': [
    { id: 'm-20', conversation_id: '2', sender_id: 'u4', text: 'Are you joining the event tomorrow?', type: 'received', created_at: new Date(Date.now() - 3600000).toISOString() }
  ],
  '3': [
    { id: 'm-30', conversation_id: '3', sender_id: 'u7', text: 'Thanks for the help!', type: 'received', created_at: new Date(Date.now() - 10800000).toISOString() }
  ],
  'c-u1-u3': [
    { id: 'm-1', conversation_id: 'c-u1-u3', sender_id: 'u3', text: 'Hi Alex! Loved your recent post on architecture.', type: 'received', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 'm-2', conversation_id: 'c-u1-u3', sender_id: 'u1', text: "Thanks Maya! Appreciate it. Let's collaborate.", type: 'sent', created_at: new Date(Date.now() - 5400000).toISOString() },
    { id: 'm-3', conversation_id: 'c-u1-u3', sender_id: 'u3', text: "Let's discuss the project marketing strategy", type: 'received', created_at: new Date(Date.now() - 3600000).toISOString() }
  ],
  'c-u1-u6': [
    { id: 'm-4', conversation_id: 'c-u1-u6', sender_id: 'u6', text: 'Hey, are you joining the design review?', type: 'received', created_at: new Date(Date.now() - 120000).toISOString() }
  ]
};

export let localConversationMembers = {
  'c-u1-u6': {
    'u1': { last_read_at: new Date(Date.now() - 300000).toISOString() },
    'u6': { last_read_at: new Date(Date.now() - 100000).toISOString() }
  },
  'c-u1-u3': {
    'u1': { last_read_at: new Date().toISOString() },
    'u3': { last_read_at: new Date().toISOString() }
  }
};

const stateListeners = new Set();
export const notifyMessagingStateChange = () => {
  stateListeners.forEach((fn) => fn());
};

export const subscribeToMessagingState = (fn) => {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
};

// Typing indicator ephemeral tracking
const typingTimeouts = new Map();
const typingListeners = new Map();

export const sendTypingNotification = (conversationId, userId, isTyping) => {
  if (!conversationId || !userId) return;

  if (isSupabaseConfigured) {
    try {
      const channel = supabase.channel(`typing:${conversationId}`);
      channel.send({
        type: 'broadcast',
        event: 'typing_indicator',
        payload: { userId, isTyping }
      });
    } catch (e) {
      // Local Broadcast fallback
    }
  }

  // Local Broadcast handling
  const listeners = typingListeners.get(conversationId);
  if (listeners) {
    listeners.forEach((fn) => fn({ userId, isTyping }));
  }

  if (isTyping) {
    if (typingTimeouts.has(`${conversationId}-${userId}`)) {
      clearTimeout(typingTimeouts.get(`${conversationId}-${userId}`));
    }
    const timeout = setTimeout(() => {
      sendTypingNotification(conversationId, userId, false);
    }, 3000);
    typingTimeouts.set(`${conversationId}-${userId}`, timeout);
  }
};

export const subscribeToTyping = (conversationId, callback) => {
  if (!conversationId) return () => {};

  if (!typingListeners.has(conversationId)) {
    typingListeners.set(conversationId, new Set());
  }
  typingListeners.get(conversationId).add(callback);

  if (isSupabaseConfigured) {
    try {
      const channel = supabase
        .channel(`typing:${conversationId}`)
        .on('broadcast', { event: 'typing_indicator' }, (payload) => {
          if (payload.payload) {
            callback(payload.payload);
          }
        })
        .subscribe();

      return () => {
        typingListeners.get(conversationId)?.delete(callback);
        supabase.removeChannel(channel);
      };
    } catch (e) {
      // Fallback
    }
  }

  return () => {
    typingListeners.get(conversationId)?.delete(callback);
  };
};

export const subscribeToRealtimeMessages = (conversationId, currentUserId, onNewMessage) => {
  let userId = currentUserId;
  let callback = onNewMessage;
  if (typeof currentUserId === 'function') {
    callback = currentUserId;
    userId = null;
  }

  if (isSupabaseConfigured && conversationId && !conversationId.startsWith('c-')) {
    try {
      const channelName = `chat_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            console.log('[REALTIME CHAT EVENT RECEIVED]:', payload.new);
            if (payload.new && callback) {
              callback({
                id: payload.new.id,
                conversation_id: payload.new.conversation_id,
                sender_id: payload.new.sender_id,
                text: payload.new.content,
                type: payload.new.sender_id === userId ? 'sent' : 'received',
                message_type: payload.new.message_type || 'text',
                created_at: payload.new.created_at
              });
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[REALTIME CHAT SUBSCRIPTION STATUS]:', channelName, status, err || '');
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime subscription error, using local fallback.', e);
    }
  }

  // Local fallback
  return subscribeToMessagingState(() => {
    const msgs = localMessages[conversationId] || [];
    if (msgs.length > 0 && callback) {
      const latest = msgs[msgs.length - 1];
      callback(latest);
    }
  });
};

export const subscribeToAllNewMessages = (currentUserId, onNewMessage) => {
  if (!currentUserId) return () => {};

  if (isSupabaseConfigured && typeof currentUserId === 'string' && !currentUserId.startsWith('u')) {
    try {
      const channelName = `all_msgs_${currentUserId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          (payload) => {
            if (payload.new && payload.new.sender_id !== currentUserId && onNewMessage) {
              onNewMessage({
                id: payload.new.id,
                conversation_id: payload.new.conversation_id,
                sender_id: payload.new.sender_id,
                text: payload.new.content,
                content: payload.new.content,
                created_at: payload.new.created_at
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('Realtime subscribeToAllNewMessages error', e);
    }
  }

  return subscribeToMessagingState(() => {
    if (onNewMessage) {
      onNewMessage({ type: 'local_update' });
    }
  });
};
