import { supabase, isSupabaseConfigured } from './supabase';
import { createNotification } from '../notifications/services/notificationService';
import { users as mockUsers } from '../data/mockData';
import { getOrCreateDirectConversation } from '../messaging/services/conversationService';
import { sendMessage } from '../messaging/services/messageService';

// ============================================================
// 1. GET SUMMARY OF ALL POST INTERACTIONS
// ============================================================
export const getPostInteractionSummary = async (postId, currentUserId = null) => {
  if (!postId) {
    return {
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      saveCount: 0,
      likedByMe: false,
      savedByMe: false
    };
  }

  let likeCount = 0;
  let commentCount = 0;
  let shareCount = 0;
  let saveCount = 0;
  let likedByMe = false;
  let savedByMe = false;

  if (isSupabaseConfigured && !postId.startsWith('post-')) {
    try {
      // Likes
      const { count: lCount, error: lErr } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (!lErr && typeof lCount === 'number') likeCount = lCount;

      if (currentUserId) {
        const { data: uLike } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        likedByMe = !!uLike;
      }

      // Comments
      const { count: cCount, error: cErr } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (!cErr && typeof cCount === 'number') commentCount = cCount;

      // Shares
      const { count: shCount, error: shErr } = await supabase
        .from('post_shares')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (!shErr && typeof shCount === 'number') shareCount = shCount;

      // Saves
      const { count: svCount, error: svErr } = await supabase
        .from('post_saves')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (!svErr && typeof svCount === 'number') saveCount = svCount;

      if (currentUserId) {
        const { data: uSave } = await supabase
          .from('post_saves')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', currentUserId)
          .maybeSingle();
        savedByMe = !!uSave;
      }
    } catch (e) {
      console.warn('[PostInteractionService] getPostInteractionSummary exception:', e);
    }
  }

  return {
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    likedByMe,
    savedByMe
  };
};

// ============================================================
// 1B. GET BATCH SUMMARY OF INTERACTIONS FOR MULTIPLE POSTS
// Consolidates hundreds of individual queries into 4 parallel queries
// ============================================================
export const getBatchPostInteractionSummaries = async (postIds = [], currentUserId = null) => {
  const summaryMap = {};
  if (!Array.isArray(postIds) || postIds.length === 0) return summaryMap;

  // Initialize clean defaults for every requested post ID
  postIds.forEach((id) => {
    if (id) {
      summaryMap[id] = {
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        saveCount: 0,
        likedByMe: false,
        savedByMe: false
      };
    }
  });

  const validUuids = postIds.filter((id) => id && !id.startsWith('post-'));
  if (!isSupabaseConfigured || validUuids.length === 0) {
    return summaryMap;
  }

  try {
    const [likesRes, commentsRes, savesRes, sharesRes] = await Promise.all([
      supabase.from('post_likes').select('post_id, user_id').in('post_id', validUuids),
      supabase.from('post_comments').select('post_id').in('post_id', validUuids),
      supabase.from('post_saves').select('post_id, user_id').in('post_id', validUuids),
      supabase.from('post_shares').select('post_id').in('post_id', validUuids)
    ]);

    (likesRes.data || []).forEach((r) => {
      if (summaryMap[r.post_id]) {
        summaryMap[r.post_id].likeCount++;
        if (currentUserId && r.user_id === currentUserId) {
          summaryMap[r.post_id].likedByMe = true;
        }
      }
    });

    (commentsRes.data || []).forEach((r) => {
      if (summaryMap[r.post_id]) {
        summaryMap[r.post_id].commentCount++;
      }
    });

    (savesRes.data || []).forEach((r) => {
      if (summaryMap[r.post_id]) {
        summaryMap[r.post_id].saveCount++;
        if (currentUserId && r.user_id === currentUserId) {
          summaryMap[r.post_id].savedByMe = true;
        }
      }
    });

    (sharesRes.data || []).forEach((r) => {
      if (summaryMap[r.post_id]) {
        summaryMap[r.post_id].shareCount++;
      }
    });
  } catch (err) {
    console.warn('[PostInteractionService] getBatchPostInteractionSummaries exception:', err);
  }

  return summaryMap;
};

