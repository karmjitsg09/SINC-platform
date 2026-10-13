-- ============================================================
-- POST INSIGHTS RLS ENHANCEMENT
-- Table: public.post_saves
-- Purpose: Allow the owner of a post to read save interactions
-- on their own post for owner-only insights, while keeping saves
-- private from non-owners and maintaining saver privacy.
-- ============================================================

-- Ensure Row Level Security is enabled
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

-- Drop existing select policies to avoid conflict
DROP POLICY IF EXISTS "post_saves_select_policy" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_owner_select_policy" ON public.post_saves;

-- Combined SELECT Policy:
-- 1. A user can read their own saved posts (auth.uid() = user_id)
-- 2. The author/owner of the post can view who saved their post
CREATE POLICY "post_saves_select_policy" ON public.post_saves
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = post_saves.post_id 
      AND posts.user_id = auth.uid()
    )
  );
