import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { users as mockUsers } from '../../data/mockData';
import { notifyMessagingStateChange, localConversations, localMessages, localConversationMembers } from './realtimeService';

function isUuid(str) {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export const getConversations = async (currentUserId) => {
  if (!currentUserId) return [];

  if (isSupabaseConfigured && isUuid(currentUserId)) {
    try {
      // 1. Select ONLY verified columns from conversation_members
      const { data: myMembers, error: memErr } = await supabase
        .from('conversation_members')
        .select('id, conversation_id, user_id, created_at')
        .eq('user_id', currentUserId);

      if (memErr) {
        console.error('[CONVERSATION MEMBERS QUERY ERROR]', {
          message: memErr?.message,
          code: memErr?.code,
          details: memErr?.details,
          hint: memErr?.hint
        });
        return [];
      }

      if (myMembers && myMembers.length > 0) {
        const convIds = Array.from(new Set(myMembers.map((m) => m.conversation_id)));

        // 2. Select ONLY verified columns from conversations
        const { data: convRows, error: convErr } = await supabase
          .from('conversations')
          .select('id, created_at, updated_at, last_message_id')
          .in('id', convIds)
          .order('updated_at', { ascending: false });

        if (convErr) {
          console.error('[CONVERSATION QUERY ERROR]', {
            message: convErr?.message,
            code: convErr?.code,
            details: convErr?.details,
            hint: convErr?.hint
          });
        }

        // 3. Get all participant members for these conversations
        const { data: allMembers, error: allMemErr } = await supabase
          .from('conversation_members')
          .select('id, conversation_id, user_id, created_at')
          .in('conversation_id', convIds);

        if (allMemErr) {
          console.error('[ALL MEMBERS QUERY ERROR]', {
            message: allMemErr?.message,
            code: allMemErr?.code,
            details: allMemErr?.details,
            hint: allMemErr?.hint
          });
        }

        const otherUserIds = Array.from(
          new Set((allMembers || []).filter((m) => m.user_id !== currentUserId).map((m) => m.user_id))
        );

        // 4. Fetch profiles for other users
        let profilesMap = new Map();
        if (otherUserIds.length > 0) {
          const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('id, name, username, role, avatar_url')
            .in('id', otherUserIds);

          if (profErr) {
            console.error('[PROFILES QUERY ERROR]', {
              message: profErr?.message,
              code: profErr?.code,
              details: profErr?.details,
              hint: profErr?.hint
            });
          } else if (profiles) {
            profiles.forEach((p) => profilesMap.set(p.id, p));
          }
        }

        // 5. Fetch all messages for these conversations
        const { data: messages, error: msgsErr } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true });

        if (msgsErr) {
          console.error('[MESSAGES BATCH QUERY ERROR]', {
            message: msgsErr?.message,
            code: msgsErr?.code,
            details: msgsErr?.details,
            hint: msgsErr?.hint
          });
        }

        const messagesByConv = new Map();
        (messages || []).forEach((msg) => {
          if (!messagesByConv.has(msg.conversation_id)) {
            messagesByConv.set(msg.conversation_id, []);
          }
          messagesByConv.get(msg.conversation_id).push(msg);
        });

        const activeConvRows = convRows || convIds.map((id) => ({ id }));

        return activeConvRows.map((c) => {
          const otherMember = (allMembers || []).find((m) => m.conversation_id === c.id && m.user_id !== currentUserId);
          const otherProfile = otherMember ? profilesMap.get(otherMember.user_id) : null;
          const convMsgs = messagesByConv.get(c.id) || [];
          const lastMsg = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : null;

          const lastReadIso = typeof window !== 'undefined'
            ? localStorage.getItem(`read_${currentUserId}_${c.id}`)
            : null;
          const lastReadTime = lastReadIso ? new Date(lastReadIso).getTime() : 0;

          const unreadMsgs = convMsgs.filter(
            (m) => m.sender_id !== currentUserId && new Date(m.created_at).getTime() > lastReadTime
          );
          const unreadCount = unreadMsgs.length;

          return {
            id: c.id,
            type: 'direct',
            title: otherProfile?.name || 'Conversation',
            name: otherProfile?.name || 'User',
            username: otherProfile?.username || '',
            avatarUrl: otherProfile?.avatar_url || null,
            lastMessage: lastMsg ? lastMsg.content : 'No messages yet',
            time: lastMsg ? formatTimeAgo(lastMsg.created_at) : 'Just now',
            unreadCount,
            isUnread: unreadCount > 0,
            isMuted: false,
            otherUser: otherProfile
              ? {
                  id: otherProfile.id,
                  name: otherProfile.name || 'User',
                  username: otherProfile.username || '',
                  role: otherProfile.role || 'Member',
                  avatarUrl: otherProfile.avatar_url || null,
                  avatar_url: otherProfile.avatar_url || null
                }
              : { id: otherMember?.user_id, name: 'User' }
          };
        });
      }
    } catch (e) {
      console.error('Supabase getConversations exception:', e);
      return [];
    }
  }

  // Local state fallback ONLY for mock mode
  return localConversations.map((c) => {
    const msgs = localMessages[c.id] || [];
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const other = c.otherUser || mockUsers.find((u) => u.id !== currentUserId && c.members?.includes(u.id)) || {
      name: c.name || 'User',
      username: 'user'
    };

    return {
      id: c.id,
      type: c.type || 'direct',
      title: c.title || other.name || 'Conversation',
      name: other.name || c.name || 'User',
      username: other.username || '',
      avatarUrl: other.avatarUrl || null,
      lastMessage: lastMsg ? lastMsg.text : c.lastMessage || 'No messages yet',
      time: lastMsg ? formatTimeAgo(lastMsg.created_at) : c.time || 'Just now',
      unreadCount: 0,
      isUnread: false,
      isMuted: false,
      otherUser: other
    };
  });
};

