import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface FormattedDomainMessage {
  id: string;
  text: string;
  userId: string;
  type: 'sent' | 'received';
  senderName: string;
  senderUsername: string | null;
  senderAvatar: string | null;
  createdAt: string;
  isPersisted: boolean;
}

export interface DomainMessageResult {
  messages: FormattedDomainMessage[];
  error: any;
}

export interface SendDomainMessageParams {
  domainId: string;
  channelId: string;
  userId: string;
  content: string;
  senderProfile?: {
    name?: string;
    username?: string | null;
    avatar_url?: string | null;
    avatarUrl?: string | null;
  };
}

export interface SendDomainMessageResult {
  success: boolean;
  message?: FormattedDomainMessage;
  error?: any;
}

export interface SubscribeDomainParams {
  domainId: string;
  channelId: string;
  currentUserId?: string;
  onMessage: (message: FormattedDomainMessage) => void;
}

/**
 * Storage key helper for domain channel message local caching
 */
const getStorageKey = (domainId: string, channelId: string): string =>
  `sync_domain_chat_domain_${domainId}_${channelId}`;

/**
 * Loads messages for a specific domain channel from Supabase.
 * Falls back to local storage cache if network is unavailable or table is loading.
 */
export async function getDomainMessages(
  domainId: string,
  channelId: string,
  currentUserId?: string
): Promise<DomainMessageResult> {
  if (!domainId || !channelId) {
    return { messages: [], error: null };
  }

  const storageKey = getStorageKey(domainId, channelId);
  let cached: FormattedDomainMessage[] = [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw) cached = JSON.parse(raw);
  } catch (e) {}

  if (!isSupabaseConfigured) {
    return { messages: cached, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('domain_messages')
      .select('id, domain_id, channel_id, user_id, content, created_at, profiles:user_id(id, name, avatar_url, username)')
      .eq('domain_id', domainId)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[domainMessageService] Query domain_messages note:', error.message || error);
      return { messages: cached, error };
    }

    if (data && Array.isArray(data)) {
      const formatted: FormattedDomainMessage[] = data.map((m: any) => ({
        id: m.id,
        text: m.content,
        userId: m.user_id,
        type: m.user_id === currentUserId ? 'sent' : 'received',
        senderName: m.profiles?.name || (m.user_id === currentUserId ? 'You' : 'Member'),
        senderUsername: m.profiles?.username || null,
        senderAvatar: m.profiles?.avatar_url || null,
        createdAt: m.created_at,
        isPersisted: true
      }));

      // Update cache
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(formatted));
        }
      } catch (e) {}

      return { messages: formatted, error: null };
    }

    return { messages: cached, error: null };
  } catch (err) {
    console.warn('[domainMessageService] getDomainMessages exception:', err);
    return { messages: cached, error: err };
  }
}

// Active Realtime channel cache
const activeChannelsMap = new Map<string, RealtimeChannel>();

function getOrCreateChannel(domainId: string, channelId: string): RealtimeChannel {
  const channelName = `domain_chat_sync_${domainId}_${channelId}`;
  if (activeChannelsMap.has(channelName)) {
    return activeChannelsMap.get(channelName)!;
  }
  const channel = supabase.channel(channelName);
  activeChannelsMap.set(channelName, channel);
  return channel;
}

/**
 * Sends a new message in a domain channel.
 * Persists to Supabase `domain_messages` table and broadcasts across the Realtime channel.
 */
