import { supabase, isSupabaseConfigured } from './supabase';
import type { CertificationItem } from '@/types';

const CERTIFICATIONS_CACHE_PREFIX = 'sync_user_certifications_';

/**
 * Sort certifications: issue_date desc, then created_at desc
 */
function sortCertifications(certList: any[]): any[] {
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

function getLocalCertifications(userId: string | null | undefined): any[] {
  if (!userId) return [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`${CERTIFICATIONS_CACHE_PREFIX}${userId}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? sortCertifications(parsed) : [];
    }
  } catch (err) {
    console.warn('Error loading local certifications:', err);
  }
  return [];
}

function saveLocalCertifications(userId: string | null | undefined, certList: any[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${CERTIFICATIONS_CACHE_PREFIX}${userId}`, JSON.stringify(sortCertifications(certList)));
  } catch (err) {
    console.warn('Error saving local certifications:', err);
  }
}

const certificationListeners = new Set<() => void>();
export function subscribeToCertificationState(callback: () => void): () => void {
  certificationListeners.add(callback);
  return () => {
    certificationListeners.delete(callback);
  };
}

const notifyCertificationListeners = () => {
  certificationListeners.forEach((fn) => fn());
};

/**
 * Fetch all certifications for a user
 */
export async function getCertificationsByUserId(userId: string | null | undefined): Promise<any[]> {
  if (!userId) return [];

  const localData = getLocalCertifications(userId);

  if (isSupabaseConfigured) {
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
  }

  return localData;
}

/**
 * Add a new certification
 */
export async function createCertification(arg1: any, arg2?: any): Promise<any> {
  const userId = typeof arg1 === 'string' ? arg1 : arg1?.user_id;
  const certData = typeof arg1 === 'string' ? arg2 : arg1;

  if (!userId) throw new Error('User ID is required to create a certification');

  const newEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId,
    title: certData.title?.trim() || 'Untitled Certification',
    issuer: certData.issuer?.trim() || '',
    issue_date: certData.issue_date || null,
    expiration_date: certData.does_not_expire ? null : (certData.expiration_date || null),
    does_not_expire: !!certData.does_not_expire,
    credential_id: certData.credential_id?.trim() || '',
    credential_url: certData.credential_url?.trim() || '',
    media_url: certData.media_url?.trim() || '',
    skills: Array.isArray(certData.skills)
      ? certData.skills.map((s: string) => s.trim()).filter(Boolean)
      : (typeof certData.skills === 'string'
          ? certData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []),
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('certifications')
        .insert([newEntry])
        .select()
        .single();

      if (!error && data) {
        const list = getLocalCertifications(userId);
        saveLocalCertifications(userId, [data, ...list]);
        notifyCertificationListeners();
        return data;
      }
    } catch (err) {
      console.warn('Supabase create certification exception:', err);
    }
  }

  const list = getLocalCertifications(userId);
  saveLocalCertifications(userId, [newEntry, ...list]);
  notifyCertificationListeners();
  return newEntry;
}

export type { CertificationItem };

/**
 * Update an existing certification
 */
export async function updateCertification(arg1: any, arg2: any, arg3?: any): Promise<any> {
  const certificationId = arg3 !== undefined ? arg2 : arg1;
  const updateData = arg3 !== undefined ? arg3 : arg2;
  const passedUserId = arg3 !== undefined ? arg1 : undefined;

  if (!certificationId) throw new Error('Certification ID is required');

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
        .from('certifications')
        .update(cleanedData)
        .eq('id', certificationId)
        .select()
        .single();

      if (!error && data) {
        const userId = data.user_id || passedUserId;
        if (userId) {
          const list = getLocalCertifications(userId);
          const updatedList = list.map((c) => (c.id === certificationId ? data : c));
          saveLocalCertifications(userId, updatedList);
        }
        notifyCertificationListeners();
        return data;
      }
    } catch (err) {
      console.warn('Supabase update certification exception:', err);
    }
  }

  // Local fallback
  let affectedUserId: string | null = passedUserId || null;
  if (affectedUserId) {
    const list = getLocalCertifications(affectedUserId);
    const idx = list.findIndex((c: any) => c.id === certificationId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...cleanedData, updated_at: new Date().toISOString() };
      saveLocalCertifications(affectedUserId, list);
      notifyCertificationListeners();
      return list[idx];
    }
  }

  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CERTIFICATIONS_CACHE_PREFIX)) {
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          const idx = list.findIndex((c: any) => c.id === certificationId);
          if (idx !== -1) {
            affectedUserId = key.replace(CERTIFICATIONS_CACHE_PREFIX, '');
            list[idx] = { ...list[idx], ...cleanedData, updated_at: new Date().toISOString() };
            saveLocalCertifications(affectedUserId, list);
            notifyCertificationListeners();
            return list[idx];
          }
        } catch (e) {}
      }
    }
  }

  notifyCertificationListeners();
  return { id: certificationId, ...cleanedData };
}

/**
 * Delete a certification
 */
export async function deleteCertification(arg1: string, arg2?: string): Promise<boolean> {
  const certificationId = arg2 ? arg2 : arg1;
  const userId = arg2 ? arg1 : undefined;

  if (!certificationId) return false;

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('certifications')
        .delete()
        .eq('id', certificationId);

      if (error) {
        console.warn('Supabase delete certification error:', error);
      }
    } catch (err) {
      console.warn('Supabase delete certification exception:', err);
    }
  }

  if (userId) {
    const list = getLocalCertifications(userId);
    saveLocalCertifications(userId, list.filter((c) => c.id !== certificationId));
  } else if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CERTIFICATIONS_CACHE_PREFIX)) {
        try {
          const uid = key.replace(CERTIFICATIONS_CACHE_PREFIX, '');
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          saveLocalCertifications(uid, list.filter((c: any) => c.id !== certificationId));
        } catch (e) {}
      }
    }
  }

  notifyCertificationListeners();
  return true;
}