// ============================================================
// 2. LIKE / UNLIKE POST
// ============================================================
export const likePost = async (postId, userId, authorId = null) => {
  if (!postId || !userId) throw new Error('Authenticated user ID required to like posts.');

  let likedState = false;

  if (isSupabaseConfigured && !postId.startsWith('post-')) {
    try {
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingLike) {
        await supabase.from('post_likes').delete().eq('id', existingLike.id);
        likedState = false;
      } else {
        await supabase.from('post_likes').insert([{ post_id: postId, user_id: userId }]);
        likedState = true;

        if (authorId && authorId !== userId) {
          createNotification({
            recipientId: authorId,
            actorId: userId,
            type: 'post_like',
            title: 'Post Liked',
            message: 'liked your post',
            entityType: 'post',
            entityId: postId
          });
        }
      }
    } catch (e) {
      console.error('[PostInteractionService] likePost error:', e);
    }
  }

  const summary = await getPostInteractionSummary(postId, userId);
  return {
    liked: likedState,
    count: summary.likeCount
  };
};

export const getLikeCount = async (postId) => {
  if (!postId || !isSupabaseConfigured) return 0;
  try {
    const { count, error } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (!error && typeof count === 'number') return count;
  } catch (e) {}
  return 0;
};

export const hasUserLiked = async (postId, userId) => {
  if (!postId || !userId || !isSupabaseConfigured) return false;
  try {
    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  } catch (e) {}
  return false;
};

export const getPostLikers = async (postId) => {
  if (!postId || !isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('id, created_at, user_id, profile:user_id(id, name, username, role, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PostInteractionService] getPostLikers error:', error);
      throw error;
    }

    if (data) {
      return data
        .filter((item) => item && item.profile)
        .map((item) => ({
          id: item.profile.id,
          name: item.profile.name || 'User',
          username: item.profile.username || 'user',
          role: item.profile.role || 'Member',
          avatarUrl: item.profile.avatar_url || null,
          avatar_url: item.profile.avatar_url || null,
          liked_at: item.created_at
        }));
    }
  } catch (e) {
    console.error('[PostInteractionService] getPostLikers exception:', e);
    throw e;
  }

  return [];
};

// ============================================================
// 3. COMMENTS
// ============================================================
export const addComment = async (postId, userId, content, authorId = null) => {
  if (!postId || !userId) throw new Error('Authenticated user ID required to comment.');
  const cleanContent = (content || '').trim();
  if (!cleanContent) throw new Error('Comment content cannot be empty.');

  let createdComment = null;

  if (isSupabaseConfigured && !postId.startsWith('post-')) {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert([{ post_id: postId, user_id: userId, content: cleanContent }])
        .select('*, profile:user_id(id, name, username, role, avatar_url)')
        .single();

      if (error) {
        console.error('[PostInteractionService] addComment error:', error);
      } else if (data) {
        createdComment = {
          id: data.id,
          post_id: data.post_id,
          user_id: data.user_id,
          content: data.content,
          created_at: data.created_at,
          profile: {
            id: data.profile?.id || userId,
            name: data.profile?.name || 'User',
            username: data.profile?.username || 'user',
            role: data.profile?.role || 'Member',
            avatar_url: data.profile?.avatar_url || null
          }
        };

        if (authorId && authorId !== userId) {
          createNotification({
            recipientId: authorId,
            actorId: userId,
            type: 'post_comment',
            title: 'New Comment',
            message: `commented: "${cleanContent.substring(0, 30)}${cleanContent.length > 30 ? '...' : ''}"`,
            entityType: 'post',
            entityId: postId
          });
        }
      }
    } catch (e) {
      console.error('[PostInteractionService] addComment exception:', e);
    }
  }

  return createdComment;
};

