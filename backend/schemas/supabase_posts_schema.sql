-- ============================================================
-- POSTS SYSTEM DATABASE SCHEMA FOR SUPABASE
-- Schema definitions, performance indexes, and RLS policies for posts
-- ============================================================

-- 1. CREATE POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  media_type TEXT DEFAULT 'none',
  media_url TEXT,
  code_snippet TEXT,
  code_language TEXT,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_domain ON public.posts(domain);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_domain_created ON public.posts(domain, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if recreating
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_update_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_policy" ON public.posts;

-- 1. SELECT POLICY: Anyone authenticated or public can view posts
CREATE POLICY "posts_select_policy" ON public.posts
  FOR SELECT
  USING (true);

-- 2. INSERT POLICY: Authenticated users can insert their own posts only
CREATE POLICY "posts_insert_policy" ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 3. UPDATE POLICY: Users can update their own posts only
CREATE POLICY "posts_update_policy" ON public.posts
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- 4. DELETE POLICY: Users can delete their own posts only
CREATE POLICY "posts_delete_policy" ON public.posts
  FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================================
-- REALTIME PUBLICATION SETUP
-- Enable Postgres Realtime change data capture for posts
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
END $$;
