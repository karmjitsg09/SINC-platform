import { supabase, isSupabaseConfigured } from './supabase';
import type { AchievementItem } from '@/types';

const ACHIEVEMENTS_CACHE_PREFIX = 'sync_user_achievements_';

/**
 * Sort achievements: achievement_date desc, then created_at desc
 */
function sortAchievements(achList: any[]): any[] {
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

function getLocalAchievements(userId: string | null | undefined): any[] {
  if (!userId) return [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`${ACHIEVEMENTS_CACHE_PREFIX}${userId}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortAchievements(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local achievements:', err);
  }
  return [];
}

function saveLocalAchievements(userId: string | null | undefined, achList: any[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${ACHIEVEMENTS_CACHE_PREFIX}${userId}`, JSON.stringify(sortAchievements(achList)));
  } catch (err) {
    console.warn('Error saving local achievements:', err);
  }
}

const achievementListeners = new Set<() => void>();
const notifyAchievementListeners = () => {
  achievementListeners.forEach((fn) => fn());
};

export function subscribeToAchievementState(callback: () => void): () => void {
  achievementListeners.add(callback);
  return () => {
    achievementListeners.delete(callback);
  };
}

/**
 * Fetch all achievements for a user
 */
export async function getAchievementsByUserId(userId: string | null | undefined): Promise<any[]> {
  if (!userId) return [];

  const localData = getLocalAchievements(userId);

  if (isSupabaseConfigured) {
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
  }

  return localData;
}

/**
 * Add a new achievement
 */
export async function createAchievement(arg1: any, arg2?: any): Promise<any> {
  const userId = typeof arg1 === 'string' ? arg1 : arg1?.user_id;
  const achData = typeof arg1 === 'string' ? arg2 : arg1;

  if (!userId) throw new Error('User ID is required to create an achievement');

  const newEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ach_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId,
    title: achData.title?.trim() || 'Untitled Achievement',
    organization: achData.organization?.trim() || '',
    achievement_date: achData.achievement_date || null,
    description: achData.description?.trim() || '',
    credential_id: achData.credential_id?.trim() || '',
    credential_url: achData.credential_url?.trim() || '',
    image_url: achData.image_url?.trim() || '',
    skills: Array.isArray(achData.skills)
      ? achData.skills.map((s: string) => s.trim()).filter(Boolean)
      : (typeof achData.skills === 'string'
          ? achData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .insert([newEntry])
        .select()
        .single();

      if (!error && data) {
        const list = getLocalAchievements(userId);
        saveLocalAchievements(userId, [data, ...list]);
        notifyAchievementListeners();
        return data;
      }
    } catch (err) {
      console.warn('Supabase create achievement exception:', err);
    }
  }

  const list = getLocalAchievements(userId);
  saveLocalAchievements(userId, [newEntry, ...list]);
  notifyAchievementListeners();
  return newEntry;
}

export type { AchievementItem };

/**
 * Update an existing achievement
 */
export async function updateAchievement(arg1: any, arg2: any, arg3?: any): Promise<any> {
  const achievementId = arg3 !== undefined ? arg2 : arg1;
  const updateData = arg3 !== undefined ? arg3 : arg2;
  const passedUserId = arg3 !== undefined ? arg1 : undefined;

  if (!achievementId) throw new Error('Achievement ID is required');

  const cleanedData = {
    ...updateData,
    skills: Array.isArray(updateData?.skills)
      ? updateData.skills.map((s: string) => s.trim()).filter(Boolean)
      : (typeof updateData?.skills === 'string'
          ? updateData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
          : updateData?.skills)
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .update(cleanedData)
        .eq('id', achievementId)
        .select()
        .single();

      if (!error && data) {
        const userId = data.user_id || passedUserId;
        if (userId) {
          const list = getLocalAchievements(userId);
          const updatedList = list.map((a) => (a.id === achievementId ? data : a));
          saveLocalAchievements(userId, updatedList);
        }
        notifyAchievementListeners();
        return data;
      }
    } catch (err) {
      console.warn('Supabase update achievement exception:', err);
    }
  }

  // Local update fallback
  let affectedUserId: string | null = passedUserId || null;
  if (affectedUserId) {
    const list = getLocalAchievements(affectedUserId);
    const idx = list.findIndex((a: any) => a.id === achievementId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...cleanedData, updated_at: new Date().toISOString() };
      saveLocalAchievements(affectedUserId, list);
      notifyAchievementListeners();
      return list[idx];
    }
  }

  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ACHIEVEMENTS_CACHE_PREFIX)) {
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          const idx = list.findIndex((a: any) => a.id === achievementId);
          if (idx !== -1) {
            affectedUserId = key.replace(ACHIEVEMENTS_CACHE_PREFIX, '');
            list[idx] = { ...list[idx], ...cleanedData, updated_at: new Date().toISOString() };
            saveLocalAchievements(affectedUserId, list);
            notifyAchievementListeners();
            return list[idx];
          }
        } catch (e) {}
      }
    }
  }

  notifyAchievementListeners();
  return { id: achievementId, ...cleanedData };
}

/**
 * Delete an achievement
 */
export async function deleteAchievement(arg1: string, arg2?: string): Promise<boolean> {
  const achievementId = arg2 ? arg2 : arg1;
  const userId = arg2 ? arg1 : undefined;

  if (!achievementId) return false;

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('id', achievementId);

      if (error) {
        console.warn('Supabase delete achievement error:', error);
      }
    } catch (err) {
      console.warn('Supabase delete achievement exception:', err);
    }
  }

  if (userId) {
    const list = getLocalAchievements(userId);
    saveLocalAchievements(userId, list.filter((a) => a.id !== achievementId));
  } else if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ACHIEVEMENTS_CACHE_PREFIX)) {
        try {
          const uid = key.replace(ACHIEVEMENTS_CACHE_PREFIX, '');
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          saveLocalAchievements(uid, list.filter((a: any) => a.id !== achievementId));
        } catch (e) {}
      }
    }
  }

  notifyAchievementListeners();
  return true;
}