export const getComments = async (postId) => {
  if (!postId) return [];

  if (isSupabaseConfigured && !postId.startsWith('post-')) {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, profile:user_id(id, name, username, role, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        return data.map((c) => ({
          id: c.id,
          post_id: c.post_id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          profile: {
            id: c.profile?.id || c.user_id,
            name: c.profile?.name || 'User',
            username: c.profile?.username || 'user',
            role: c.profile?.role || 'Member',
            avatar_url: c.profile?.avatar_url || null
          }
        }));
      }
    } catch (e) {
      console.warn('[PostInteractionService] getComments exception:', e);
    }
  }

  return [];
};

export const getCommentCount = async (postId) => {
  if (!postId || !isSupabaseConfigured) return 0;
  try {
    const { count, error } = await supabase
      .from('post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (!error && typeof count === 'number') return count;
  } catch (e) {}
  return 0;
};

export const deleteComment = async (commentId, userId) => {
  if (!commentId || !userId) return false;

  if (isSupabaseConfigured && !commentId.startsWith('c-')) {
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) {
        console.error('[PostInteractionService] deleteComment error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[PostInteractionService] deleteComment exception:', e);
    }
  }

  return false;
};

// ============================================================
// 4. TOGGLE SAVE POST
// ============================================================
export const toggleSavePost = async (postId, userId) => {
  if (!postId || !userId) throw new Error('Authenticated user ID required to save posts.');

  let savedState = false;

  if (isSupabaseConfigured && !postId.startsWith('post-')) {
    try {
      const { data: existingSave } = await supabase
        .from('post_saves')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSave) {
        await supabase.from('post_saves').delete().eq('id', existingSave.id);
        savedState = false;
      } else {
        await supabase.from('post_saves').insert([{ post_id: postId, user_id: userId }]);
        savedState = true;
      }
    } catch (e) {
      console.error('[PostInteractionService] toggleSavePost error:', e);
    }
  }

  const summary = await getPostInteractionSummary(postId, userId);
  return {
    saved: savedState,
    count: summary.saveCount
  };
};

export const hasUserSaved = async (postId, userId) => {
  if (!postId || !userId || !isSupabaseConfigured) return false;
  try {
    const { data } = await supabase
      .from('post_saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  } catch (e) {}
  return false;
};

// ============================================================
// 5. IN-APP USER-TO-USER SHARING
// ============================================================
export const getAppProfiles = async (currentUserId, searchQuery = '') => {
  let list = [];

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, username, role, avatar_url')
        .neq('id', currentUserId);

      if (searchQuery.trim()) {
        const q = `%${searchQuery.trim()}%`;
        query = query.or(`name.ilike.${q},username.ilike.${q}`);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (!error && data) {
        list = data.map((p) => ({
          id: p.id,
          name: p.name || 'User',
          username: p.username || 'user',
          role: p.role || 'Member',
          avatarUrl: p.avatar_url || null,
          avatar_url: p.avatar_url || null
        }));
      }
    } catch (e) {
      console.warn('[PostInteractionService] getAppProfiles exception:', e);
    }
  }

  if (list.length === 0) {
    list = mockUsers.filter((u) => u.id !== currentUserId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q))
      );
    }
  }

  return list;
};

