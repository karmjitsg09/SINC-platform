import { supabase, isSupabaseConfigured } from './supabase';
import { users as mockUsers } from '../data/mockData';
import { createNotification } from '../notifications/services/notificationService';

// Dynamic database availability flag
let dbTablesExist = false;

// Check table availability on load
async function checkDbAvailability() {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('messages').select('id').limit(1);
    if (!error) {
      dbTablesExist = true;
    }
  } catch (e) {
    dbTablesExist = false;
  }
}
checkDbAvailability();

// In-memory reactive state for mock mode & fallback state
let localFollowRequests = [
  { id: 'fr-1', follower_user_id: 'u1', following_user_id: 'u3', status: 'accepted', created_at: new Date().toISOString() },
  { id: 'fr-2', follower_user_id: 'u2', following_user_id: 'u1', status: 'pending', created_at: new Date().toISOString() },
  { id: 'fr-3', follower_user_id: 'u1', following_user_id: 'u6', status: 'accepted', created_at: new Date().toISOString() }
];

let localConversations = [
  {
    id: 'c-u1-u6',
    members: ['u1', 'u6'],
    otherUser: { id: 'u6', name: 'Jordan Vance', username: 'jordanv', role: 'Product Designer', avatarUrl: null },
    lastMessage: 'Hey, are you joining the design review?',
    time: '2m',
    unread: true,
    updated_at: new Date(Date.now() - 120000).toISOString()
  },
  {
    id: 'c-u1-u3',
    members: ['u1', 'u3'],
    otherUser: { id: 'u3', name: 'Maya Patel', username: 'mayap', role: 'Digital Marketer', avatarUrl: null },
    lastMessage: "Let's discuss the project marketing strategy",
    time: '1h',
    unread: false,
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '1',
    name: 'Rahul Sharma',
    members: ['u1', 'u2'],
    otherUser: { id: 'u2', name: 'Rahul Sharma', username: 'rahul_dev', role: 'Software Developer', avatarUrl: null },
    lastMessage: 'Thanks! Exciting to be here.',
    time: '1h',
    unread: false,
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '2',
    name: 'Arun Kumar',
    members: ['u1', 'u4'],
    otherUser: { id: 'u4', name: 'Arun Kumar', username: 'arunkumar', role: 'Frontend Developer', avatarUrl: null },
    lastMessage: 'Are you joining the event tomorrow?',
    time: '1h',
    unread: false,
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '3',
    name: 'Sarah Jenkins',
    members: ['u1', 'u7'],
    otherUser: { id: 'u7', name: 'Sarah Jenkins', username: 'sarahj', role: 'Brand Strategist', avatarUrl: null },
    lastMessage: 'Thanks for the help!',
    time: '3h',
    unread: false,
    updated_at: new Date(Date.now() - 10800000).toISOString()
  }
];

