import { supabase, supabaseAdmin, isSupabaseConfigured } from './supabase';
import { getCategoryMatchValues } from '../data/mockData';

const listeners = new Set();
const notifyListeners = () => {
  listeners.forEach((fn) => fn());
};

export const subscribeToPostState = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ============================================================
// FORMAT POST ROW (SUPPORTS BOTH NEW POST_MEDIA & LEGACY POSTS)
// ============================================================
export const formatPostRow = (p, mediaRows = []) => {
  const userId = p.user_id || p.author_id;
  const userProf = p.profiles || p.profile || {};

  // Build normalized media items list
  let postMedia = [];
  if (Array.isArray(mediaRows) && mediaRows.length > 0) {
    postMedia = [...mediaRows].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  } else if (p.post_media && Array.isArray(p.post_media) && p.post_media.length > 0) {
    postMedia = [...p.post_media].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  } else if (p.video_url) {
    postMedia = [{ id: 'legacy-video', media_type: 'video', media_url: p.video_url, display_order: 0, layout_type: 'single' }];
  } else if (p.image_url) {
    let parsed = null;
    if (typeof p.image_url === 'string' && p.image_url.trim().startsWith('[')) {
      try {
        parsed = JSON.parse(p.image_url);
      } catch (e) {}
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      postMedia = [...parsed].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    } else {
      postMedia = [{ id: 'legacy-image', media_type: 'image', media_url: p.image_url, display_order: 0, layout_type: 'single' }];
    }
  }

  const effectiveLayout =
    postMedia.find((m) => m.layout_type)?.layout_type ||
    postMedia[0]?.layout_type ||
    (postMedia.length > 1 ? 'collage' : 'single');
  const hasVideo = postMedia.some((m) => m.media_type === 'video') || !!p.video_url;
  const hasImage = postMedia.some((m) => m.media_type === 'image') || !!p.image_url;
  const computedPostType = p.post_type || (hasVideo ? 'video' : hasImage ? 'image' : 'text');

  return {
    id: p.id,
    user_id: userId,
    author_id: userId,
    author: userProf.name || p.author || 'User',
    username: userProf.username || p.username || 'user',
    role: userProf.role || p.role || 'Member',
    avatar_url: userProf.avatar_url || p.avatar_url || p.avatarUrl || null,
    avatarUrl: userProf.avatar_url || p.avatar_url || p.avatarUrl || null,
    domain: p.domain || p.domain_id || 'tech',
    domain_id: p.domain || p.domain_id || 'tech',
    title: p.title || p.content?.substring(0, 50) || 'Post',
    content: p.content || '',
    post_type: computedPostType,
    mediaType: computedPostType,
    media_type: computedPostType,
    media: postMedia,
    layout: effectiveLayout,
    mediaUrl: postMedia[0]?.media_url || p.image_url || p.video_url || null,
    media_url: postMedia[0]?.media_url || p.image_url || p.video_url || null,
    image_url: p.image_url || (postMedia.find((m) => m.media_type === 'image')?.media_url || null),
    video_url: p.video_url || (postMedia.find((m) => m.media_type === 'video')?.media_url || null),
    codeSnippet: p.code_snippet || p.codeSnippet || null,
    code_snippet: p.code_snippet || p.codeSnippet || null,
    codeLanguage: p.code_language || p.codeLanguage || null,
    code_language: p.code_language || p.codeLanguage || null,
    created_at: p.created_at
  };
};

// Helper to batch fetch and attach media items from public.post_media
const attachPostMedia = async (postsList) => {
  if (!postsList || postsList.length === 0) return [];
  const postIds = postsList.map((p) => p.id).filter(Boolean);
  if (postIds.length === 0) return postsList.map((p) => formatPostRow(p));

  let mediaMap = {};
  try {
    const { data: mediaData, error } = await supabase
      .from('post_media')
      .select('*')
      .in('post_id', postIds)
      .order('display_order', { ascending: true });

    if (!error && mediaData && Array.isArray(mediaData)) {
      mediaData.forEach((item) => {
        if (!mediaMap[item.post_id]) mediaMap[item.post_id] = [];
        mediaMap[item.post_id].push(item);
      });
    }
  } catch (e) {
    // If post_media table is not created yet, formatPostRow falls back to legacy columns
  }

  return postsList.map((p) => formatPostRow(p, mediaMap[p.id] || []));
};

