import { supabase, isSupabaseConfigured } from './supabase';

const CERTIFICATIONS_CACHE_PREFIX = 'sync_user_certifications_';

/**
 * Sort certifications: issue_date desc, then created_at desc
 */
function sortCertifications(certList) {
  return [...certList].sort((a, b) => {
    const dateA = a.issue_date ? new Date(a.issue_date).getTime() : 0;
    const dateB = b.issue_date ? new Date(b.issue_date).getTime() : 0;
    if (dateB !== dateA) {
      return dateB - dateA;
    }

    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
}

function getLocalCertifications(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${CERTIFICATIONS_CACHE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortCertifications(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local certifications:', err);
  }
  return [];
}

function saveLocalCertifications(userId, certList) {
  if (!userId) return;
  try {
    localStorage.setItem(`${CERTIFICATIONS_CACHE_PREFIX}${userId}`, JSON.stringify(sortCertifications(certList)));
  } catch (err) {
    console.warn('Error saving local certifications:', err);
  }
}

/**
 * Fetch all certifications for a user
 */
export async function getCertificationsByUserId(userId) {
  if (!userId) return [];

  const localData = getLocalCertifications(userId);

  try {
    const { data, error } = await supabase
      .from('certifications')
      .select('*')
      .eq('user_id', userId)
      .order('issue_date', { ascending: false });

    if (!error && Array.isArray(data)) {
      const sorted = sortCertifications(data);
      saveLocalCertifications(userId, sorted);
      return sorted;
    }

    if (error) {
      console.warn('Supabase certifications fetch notice (using cache/local):', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to query certifications from Supabase, using local fallback:', err);
  }

  return localData;
}

/**
 * Add a new certification
 * Supports createCertification(userId, data) or createCertification(data)
 */
export async function createCertification(arg1, arg2) {
  const userId = typeof arg1 === 'string' ? arg1 : arg1?.user_id;
  const certData = typeof arg1 === 'string' ? arg2 : arg1;

  if (!userId) throw new Error('User ID is required to create a certification');

  const newEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    name: certData.name?.trim() || 'Certification',
    issuing_organization: certData.issuing_organization?.trim() || '',
    issue_date: certData.issue_date || null,
    expiration_date: certData.does_not_expire ? null : (certData.expiration_date || null),
    does_not_expire: Boolean(certData.does_not_expire),
    credential_id: certData.credential_id?.trim() || '',
    credential_url: certData.credential_url?.trim() || '',
    description: certData.description?.trim() || '',
    skills: Array.isArray(certData.skills)
      ? certData.skills.map(s => s.trim()).filter(Boolean)
      : (typeof certData.skills === 'string'
          ? certData.skills.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Optimistically store in local fallback
  const currentList = getLocalCertifications(userId);
  const updatedList = sortCertifications([newEntry, ...currentList]);
  saveLocalCertifications(userId, updatedList);

  // 2. Try inserting into Supabase
  try {
    const { data, error } = await supabase
      .from('certifications')
      .insert([newEntry])
      .select()
      .single();

    if (!error && data) {
      const finalIndex = updatedList.findIndex(c => c.id === newEntry.id);
      if (finalIndex !== -1) {
        updatedList[finalIndex] = data;
        saveLocalCertifications(userId, updatedList);
      }
      return data;
    }

    if (error) {
      console.warn('Supabase certifications insert notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to insert into Supabase certifications table, using optimistic entry:', err);
  }

  // Dispatch custom window event for reactivity
  window.dispatchEvent(new CustomEvent('sync_certifications_updated', { detail: { userId, certification: newEntry } }));

  return newEntry;
}

/**
 * Update an existing certification
 * Supports updateCertification(userId, certId, updates) or updateCertification(certId, updates, userId)
 */
export async function updateCertification(arg1, arg2, arg3) {
  let userId, certId, updates;
  if (typeof arg1 === 'string' && typeof arg2 === 'string' && typeof arg3 === 'object') {
    userId = arg1;
    certId = arg2;
    updates = arg3;
  } else {
    certId = arg1;
    updates = arg2;
    userId = arg3 || updates?.user_id;
  }

  if (!certId) throw new Error('Certification ID is required');

  const currentList = userId ? getLocalCertifications(userId) : [];
  const existing = currentList.find(c => c.id === certId) || {};
  const effectiveUserId = userId || existing.user_id;

  const cleanUpdates = {
    ...updates,
    name: updates.name !== undefined ? updates.name.trim() : existing.name,
    issuing_organization: updates.issuing_organization !== undefined ? updates.issuing_organization.trim() : existing.issuing_organization,
    issue_date: updates.issue_date !== undefined ? updates.issue_date : existing.issue_date,
    expiration_date: updates.does_not_expire ? null : (updates.expiration_date !== undefined ? updates.expiration_date : existing.expiration_date),
    does_not_expire: updates.does_not_expire !== undefined ? Boolean(updates.does_not_expire) : existing.does_not_expire,
    credential_id: updates.credential_id !== undefined ? updates.credential_id.trim() : existing.credential_id,
    credential_url: updates.credential_url !== undefined ? updates.credential_url.trim() : existing.credential_url,
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

  const updatedEntry = {
    ...existing,
    ...cleanUpdates,
    id: certId,
    user_id: effectiveUserId,
  };

  if (effectiveUserId) {
    const newList = sortCertifications(currentList.map(c => (c.id === certId ? updatedEntry : c)));
    saveLocalCertifications(effectiveUserId, newList);
  }

  try {
    let query = supabase
      .from('certifications')
      .update(cleanUpdates)
      .eq('id', certId);

    if (effectiveUserId) {
      query = query.eq('user_id', effectiveUserId);
    }

    const { data, error } = await query.select().single();

    if (!error && data) {
      if (effectiveUserId) {
        const freshList = getLocalCertifications(effectiveUserId);
        const idx = freshList.findIndex(c => c.id === certId);
        if (idx !== -1) {
          freshList[idx] = data;
          saveLocalCertifications(effectiveUserId, freshList);
        }
      }
      return data;
    }

    if (error) {
      console.warn('Supabase certifications update notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to update in Supabase certifications table:', err);
  }

  window.dispatchEvent(new CustomEvent('sync_certifications_updated', { detail: { userId: effectiveUserId, certification: updatedEntry } }));

  return updatedEntry;
}

/**
 * Delete a certification
 * Supports deleteCertification(userId, certId) or deleteCertification(certId, userId)
 */
export async function deleteCertification(arg1, arg2) {
  let userId, certId;
  // If first argument is UUID and second is UUID, detect order
  // Usually deleteCertification(userId, certId)
  userId = arg1;
  certId = arg2;

  if (!certId && typeof arg1 === 'string') {
    certId = arg1;
    userId = null;
  }

  if (userId) {
    const currentList = getLocalCertifications(userId);
    const updatedList = currentList.filter(c => c.id !== certId);
    saveLocalCertifications(userId, updatedList);
  }

  try {
    let query = supabase.from('certifications').delete().eq('id', certId);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (error) {
      console.warn('Supabase certifications delete notice:', error.message || error);
    }
  } catch (err) {
    console.warn('Failed to delete certification from Supabase:', err);
  }

  window.dispatchEvent(new CustomEvent('sync_certifications_updated', { detail: { userId, deletedId: certId } }));

  return true;
}

/**
 * Listen for certification updates
 */
export function subscribeToCertificationState(callback) {
  const handler = (e) => {
    if (callback) callback(e.detail);
  };
  window.addEventListener('sync_certifications_updated', handler);
  return () => window.removeEventListener('sync_certifications_updated', handler);
}