let localMessages = {
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

const listeners = new Set();
const notifyListeners = () => {
  listeners.forEach((fn) => fn());
};

export const subscribeToLocalState = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ==========================================
// SEARCH PROFILES SERVICE
// ==========================================
export const searchProfiles = async (query = '', currentUserId = '') => {
  const qClean = query.replace(/^@/, '').toLowerCase().trim();

  if (isSupabaseConfigured) {
    try {
      let req = supabase.from('profiles').select('*');
      if (qClean) {
        req = req.or(`name.ilike.%${qClean}%,username.ilike.%${qClean}%,role.ilike.%${qClean}%`);
      }
      const { data, error } = await req;
      
      console.log('PROFILE SEARCH TERM:', query);
      console.log('PROFILE SEARCH DATA:', data);
      if (error) {
        console.error('PROFILE SEARCH SUPABASE ERROR:', error);
      }

      if (!error && data) {
        const dbProfiles = data.map((p) => ({
          id: p.id,
          name: p.name || 'User',
          username: p.username || 'user',
          role: p.role || 'Member',
          bio: p.bio || '',
          avatarUrl: p.avatar_url || null,
          avatar_url: p.avatar_url || null,
          skills: p.skills || [],
          domains: p.domains || [],
          is_verified: Boolean(p.is_verified),
          privacy_settings: p.privacy_settings || {}
        }));

        const otherMatches = dbProfiles.filter((u) => u.id !== currentUserId);
        // If authenticated with a real Supabase user, return DB results without mock fallbacks
        if (currentUserId && !currentUserId.startsWith('u1') && !currentUserId.startsWith('u-')) {
          return otherMatches;
        }
        return otherMatches.length > 0 ? otherMatches : dbProfiles;
      }
    } catch (e) {
      console.error('Supabase profile search error:', e);
    }
  }

  // Fallback to mock users only if Supabase is unconfigured or in mock mode
  const filteredMock = mockUsers.filter((u) => {
    if (u.id === currentUserId) return false;
    if (!qClean) return true;
    const matchName = u.name?.toLowerCase().includes(qClean);
    const matchUsername = u.username?.toLowerCase().includes(qClean);
    const matchRole = (u.role || u.profession || '').toLowerCase().includes(qClean);
    const matchSkill = u.skills?.some((s) => s.toLowerCase().includes(qClean));
    const matchDomain = u.domains?.some((d) => d.toLowerCase().includes(qClean));
    return matchName || matchUsername || matchRole || matchSkill || matchDomain;
  });

  return filteredMock;
};

// ==========================================
// FOLLOW REQUEST SERVICE
// ==========================================
export const getFollowStatus = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { status: 'self', request: null };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('follow_requests')
        .select('*')
        .or(`and(follower_user_id.eq.${currentUserId},following_user_id.eq.${targetUserId}),and(follower_user_id.eq.${targetUserId},following_user_id.eq.${currentUserId})`)
        .maybeSingle();

      if (!error && data) {
        if (data.status === 'accepted') {
          return { status: 'accepted', request: data };
        }
        if (data.follower_user_id === currentUserId) {
          return { status: 'pending_sent', request: data };
        } else {
          return { status: 'pending_received', request: data };
        }
      }
    } catch (e) {
      console.warn('Supabase getFollowStatus error:', e);
    }
  }

  // Local fallback state
  const req = localFollowRequests.find(
    (r) =>
      (r.follower_user_id === currentUserId && r.following_user_id === targetUserId) ||
      (r.follower_user_id === targetUserId && r.following_user_id === currentUserId)
  );

  if (!req) return { status: 'none', request: null };
  if (req.status === 'accepted') return { status: 'accepted', request: req };
  if (req.follower_user_id === currentUserId) return { status: 'pending_sent', request: req };
  return { status: 'pending_received', request: req };
};

