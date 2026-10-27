import { supabase, isSupabaseConfigured } from './supabase';
import { respondToFollowRequest } from './socialService';

// In-memory cache for fast sync checks, refreshed from the database
const blockMemoryCache = new Map<string, boolean>(); // key: `${blockerId}_${blockedId}` -> boolean

const blockListeners = new Set<() => void>();
export const notifyBlockStateChange = (): void => {
  blockListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn('[BlockService] Listener error:', err);
    }
  });
};

export const subscribeToBlockState = (fn: () => void): (() => boolean) => {
  blockListeners.add(fn);
  return () => blockListeners.delete(fn);
};

export interface BlockStatusResult {
  isBlocked: boolean;
  blockedByMe: boolean;
  blockedByTarget: boolean;
}

/**
 * Check if a block exists between two users using the database as the source of truth.
 * Returns { isBlocked: boolean, blockedByMe: boolean, blockedByTarget: boolean }
 */
export const checkBlockStatus = async (
  currentUserId: string | null | undefined,
  targetUserId: string | null | undefined
): Promise<BlockStatusResult> => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { isBlocked: false, blockedByMe: false, blockedByTarget: false };
  }

  // 1. Query Supabase (Authoritative source of truth)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocker_user_id, blocked_user_id')
        .or(
          `and(blocker_user_id.eq.${currentUserId},blocked_user_id.eq.${targetUserId}),and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${currentUserId})`
        );

      if (error) {
        console.error('[BlockService] checkBlockStatus database query error:', error.message);
        // Fall back to in-memory cache if database query fails
        const blockedByMeCache = blockMemoryCache.get(`${currentUserId}_${targetUserId}`) === true;
        const blockedByTargetCache = blockMemoryCache.get(`${targetUserId}_${currentUserId}`) === true;
        return {
          isBlocked: blockedByMeCache || blockedByTargetCache,
          blockedByMe: blockedByMeCache,
          blockedByTarget: blockedByTargetCache
        };
      }

      let blockedByMe = false;
      let blockedByTarget = false;

      // Update in-memory cache with database reality
      blockMemoryCache.set(`${currentUserId}_${targetUserId}`, false);
      blockMemoryCache.set(`${targetUserId}_${currentUserId}`, false);

      if (data && data.length > 0) {
        data.forEach((row: { blocker_user_id: string; blocked_user_id: string }) => {
          blockMemoryCache.set(`${row.blocker_user_id}_${row.blocked_user_id}`, true);
          if (row.blocker_user_id === currentUserId) blockedByMe = true;
          if (row.blocker_user_id === targetUserId) blockedByTarget = true;
        });
      }

      return {
        isBlocked: blockedByMe || blockedByTarget,
        blockedByMe,
        blockedByTarget
      };
    } catch (e: any) {
      console.error('[BlockService] checkBlockStatus database exception:', e);
    }
  }

  // Fallback to in-memory cache if Supabase not configured
  const blockedByMe = blockMemoryCache.get(`${currentUserId}_${targetUserId}`) === true;
  const blockedByTarget = blockMemoryCache.get(`${targetUserId}_${currentUserId}`) === true;

  return {
    isBlocked: blockedByMe || blockedByTarget,
    blockedByMe,
    blockedByTarget
  };
};

/**
 * Synchronous helper for instant client-side checks backed by memory cache
 */
export const isBlockedSync = (
  currentUserId: string | null | undefined,
  targetUserId: string | null | undefined
): boolean => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
  if (blockMemoryCache.get(`${currentUserId}_${targetUserId}`) === true) return true;
  if (blockMemoryCache.get(`${targetUserId}_${currentUserId}`) === true) return true;
  return false;
};

/**
 * Block a target user.
 * Writes to the database FIRST. Only updates in-memory cache if the database write succeeds.
 */
export const blockUser = async (
  currentUserId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { success: false, error: 'Cannot block yourself or invalid user IDs' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database service is not configured.' };
  }

  try {
    // 1. Write directly to the database first (Source of Truth)
    const { error } = await supabase
      .from('blocked_users')
      .insert([{ blocker_user_id: currentUserId, blocked_user_id: targetUserId }]);

    if (error) {
      // 23505 is PostgreSQL unique constraint violation (already blocked in database)
      if (error.code === '23505') {
        blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);
        notifyBlockStateChange();
        return { success: true };
      }
      console.error('[BlockService] Failed to block user in database:', error.message);
      return { success: false, error: error.message || 'Failed to block user in database' };
    }

    // 2. Database write succeeded: update in-memory cache
    blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);
    notifyBlockStateChange();
    return { success: true };
  } catch (err: any) {
    console.error('[BlockService] Database exception while blocking user:', err);
    return { success: false, error: err?.message || 'Database error while blocking user' };
  }
};