// Helper to convert File to base64 DataURL as rock-solid fallback
const fileToDataUrl = (file) => {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

// ============================================================
// UPLOAD MEDIA FILE TO SUPABASE STORAGE
// Unique path format: posts/<userId>/<postId>/<unique-id>.<ext>
// ============================================================
export const uploadPostMediaFile = async (file, userId, postId) => {
  if (!file || !userId || !postId) return null;

  const rawExt = file.name ? file.name.split('.').pop().toLowerCase() : '';
  const isVideo = file.type ? file.type.startsWith('video') : false;
  const ext = rawExt || (isVideo ? 'mp4' : 'jpg');
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const filePath = `posts/${userId}/${postId}/${uniqueId}.${ext}`;

  try {
    const clientToUse = supabaseAdmin || supabase;
    const { data, error } = await clientToUse.storage
      .from('post-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn('[PostService] Storage upload error:', error);
      return null;
    }

    const { data: publicUrlData } = clientToUse.storage
      .from('post-media')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl || null;
    console.log('Resolved media URL:', publicUrl);
    return publicUrl;
  } catch (e) {
    console.warn('[PostService] Storage upload exception:', e);
    return null;
  }
};

// ==========================================
// 1. CREATE POST (SUPPORTS 1-5 IMAGES & VIDEOS)
// ==========================================
export const createPost = async ({
  authorId,
  domain,
  content,
  title = '',
  mediaType = 'text',
  mediaUrl = null,
  mediaItems = [], // Array of { file, type: 'image'|'video', previewUrl, url }
  layout = 'single', // 'single' | 'collage' | 'carousel'
  codeSnippet = null,
  codeLanguage = null,
  onProgress = null
}) => {
  const cleanDomain = (domain || 'tech').toLowerCase();
  const cleanContent = (content || title || '').trim();

  const hasMedia = (mediaItems && mediaItems.length > 0) || !!mediaUrl;
  if (!cleanContent && !hasMedia) {
    throw new Error('Post content cannot be empty.');
  }

  // Authenticate user
  const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('[PostService] Auth getUser error:', authError);
  }

  if (!authenticatedUser || !authenticatedUser.id) {
    throw new Error('Please log in before creating a post.');
  }

  // Determine effective post type
  let effectiveType = mediaType;
  if (mediaItems.length > 0) {
    effectiveType = mediaItems.some((m) => m.type === 'video') ? 'video' : 'image';
  } else if (mediaUrl) {
    effectiveType = mediaType === 'video' ? 'video' : 'image';
  }

  // Step A: Insert the main post record into public.posts
  const initialPayload = {
    user_id: authenticatedUser.id,
    content: cleanContent,
    image_url: null,
    video_url: null,
    domain: cleanDomain,
    post_type: effectiveType
  };

  const { data: newPost, error: insertError } = await supabase
    .from('posts')
    .insert([initialPayload])
    .select('*, profiles:user_id(id, name, username, role, avatar_url)')
    .single();

  if (insertError) {
    console.error('[PostService] Supabase INSERT failed:', insertError);
    throw new Error(insertError.message || 'Supabase INSERT failed.');
  }

  if (!newPost) {
    throw new Error('Post insertion returned empty response from database.');
  }

  // Step B: Upload media items (with progress reporting)
  let uploadedMedia = [];
  if (mediaItems && mediaItems.length > 0) {
    const total = mediaItems.length;
    for (let i = 0; i < total; i++) {
      const item = mediaItems[i];
      let finalUrl = item.url;

      if (item.file) {
        if (onProgress) {
          const pct = Math.round(((i) / total) * 90) + 10;
          onProgress(pct, `Uploading ${item.type === 'video' ? 'video' : `image ${i + 1} of ${total}`}...`);
        }
        const uploadedUrl = await uploadPostMediaFile(item.file, authenticatedUser.id, newPost.id);
        if (uploadedUrl) {
          finalUrl = uploadedUrl;
        } else {
          // If storage upload fails, fallback to persistent Base64 DataURL (never dead blob)
          const fallbackDataUrl = await fileToDataUrl(item.file);
          finalUrl = fallbackDataUrl || item.url || item.previewUrl;
        }
      }

      uploadedMedia.push({
        post_id: newPost.id,
        media_type: item.type || 'image',
        media_url: finalUrl,
        display_order: i,
        layout_type: layout || (mediaItems.length > 1 ? 'collage' : 'single')
      });
    }
    if (onProgress) onProgress(100, 'Finishing up...');
  } else if (mediaUrl) {
    uploadedMedia.push({
      post_id: newPost.id,
      media_type: effectiveType === 'video' ? 'video' : 'image',
      media_url: mediaUrl,
      display_order: 0,
      layout_type: 'single'
    });
  }

  console.log('Post media:', {
    postId: newPost.id,
    media: uploadedMedia
  });

  // Step C: Insert normalized post_media rows into public.post_media
  let createdMediaRows = [];
  if (uploadedMedia.length > 0) {
    try {
      const { data: pmData, error: pmErr } = await (supabaseAdmin || supabase)
        .from('post_media')
        .insert(uploadedMedia)
        .select('*');

      if (!pmErr && pmData) {
        createdMediaRows = pmData;
      } else if (pmErr) {
        console.warn('[PostService] post_media insert notice (fallback to JSON):', pmErr.message);
      }
    } catch (e) {
      console.warn('[PostService] post_media insert exception:', e);
    }

    // Step D: Update posts table for backward compatibility & persistence across refresh
    const firstImg = uploadedMedia.find((m) => m.media_type === 'image');
    const firstVid = uploadedMedia.find((m) => m.media_type === 'video');

    // If multiple images, store the JSON array in image_url so all images persist across reloads
    const imageUrlPayload = uploadedMedia.length > 1
      ? JSON.stringify(uploadedMedia)
      : (firstImg ? firstImg.media_url : null);

    try {
      await supabase
        .from('posts')
        .update({
          image_url: imageUrlPayload,
          video_url: firstVid ? firstVid.media_url : null
        })
        .eq('id', newPost.id);
    } catch (e) {
      console.warn('[PostService] Legacy column update notice:', e);
    }
  }

  const formattedPost = formatPostRow(newPost, createdMediaRows.length > 0 ? createdMediaRows : uploadedMedia);
  notifyListeners();
  return formattedPost;
};

