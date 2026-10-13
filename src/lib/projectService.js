import { supabase, isSupabaseConfigured } from './supabase';

// In-memory listener set for real-time local state updates
const projectListeners = new Set();

export const notifyProjectListeners = () => {
  projectListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Project listener error:', e);
    }
  });
};

export const subscribeToProjectState = (fn) => {
  projectListeners.add(fn);
  return () => projectListeners.delete(fn);
};

const getStorageKey = (userId) => `sync_user_projects_${userId}`;

const getLocalProjects = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local projects:', e);
  }
  return [];
};

const saveLocalProjects = (userId, projects) => {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(projects));
  } catch (e) {
    console.error('Error saving local projects:', e);
  }
};

/**
 * Fetch all projects for a specific user ID
 */
export const getUserProjects = async (userId) => {
  if (!userId) return [];

  let dbProjects = null;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        dbProjects = data;
        saveLocalProjects(userId, data);
        return data;
      }
    } catch (err) {
      // Table may not yet be provisioned; fallback to local storage
      console.warn('[ProjectService] Supabase query note:', err.message);
    }
  }

  // Fallback to local storage
  return getLocalProjects(userId);
};

/**
 * Create a new project for the authenticated user
 */
export const createProject = async (userId, projectData) => {
  if (!userId || !projectData?.title?.trim()) {
    throw new Error('Title and authenticated User ID are required.');
  }

  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`;
  const now = new Date().toISOString();

  // Normalize technologies array
  let techArray = [];
  if (Array.isArray(projectData.technologies)) {
    techArray = projectData.technologies.map((t) => (typeof t === 'string' ? t.trim() : t)).filter(Boolean);
  } else if (typeof projectData.technologies === 'string') {
    techArray = projectData.technologies.split(',').map((t) => t.trim()).filter(Boolean);
  }

  const projectRecord = {
    id: newId,
    user_id: userId,
    title: projectData.title.trim(),
    description: projectData.description?.trim() || '',
    image_url: projectData.image_url || projectData.imageUrl || null,
    project_url: projectData.project_url || projectData.projectUrl || null,
    technologies: techArray,
    start_date: projectData.start_date || projectData.startDate || null,
    end_date: projectData.is_current || projectData.isCurrent ? null : (projectData.end_date || projectData.endDate || null),
    is_current: Boolean(projectData.is_current ?? projectData.isCurrent ?? false),
    created_at: now,
    updated_at: now
  };

  // Try Supabase insert
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert(projectRecord)
        .select()
        .single();

      if (!error && data) {
        // Sync local cache
        const currentLocal = getLocalProjects(userId);
        saveLocalProjects(userId, [data, ...currentLocal.filter((p) => p.id !== data.id)]);
        notifyProjectListeners();
        return data;
      }
    } catch (err) {
      console.warn('[ProjectService] Supabase insert note:', err.message);
    }
  }

  // Fallback local update
  const currentLocal = getLocalProjects(userId);
  const updatedList = [projectRecord, ...currentLocal.filter((p) => p.id !== projectRecord.id)];
  saveLocalProjects(userId, updatedList);
  notifyProjectListeners();
  return projectRecord;
};

/**
 * Update an existing project
 */
export const updateProject = async (userId, projectId, updates) => {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required.');
  }

  const now = new Date().toISOString();

  let techArray = undefined;
  if (updates.technologies !== undefined) {
    if (Array.isArray(updates.technologies)) {
      techArray = updates.technologies.map((t) => (typeof t === 'string' ? t.trim() : t)).filter(Boolean);
    } else if (typeof updates.technologies === 'string') {
      techArray = updates.technologies.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const payload = {
    updated_at: now
  };

  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.description !== undefined) payload.description = updates.description.trim();
  if (updates.image_url !== undefined) payload.image_url = updates.image_url;
  if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
  if (updates.project_url !== undefined) payload.project_url = updates.project_url;
  if (updates.projectUrl !== undefined) payload.project_url = updates.projectUrl;
  if (techArray !== undefined) payload.technologies = techArray;
  if (updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.end_date !== undefined) payload.end_date = updates.end_date;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;
  if (updates.is_current !== undefined) payload.is_current = Boolean(updates.is_current);
  if (updates.isCurrent !== undefined) payload.is_current = Boolean(updates.isCurrent);

  if (payload.is_current) {
    payload.end_date = null;
  }

  // Try Supabase update
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (!error && data) {
        const currentLocal = getLocalProjects(userId);
        saveLocalProjects(userId, currentLocal.map((p) => (p.id === projectId ? { ...p, ...data } : p)));
        notifyProjectListeners();
        return data;
      }
    } catch (err) {
      console.warn('[ProjectService] Supabase update note:', err.message);
    }
  }

  // Fallback local update
  const currentLocal = getLocalProjects(userId);
  const updatedList = currentLocal.map((p) => {
    if (p.id === projectId) {
      return { ...p, ...payload };
    }
    return p;
  });
  saveLocalProjects(userId, updatedList);
  notifyProjectListeners();
  return updatedList.find((p) => p.id === projectId);
};

/**
 * Delete a project
 */
export const deleteProject = async (userId, projectId) => {
  if (!userId || !projectId) {
    throw new Error('User ID and Project ID are required.');
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);

      if (!error) {
        const currentLocal = getLocalProjects(userId);
        saveLocalProjects(userId, currentLocal.filter((p) => p.id !== projectId));
        notifyProjectListeners();
        return true;
      }
    } catch (err) {
      console.warn('[ProjectService] Supabase delete note:', err.message);
    }
  }

  // Fallback local update
  const currentLocal = getLocalProjects(userId);
  saveLocalProjects(userId, currentLocal.filter((p) => p.id !== projectId));
  notifyProjectListeners();
  return true;
};
