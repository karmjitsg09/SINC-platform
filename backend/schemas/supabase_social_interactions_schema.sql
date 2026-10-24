-- ============================================================
-- SOCIAL INTERACTIONS DATABASE SCHEMA FOR SUPABASE
-- Tables, RLS policies, performance indexes, and Realtime setup
-- ============================================================

-- 1. CREATE POST LIKES TABLE
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_post_user_like UNIQUE (post_id, user_id)
);

-- 2. CREATE POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CREATE POST SAVES TABLE
CREATE TABLE IF NOT EXISTS public.post_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_post_user_save UNIQUE (post_id, user_id)
);

-- 4. CREATE POST SHARES TABLE (IN-APP USER-TO-USER SHARING)
CREATE TABLE IF NOT EXISTS public.post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_post_sender_recipient UNIQUE (post_id, sender_id, recipient_id)
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created ON public.post_comments(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_post_saves_post_id ON public.post_saves(post_id);
CREATE INDEX IF NOT EXISTS idx_post_saves_user_id ON public.post_saves(user_id);

CREATE INDEX IF NOT EXISTS idx_post_shares_post_id ON public.post_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_sender_id ON public.post_shares(sender_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_recipient_id ON public.post_shares(recipient_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- A) post_likes RLS
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select_policy" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_policy" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_policy" ON public.post_likes;

CREATE POLICY "post_likes_select_policy" ON public.post_likes
  FOR SELECT USING (true);

CREATE POLICY "post_likes_insert_policy" ON public.post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_likes_delete_policy" ON public.post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- B) post_comments RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select_policy" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_policy" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_update_policy" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_policy" ON public.post_comments;

CREATE POLICY "post_comments_select_policy" ON public.post_comments
  FOR SELECT USING (true);

CREATE POLICY "post_comments_insert_policy" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_update_policy" ON public.post_comments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_delete_policy" ON public.post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- C) post_saves RLS
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_saves_select_policy" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_insert_policy" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_delete_policy" ON public.post_saves;

CREATE POLICY "post_saves_select_policy" ON public.post_saves
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = post_saves.post_id 
      AND posts.user_id = auth.uid()
    )
  );

CREATE POLICY "post_saves_insert_policy" ON public.post_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_saves_delete_policy" ON public.post_saves
  FOR DELETE USING (auth.uid() = user_id);

-- D) post_shares RLS (IN-APP USER-TO-USER)
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_shares_select_policy" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_insert_policy" ON public.post_shares;

CREATE POLICY "post_shares_select_policy" ON public.post_shares
  FOR SELECT USING (true);

CREATE POLICY "post_shares_insert_policy" ON public.post_shares
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- REALTIME PUBLICATION SETUP
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'post_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'post_shares'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_shares;
  END IF;
END $$;
