import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { notifyMessagingStateChange, localConversations, localMessages } from './realtimeService';

function isUuid(str) {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export const getMessages = async (conversationId, currentUserId) => {
  if (!conversationId) return [];

  if (isSupabaseConfigured && isUuid(conversationId)) {
    try {
      console.log('[MESSAGE LOAD PRE-FLIGHT]', { conversationId, currentUserId });
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      console.log('[MESSAGE LOAD RESULT]', { conversationId, messageCount: data?.length || 0, messages: data, error });

      if (error) {
        console.error('SUPABASE GET MESSAGES ERROR:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }

      if (!error && data) {
        return data.map((m) => ({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          text: m.content,
          type: m.sender_id === currentUserId ? 'sent' : 'received',
          message_type: m.message_type || 'text',
          status: 'read',
          created_at: m.created_at
        }));
      }
    } catch (e) {
      console.error('Supabase getMessages exception:', e);
    }
  }

  return (localMessages[conversationId] || []).map((m) => ({
    ...m,
    type: m.sender_id === currentUserId ? 'sent' : 'received',
    status: m.status || 'read'
  }));
};

export const sendMessage = async (conversationId, senderId, text, messageType = 'text') => {
  if (!conversationId || !text || !text.trim() || !senderId) return null;

  const content = text.trim();
  const createdAt = new Date().toISOString();

  if (isSupabaseConfigured && isUuid(conversationId) && isUuid(senderId)) {
    try {
      console.log('[MESSAGE INSERT PRE-FLIGHT]', { conversationId, senderId, content });
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            conversation_id: conversationId,
            sender_id: senderId,
            content: content
          }
        ])
        .select('*')
        .single();

      console.log('[MESSAGE INSERT RESULT]', { data, error });

      if (error) {
        console.error('[MESSAGE INSERT ERROR]', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
        return { error: error.message || 'Database insert failed' };
      }

      if (data) {
        console.log('[MESSAGE INSERT SUCCESS]', {
          databaseMessageId: data.id,
          conversationId: data.conversation_id,
          senderId: data.sender_id,
          content: data.content
        });

        // Attempt updating conversation timestamp
        try {
          await supabase
            .from('conversations')
            .update({ updated_at: createdAt })
            .eq('id', conversationId);
        } catch (e) {
          // Ignore conversation timestamp update warning
        }

        return {
          id: data.id,
          conversation_id: data.conversation_id,
          sender_id: data.sender_id,
          text: data.content,
          type: 'sent',
          message_type: 'text',
          status: 'sent',
          created_at: data.created_at
        };
      }
    } catch (e) {
      console.error('Supabase sendMessage exception:', e);
      return { error: e.message || 'Exception while inserting message' };
    }
  }

  // Local fallback for mock state
  const newMsg = {
    id: `m-${Date.now()}`,
    conversation_id: conversationId,
    sender_id: senderId,
    text: content,
    type: 'sent',
    message_type: messageType,
    status: 'read',
    created_at: createdAt
  };

  if (!localMessages[conversationId]) {
    localMessages[conversationId] = [];
  }
  localMessages[conversationId].push(newMsg);

  const conv = localConversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.lastMessage = content;
    conv.time = 'Just now';
    conv.updated_at = createdAt;
  }

  notifyMessagingStateChange();
  return newMsg;
};