export const sharePost = async (postId, senderId, recipientId, authorId = null) => {
  if (!postId || !senderId || !recipientId) {
    throw new Error('Valid post, sender, and recipient IDs required.');
  }

  if (senderId === recipientId) {
    throw new Error('You cannot share a post with yourself.');
  }

  console.log('[SHARE DEBUG] sender:', senderId);
  console.log('[SHARE DEBUG] recipient:', recipientId);
  console.log('[SHARE DEBUG] post:', postId);

  // 1. Insert into public.post_shares
  if (isSupabaseConfigured && !postId.startsWith('post-')) {
    try {
      const { error: shareError } = await supabase
        .from('post_shares')
        .insert([{ post_id: postId, sender_id: senderId, recipient_id: recipientId }]);

      if (shareError && shareError.code !== '23505') {
        console.error('[SHARE DEBUG] post_shares insert error:', shareError);
      }
    } catch (e) {
      console.error('[SHARE DEBUG] post_shares exception:', e);
    }
  }

  // 2. Find or create direct conversation between sender and recipient
  let conversationId = null;
  try {
    const conv = await getOrCreateDirectConversation(senderId, recipientId);
    console.log('[SHARE DEBUG] conversation:', conv);

    if (conv && conv.id && !conv.error) {
      conversationId = conv.id;
    } else if (conv?.error) {
      console.error('[SHARE DEBUG] conversation error:', conv.error);
    }
  } catch (convErr) {
    console.error('[SHARE DEBUG] conversation exception:', convErr);
  }

  // 3. Send shared-post message into public.messages
  if (conversationId) {
    const sharedPayload = JSON.stringify({
      type: 'shared_post',
      post_id: postId,
      text: 'Shared a post with you'
    });

    console.log('[SHARE DEBUG] message payload:', sharedPayload);

    try {
      const msgRes = await sendMessage(conversationId, senderId, sharedPayload);
      console.log('[SHARE DEBUG] message insert result:', msgRes);

      if (msgRes?.error) {
        console.error('[SHARE DEBUG] message insert error:', msgRes.error);
      }
    } catch (msgErr) {
      console.error('[SHARE DEBUG] message exception:', msgErr);
    }
  }

  // 4. Create in-app notification for recipient
  try {
    createNotification({
      recipientId: recipientId,
      actorId: senderId,
      type: 'post_share',
      title: 'Post Shared',
      message: 'shared a post with you',
      entityType: 'post',
      entityId: postId
    });
  } catch (notifErr) {
    console.error('[SHARE DEBUG] notification exception:', notifErr);
  }

  const summary = await getPostInteractionSummary(postId, senderId);
  return {
    shareCount: summary.shareCount
  };
};

export const getShareCount = async (postId) => {
  if (!postId || !isSupabaseConfigured) return 0;
  try {
    const { count, error } = await supabase
      .from('post_shares')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (!error && typeof count === 'number') return count;
  } catch (e) {}
  return 0;
};

// ============================================================
// 6. REALTIME SUBSCRIPTION FOR POST INTERACTIONS
// ============================================================
// 6. REALTIME SUBSCRIPTION FOR POST INTERACTIONS
// ============================================================
export const subscribeToPostInteractions = (postId, onUpdate) => {
  if (!postId || !isSupabaseConfigured) return () => {};

  try {
    const channel = supabase
      .channel(`post_interactions_channel_${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${postId}` },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_shares', filter: `post_id=eq.${postId}` },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_saves', filter: `post_id=eq.${postId}` },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
    };
  } catch (e) {
    console.warn('[PostInteractionService] subscribeToPostInteractions error:', e);
  }

  return () => {};
};

