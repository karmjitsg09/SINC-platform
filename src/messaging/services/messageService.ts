import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { notifyMessagingStateChange, localConversations, localMessages, localConversationMembers } from './realtimeService';
import { dispatchServerPushNotification } from '../../lib/pushNotificationService';
import type { Message } from '@/types';

function isUuid(str: string): boolean {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export type SendMessageResult = (Message & { error?: string }) | { error: string; id?: undefined };

export const getMessages = async (
  conversationId: string | null | undefined,
  currentUserId: string | null | undefined
): Promise<Message[]> => {
  if (!conversationId) return [];

  if (isSupabaseConfigured && isUuid(conversationId)) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('SUPABASE GET MESSAGES ERROR:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }

      if (!error && data) {
        return data.map((m: any) => ({
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

export const sendMessage = async (
  conversationId: string | null | undefined,
  senderId: string | null | undefined,
  text: string,
  messageType: string = 'text'
): Promise<any> => {
  if (!conversationId || !text || !text.trim() || !senderId) return null;

  const content = text.trim();
  const createdAt = new Date().toISOString();

  if (isSupabaseConfigured && isUuid(conversationId) && isUuid(senderId)) {
    try {
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
        // Attempt updating conversation timestamp
        try {
          await supabase
            .from('conversations')
            .update({ updated_at: createdAt })
            .eq('id', conversationId);
        } catch (e) {
          // Ignore conversation timestamp update warning
        }

        // Asynchronously dispatch push notification to conversation recipient
        (async () => {
          try {
            const { data: members } = await supabase
              .from('conversation_members')
              .select('user_id')
              .eq('conversation_id', conversationId);

            const recipient = (members || []).find((m: any) => m.user_id !== senderId);
            if (recipient?.user_id) {
              const { data: senderProf } = await supabase
                .from('profiles')
                .select('name, username')
                .eq('id', senderId)
                .maybeSingle();

              const senderName = senderProf?.name || (senderProf?.username ? `@${senderProf.username}` : 'Direct Message');
              const previewText = content.length > 80 ? content.slice(0, 77) + '...' : content;

              dispatchServerPushNotification({
                recipientId: recipient.user_id,
                type: 'message',
                title: senderName,
                message: previewText,
                url: `/messages/${conversationId}`,
                entityType: 'conversation',
                entityId: conversationId
              });
            }
          } catch (pushErr) {
            console.warn('[messageService] Push trigger error:', pushErr);
          }
        })();

        return {
          id: data.id,
          conversation_id: data.conversation_id,
          sender_id: data.sender_id,
          text: data.content,
          type: 'sent',
          status: 'sent',
          created_at: data.created_at
        };
      }
    } catch (e: any) {
      console.error('Supabase sendMessage exception:', e);
      return { error: e.message || 'Exception while inserting message' };
    }
  }

  // Local fallback for mock state
  const newMsg: Message = {
    id: `m-${Date.now()}`,
    conversation_id: conversationId,
    sender_id: senderId,
    text: content,
    type: 'sent',
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

  // Dispatch push for mock conversation if other member exists
  const members = Object.keys(localConversationMembers?.[conversationId] || {});
  const otherMember = members.find((uid) => uid !== senderId);
  if (otherMember) {
    const previewText = content.length > 80 ? content.slice(0, 77) + '...' : content;
    dispatchServerPushNotification({
      recipientId: otherMember,
      type: 'message',
      title: 'Direct Message',
      message: previewText,
      url: `/messages/${conversationId}`,
      entityType: 'conversation',
      entityId: conversationId
    });
  }

  notifyMessagingStateChange();
  return newMsg;
};