// ==========================================
// 2. GET ALL POSTS FROM PUBLIC.POSTS
// ==========================================
export const getPosts = async () => {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(id, name, username, role, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PostService] getPosts error:', error);
      throw error;
    }

    if (data) {
      return await attachPostMedia(data);
    }
  } catch (e) {
    console.error('[PostService] getPosts exception:', e);
  }

  return [];
};

// ==========================================
// 3. GET POSTS BY AUTHOR FROM PUBLIC.POSTS
// ==========================================
export const getPostsByAuthor = async (authorId) => {
  if (!authorId || !isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(id, name, username, role, avatar_url)')
      .eq('user_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PostService] getPostsByAuthor error:', error);
      throw error;
    }

    if (data) {
      return await attachPostMedia(data);
    }
  } catch (e) {
    console.error('[PostService] getPostsByAuthor exception:', e);
  }

  return [];
};

// ==========================================
// 4. GET POSTS BY DOMAIN FROM PUBLIC.POSTS
// ==========================================
export const getPostsByDomain = async (domain) => {
  if (!domain || domain === 'explore' || domain === 'all') {
    return getPosts();
  }

  const matchValues = getCategoryMatchValues(domain);
  const targets = matchValues.length > 0 ? matchValues : [domain.toLowerCase()];

  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(id, name, username, role, avatar_url)')
      .in('domain', targets)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PostService] getPostsByDomain error:', error);
      throw error;
    }

    if (data) {
      return await attachPostMedia(data);
    }
  } catch (e) {
    console.error('[PostService] getPostsByDomain exception:', e);
  }

  return [];
};