export const sendFollowRequest = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { success: false, error: 'Cannot follow yourself or invalid user IDs' };
  }

  console.log('[socialService] sendFollowRequest:', { currentUserId, targetUserId });

  if (isSupabaseConfigured) {
    try {
      // 1. Check if a follow request already exists in Supabase
      const { data: existing, error: existingErr } = await supabase
        .from('follow_requests')
        .select('*')
        .eq('follower_user_id', currentUserId)
        .eq('following_user_id', targetUserId)
        .maybeSingle();

      if (existingErr) {
        console.error('[socialService] Error checking existing follow request:', existingErr);
        return { success: false, error: existingErr.message };
      }

      // Helper to fetch sender profile for notification attribution
      const getSenderProfile = async () => {
        try {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url, role')
            .eq('id', currentUserId)
            .maybeSingle();
          if (pData) {
            const senderName = pData.username || pData.name || 'user';
            return {
              username: senderName,
              profile: {
                id: pData.id,
                name: pData.name || senderName,
                username: pData.username || senderName,
                role: pData.role || 'Member',
                avatarUrl: pData.avatar_url || null,
                avatar_url: pData.avatar_url || null
              }
            };
          }
        } catch (e) {}
        return { username: 'user', profile: null };
      };

      if (existing) {
        console.log('[socialService] Existing follow request found:', existing);
        if (existing.status === 'pending') {
          return { success: true, status: 'pending', request: existing };
        }
        if (existing.status === 'accepted') {
          return { success: true, status: 'accepted', request: existing };
        }

        // If previously rejected, allow re-requesting
        const { data: updatedReq, error: updateErr } = await supabase
          .from('follow_requests')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateErr) {
          console.error('[socialService] Error resetting follow request:', updateErr);
          return { success: false, error: updateErr.message };
        }

        const { username: senderUsername, profile: senderProfile } = await getSenderProfile();
        await createNotification({
          recipientId: targetUserId,
          actorId: currentUserId,
          type: 'follow_request',
          title: 'Follow Request',
          message: `@${senderUsername} sent you a follow request.`,
          entityType: 'follow_request',
          entityId: updatedReq.id,
          actorObj: senderProfile
        });

        notifyListeners();
        return { success: true, status: 'pending', request: updatedReq };
      }

      // 2. Insert new follow request into Supabase
      const { data: newReq, error: insertErr } = await supabase
        .from('follow_requests')
        .insert([{ follower_user_id: currentUserId, following_user_id: targetUserId, status: 'pending' }])
        .select()
        .single();

      if (insertErr) {
        console.error('[socialService] Error inserting follow request:', insertErr);
        return { success: false, error: insertErr.message };
      }

      // 3. Immediately create notification for recipient
      const { username: senderUsername, profile: senderProfile } = await getSenderProfile();
      await createNotification({
        recipientId: targetUserId,
        actorId: currentUserId,
        type: 'follow_request',
        title: 'Follow Request',
        message: `@${senderUsername} sent you a follow request.`,
        entityType: 'follow_request',
        entityId: newReq.id,
        actorObj: senderProfile
      });

      notifyListeners();
      return { success: true, status: 'pending', request: newReq };
    } catch (e) {
      console.error('[socialService] sendFollowRequest exception:', e);
      return { success: false, error: e.message || 'Failed to send follow request' };
    }
  }

  // Local fallback state
  let existingReq = localFollowRequests.find(
    (r) => r.follower_user_id === currentUserId && r.following_user_id === targetUserId
  );
  if (!existingReq) {
    existingReq = {
      id: `fr-${Date.now()}`,
      follower_user_id: currentUserId,
      following_user_id: targetUserId,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    localFollowRequests.push(existingReq);
    notifyListeners();
  }

  await createNotification({
    recipientId: targetUserId,
    actorId: currentUserId,
    type: 'follow_request',
    title: 'Follow Request',
    message: `@${currentUserId} sent you a follow request.`,
    entityType: 'follow_request',
    entityId: existingReq.id
  });

  return { success: true, status: 'pending', request: existingReq };
};

