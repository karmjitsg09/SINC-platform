import { supabase, isSupabaseConfigured } from './supabase';

const EXPERIENCE_CACHE_PREFIX = 'sync_user_experiences_';

export interface Experience {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  employment_type?: string;
  location?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current: boolean;
  description?: string;
  skills?: string[];
  created_at?: string;
  updated_at?: string;
}

export type ExperienceItem = Experience;

export interface ExperienceInput {
  job_title?: string;
  company?: string;
  employment_type?: string;
  location?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  description?: string;
  skills?: string[] | string;
}

/**
 * Sort experiences: current first, then start_date desc, then created_at desc
 */
function sortExperiences(experiences: Experience[]): Experience[] {
  return [...experiences].sort((a, b) => {
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

function getLocalExperiences(userId: string | null | undefined): Experience[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${EXPERIENCE_CACHE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortExperiences(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local experiences:', err);
  }
  return [];
}

function saveLocalExperiences(userId: string | null | undefined, experiences: Experience[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${EXPERIENCE_CACHE_PREFIX}${userId}`, JSON.stringify(sortExperiences(experiences)));
  } catch (err) {
    console.warn('Error saving local experiences:', err);
  }
}

/**
 * Fetch all experience entries for a user
 */
export async function getExperiencesByUserId(userId: string): Promise<Experience[]> {
  if (!userId) return [];

  const localData = getLocalExperiences(userId);

  try {
    const { data, error } = await supabase
      .from('experience')
      .select('*')
      .eq('user_id', userId)
      .order('is_current', { ascending: false })
      .order('start_date', { ascending: false });

    if (!error && Array.isArray(data)) {
      const sorted = sortExperiences(data);
      saveLocalExperiences(userId, sorted);
      return sorted;
    }

    if (error) {
      console.warn('Supabase experience fetch notice (using cache/local):', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to query experience from Supabase, using local fallback:', err);
  }

  return localData;
}

/**
 * Add a new experience entry
 */
export async function createExperience(userId: string, experienceData: ExperienceInput): Promise<Experience> {
  if (!userId) throw new Error('User ID is required to create an experience');

  const newEntry: Experience = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    job_title: experienceData.job_title?.trim() || 'Untitled Role',
    company: experienceData.company?.trim() || 'Company',
    employment_type: experienceData.employment_type || 'Full-time',
    location: experienceData.location?.trim() || '',
    start_date: experienceData.start_date || null,
    end_date: experienceData.is_current ? null : (experienceData.end_date || null),
    is_current: Boolean(experienceData.is_current),
    description: experienceData.description?.trim() || '',
    skills: Array.isArray(experienceData.skills)
      ? experienceData.skills.map(s => s.trim()).filter(Boolean)
      : (typeof experienceData.skills === 'string'
          ? experienceData.skills.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Optimistically store in local fallback
  const currentList = getLocalExperiences(userId);
  const updatedList = sortExperiences([newEntry, ...currentList]);
  saveLocalExperiences(userId, updatedList);

  // 2. Try inserting into Supabase
  try {
    const { data, error } = await supabase
      .from('experience')
      .insert([newEntry])
      .select()
      .single();

    if (!error && data) {
      const finalIndex = updatedList.findIndex(e => e.id === newEntry.id);
      if (finalIndex !== -1) {
        updatedList[finalIndex] = data;
        saveLocalExperiences(userId, updatedList);
      }
      return data;
    }

    if (error) {
      console.warn('Supabase experience insert notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to insert into Supabase experience table, using optimistic entry:', err);
  }

  // Dispatch custom window event for instant multi-component reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync_experience_updated', { detail: { userId, experience: newEntry } }));
  }

  return newEntry;
}

/**
 * Update an existing experience entry
 */
export async function updateExperience(userId: string, experienceId: string, updates: Partial<ExperienceInput>): Promise<Experience> {
  if (!userId || !experienceId) throw new Error('User ID and Experience ID are required');

  const currentList = getLocalExperiences(userId);
  const existing = currentList.find(e => e.id === experienceId) || {
    id: experienceId,
    user_id: userId,
    job_title: 'Untitled Role',
    company: 'Company',
    is_current: false
  };

  const cleanUpdates = {
    ...updates,
    job_title: updates.job_title !== undefined ? updates.job_title.trim() : existing.job_title,
    company: updates.company !== undefined ? updates.company.trim() : existing.company,
    employment_type: updates.employment_type !== undefined ? updates.employment_type : existing.employment_type,
    location: updates.location !== undefined ? updates.location.trim() : existing.location,
    start_date: updates.start_date !== undefined ? updates.start_date : existing.start_date,
    end_date: updates.is_current ? null : (updates.end_date !== undefined ? updates.end_date : existing.end_date),
    is_current: updates.is_current !== undefined ? Boolean(updates.is_current) : existing.is_current,
    description: updates.description !== undefined ? updates.description.trim() : existing.description,
    skills: updates.skills !== undefined
      ? (Array.isArray(updates.skills)
          ? updates.skills.map(s => s.trim()).filter(Boolean)
          : (typeof updates.skills === 'string'
              ? updates.skills.split(',').map(s => s.trim()).filter(Boolean)
              : []))
      : (existing.skills || []),
    updated_at: new Date().toISOString(),
  };

  const updatedEntry: Experience = {
    ...existing,
    ...cleanUpdates,
    id: experienceId,
    user_id: userId,
  };

  // 1. Optimistically update local
  const newList = sortExperiences(currentList.map(e => (e.id === experienceId ? updatedEntry : e)));
  saveLocalExperiences(userId, newList);

  // 2. Try updating in Supabase
  try {
    const { data, error } = await supabase
      .from('experience')
      .update(cleanUpdates)
      .eq('id', experienceId)
      .eq('user_id', userId)
      .select()
      .single();

    if (!error && data) {
      const idx = newList.findIndex(e => e.id === experienceId);
      if (idx !== -1) {
        newList[idx] = data;
        saveLocalExperiences(userId, newList);
      }
      return data;
    }

    if (error) {
      console.warn('Supabase experience update notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to update in Supabase experience table:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync_experience_updated', { detail: { userId, experience: updatedEntry } }));
  }

  return updatedEntry;
}

/**
 * Delete an experience entry
 */
export async function deleteExperience(userId: string, experienceId: string): Promise<boolean> {
  if (!userId || !experienceId) throw new Error('User ID and Experience ID are required');

  // 1. Optimistically update local
  const currentList = getLocalExperiences(userId);
  const updatedList = currentList.filter(e => e.id !== experienceId);
  saveLocalExperiences(userId, updatedList);

  // 2. Try deleting in Supabase
  try {
    const { error } = await supabase
      .from('experience')
      .delete()
      .eq('id', experienceId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Supabase experience delete notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to delete experience from Supabase:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync_experience_updated', { detail: { userId, deletedId: experienceId } }));
  }

  return true;
}

/**
 * Listen for experience updates
 */
export function subscribeToExperienceState(callback: (detail: any) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    if (callback) callback((e as CustomEvent).detail);
  };
  window.addEventListener('sync_experience_updated', handler);
  return () => window.removeEventListener('sync_experience_updated', handler);
}