// ============================================================
// 6B. CENTRALIZED FEED REALTIME SUBSCRIPTION FOR INTERACTIONS
// Single WebSocket channel for entire feed, filtering events by post_id
// ============================================================
export const subscribeToFeedInteractions = (postIds = [], onUpdate) => {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channel = supabase
      .channel('central_feed_interactions_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        (payload) => {
          const targetPostId = payload.new?.post_id || payload.old?.post_id;
          if (targetPostId && (!postIds || postIds.length === 0 || postIds.includes(targetPostId))) {
            onUpdate({ table: 'post_likes', postId: targetPostId, payload });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload) => {
          const targetPostId = payload.new?.post_id || payload.old?.post_id;
          if (targetPostId && (!postIds || postIds.length === 0 || postIds.includes(targetPostId))) {
            onUpdate({ table: 'post_comments', postId: targetPostId, payload });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_shares' },
        (payload) => {
          const targetPostId = payload.new?.post_id || payload.old?.post_id;
          if (targetPostId && (!postIds || postIds.length === 0 || postIds.includes(targetPostId))) {
            onUpdate({ table: 'post_shares', postId: targetPostId, payload });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_saves' },
        (payload) => {
          const targetPostId = payload.new?.post_id || payload.old?.post_id;
          if (targetPostId && (!postIds || postIds.length === 0 || postIds.includes(targetPostId))) {
            onUpdate({ table: 'post_saves', postId: targetPostId, payload });
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
    };
  } catch (e) {
    console.warn('[PostInteractionService] subscribeToFeedInteractions error:', e);
  }

  return () => {};
};

// ============================================================
// 7. OWNER-ONLY DETAILED POST INSIGHTS
// ============================================================
export const getPostInsights = async (postId, ownerId) => {
  if (!postId || !ownerId) {
    throw new Error('Valid post ID and authenticated owner ID are required.');
  }

  // 1. Verify post ownership
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .maybeSingle();

  if (postErr) {
    console.error('[PostInteractionService] getPostInsights post lookup error:', postErr);
    throw new Error('Failed to verify post ownership.');
  }

  if (!post || post.user_id !== ownerId) {
    throw new Error('Unauthorized: Only the post owner can access detailed engagement insights.');
  }

  // 2. Query all engagement data in parallel
  const [likesRes, commentsRes, sharesRes, savesRes] = await Promise.all([
    supabase
      .from('post_likes')
      .select('id, created_at, user_id, profile:user_id(id, name, username, role, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_comments')
      .select('id, created_at, user_id, content, profile:user_id(id, name, username, role, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_shares')
      .select('id, created_at, sender_id, recipient_id, sender:sender_id(id, name, username, role, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_saves')
      .select('id, created_at, user_id, profile:user_id(id, name, username, role, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
  ]);

  if (likesRes.error) console.error('[PostInteractionService] likes query error:', likesRes.error);
  if (commentsRes.error) console.error('[PostInteractionService] comments query error:', commentsRes.error);
  if (sharesRes.error) console.error('[PostInteractionService] shares query error:', sharesRes.error);
  if (savesRes.error) console.error('[PostInteractionService] saves query error:', savesRes.error);

  const likes = (likesRes.data || [])
    .filter((item) => item && item.profile)
    .map((item) => ({
      id: item.profile.id,
      name: item.profile.name || 'User',
      username: item.profile.username || 'user',
      role: item.profile.role || 'Member',
      avatarUrl: item.profile.avatar_url || null,
      avatar_url: item.profile.avatar_url || null,
      created_at: item.created_at
    }));

  const comments = (commentsRes.data || []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    content: item.content,
    created_at: item.created_at,
    profile: {
      id: item.profile?.id || item.user_id,
      name: item.profile?.name || 'User',
      username: item.profile?.username || 'user',
      role: item.profile?.role || 'Member',
      avatarUrl: item.profile?.avatar_url || null,
      avatar_url: item.profile?.avatar_url || null
    }
  }));

  const shares = (sharesRes.data || []).map((item) => ({
    id: item.id,
    sender_id: item.sender_id,
    recipient_id: item.recipient_id,
    created_at: item.created_at,
    user: {
      id: item.sender?.id || item.sender_id,
      name: item.sender?.name || 'User',
      username: item.sender?.username || 'user',
      role: item.sender?.role || 'Member',
      avatarUrl: item.sender?.avatar_url || null,
      avatar_url: item.sender?.avatar_url || null
    }
  }));

  const saves = (savesRes.data || []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    created_at: item.created_at,
    user: {
      id: item.profile?.id || item.user_id,
      name: item.profile?.name || 'User',
      username: item.profile?.username || 'user',
      role: item.profile?.role || 'Member',
      avatarUrl: item.profile?.avatar_url || null,
      avatar_url: item.profile?.avatar_url || null
    }
  }));

  return {
    likes,
    comments,
    shares,
    saves,
    counts: {
      likes: likes.length,
      comments: comments.length,
      shares: shares.length,
      saves: saves.length
    }
  };
};