export async function sendDomainMessage({
  domainId,
  channelId,
  userId,
  content,
  senderProfile = {}
}: SendDomainMessageParams): Promise<SendDomainMessageResult> {
  if (!content || !content.trim()) {
    return { success: false, error: new Error('Message content cannot be empty') };
  }
  if (!domainId || !channelId || !userId) {
    return { success: false, error: new Error('Missing domainId, channelId, or userId') };
  }

  const trimmed = content.trim();
  const tempId = `dm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();

  const optimisticMessage: FormattedDomainMessage = {
    id: tempId,
    text: trimmed,
    userId: userId,
    type: 'sent',
    senderName: senderProfile?.name || 'You',
    senderUsername: senderProfile?.username || null,
    senderAvatar: senderProfile?.avatar_url || senderProfile?.avatarUrl || null,
    createdAt: timestamp,
    isPersisted: false
  };

  // 1. Broadcast immediately to any active subscribers on this channel
  if (isSupabaseConfigured) {
    try {
      const channel = getOrCreateChannel(domainId, channelId);
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: tempId,
          domainId,
          channelId,
          userId,
          content: trimmed,
          senderName: senderProfile?.name || 'Member',
          senderUsername: senderProfile?.username || null,
          senderAvatar: senderProfile?.avatar_url || senderProfile?.avatarUrl || null,
          createdAt: timestamp
        }
      });
    } catch (bErr) {
      console.warn('[domainMessageService] Realtime broadcast notice:', bErr);
    }
  }

  // 2. Persist to database
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('domain_messages')
        .insert([
          {
            domain_id: domainId,
            channel_id: channelId,
            user_id: userId,
            content: trimmed
          }
        ])
        .select('id, created_at')
        .single();

      if (error) {
        console.warn('[domainMessageService] Insert error:', error.message || error);
        return {
          success: false,
          error,
          message: optimisticMessage
        };
      }

      const persistedMessage: FormattedDomainMessage = {
        ...optimisticMessage,
        id: data?.id || tempId,
        createdAt: data?.created_at || timestamp,
        isPersisted: true
      };

      return {
        success: true,
        message: persistedMessage,
        error: null
      };
    } catch (dbErr) {
      console.warn('[domainMessageService] Persistence exception:', dbErr);
      return {
        success: false,
        error: dbErr,
        message: optimisticMessage
      };
    }
  }

  return { success: true, message: optimisticMessage, error: null };
}

/**
 * Subscribes to realtime updates for a domain channel.
 * Uses both PostgreSQL change events and channel broadcast for ultra-reliable cross-account delivery.
 */
export function subscribeToDomainChannel({
  domainId,
  channelId,
  currentUserId,
  onMessage
}: SubscribeDomainParams): () => void {
  if (!isSupabaseConfigured || !domainId || !channelId) {
    return () => {};
  }

  const channelName = `domain_chat_sync_${domainId}_${channelId}`;
  const seenMessageIds = new Set<string>();

  const handleIncoming = (newMsg: any) => {
    if (!newMsg || !newMsg.id) return;
    if (seenMessageIds.has(newMsg.id)) return;
    seenMessageIds.add(newMsg.id);

    const isMine = newMsg.userId === currentUserId || newMsg.user_id === currentUserId;
    const formatted: FormattedDomainMessage = {
      id: newMsg.id,
      text: newMsg.content || newMsg.text,
      userId: newMsg.userId || newMsg.user_id,
      type: isMine ? 'sent' : 'received',
      senderName: isMine ? 'You' : (newMsg.senderName || newMsg.sender_name || 'Member'),
      senderUsername: newMsg.senderUsername || newMsg.sender_username || null,
      senderAvatar: newMsg.senderAvatar || newMsg.sender_avatar || null,
      createdAt: newMsg.createdAt || newMsg.created_at || new Date().toISOString(),
      isPersisted: true
    };

    onMessage(formatted);
  };

  const channel = getOrCreateChannel(domainId, channelId);

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'domain_messages',
        filter: `domain_id=eq.${domainId}`
      },
      (payload: any) => {
        if (payload?.new && payload.new.channel_id === channelId) {
          handleIncoming({
            id: payload.new.id,
            user_id: payload.new.user_id,
            content: payload.new.content,
            created_at: payload.new.created_at
          });
        }
      }
    )
    .on('broadcast', { event: 'new_message' }, (payload: any) => {
      if (payload?.payload && payload.payload.channelId === channelId) {
        handleIncoming(payload.payload);
      }
    })
    .subscribe((status, err) => {
      if (err) {
        console.warn(`[domainMessageService] Subscription error on ${channelName}:`, err);
      }
    });

  return () => {
    try {
      activeChannelsMap.delete(channelName);
      supabase.removeChannel(channel);
    } catch (e) {}
  };
}