// ==========================================
// 5. REALTIME SUBSCRIPTION FOR PUBLIC.POSTS
// ==========================================
export const subscribeToPosts = (onNewPost, onDeletePost) => {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channel = supabase
      .channel('public_posts_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          if (payload.new && onNewPost) {
            let authorInfo = { name: 'User', role: 'Member', avatar_url: null };
            try {
              const { data: prof } = await supabase
                .from('profiles')
                .select('id, name, username, role, avatar_url')
                .eq('id', payload.new.user_id)
                .single();

              if (prof) authorInfo = prof;
            } catch (e) {}

            const [formatted] = await attachPostMedia([{ ...payload.new, profiles: authorInfo }]);
            onNewPost(formatted);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          if (payload.old?.id && onDeletePost) {
            onDeletePost(payload.old.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn('[PostService] subscribeToPosts error:', e);
  }

  return () => {};
};

// ==========================================
// 6. GET POST BY ID FROM PUBLIC.POSTS
// ==========================================
export const getPostById = async (postId) => {
  if (!postId || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(id, name, username, role, avatar_url)')
      .eq('id', postId)
      .maybeSingle();

    if (error) {
      console.error('[PostService] getPostById error:', error);
      return null;
    }

    if (data) {
      const [formatted] = await attachPostMedia([data]);
      return formatted;
    }
  } catch (e) {
    console.error('[PostService] getPostById exception:', e);
  }

  return null;
};

// ==========================================
// 7. DELETE POST FROM PUBLIC.POSTS (OWNER ONLY)
// ==========================================
export const deletePost = async (postId, userId) => {
  if (!postId) {
    throw new Error('Post ID is required for deletion.');
  }

  // Ensure authenticated user
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const effectiveUserId = userId || authUser?.id;

  if (!effectiveUserId) {
    throw new Error('You must be signed in to delete a post.');
  }

  // 1. Verify ownership before attempting deletion
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .single();

  if (fetchError) {
    console.error('[PostService] Error fetching post before deletion:', fetchError);
    throw new Error('Post could not be found or has already been deleted.');
  }

  const postOwnerId = post.user_id;
  if (postOwnerId !== effectiveUserId && (!authUser || postOwnerId !== authUser.id)) {
    throw new Error('You can only delete your own posts.');
  }

  // 2. Perform DB deletion using the real post UUID
  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (deleteError) {
    console.error('[PostService] Supabase delete error:', deleteError);
    throw deleteError;
  }

  // 3. Clean up uploaded storage files belonging strictly to this post
  try {
    const storageFolder = `posts/${postOwnerId}/${postId}`;
    const clientToUse = supabaseAdmin || supabase;
    const { data: files } = await clientToUse.storage
      .from('post-media')
      .list(storageFolder);

    if (files && Array.isArray(files) && files.length > 0) {
      const filePathsToRemove = files
        .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
        .map((f) => `${storageFolder}/${f.name}`);

      if (filePathsToRemove.length > 0) {
        await clientToUse.storage.from('post-media').remove(filePathsToRemove);
        console.log('[PostService] Post storage media cleaned up:', filePathsToRemove);
      }
    }
  } catch (storageErr) {
    console.warn('[PostService] Media storage cleanup notice:', storageErr);
  }

  // 4. Notify all app subscribers of post state changes
  notifyListeners();

  return { success: true, postId };
};