/**
 * Unblock a target user.
 * Deletes from the database FIRST. Only clears in-memory cache if database deletion succeeds.
 */
export const unblockUser = async (
  currentUserId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!currentUserId || !targetUserId) {
    return { success: false, error: 'Invalid user IDs' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database service is not configured.' };
  }

  try {
    // 1. Delete from database first (Source of Truth)
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_user_id', currentUserId)
      .eq('blocked_user_id', targetUserId);

    if (error) {
      console.error('[BlockService] Failed to unblock user in database:', error.message);
      return { success: false, error: error.message || 'Failed to unblock user in database' };
    }

    // 2. Database delete succeeded: clear in-memory cache
    blockMemoryCache.delete(`${currentUserId}_${targetUserId}`);
    notifyBlockStateChange();
    return { success: true };
  } catch (err: any) {
    console.error('[BlockService] Database exception while unblocking user:', err);
    return { success: false, error: err?.message || 'Database error while unblocking user' };
  }
};

export interface BlockedUserProfile {
  id: string;
  name: string;
  username: string;
  role: string;
  avatarUrl: string | null;
  bio: string;
}

/**
 * Get list of blocked user profiles for the current user directly from the database.
 */
export const getBlockedUserList = async (currentUserId: string): Promise<BlockedUserProfile[]> => {
  if (!currentUserId) return [];

  if (!isSupabaseConfigured) {
    console.warn('[BlockService] Supabase not configured for getBlockedUserList');
    return [];
  }

  try {
    // 1. Try invoking SECURITY DEFINER function returning { id, username, name, avatar_url }
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_blocked_users');

    if (!rpcErr && Array.isArray(rpcData)) {
      // Sync in-memory cache
      rpcData.forEach((row: any) => {
        if (row?.id) blockMemoryCache.set(`${currentUserId}_${row.id}`, true);
      });

      return rpcData.map((row: any) => ({
        id: row.id,
        name: row.name || 'Blocked Member',
        username: row.username || (row.id ? row.id.substring(0, 8) : 'user'),
        role: 'Member',
        avatarUrl: row.avatar_url || null,
        bio: ''
      }));
    }

    if (rpcErr) {
      console.warn('[BlockService] get_my_blocked_users RPC notice:', rpcErr.message);
    }

    // 2. Fallback to direct query if RPC unavailable
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_user_id')
      .eq('blocker_user_id', currentUserId);

    if (error) {
      console.warn('[BlockService] getBlockedUserList database query failed (safe fallback active):', error.message);
      return [];
    }

    const blockedIds = (data || [])
      .map((r: { blocked_user_id: string }) => r.blocked_user_id)
      .filter(Boolean);

    // Sync in-memory cache
    blockedIds.forEach((id: string) => {
      blockMemoryCache.set(`${currentUserId}_${id}`, true);
    });

    if (blockedIds.length === 0) return [];

    return blockedIds.map((id: string) => ({
      id,
      name: 'Blocked Member',
      username: id.substring(0, 8),
      role: 'Member',
      avatarUrl: null,
      bio: ''
    }));
  } catch (e: any) {
    console.warn('[BlockService] getBlockedUserList exception (safe fallback active):', e);
    return [];
  }
};

/**
 * Atomic coordinated action: Reject Follow Request and Block User
 */
export const rejectAndBlockUser = async (
  targetUserId: string | null | undefined,
  requestId: string | null,
  currentUserId: string | null | undefined
): Promise<{ success: boolean; error?: string; rejectResult?: any }> => {
  if (!currentUserId || !targetUserId) {
    return { success: false, error: 'Missing required user IDs' };
  }

  // 1. Try atomic Supabase RPC if available
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('reject_and_block_user', {
        p_target_user_id: targetUserId,
        p_request_id: requestId || null
      });

      if (!error && data && data.success) {
        blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);
        notifyBlockStateChange();
        return { success: true };
      }
    } catch (e: any) {
      console.warn('[BlockService] RPC reject_and_block_user unavailable, falling back to database operations');
    }
  }

  // 2. Coordinated operations:
  // Step A: Block user in database first
  const blockResult = await blockUser(currentUserId, targetUserId);
  if (!blockResult.success) {
    return { success: false, error: blockResult.error || 'Failed to block user in database' };
  }

  // Step B: Reject the follow request
  let rejectRes: any = null;
  try {
    rejectRes = await respondToFollowRequest(requestId, currentUserId, targetUserId, 'rejected');
  } catch (err: any) {
    console.error('[BlockService] respondToFollowRequest error during rejectAndBlock:', err);
  }

  // Step C: Mark notifications read
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', currentUserId)
        .eq('actor_id', targetUserId)
        .eq('type', 'follow_request');
    } catch (e) {
      // Non-critical notification cleanup
    }
  }

  notifyBlockStateChange();
  return { success: true, rejectResult: rejectRes };
};
