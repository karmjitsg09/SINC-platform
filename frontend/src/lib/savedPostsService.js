import { supabase, isSupabaseConfigured } from './supabase';
import { formatPostRow } from './postService';

/**
 * Fetch all posts saved by a specific user from public.post_saves
 * Orders by post_saves.created_at DESC (newest saved first)
 * Normalizes author, profiles, and media items
 */
export const getSavedPosts = async (userId) => {
  if (!userId || !isSupabaseConfigured) {
    return [];
  }

  try {
    const query = `
      id,
      created_at,
      post_id,
      posts:post_id (
        id,
        user_id,
        content,
        image_url,
        video_url,
        domain,
        post_type,
        created_at,
        profiles:user_id (
          id,
          name,
          username,
          role,
          avatar_url
        )
      )
    `;

    const { data: saves, error } = await supabase
      .from('post_saves')
      .select(query)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SavedPostsService] Error fetching saved posts:', error);
      throw error;
    }

    if (!saves || saves.length === 0) {
      return [];
    }

    // Filter valid posts and extract post records
    const seenPostIds = new Set();
    const rawPosts = [];

    saves.forEach((save) => {
      const p = save.posts;
      if (p && p.id && !seenPostIds.has(p.id)) {
        seenPostIds.add(p.id);
        rawPosts.push({
          ...p,
          saved_at: save.created_at
        });
      }
    });

    if (rawPosts.length === 0) return [];

    // Format all posts using normalized stored media
    const formatted = rawPosts.map((p) => {
      const formattedRow = formatPostRow(p);
      return {
        ...formattedRow,
        saved_at: p.saved_at
      };
    });

    console.log('Saved posts:', {
      currentUserId: userId,
      savedCount: formatted.length,
      savedPosts: formatted
    });

    return formatted;
  } catch (err) {
    console.error('[SavedPostsService] getSavedPosts exception:', err);
    throw err;
  }
};
