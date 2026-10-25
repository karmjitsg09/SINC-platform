import { supabase, isSupabaseConfigured } from './supabase';
import { respondToFollowRequest } from './socialService';

// In-memory / persistent localStorage fallback for blocks
const STORAGE_PREFIX = 'sync_blocked_users_';

function getLocalBlocks(userId: string | null | undefined): string[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Ignore parse error
  }
  return [];
}

function saveLocalBlocks(userId: string | null | undefined, blocks: string[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(blocks));
  } catch (e) {
    // Ignore storage error
  }
}

// In-memory cache for fast sync checks
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
 * Check if a block exists between two users.
 * Returns { isBlocked: boolean, blockedByMe: boolean, blockedByTarget: boolean }
 */
export const checkBlockStatus = async (
  currentUserId: string | null | undefined,
  targetUserId: string | null | undefined
): Promise<BlockStatusResult> => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { isBlocked: false, blockedByMe: false, blockedByTarget: false };
  }

  // 1. Check in-memory fast cache first
  const blockedByMeCache = blockMemoryCache.get(`${currentUserId}_${targetUserId}`);
  const blockedByTargetCache = blockMemoryCache.get(`${targetUserId}_${currentUserId}`);
  if (blockedByMeCache === true || blockedByTargetCache === true) {
    return {
      isBlocked: true,
      blockedByMe: Boolean(blockedByMeCache),
      blockedByTarget: Boolean(blockedByTargetCache)
    };
  }

  // 2. Check Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocker_user_id, blocked_user_id')
        .or(
          `and(blocker_user_id.eq.${currentUserId},blocked_user_id.eq.${targetUserId}),and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${currentUserId})`
        );

      if (!error && data && data.length > 0) {
        let blockedByMe = false;
        let blockedByTarget = false;
        data.forEach((row: { blocker_user_id: string; blocked_user_id: string }) => {
          blockMemoryCache.set(`${row.blocker_user_id}_${row.blocked_user_id}`, true);
          if (row.blocker_user_id === currentUserId) blockedByMe = true;
          if (row.blocker_user_id === targetUserId) blockedByTarget = true;
        });
        return {
          isBlocked: true,
          blockedByMe,
          blockedByTarget
        };
      }
    } catch (e) {
      // Fall through to local fallback
    }
  }

  // 3. Check persistent localStorage fallback
  const myBlocks = getLocalBlocks(currentUserId);
  const targetBlocks = getLocalBlocks(targetUserId);

  const blockedByMe = myBlocks.includes(targetUserId);
  const blockedByTarget = targetBlocks.includes(currentUserId);

  if (blockedByMe) blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);
  if (blockedByTarget) blockMemoryCache.set(`${targetUserId}_${currentUserId}`, true);

  return {
    isBlocked: blockedByMe || blockedByTarget,
    blockedByMe,
    blockedByTarget
  };
};

/**
 * Synchronous helper for instant client-side checks
 */
export const isBlockedSync = (
  currentUserId: string | null | undefined,
  targetUserId: string | null | undefined
): boolean => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;
  if (blockMemoryCache.get(`${currentUserId}_${targetUserId}`) === true) return true;
  if (blockMemoryCache.get(`${targetUserId}_${currentUserId}`) === true) return true;

  const myBlocks = getLocalBlocks(currentUserId);
  if (myBlocks.includes(targetUserId)) return true;

  const targetBlocks = getLocalBlocks(targetUserId);
  if (targetBlocks.includes(currentUserId)) return true;

  return false;
};

/**
 * Block a target user
 */
export const blockUser = async (
  currentUserId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return { success: false, error: 'Cannot block yourself or invalid user IDs' };
  }

  // 1. Save locally first for instant consistency
  const myBlocks = getLocalBlocks(currentUserId);
  if (!myBlocks.includes(targetUserId)) {
    myBlocks.push(targetUserId);
    saveLocalBlocks(currentUserId, myBlocks);
  }
  blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);

  // 2. Persist in Supabase
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert([{ blocker_user_id: currentUserId, blocked_user_id: targetUserId }]);
      if (error && error.code !== '23505') { // Ignore unique constraint violation
        console.warn('[BlockService] Supabase blockUser error:', error.message);
      }
    } catch (e) {
      console.warn('[BlockService] Supabase blockUser exception:', e);
    }
  }

  notifyBlockStateChange();
  return { success: true };
};