export const respondToFollowRequest = async (requestId, currentUserId, targetUserId, newStatus) => {
  console.log('[socialService] respondToFollowRequest:', { requestId, currentUserId, targetUserId, newStatus });

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('follow_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() });

      let cleanReqId = requestId;
      if (cleanReqId && typeof cleanReqId === 'string' && cleanReqId.startsWith('fr-notif-')) {
        cleanReqId = cleanReqId.replace('fr-notif-', '');
      }

      if (cleanReqId && !cleanReqId.startsWith('fr-')) {
        query = query.eq('id', cleanReqId).eq('following_user_id', currentUserId);
      } else {
        query = query.eq('follower_user_id', targetUserId).eq('following_user_id', currentUserId);
      }

      const { data: updatedReq, error } = await query.select().maybeSingle();
      if (error) {
        console.error('[socialService] Error responding to follow request:', error);
        return { success: false, error: error.message };
      }

      // Mark the recipient's follow request notification as read
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_id', currentUserId)
          .eq('actor_id', targetUserId)
          .eq('type', 'follow_request');

        if (cleanReqId) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('recipient_id', currentUserId)
            .eq('entity_id', cleanReqId);
        }
      } catch (err) {
        console.warn('[socialService] Error marking notification read:', err);
      }

      // If accepted, notify the original requester
      if (newStatus === 'accepted') {
        let responderUsername = 'user';
        let responderProfile = null;
        try {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url, role')
            .eq('id', currentUserId)
            .maybeSingle();
          if (pData) {
            responderUsername = pData.username || pData.name || 'user';
            responderProfile = {
              id: pData.id,
              name: pData.name || responderUsername,
              username: pData.username || responderUsername,
              role: pData.role || 'Member',
              avatarUrl: pData.avatar_url || null,
              avatar_url: pData.avatar_url || null
            };
          }
        } catch (e) {}

        await createNotification({
          recipientId: targetUserId,
          actorId: currentUserId,
          type: 'follow_accepted',
          title: 'Follow Accepted',
          message: `@${responderUsername} accepted your follow request.`,
          entityType: 'user',
          entityId: currentUserId,
          actorObj: responderProfile
        });
      }

      notifyListeners();
      return { success: true, status: newStatus, request: updatedReq };
    } catch (e) {
      console.error('[socialService] respondToFollowRequest exception:', e);
      return { success: false, error: e.message || 'Failed to respond to follow request' };
    }
  }

  // Local fallback state
  localFollowRequests = localFollowRequests.map((r) => {
    if (
      (r.id === requestId) ||
      (r.follower_user_id === targetUserId && r.following_user_id === currentUserId)
    ) {
      return { ...r, status: newStatus, updated_at: new Date().toISOString() };
    }
    return r;
  });
  notifyListeners();

  if (newStatus === 'accepted') {
    await createNotification({
      recipientId: targetUserId,
      actorId: currentUserId,
      type: 'follow_accepted',
      title: 'Follow Accepted',
      message: 'accepted your follow request',
      entityType: 'user',
      entityId: currentUserId
    });
  }

  return { success: true, status: newStatus };
};

// ==========================================
// CONVERSATIONS & CHAT SERVICE
// ==========================================

export const getOrCreateConversation = async (currentUserId, targetUserId, targetUserObj = null) => {
  if (!currentUserId || !targetUserId) return null;

  if (isSupabaseConfigured && dbTablesExist) {
    try {
      const { data: userMemberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      if (userMemberships && userMemberships.length > 0) {
        const convIds = userMemberships.map((m) => m.conversation_id);
        const { data: sharedMemberships } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', convIds);

        if (sharedMemberships && sharedMemberships.length > 0) {
          const existingConvId = sharedMemberships[0].conversation_id;
          return { id: existingConvId, targetUserId, otherUser: targetUserObj };
        }
      }

      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert([{}])
        .select()
        .single();

      if (!convErr && newConv) {
        await supabase.from('conversation_members').insert([
          { conversation_id: newConv.id, user_id: currentUserId },
          { conversation_id: newConv.id, user_id: targetUserId }
        ]);
        return { id: newConv.id, targetUserId, otherUser: targetUserObj };
      }
    } catch (e) {
      console.warn('Supabase getOrCreateConversation error, falling back to local state.', e);
    }
  }

  // Local fallback
  const pairKey = [currentUserId, targetUserId].sort().join('-');
  let existing = localConversations.find(
    (c) => c.members.includes(currentUserId) && c.members.includes(targetUserId)
  );

  if (!existing) {
    const targetInfo = targetUserObj || mockUsers.find((u) => u.id === targetUserId) || {
      id: targetUserId,
      name: 'User',
      username: 'user',
      role: 'Member'
    };

    existing = {
      id: `c-${pairKey}`,
      members: [currentUserId, targetUserId],
      otherUser: targetInfo,
      lastMessage: 'Conversation started',
      time: 'Just now',
      unread: false,
      updated_at: new Date().toISOString()
    };
    localConversations.unshift(existing);
    localMessages[existing.id] = [];
    notifyListeners();
  }

  return existing;
};

export const getConversationsList = async (currentUserId = 'u1') => {
  if (isSupabaseConfigured && dbTablesExist) {
    try {
      const { data: members, error } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      if (!error && members && members.length > 0) {
        const convIds = members.map((m) => m.conversation_id);
        const { data: convs } = await supabase
          .from('conversations')
          .select('*, conversation_members(user_id, profiles(*)), messages(*)')
          .in('id', convIds)
          .order('updated_at', { ascending: false });

        if (convs) {
          return convs.map((c) => {
            const otherMember = c.conversation_members?.find((m) => m.user_id !== currentUserId);
            const otherProfile = otherMember?.profiles;
            const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
            return {
              id: c.id,
              name: otherProfile?.name || 'User',
              username: otherProfile?.username || '',
              avatarUrl: otherProfile?.avatar_url || null,
              lastMessage: lastMsg ? lastMsg.content : 'No messages yet',
              time: lastMsg ? formatTimeAgo(lastMsg.created_at) : 'Just now',
              otherUser: otherProfile || { id: otherMember?.user_id, name: 'User' }
            };
          });
        }
      }
    } catch (e) {
      console.warn('Supabase fetch conversations list failed, using local fallback.', e);
    }
  }

  // Local fallback
  return localConversations.map((c) => {
    const other = c.otherUser || mockUsers.find((u) => u.id !== currentUserId && c.members?.includes(u.id)) || {
      name: c.name || 'User',
      username: 'user'
    };
    return {
      id: c.id,
      name: other.name || c.name || 'User',
      username: other.username || '',
      avatarUrl: other.avatarUrl || null,
      lastMessage: c.lastMessage,
      time: c.time,
      unread: c.unread,
      otherUser: other
    };
  });
};

export const getMessagesForConversation = async (conversationId, currentUserId = 'u1') => {
  if (!conversationId) return [];

  if (isSupabaseConfigured && dbTablesExist && !conversationId.startsWith('c-')) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        return data.map((m) => ({
          id: m.id,
          text: m.content,
          type: m.sender_id === currentUserId ? 'sent' : 'received',
          sender_id: m.sender_id,
          created_at: m.created_at
        }));
      }
    } catch (e) {
      console.warn('Supabase messages query error, using local fallback.', e);
    }
  }

  return localMessages[conversationId] || [];
};

