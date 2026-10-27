import { supabase, isSupabaseConfigured } from './supabase';

export const UPDATE_MEDIA_BUCKET = 'updates-media';

const UPDATE_COLUMNS = 'id, user_id, category_id, content, media_url, media_type, created_at, expires_at';

function logSupabaseError(operation, error) {
  if (!error) return;
  console.error('[Updates] Supabase request failed', {
    operation,
    supabaseErrorCode: error.code || null,
    message: error.message || null,
    details: error.details || null,
    hint: error.hint || null,
    httpStatus: error.status || null
  });
}

async function getAuthenticatedUserId(operation, expectedUserId = null) {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    logSupabaseError(operation, error);
    return { userId: null, error };
  }

  const authenticatedUserId = data?.user?.id || null;
  if (!authenticatedUserId || (expectedUserId && authenticatedUserId !== expectedUserId)) {
    const authError = new Error('No matching authenticated Supabase user is available.');
    authError.status = 401;
    logSupabaseError(operation, authError);
    return { userId: null, error: authError };
  }

  return { userId: authenticatedUserId, error: null };
}

async function attachProfiles(updates) {
  if (updates.length === 0) return updates;
  const userIds = [...new Set(updates.map((update) => update.user_id).filter(Boolean))];
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .in('id', userIds);

  if (error) {
    logSupabaseError('load update profiles', error);
  }

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return updates.map((update) => normalizeUpdate({ ...update, profile: profilesById.get(update.user_id) }));
}

function normalizeUpdate(update) {
  const profile = update.profile || {};
  return {
    ...update,
    profile: {
      id: profile.id || update.user_id,
      name: profile.name || profile.username || 'User',
      username: profile.username || '',
      avatar_url: profile.avatar_url || null,
      is_verified: Boolean(profile.is_verified)
    }
  };
}

export async function getActiveUpdates() {
  if (!isSupabaseConfigured) return { data: [], error: null };

  const { data, error } = await supabase
    .from('updates')
    .select(UPDATE_COLUMNS)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    logSupabaseError('load active updates', error);
    return { data: [], error };
  }

  return { data: await attachProfiles(data || []), error: null };
}

export async function createUpdate({ id, userId, categoryId, content, mediaUrl = null, mediaType = 'none' }) {
  if (!isSupabaseConfigured || !userId) return { data: null, error: new Error('Updates require an authenticated Supabase user.') };

  const authenticated = await getAuthenticatedUserId('create update', userId);
  if (authenticated.error) return { data: null, error: authenticated.error };

  const updateId = id || crypto.randomUUID();
  const { data, error } = await supabase
    .from('updates')
    .insert({
      id: updateId,
      user_id: authenticated.userId,
      category_id: categoryId,
      content: content?.trim() || null,
      media_url: mediaUrl || null,
      media_type: mediaType,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    .select(UPDATE_COLUMNS)
    .single();

  if (error) {
    logSupabaseError('create update', error);
    return { data: null, error };
  }

  const [withProfile] = await attachProfiles([data]);
  return { data: withProfile, error: null };
}

export async function uploadUpdateMedia(file, userId, updateId) {
  if (!isSupabaseConfigured || !file || !userId || !updateId) {
    return { data: null, error: new Error('Media uploads require an authenticated Supabase user.') };
  }

  const authenticated = await getAuthenticatedUserId('upload update media', userId);
  if (authenticated.error) return { data: null, error: authenticated.error };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `updates/${authenticated.userId}/${updateId}/${safeName}`;
  const upload = await supabase.storage.from(UPDATE_MEDIA_BUCKET).upload(path, file, { upsert: false });
  if (upload.error) {
    logSupabaseError('upload update media', upload.error);
    return { data: null, error: upload.error };
  }

  const publicUrl = supabase.storage.from(UPDATE_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  return { data: { path, publicUrl }, error: null };
}

export async function removeUpdateMedia(path, userId) {
  if (!isSupabaseConfigured || !path || !userId) return { error: null };
  const authenticated = await getAuthenticatedUserId('remove failed update media', userId);
  if (authenticated.error) return { error: authenticated.error };

  const { error } = await supabase.storage.from(UPDATE_MEDIA_BUCKET).remove([path]);
  if (error) logSupabaseError('remove failed update media', error);
  return { error };
}

export function classifyUpdateError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (message.includes('bucket not found')) return 'storage-bucket-missing';
  if (message.includes('jwt') || message.includes('auth') || error?.status === 401) return 'authentication';
  if (error?.status >= 500 || message.includes('network') || message.includes('fetch')) return 'network';
  return 'database';
}

export async function deleteUpdate(updateId, userId) {
  if (!isSupabaseConfigured || !updateId || !userId) return { error: new Error('Unable to delete this update.') };
  const authenticated = await getAuthenticatedUserId('delete update', userId);
  if (authenticated.error) return { error: authenticated.error };
  const { error } = await supabase.from('updates').delete().eq('id', updateId).eq('user_id', authenticated.userId);
  if (error) logSupabaseError('delete update', error);
  return { error };
}

export async function recordUpdateView(updateId, viewerId) {
  if (!isSupabaseConfigured || !updateId) return { error: null };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authenticatedUserId = authData?.user?.id || null;
  if (authError || !authenticatedUserId) {
    logSupabaseError('record update view auth check', authError || new Error('No authenticated Supabase user.'));
    return { error: authError || new Error('No authenticated Supabase user.') };
  }

  console.debug('[Updates] Recording Story view', {
    operation: 'record update view',
    authenticatedUserId,
    viewerId: authenticatedUserId,
    suppliedViewerId: viewerId || null,
    updateId
  });

  const { error } = await supabase
    .from('update_views')
    .insert({ update_id: updateId, viewer_id: authenticatedUserId });

  if (error?.code === '23505') return { error: null };
  if (error) {
    console.error('[Updates] Supabase request failed', {
      operation: 'record update view',
      authenticatedUserId,
      viewerId: authenticatedUserId,
      updateId,
      supabaseErrorCode: error.code || null,
      message: error.message || null,
      details: error.details || null,
      hint: error.hint || null,
      httpStatus: error.status || null
    });
  }
  return { error };
}

export async function getViewedUpdateIds(updateIds, viewerId) {
  if (!isSupabaseConfigured || !viewerId || updateIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('update_views')
    .select('update_id')
    .eq('viewer_id', viewerId)
    .in('update_id', updateIds);
  if (error) {
    logSupabaseError('load viewed update ids', error);
    return new Set();
  }
  return new Set((data || []).map((view) => view.update_id));
}

export function subscribeToUpdates(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('public:updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'updates' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