export const getOrCreateDirectConversation = async (currentUserId, targetUserId, targetUserObj = null) => {
  if (!currentUserId || !targetUserId) return null;

  if (isSupabaseConfigured && isUuid(currentUserId) && isUuid(targetUserId)) {
    try {
      console.log('[CONVERSATION STEP]', {
        step: 'init_check',
        currentUserId,
        targetUserId
      });

      // Get authenticated user directly from Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.getUser();
      console.log('[AUTH CHECK]', {
        userId: authData?.user?.id,
        email: authData?.user?.email,
        error: authError
      });

      // Profile Check for both users
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', [currentUserId, targetUserId]);

      console.log('[PROFILES VERIFICATION]', {
        profiles: profilesData,
        error: profilesErr ? { message: profilesErr.message, code: profilesErr.code } : null
      });

      const targetProfile = (profilesData || []).find((p) => p.id === targetUserId);
      const resolvedOtherUser = targetProfile
        ? {
            id: targetProfile.id,
            name: targetProfile.name || targetProfile.username || 'User',
            username: targetProfile.username || '',
            role: 'Member',
            avatarUrl: null,
            avatar_url: null
          }
        : targetUserObj;

      // 1. Find conversation_members for currentUserId
      console.log('[CONVERSATION STEP]', {
        step: 'find_user_memberships',
        currentUserId,
        targetUserId
      });

      const { data: userMemberships, error: memErr1 } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      if (memErr1) {
        console.error('[MEMBERSHIP SELECT ERROR]', {
          message: memErr1?.message,
          code: memErr1?.code,
          details: memErr1?.details,
          hint: memErr1?.hint
        });
      }

      if (userMemberships && userMemberships.length > 0) {
        const convIds = userMemberships.map((m) => m.conversation_id);

        console.log('[CONVERSATION STEP]', {
          step: 'find_shared_memberships',
          currentUserId,
          targetUserId,
          convIds
        });

        // 2. Find conversation_members for targetUserId in convIds
        const { data: sharedMemberships, error: memErr2 } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', convIds);

        if (memErr2) {
          console.error('[CONVERSATION MEMBERS TARGET QUERY ERROR]', {
            message: memErr2?.message,
            code: memErr2?.code,
            details: memErr2?.details,
            hint: memErr2?.hint
          });
        }

        if (sharedMemberships && sharedMemberships.length > 0) {
          const sharedConvId = sharedMemberships[0].conversation_id;

          // 3. Verify conversation exists in public.conversations
          const { data: convRow, error: memErr3 } = await supabase
            .from('conversations')
            .select('id, created_at, updated_at, last_message_id')
            .eq('id', sharedConvId)
            .maybeSingle();

          if (memErr3) {
            console.error('[CONVERSATION QUERY ERROR]', {
              message: memErr3?.message,
              code: memErr3?.code,
              details: memErr3?.details,
              hint: memErr3?.hint
            });
          }

          if (convRow) {
            console.log('[CONVERSATION FOUND]', {
              conversationId: convRow.id,
              currentUserId,
              targetUserId,
              profile: resolvedOtherUser
            });

            return {
              id: convRow.id,
              targetUserId,
              name: resolvedOtherUser?.name || 'User',
              avatarUrl: resolvedOtherUser?.avatarUrl || resolvedOtherUser?.avatar_url || null,
              otherUser: resolvedOtherUser
            };
          }
        }
      }

      console.log('[CONVERSATION STEP]', {
        step: 'create_new_conversation',
        currentUserId,
        targetUserId
      });

      // 4. Generate client-side UUID to avoid SELECT RLS race conditions
      const newConvId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      console.log('[CONVERSATION INSERT PRE-FLIGHT]', {
        conversationId: newConvId,
        currentUserId,
        targetUserId
      });

      const { error: convInsertError } = await supabase
        .from('conversations')
        .insert([
          {
            id: newConvId,
            created_at: createdAt
          }
        ]);

      console.log('[CONVERSATION INSERT RESULT]', {
        data: convInsertError ? null : { id: newConvId, created_at: createdAt },
        error: convInsertError
          ? {
              message: convInsertError.message,
              code: convInsertError.code,
              details: convInsertError.details,
              hint: convInsertError.hint
            }
          : null
      });

      if (convInsertError) {
        console.error('[CONVERSATION INSERT ERROR]', {
          message: convInsertError.message,
          code: convInsertError.code,
          details: convInsertError.details,
          hint: convInsertError.hint
        });
        return { error: convInsertError.message || 'Failed to insert conversation row' };
      }

      console.log('[CONVERSATION CREATED]', { id: newConvId, created_at: createdAt });

      console.log('[CONVERSATION STEP]', {
        step: 'insert_memberships',
        conversationId: newConvId,
        currentUserId,
        targetUserId
      });

      // 5. Insert BOTH rows into conversation_members without triggering SELECT RLS on target member
      const { error: membersError } = await supabase
        .from('conversation_members')
        .insert([
          {
            conversation_id: newConvId,
            user_id: currentUserId
          },
          {
            conversation_id: newConvId,
            user_id: targetUserId
          }
        ]);

      console.log('[MEMBERSHIP INSERT RESULT]', {
        success: !membersError,
        error: membersError
          ? {
              message: membersError.message,
              code: membersError.code,
              details: membersError.details,
              hint: membersError.hint
            }
          : null
      });

      if (membersError) {
        console.error('[MEMBERSHIP INSERT ERROR]', {
          message: membersError.message,
          code: membersError.code,
          details: membersError.details,
          hint: membersError.hint
        });
        return { error: membersError.message || 'Failed to insert conversation members' };
      }

      // 6. Verify membership after insert
      const { data: verifyMembers, error: verifyError } = await supabase
        .from('conversation_members')
        .select('id, conversation_id, user_id, created_at')
        .eq('conversation_id', newConvId);

      console.log('[MEMBERSHIP VERIFY]', {
        conversationId: newConvId,
        members: verifyMembers,
        error: verifyError
      });

      // 7. Verify conversation
      const { data: verifyConversation, error: verifyConvErr } = await supabase
        .from('conversations')
        .select('id, created_at, updated_at, last_message_id')
        .eq('id', newConvId)
        .single();

      console.log('[CONVERSATION VERIFY]', {
        conversationId: newConvId,
        conversation: verifyConversation,
        error: verifyConvErr
      });

      return {
        id: newConvId,
        targetUserId,
        name: resolvedOtherUser?.name || 'User',
        avatarUrl: resolvedOtherUser?.avatarUrl || resolvedOtherUser?.avatar_url || null,
        otherUser: resolvedOtherUser
      };
    } catch (e) {
      console.error('Supabase getOrCreateDirectConversation exception:', e);
      return { error: e.message || 'Exception in getOrCreateDirectConversation' };
    }
  }

  // Local fallback ONLY for non-UUID mock state
  const pairKey = [currentUserId, targetUserId].sort().join('-');
  let existing = localConversations.find(
    (c) => c.type === 'direct' && c.members?.includes(currentUserId) && c.members?.includes(targetUserId)
  );

  if (!existing) {
    const targetInfo = targetUserObj || mockUsers.find((u) => u.id === targetUserId) || {
      id: targetUserId,
      name: 'User',
      username: 'user'
    };

    existing = {
      id: `c-${pairKey}`,
      type: 'direct',
      members: [currentUserId, targetUserId],
      otherUser: targetInfo,
      lastMessage: 'Conversation started',
      time: 'Just now',
      unreadCount: 0,
      updated_at: new Date().toISOString()
    };
    localConversations.unshift(existing);
    localMessages[existing.id] = [];
    localConversationMembers[existing.id] = {
      [currentUserId]: { last_read_at: new Date().toISOString() },
      [targetUserId]: { last_read_at: new Date().toISOString() }
    };
    notifyMessagingStateChange();
  }

  return existing;
};

export const markConversationAsRead = async (conversationId, currentUserId) => {
  if (!conversationId || !currentUserId) return;
  const readTime = new Date().toISOString();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`read_${currentUserId}_${conversationId}`, readTime);
    } catch (e) {
      console.warn('Failed to save read state', e);
    }
  }
  notifyMessagingStateChange();
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
