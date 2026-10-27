import { supabase, isSupabaseConfigured } from './supabase';

const UPDATES_CACHE_PREFIX = 'sync_item_updates_';

export type ProfileItemType = 'project' | 'experience' | 'education' | 'certification' | 'achievement' | string;

export interface ProfileItemUpdate {
  id: string;
  user_id: string;
  item_type: string;
  item_id: string;
  title: string;
  content: string;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUpdateParams {
  userId: string;
  itemType: string;
  itemId: string;
  title?: string;
  content: string;
  imageUrl?: string | null;
  status?: string;
}

export interface UpdateUpdateData {
  itemType?: string;
  itemId?: string;
  title?: string;
  content?: string;
  imageUrl?: string | null;
  status?: string;
}

const listeners = new Set<(event: any) => void>();
const notifyListeners = (event: any) => {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.warn('[ProfileItemUpdateService] Listener error:', e);
    }
  });
};

export const subscribeToUpdates = (fn: (event: any) => void): (() => boolean) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function getLocalCacheKey(itemType: string, itemId: string): string {
  return `${UPDATES_CACHE_PREFIX}${itemType}_${itemId}`;
}

function getLocalUpdates(itemType: string, itemId: string): ProfileItemUpdate[] {
  if (!itemType || !itemId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalCacheKey(itemType, itemId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    }
  } catch (err) {
    console.warn('[ProfileItemUpdateService] Local cache read error:', err);
  }
  return [];
}

function saveLocalUpdates(itemType: string, itemId: string, updates: ProfileItemUpdate[]): void {
  if (!itemType || !itemId || typeof window === 'undefined') return;
  try {
    const sorted = [...updates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    localStorage.setItem(getLocalCacheKey(itemType, itemId), JSON.stringify(sorted));
  } catch (err) {
    console.warn('[ProfileItemUpdateService] Local cache write error:', err);
  }
}

/**
 * Fetch all updates for a specific profile item
 */
export async function getUpdates(itemType: string, itemId: string): Promise<ProfileItemUpdate[]> {
  if (!itemType || !itemId) return [];

  const localData = getLocalUpdates(itemType, itemId);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profile_item_updates')
        .select('*')
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        // Merge with local changes if any
        const map = new Map<string, ProfileItemUpdate>();
        localData.forEach((u) => map.set(u.id, u));
        data.forEach((u: ProfileItemUpdate) => map.set(u.id, u));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalUpdates(itemType, itemId, merged);
        return merged;
      }
    } catch (err: any) {
      console.warn('[ProfileItemUpdateService] Supabase getUpdates notice:', err?.message);
    }
  }

  return localData;
}

/**
 * Create a new update for an item
 */
export async function createUpdate({
  userId,
  itemType,
  itemId,
  title,
  content,
  imageUrl = null,
  status = 'In Progress'
}: CreateUpdateParams): Promise<ProfileItemUpdate> {
  if (!userId || !itemType || !itemId || !content?.trim()) {
    throw new Error('User ID, item type, item ID, and content are required to add an update.');
  }

  const validStatuses = ['Planned', 'In Progress', 'Completed', 'Updated'];
  const cleanStatus = validStatuses.includes(status) ? status : 'In Progress';

  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `upd_${Date.now()}`;
  const now = new Date().toISOString();

  const newRecord: ProfileItemUpdate = {
    id: newId,
    user_id: userId,
    item_type: itemType,
    item_id: itemId,
    title: title?.trim() || '',
    content: content.trim(),
    image_url: imageUrl || null,
    status: cleanStatus,
    created_at: now,
    updated_at: now
  };

  // 1. Insert into Supabase (Source of Truth)
  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const { data, error } = await supabase
    .from('profile_item_updates')
    .insert([newRecord])
    .select('*')
    .single();

  if (error || !data) {
    console.error('[ProfileItemUpdateService] Supabase createUpdate error:', error?.message);
    throw new Error(error?.message || 'Failed to create item update in database.');
  }

  // 2. Update local read cache only on successful database persist
  const existing = getLocalUpdates(itemType, itemId);
  saveLocalUpdates(itemType, itemId, [data, ...existing.filter(u => u.id !== data.id)]);

  notifyListeners({ type: 'create', update: data });
  return data;
}

/**
 * Update an existing update
 */
export async function updateUpdate(
  updateId: string,
  updateData: UpdateUpdateData,
  userId: string
): Promise<ProfileItemUpdate> {
  if (!updateId || !userId) {
    throw new Error('Update ID and User ID are required.');
  }

  const now = new Date().toISOString();
  const validStatuses = ['Planned', 'In Progress', 'Completed', 'Updated'];

  const { itemType, itemId } = updateData;

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const payload: Record<string, any> = {
    updated_at: now
  };
  if (updateData.title !== undefined) payload.title = updateData.title.trim();
  if (updateData.content !== undefined) payload.content = updateData.content.trim();
  if (updateData.imageUrl !== undefined) payload.image_url = updateData.imageUrl;
  if (updateData.status && validStatuses.includes(updateData.status)) payload.status = updateData.status;

  const { data, error } = await supabase
    .from('profile_item_updates')
    .update(payload)
    .eq('id', updateId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[ProfileItemUpdateService] Supabase updateUpdate error:', error?.message);
    throw new Error(error?.message || 'Failed to update item update in database.');
  }

  if (itemType && itemId) {
    const freshList = getLocalUpdates(itemType, itemId).map((u) => (u.id === updateId ? data : u));
    saveLocalUpdates(itemType, itemId, freshList);
  }
  notifyListeners({ type: 'update', update: data });
  return data;
}

/**
 * Delete an update
 */
export async function deleteUpdate(
  updateId: string,
  userId: string,
  itemType: string,
  itemId: string
): Promise<boolean> {
  if (!updateId || !userId) {
    throw new Error('Update ID and User ID are required.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const { error } = await supabase
    .from('profile_item_updates')
    .delete()
    .eq('id', updateId)
    .eq('user_id', userId);

  if (error) {
    console.error('[ProfileItemUpdateService] Supabase deleteUpdate error:', error.message);
    throw new Error(error.message || 'Failed to delete item update from database.');
  }

  // Remove from local cache only after successful database deletion
  if (itemType && itemId) {
    const existing = getLocalUpdates(itemType, itemId);
    const filtered = existing.filter((u) => u.id !== updateId);
    saveLocalUpdates(itemType, itemId, filtered);
  }

  notifyListeners({ type: 'delete', updateId });
  return true;
}

/**
 * Delete all updates for a deleted profile item
 */
export async function deleteUpdatesByItem(itemType: string, itemId: string): Promise<void> {
  if (!itemType || !itemId) return;

  try {
    localStorage.removeItem(getLocalCacheKey(itemType, itemId));
  } catch (err) {
    console.warn('[ProfileItemUpdateService] Local deleteUpdatesByItem error:', err);
  }

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('profile_item_updates')
        .delete()
        .eq('item_type', itemType)
        .eq('item_id', itemId);
    } catch (err: any) {
      console.warn('[ProfileItemUpdateService] Supabase deleteUpdatesByItem exception:', err?.message);
    }
  }

  notifyListeners({ type: 'delete_all_for_item', itemType, itemId });
}
