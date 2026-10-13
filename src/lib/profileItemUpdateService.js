import { supabase, isSupabaseConfigured } from './supabase';

const UPDATES_CACHE_PREFIX = 'sync_item_updates_';

const listeners = new Set();
const notifyListeners = (event) => {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.warn('[ProfileItemUpdateService] Listener error:', e);
    }
  });
};

export const subscribeToUpdates = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function getLocalCacheKey(itemType, itemId) {
  return `${UPDATES_CACHE_PREFIX}${itemType}_${itemId}`;
}

function getLocalUpdates(itemType, itemId) {
  if (!itemType || !itemId) return [];
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

function saveLocalUpdates(itemType, itemId, updates) {
  if (!itemType || !itemId) return;
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
export async function getUpdates(itemType, itemId) {
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
        const map = new Map();
        localData.forEach((u) => map.set(u.id, u));
        data.forEach((u) => map.set(u.id, u));
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalUpdates(itemType, itemId, merged);
        return merged;
      }
    } catch (err) {
      console.warn('[ProfileItemUpdateService] Supabase getUpdates notice:', err.message);
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
}) {
  if (!userId || !itemType || !itemId || !content?.trim()) {
    throw new Error('User ID, item type, item ID, and content are required to add an update.');
  }

  const validStatuses = ['Planned', 'In Progress', 'Completed', 'Updated'];
  const cleanStatus = validStatuses.includes(status) ? status : 'In Progress';

  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `upd_${Date.now()}`;
  const now = new Date().toISOString();

  const newRecord = {
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

  // 1. Save to local storage cache immediately
  const existing = getLocalUpdates(itemType, itemId);
  saveLocalUpdates(itemType, itemId, [newRecord, ...existing]);

  // 2. Insert into Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profile_item_updates')
        .insert([newRecord])
        .select('*')
        .single();

      if (!error && data) {
        const updatedList = getLocalUpdates(itemType, itemId).map((u) => (u.id === newId ? data : u));
        saveLocalUpdates(itemType, itemId, updatedList);
        notifyListeners({ type: 'create', update: data });
        return data;
      }
    } catch (err) {
      console.warn('[ProfileItemUpdateService] Supabase createUpdate notice:', err.message);
    }
  }

  notifyListeners({ type: 'create', update: newRecord });
  return newRecord;
}

/**
 * Update an existing update
 */
export async function updateUpdate(updateId, updateData, userId) {
  if (!updateId || !userId) {
    throw new Error('Update ID and User ID are required.');
  }

  const now = new Date().toISOString();
  const validStatuses = ['Planned', 'In Progress', 'Completed', 'Updated'];

  let updatedRecord = null;
  const { itemType, itemId } = updateData;

  // 1. Update in local storage
  if (itemType && itemId) {
    const existing = getLocalUpdates(itemType, itemId);
    const target = existing.find((u) => u.id === updateId);
    if (target) {
      if (target.user_id !== userId) {
        throw new Error('Unauthorized: You can only edit your own updates.');
      }
      updatedRecord = {
        ...target,
        title: updateData.title !== undefined ? updateData.title.trim() : target.title,
        content: updateData.content !== undefined ? updateData.content.trim() : target.content,
        image_url: updateData.imageUrl !== undefined ? updateData.imageUrl : target.image_url,
        status: validStatuses.includes(updateData.status) ? updateData.status : target.status,
        updated_at: now
      };
      const newList = existing.map((u) => (u.id === updateId ? updatedRecord : u));
      saveLocalUpdates(itemType, itemId, newList);
    }
  }

  // 2. Update in Supabase
  if (isSupabaseConfigured) {
    try {
      const payload = {
        updated_at: now
      };
      if (updateData.title !== undefined) payload.title = updateData.title.trim();
      if (updateData.content !== undefined) payload.content = updateData.content.trim();
      if (updateData.imageUrl !== undefined) payload.image_url = updateData.imageUrl;
      if (validStatuses.includes(updateData.status)) payload.status = updateData.status;

      const { data, error } = await supabase
        .from('profile_item_updates')
        .update(payload)
        .eq('id', updateId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (!error && data) {
        if (itemType && itemId) {
          const freshList = getLocalUpdates(itemType, itemId).map((u) => (u.id === updateId ? data : u));
          saveLocalUpdates(itemType, itemId, freshList);
        }
        notifyListeners({ type: 'update', update: data });
        return data;
      }
    } catch (err) {
      console.warn('[ProfileItemUpdateService] Supabase updateUpdate notice:', err.message);
    }
  }

  if (updatedRecord) {
    notifyListeners({ type: 'update', update: updatedRecord });
    return updatedRecord;
  }
  throw new Error('Update not found or unauthorized.');
}

/**
 * Delete an update
 */
export async function deleteUpdate(updateId, userId, itemType, itemId) {
  if (!updateId || !userId) {
    throw new Error('Update ID and User ID are required.');
  }

  // 1. Remove from local storage
  if (itemType && itemId) {
    const existing = getLocalUpdates(itemType, itemId);
    const target = existing.find((u) => u.id === updateId);
    if (target && target.user_id !== userId) {
      throw new Error('Unauthorized: You can only delete your own updates.');
    }
    const filtered = existing.filter((u) => u.id !== updateId);
    saveLocalUpdates(itemType, itemId, filtered);
  }

  // 2. Remove from Supabase
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('profile_item_updates')
        .delete()
        .eq('id', updateId)
        .eq('user_id', userId);

      if (error) {
        console.warn('[ProfileItemUpdateService] Supabase deleteUpdate notice:', error.message);
      }
    } catch (err) {
      console.warn('[ProfileItemUpdateService] Supabase deleteUpdate exception:', err.message);
    }
  }

  notifyListeners({ type: 'delete', updateId });
  return true;
}

/**
 * Delete all updates for a deleted profile item
 */
export async function deleteUpdatesByItem(itemType, itemId) {
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
    } catch (err) {
      console.warn('[ProfileItemUpdateService] Supabase deleteUpdatesByItem exception:', err.message);
    }
  }

  notifyListeners({ type: 'delete_all_for_item', itemType, itemId });
}
