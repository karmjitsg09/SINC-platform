import { supabase, isSupabaseConfigured } from './supabase';
import type { EducationItem } from '@/types';

const EDUCATION_CACHE_PREFIX = 'sync_user_education_';

/**
 * Sort education: current first, then start_date desc, then created_at desc
 */
function sortEducation(educationList: any[]): any[] {
  return [...educationList].sort((a, b) => {
    // Current positions first
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;

    // Start date desc
    const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
    const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }

    // Created at desc
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
}

function getLocalEducation(userId: string | null | undefined): any[] {
  if (!userId) return [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`${EDUCATION_CACHE_PREFIX}${userId}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortEducation(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local education:', err);
  }
  return [];
}

function saveLocalEducation(userId: string | null | undefined, educationList: any[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${EDUCATION_CACHE_PREFIX}${userId}`, JSON.stringify(sortEducation(educationList)));
  } catch (err) {
    console.warn('Error saving local education:', err);
  }
}

const educationListeners = new Set<() => void>();
export function subscribeToEducationState(callback: () => void): () => void {
  educationListeners.add(callback);
  return () => {
    educationListeners.delete(callback);
  };
}

const notifyEducationListeners = () => {
  educationListeners.forEach((fn) => fn());
};

/**
 * Fetch all education entries for a user
 */
export async function getEducationByUserId(userId: string | null | undefined): Promise<any[]> {
  if (!userId) return [];

  const localData = getLocalEducation(userId);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profile_education')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (!error && Array.isArray(data)) {
        const sorted = sortEducation(data);
        saveLocalEducation(userId, sorted);
        return sorted;
      }

      if (error) {
        console.warn('Supabase education fetch notice (using cache/local):', error.message || error);
      }
    } catch (err) {
      console.warn('Failed to query education from Supabase, using local fallback:', err);
    }
  }

  return localData;
}

/**
 * Add a new education entry
 */
export async function createEducation(arg1: any, arg2?: any): Promise<any> {
  const userId = typeof arg1 === 'string' ? arg1 : arg1?.user_id;
  const eduData = typeof arg1 === 'string' ? arg2 : arg1;

  if (!userId) throw new Error('User ID is required to create education entry');

  const newEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `edu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId,
    institution: eduData.institution?.trim() || 'Institution',
    degree: eduData.degree?.trim() || '',
    field_of_study: eduData.field_of_study?.trim() || '',
    start_date: eduData.start_date || null,
    end_date: eduData.is_current ? null : (eduData.end_date || null),
    is_current: !!eduData.is_current,
    grade: eduData.grade?.trim() || '',
    activities: eduData.activities?.trim() || '',
    description: eduData.description?.trim() || '',
    skills: Array.isArray(eduData.skills)
      ? eduData.skills.map((s: string) => s.trim()).filter(Boolean)
      : (typeof eduData.skills === 'string'
          ? eduData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const { data, error } = await supabase
    .from('profile_education')
    .insert([newEntry])
    .select()
    .single();

  if (error || !data) {
    console.error('[EducationService] Supabase create education error:', error?.message);
    throw new Error(error?.message || 'Failed to create education in database.');
  }

  const list = getLocalEducation(userId);
  saveLocalEducation(userId, [data, ...list.filter(e => e.id !== data.id)]);
  notifyEducationListeners();
  return data;
}

export type { EducationItem };

/**
 * Update an existing education entry
 */
export async function updateEducation(arg1: any, arg2: any, arg3?: any): Promise<any> {
  const educationId = arg3 !== undefined ? arg2 : arg1;
  const updateData = arg3 !== undefined ? arg3 : arg2;
  const passedUserId = arg3 !== undefined ? arg1 : undefined;

  if (!educationId) throw new Error('Education ID is required');

  const cleanedData = {
    ...updateData,
    skills: Array.isArray(updateData?.skills)
      ? updateData.skills.map((s: string) => s.trim()).filter(Boolean)
      : (typeof updateData?.skills === 'string'
          ? updateData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
          : updateData?.skills)
  };

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  let query = supabase
    .from('profile_education')
    .update(cleanedData)
    .eq('id', educationId);

  if (passedUserId) {
    query = query.eq('user_id', passedUserId);
  }

  const { data, error } = await query.select().single();

  if (error || !data) {
    console.error('[EducationService] Supabase update education error:', error?.message);
    throw new Error(error?.message || 'Failed to update education in database.');
  }

  const userId = data.user_id || passedUserId;
  if (userId) {
    const list = getLocalEducation(userId);
    const updatedList = list.map((e) => (e.id === educationId ? data : e));
    saveLocalEducation(userId, updatedList);
  }
  notifyEducationListeners();
  return data;
}

/**
 * Delete an education entry
 */
export async function deleteEducation(arg1: string, arg2?: string): Promise<boolean> {
  const educationId = arg2 ? arg2 : arg1;
  const userId = arg2 ? arg1 : undefined;

  if (!educationId) throw new Error('Education ID is required');

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  let query = supabase
    .from('profile_education')
    .delete()
    .eq('id', educationId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;

  if (error) {
    console.error('[EducationService] Supabase delete education error:', error.message);
    throw new Error(error.message || 'Failed to delete education from database.');
  }

  if (userId) {
    const list = getLocalEducation(userId);
    saveLocalEducation(userId, list.filter((e) => e.id !== educationId));
  } else if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(EDUCATION_CACHE_PREFIX)) {
        try {
          const uid = key.replace(EDUCATION_CACHE_PREFIX, '');
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          saveLocalEducation(uid, list.filter((e: any) => e.id !== educationId));
        } catch (e) {}
      }
    }
  }

  notifyEducationListeners();
  return true;
}

export const clearEducationCache = (userId?: string): void => {
  if (userId && typeof window !== 'undefined') {
    localStorage.removeItem(`${EDUCATION_CACHE_PREFIX}${userId}`);
  }
};