export const sendMessage = async (conversationId, senderId, text) => {
  if (!conversationId || !text || !text.trim()) return null;

  const content = text.trim();
  const created_at = new Date().toISOString();

  if (isSupabaseConfigured && dbTablesExist && !conversationId.startsWith('c-')) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{ conversation_id: conversationId, sender_id: senderId, content }])
        .select()
        .single();

      if (!error && data) {
        await supabase
          .from('conversations')
          .update({ updated_at: created_at })
          .eq('id', conversationId);

        return {
          id: data.id,
          text: data.content,
          type: 'sent',
          sender_id: senderId,
          created_at: data.created_at
        };
      }
    } catch (e) {
      console.warn('Supabase sendMessage error, updating local state.', e);
    }
  }

  // Local fallback
  const newMsg = {
    id: `m-${Date.now()}`,
    conversation_id: conversationId,
    sender_id: senderId,
    text: content,
    type: 'sent',
    created_at
  };

  if (!localMessages[conversationId]) {
    localMessages[conversationId] = [];
  }
  localMessages[conversationId].push(newMsg);

  // Update conversation preview
  const conv = localConversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.lastMessage = content;
    conv.time = 'Just now';
    conv.updated_at = created_at;
  }

  notifyListeners();
  return newMsg;
};

// Realtime messaging subscription helper
export const subscribeToMessages = (conversationId, onNewMessage) => {
  if (isSupabaseConfigured && dbTablesExist && !conversationId.startsWith('c-')) {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.new) {
            onNewMessage({
              id: payload.new.id,
              text: payload.new.content,
              type: payload.new.sender_id === 'u1' ? 'sent' : 'received',
              sender_id: payload.new.sender_id,
              created_at: payload.new.created_at
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Local state listener
  const unsubscribe = subscribeToLocalState(() => {
    const msgs = localMessages[conversationId] || [];
    if (msgs.length > 0) {
      const latest = msgs[msgs.length - 1];
      onNewMessage(latest);
    }
  });

  return unsubscribe;
};

const loadLocalPosts = () => {
  try {
    const saved = localStorage.getItem('sync_platform_posts');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load posts from localStorage', e);
  }
  return [
    {
      id: 'post-1',
      author_id: 'u1',
      author: 'Alex Rivers',
      role: 'Senior Developer',
      avatar_url: null,
      title: 'Building Modern Scalable Web Applications',
      content: 'Excited to announce our new component-driven design system. Clean architecture and fast database queries make all the difference.',
      domain_id: 'tech',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      likes_count: 12,
      comments_count: 3
    }
  ];
};

let localPosts = loadLocalPosts();

const saveLocalPosts = () => {
  try {
    localStorage.setItem('sync_platform_posts', JSON.stringify(localPosts));
  } catch (e) {
    console.warn('Failed to save posts to localStorage', e);
  }
};

let globalPostsChannel = null;

export const initGlobalPostsRealtime = () => {
  if (isSupabaseConfigured && !globalPostsChannel) {
    try {
      globalPostsChannel = supabase.channel('global_posts_channel');
      globalPostsChannel
        .on('broadcast', { event: 'new_post' }, (payload) => {
          if (payload.payload) {
            const post = payload.payload;
            const exists = localPosts.some((p) => p.id === post.id);
            if (!exists) {
              localPosts.unshift(post);
              saveLocalPosts();
              notifyListeners();
            }
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime global_posts_channel error', e);
    }
  }
};
initGlobalPostsRealtime();

export const createPost = async ({
  authorId,
  authorName,
  authorRole,
  avatarUrl,
  title,
  content,
  domainId = 'tech',
  mediaType = 'none',
  mediaUrl = null,
  codeSnippet = null,
  codeLanguage = null
}) => {
  if (!authorId || (!title && !content)) return null;

  const effectiveType = mediaType === 'image' || mediaType === 'video' ? mediaType : mediaUrl ? 'image' : 'text';

  const payload = {
    user_id: authorId,
    content: (content || title || '').trim(),
    image_url: effectiveType === 'image' ? mediaUrl : null,
    video_url: effectiveType === 'video' ? mediaUrl : null,
    domain: (domainId || 'tech').toLowerCase(),
    post_type: effectiveType
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([payload])
        .select('*, profiles:user_id(id, name, role, avatar_url)')
        .single();

      if (!error && data) {
        return {
          id: data.id,
          user_id: data.user_id,
          author_id: data.user_id,
          author: data.profiles?.name || authorName || 'User',
          role: data.profiles?.role || authorRole || 'Member',
          avatar_url: data.profiles?.avatar_url || avatarUrl || null,
          title: data.content?.substring(0, 50) || title || 'Post',
          content: data.content || content,
          domain_id: data.domain || domainId,
          mediaType: data.post_type || mediaType,
          mediaUrl: data.image_url || data.video_url || mediaUrl,
          created_at: data.created_at
        };
      }
    } catch (e) {
      console.warn('Supabase createPost exception:', e);
    }
  }

  return null;
};

export const getUserPosts = async (userId, userObj = null) => {
  if (!userId && !userObj) return [];
  const targetId = userId || userObj?.id;

  if (isSupabaseConfigured && targetId) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:user_id(id, name, role, avatar_url)')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          author_id: p.user_id,
          author: p.profiles?.name || userObj?.name || 'User',
          role: p.profiles?.role || userObj?.role || 'Member',
          avatar_url: p.profiles?.avatar_url || userObj?.avatar_url || null,
          title: p.content?.substring(0, 50) || 'Post',
          content: p.content || '',
          domain_id: p.domain || 'tech',
          mediaType: p.post_type || (p.image_url ? 'image' : p.video_url ? 'video' : 'none'),
          mediaUrl: p.image_url || p.video_url || null,
          created_at: p.created_at
        }));
      }
    } catch (e) {
      console.warn('Supabase getUserPosts exception:', e);
    }
  }

  return [];
};

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