/**
 * Unblock a target user
 */
export const unblockUser = async (
  currentUserId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!currentUserId || !targetUserId) {
    return { success: false, error: 'Invalid user IDs' };
  }

  // 1. Remove from local storage
  let myBlocks = getLocalBlocks(currentUserId);
  myBlocks = myBlocks.filter((id) => id !== targetUserId);
  saveLocalBlocks(currentUserId, myBlocks);
  blockMemoryCache.delete(`${currentUserId}_${targetUserId}`);

  // 2. Remove from Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_user_id', currentUserId)
        .eq('blocked_user_id', targetUserId);
    } catch (e) {
      console.warn('[BlockService] Supabase unblockUser error:', e);
    }
  }

  notifyBlockStateChange();
  return { success: true };
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
 * Get list of blocked user profiles for the current user
 */
export const getBlockedUserList = async (currentUserId: string): Promise<BlockedUserProfile[]> => {
  if (!currentUserId) return [];
  const localBlockIds = getLocalBlocks(currentUserId);
  const blockedIds = [...localBlockIds];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('blocker_user_id', currentUserId);

      if (!error && data) {
        data.forEach((r: { blocked_user_id: string }) => {
          if (r.blocked_user_id && !blockedIds.includes(r.blocked_user_id)) {
            blockedIds.push(r.blocked_user_id);
          }
        });
      }
    } catch (e) {
      console.warn('[BlockService] getBlockedUserList fetch error:', e);
    }
  }

  if (blockedIds.length === 0) return [];

  if (isSupabaseConfigured) {
    try {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, username, role, avatar_url, bio')
        .in('id', blockedIds);

      if (!pErr && profiles && profiles.length > 0) {
        return profiles.map((p: any) => ({
          id: p.id,
          name: p.name || 'User',
          username: p.username || 'user',
          role: p.role || 'Member',
          avatarUrl: p.avatar_url || null,
          bio: p.bio || ''
        }));
      }
    } catch (e) {
      console.warn('[BlockService] getBlockedUserList profiles error:', e);
    }
  }

  return blockedIds.map((id) => ({
    id,
    name: 'Blocked User',
    username: 'user_' + id.slice(0, 6),
    role: 'Member',
    avatarUrl: null,
    bio: ''
  }));
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

  console.log('[BlockService] rejectAndBlockUser initiated:', { targetUserId, requestId, currentUserId });

  // 1. Try atomic Supabase RPC if available
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('reject_and_block_user', {
        p_target_user_id: targetUserId,
        p_request_id: requestId || null
      });

      if (!error && data && data.success) {
        console.log('[BlockService] Supabase RPC reject_and_block_user succeeded');
        // Record in local cache
        const myBlocks = getLocalBlocks(currentUserId);
        if (!myBlocks.includes(targetUserId)) {
          myBlocks.push(targetUserId);
          saveLocalBlocks(currentUserId, myBlocks);
        }
        blockMemoryCache.set(`${currentUserId}_${targetUserId}`, true);
        notifyBlockStateChange();
        return { success: true };
      }
    } catch (e: any) {
      console.warn('[BlockService] RPC reject_and_block_user fallback:', e?.message);
    }
  }

  // 2. Coordinated fallback operations:
  // Step A: Block the user
  await blockUser(currentUserId, targetUserId);

  // Step B: Reject the follow request
  const rejectRes = await respondToFollowRequest(requestId, currentUserId, targetUserId, 'rejected');

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
      // Ignore notification update error
    }
  }

  notifyBlockStateChange();
  return { success: true, rejectResult: rejectRes };
};
