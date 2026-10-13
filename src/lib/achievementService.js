import { supabase, isSupabaseConfigured } from './supabase';

const ACHIEVEMENTS_CACHE_PREFIX = 'sync_user_achievements_';

/**
 * Sort achievements: achievement_date desc, then created_at desc
 */
function sortAchievements(achList) {
  return [...achList].sort((a, b) => {
    const dateA = a.achievement_date ? new Date(a.achievement_date).getTime() : 0;
    const dateB = b.achievement_date ? new Date(b.achievement_date).getTime() : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }

    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
}

function getLocalAchievements(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${ACHIEVEMENTS_CACHE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortAchievements(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local achievements:', err);
  }
  return [];
}

function saveLocalAchievements(userId, achList) {
  if (!userId) return;
  try {
    localStorage.setItem(`${ACHIEVEMENTS_CACHE_PREFIX}${userId}`, JSON.stringify(sortAchievements(achList)));
  } catch (err) {
    console.warn('Error saving local achievements:', err);
  }
}

/**
 * Fetch all achievements for a user
 */
export async function getAchievementsByUserId(userId) {
  if (!userId) return [];

  const localData = getLocalAchievements(userId);

  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('achievement_date', { ascending: false });

    if (!error && Array.isArray(data)) {
      const sorted = sortAchievements(data);
      saveLocalAchievements(userId, sorted);
      return sorted;
    }

    if (error) {
      console.warn('Supabase achievements fetch notice (using cache/local):', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to query achievements from Supabase, using local fallback:', err);
  }

  return localData;
}

/**
 * Add a new achievement
 * Supports createAchievement(userId, data) or createAchievement(data)
 */
export async function createAchievement(arg1, arg2) {
  const userId = typeof arg1 === 'string' ? arg1 : arg1?.user_id;
  const achData = typeof arg1 === 'string' ? arg2 : arg1;

  if (!userId) throw new Error('User ID is required to create an achievement');

  const newEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `ach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    title: achData.title?.trim() || 'Untitled Achievement',
    organization: achData.organization?.trim() || '',
    achievement_date: achData.achievement_date || null,
    description: achData.description?.trim() || '',
    credential_id: achData.credential_id?.trim() || '',
    credential_url: achData.credential_url?.trim() || '',
    image_url: achData.image_url?.trim() || '',
    skills: Array.isArray(achData.skills)
      ? achData.skills.map(s => s.trim()).filter(Boolean)
      : (typeof achData.skills === 'string'
          ? achData.skills.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Optimistically store in local fallback
  const currentList = getLocalAchievements(userId);
  const updatedList = sortAchievements([newEntry, ...currentList]);
  saveLocalAchievements(userId, updatedList);

  // 2. Try inserting into Supabase
  try {
    const { data, error } = await supabase
      .from('achievements')
      .insert([newEntry])
      .select()
      .single();

    if (!error && data) {
      const finalIndex = updatedList.findIndex(a => a.id === newEntry.id);
      if (finalIndex !== -1) {
        updatedList[finalIndex] = data;
        saveLocalAchievements(userId, updatedList);
      }
      return data;
    }

    if (error) {
      console.warn('Supabase achievements insert notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to insert into Supabase achievements table, using optimistic entry:', err);
  }

  // Dispatch custom window event for reactivity
  window.dispatchEvent(new CustomEvent('sync_achievements_updated', { detail: { userId, achievement: newEntry } }));

  return newEntry;
}

/**
 * Update an existing achievement
 * Supports updateAchievement(userId, achId, updates) or updateAchievement(achId, updates, userId)
 */
export async function updateAchievement(arg1, arg2, arg3) {
  let userId, achId, updates;
  if (typeof arg1 === 'string' && typeof arg2 === 'string' && typeof arg3 === 'object') {
    userId = arg1;
    achId = arg2;
    updates = arg3;
  } else {
    achId = arg1;
    updates = arg2;
    userId = arg3 || updates?.user_id;
  }

  if (!achId) throw new Error('Achievement ID is required');

  const currentList = userId ? getLocalAchievements(userId) : [];
  const existing = currentList.find(a => a.id === achId) || {};
  const effectiveUserId = userId || existing.user_id;

  const cleanUpdates = {
    ...updates,
    title: updates.title !== undefined ? updates.title.trim() : existing.title,
    organization: updates.organization !== undefined ? updates.organization.trim() : existing.organization,
    achievement_date: updates.achievement_date !== undefined ? updates.achievement_date : existing.achievement_date,
    description: updates.description !== undefined ? updates.description.trim() : existing.description,
    credential_id: updates.credential_id !== undefined ? updates.credential_id.trim() : existing.credential_id,
    credential_url: updates.credential_url !== undefined ? updates.credential_url.trim() : existing.credential_url,
    image_url: updates.image_url !== undefined ? updates.image_url.trim() : existing.image_url,
    skills: updates.skills !== undefined
      ? (Array.isArray(updates.skills)
          ? updates.skills.map(s => s.trim()).filter(Boolean)
          : (typeof updates.skills === 'string'
              ? updates.skills.split(',').map(s => s.trim()).filter(Boolean)
              : []))
      : (existing.skills || []),
    updated_at: new Date().toISOString(),
  };

  const updatedEntry = {
    ...existing,
    ...cleanUpdates,
    id: achId,
    user_id: effectiveUserId,
  };

  if (effectiveUserId) {
    const newList = sortAchievements(currentList.map(a => (a.id === achId ? updatedEntry : a)));
    saveLocalAchievements(effectiveUserId, newList);
  }

  try {
    let query = supabase
      .from('achievements')
      .update(cleanUpdates)
      .eq('id', achId);

    if (effectiveUserId) {
      query = query.eq('user_id', effectiveUserId);
    }

    const { data, error } = await query.select().single();

    if (!error && data) {
      if (effectiveUserId) {
        const freshList = getLocalAchievements(effectiveUserId);
        const idx = freshList.findIndex(a => a.id === achId);
        if (idx !== -1) {
          freshList[idx] = data;
          saveLocalAchievements(effectiveUserId, freshList);
        }
      }
      return data;
    }

    if (error) {
      console.warn('Supabase achievements update notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to update in Supabase achievements table:', err);
  }

  window.dispatchEvent(new CustomEvent('sync_achievements_updated', { detail: { userId: effectiveUserId, achievement: updatedEntry } }));

  return updatedEntry;
}

/**
 * Delete an achievement
 * Supports deleteAchievement(userId, achId) or deleteAchievement(achId, userId)
 */
export async function deleteAchievement(arg1, arg2) {
  let userId, achId;
  userId = arg1;
  achId = arg2;

  if (!achId && typeof arg1 === 'string') {
    achId = arg1;
    userId = null;
  }

  if (userId) {
    const currentList = getLocalAchievements(userId);
    const updatedList = currentList.filter(a => a.id !== achId);
    saveLocalAchievements(userId, updatedList);
  }

  try {
    let query = supabase.from('achievements').delete().eq('id', achId);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (error) {
      console.warn('Supabase achievements delete notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to delete achievement from Supabase:', err);
  }

  window.dispatchEvent(new CustomEvent('sync_achievements_updated', { detail: { userId, deletedId: achId } }));

  return true;
}

/**
 * Listen for achievement updates
 */
export function subscribeToAchievementState(callback) {
  const handler = (e) => {
    if (callback) callback(e.detail);
  };
  window.addEventListener('sync_achievements_updated', handler);
  return () => window.removeEventListener('sync_achievements_updated', handler);
}
