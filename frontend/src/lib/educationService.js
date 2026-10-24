import { supabase, isSupabaseConfigured } from './supabase';

const EDUCATION_CACHE_PREFIX = 'sync_user_education_';

/**
 * Sort education: current first, then start_date desc, then created_at desc
 */
function sortEducation(educationList) {
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

function getLocalEducation(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${EDUCATION_CACHE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortEducation(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local education:', err);
  }
  return [];
}

function saveLocalEducation(userId, educationList) {
  if (!userId) return;
  try {
    localStorage.setItem(`${EDUCATION_CACHE_PREFIX}${userId}`, JSON.stringify(sortEducation(educationList)));
  } catch (err) {
    console.warn('Error saving local education:', err);
  }
}

/**
 * Fetch all education entries for a user
 */
export async function getEducationByUserId(userId) {
  if (!userId) return [];

  const localData = getLocalEducation(userId);

  try {
    const { data, error } = await supabase
      .from('education')
      .select('*')
      .eq('user_id', userId)
      .order('is_current', { ascending: false })
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

  return localData;
}

/**
 * Add a new education entry
 */
export async function createEducation(userId, educationData) {
  if (!userId) throw new Error('User ID is required to create an education entry');

  const newEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `edu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    institution: educationData.institution?.trim() || 'Institution',
    degree: educationData.degree?.trim() || '',
    field_of_study: educationData.field_of_study?.trim() || '',
    location: educationData.location?.trim() || '',
    start_date: educationData.start_date || null,
    end_date: educationData.is_current ? null : (educationData.end_date || null),
    is_current: Boolean(educationData.is_current),
    description: educationData.description?.trim() || '',
    grade: educationData.grade?.trim() || '',
    activities: educationData.activities?.trim() || '',
    skills: Array.isArray(educationData.skills)
      ? educationData.skills.map(s => s.trim()).filter(Boolean)
      : (typeof educationData.skills === 'string'
          ? educationData.skills.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Optimistically store in local fallback
  const currentList = getLocalEducation(userId);
  const updatedList = sortEducation([newEntry, ...currentList]);
  saveLocalEducation(userId, updatedList);

  // 2. Try inserting into Supabase
  try {
    const { data, error } = await supabase
      .from('education')
      .insert([newEntry])
      .select()
      .single();

    if (!error && data) {
      const finalIndex = updatedList.findIndex(e => e.id === newEntry.id);
      if (finalIndex !== -1) {
        updatedList[finalIndex] = data;
        saveLocalEducation(userId, updatedList);
      }
      return data;
    }

    if (error) {
      console.warn('Supabase education insert notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to insert into Supabase education table, using optimistic entry:', err);
  }

  // Dispatch custom window event for instant reactivity
  window.dispatchEvent(new CustomEvent('sync_education_updated', { detail: { userId, education: newEntry } }));

  return newEntry;
}

/**
 * Update an existing education entry
 */
export async function updateEducation(userId, educationId, updates) {
  if (!userId || !educationId) throw new Error('User ID and Education ID are required');

  const currentList = getLocalEducation(userId);
  const existing = currentList.find(e => e.id === educationId) || {};

  const cleanUpdates = {
    ...updates,
    institution: updates.institution !== undefined ? updates.institution.trim() : existing.institution,
    degree: updates.degree !== undefined ? updates.degree.trim() : existing.degree,
    field_of_study: updates.field_of_study !== undefined ? updates.field_of_study.trim() : existing.field_of_study,
    location: updates.location !== undefined ? updates.location.trim() : existing.location,
    start_date: updates.start_date !== undefined ? updates.start_date : existing.start_date,
    end_date: updates.is_current ? null : (updates.end_date !== undefined ? updates.end_date : existing.end_date),
    is_current: updates.is_current !== undefined ? Boolean(updates.is_current) : existing.is_current,
    description: updates.description !== undefined ? updates.description.trim() : existing.description,
    grade: updates.grade !== undefined ? updates.grade.trim() : existing.grade,
    activities: updates.activities !== undefined ? updates.activities.trim() : existing.activities,
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
    id: educationId,
    user_id: userId,
  };

  // 1. Optimistically update local
  const newList = sortEducation(currentList.map(e => (e.id === educationId ? updatedEntry : e)));
  saveLocalEducation(userId, newList);

  // 2. Try updating in Supabase
  try {
    const { data, error } = await supabase
      .from('education')
      .update(cleanUpdates)
      .eq('id', educationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (!error && data) {
      const idx = newList.findIndex(e => e.id === educationId);
      if (idx !== -1) {
        newList[idx] = data;
        saveLocalEducation(userId, newList);
      }
      return data;
    }

    if (error) {
      console.warn('Supabase education update notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to update in Supabase education table:', err);
  }

  window.dispatchEvent(new CustomEvent('sync_education_updated', { detail: { userId, education: updatedEntry } }));

  return updatedEntry;
}

/**
 * Delete an education entry
 */
export async function deleteEducation(userId, educationId) {
  if (!userId || !educationId) throw new Error('User ID and Education ID are required');

  // 1. Optimistically update local
  const currentList = getLocalEducation(userId);
  const updatedList = currentList.filter(e => e.id !== educationId);
  saveLocalEducation(userId, updatedList);

  // 2. Try deleting in Supabase
  try {
    const { error } = await supabase
      .from('education')
      .delete()
      .eq('id', educationId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Supabase education delete notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to delete education from Supabase:', err);
  }

  window.dispatchEvent(new CustomEvent('sync_education_updated', { detail: { userId, deletedId: educationId } }));

  return true;
}

/**
 * Listen for education updates
 */
export function subscribeToEducationState(callback) {
  const handler = (e) => {
    if (callback) callback(e.detail);
  };
  window.addEventListener('sync_education_updated', handler);
  return () => window.removeEventListener('sync_education_updated', handler);
}
