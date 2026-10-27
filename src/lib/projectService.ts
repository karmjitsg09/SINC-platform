import { supabase, isSupabaseConfigured } from './supabase';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string | null;
  imageUrl?: string | null;
  project_url?: string | null;
  projectUrl?: string | null;
  technologies?: string[];
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  is_current?: boolean;
  isCurrent?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ProjectItem = Project;

export interface ProjectInput {
  title: string;
  description?: string;
  image_url?: string | null;
  imageUrl?: string | null;
  project_url?: string | null;
  projectUrl?: string | null;
  technologies?: string[] | string;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  is_current?: boolean;
  isCurrent?: boolean;
}

// In-memory listener set for real-time local state updates
const projectListeners = new Set<() => void>();

export const notifyProjectListeners = (): void => {
  projectListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Project listener error:', e);
    }
  });
};

export const subscribeToProjectState = (fn: () => void): (() => boolean) => {
  projectListeners.add(fn);
  return () => projectListeners.delete(fn);
};

const getStorageKey = (userId: string) => `sync_user_projects_${userId}`;

const getLocalProjects = (userId: string | null | undefined): Project[] => {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local projects:', e);
  }
  return [];
};

const saveLocalProjects = (userId: string | null | undefined, projects: Project[]): void => {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(projects));
  } catch (e) {
    console.error('Error saving local projects:', e);
  }
};

/**
 * Fetch all projects for a specific user ID
 */
export const getUserProjects = async (userId: string): Promise<Project[]> => {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profile_projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted: Project[] = data.map((d: any) => ({
          ...d,
          technologies: Array.isArray(d.skills) ? d.skills : (d.technologies || []),
          skills: Array.isArray(d.skills) ? d.skills : []
        }));
        saveLocalProjects(userId, formatted);
        return formatted;
      }
    } catch (err: any) {
      console.warn('[ProjectService] Supabase query note:', err?.message);
    }
  }

  // Fallback to local storage read cache
  return getLocalProjects(userId);
};

/**
 * Create a new project for the authenticated user
 */
export const createProject = async (userId: string, projectData: ProjectInput): Promise<Project> => {
  if (!userId || !projectData?.title?.trim()) {
    throw new Error('Title and authenticated User ID are required.');
  }

  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;

  // Normalize technologies array into skills array for profile_projects schema
  let techArray: string[] = [];
  if (Array.isArray(projectData.technologies)) {
    techArray = projectData.technologies.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
  } else if (typeof projectData.technologies === 'string') {
    techArray = projectData.technologies.split(',').map((t) => t.trim()).filter(Boolean);
  }

  const dbRecord: Record<string, any> = {
    user_id: userId,
    title: projectData.title.trim(),
    description: projectData.description?.trim() || null,
    project_url: projectData.project_url || projectData.projectUrl || null,
    skills: techArray
  };
  if (newId) dbRecord.id = newId;

  // Try Supabase insert
  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const { data, error } = await supabase
    .from('profile_projects')
    .insert([dbRecord])
    .select()
    .single();

  if (error || !data) {
    console.error('[ProjectService] Supabase insert error:', error?.message);
    throw new Error(error?.message || 'Failed to create project in database.');
  }

  const result: Project = {
    ...data,
    technologies: Array.isArray(data.skills) ? data.skills : techArray,
    skills: Array.isArray(data.skills) ? data.skills : techArray
  };

  // Update local read cache only on successful database write
  const currentLocal = getLocalProjects(userId);
  saveLocalProjects(userId, [result, ...currentLocal.filter((p) => p.id !== result.id)]);
  notifyProjectListeners();
  return result;
};

/**
 * Update an existing project
 */
export const updateProject = async (
  userId: string,
  projectId: string,
  updates: Partial<ProjectInput>
): Promise<Project | undefined> => {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required.');
  }

  let techArray: string[] | undefined = undefined;
  if (updates.technologies !== undefined) {
    if (Array.isArray(updates.technologies)) {
      techArray = updates.technologies.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
    } else if (typeof updates.technologies === 'string') {
      techArray = updates.technologies.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const dbPayload: Record<string, any> = {};

  if (updates.title !== undefined) dbPayload.title = updates.title.trim();
  if (updates.description !== undefined) dbPayload.description = updates.description.trim() || null;
  if (updates.project_url !== undefined) dbPayload.project_url = updates.project_url || null;
  if (updates.projectUrl !== undefined) dbPayload.project_url = updates.projectUrl || null;
  if (techArray !== undefined) dbPayload.skills = techArray;

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const { data, error } = await supabase
    .from('profile_projects')
    .update(dbPayload)
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    console.error('[ProjectService] Supabase update error:', error?.message);
    throw new Error(error?.message || 'Failed to update project in database.');
  }

  const result: Project = {
    ...data,
    technologies: Array.isArray(data.skills) ? data.skills : (techArray || []),
    skills: Array.isArray(data.skills) ? data.skills : (techArray || [])
  };

  // Update local read cache only on successful database write
  const currentLocal = getLocalProjects(userId);
  saveLocalProjects(userId, currentLocal.map((p) => (p.id === projectId ? result : p)));
  notifyProjectListeners();
  return result;
};

/**
 * Delete a project
 */
export const deleteProject = async (userId: string, projectId: string): Promise<boolean> => {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Database service is not configured.');
  }

  const { error } = await supabase
    .from('profile_projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);

  if (error) {
    console.error('[ProjectService] Supabase delete error:', error.message);
    throw new Error(error.message || 'Failed to delete project from database.');
  }

  const currentLocal = getLocalProjects(userId);
  saveLocalProjects(userId, currentLocal.filter((p) => p.id !== projectId));
  notifyProjectListeners();
  return true;
};

export const clearProjectCache = (userId?: string): void => {
  if (userId && typeof window !== 'undefined') {
    localStorage.removeItem(getStorageKey(userId));
  }
};
