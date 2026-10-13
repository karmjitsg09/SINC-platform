-- ============================================================
-- POST MEDIA MIGRATION (MULTIPLE IMAGES & VIDEOS)
-- Table: public.post_media
-- Purpose: Normalized storage for post media items (images, videos,
-- collages, carousels/swipeable photos)
-- ============================================================

-- 1. Create normalized post_media table
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  layout_type TEXT CHECK (layout_type IN ('single', 'collage', 'carousel')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast retrieval and ordered display
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON public.post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_order ON public.post_media(post_id, display_order);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- A) SELECT Policy: Anyone can read media of existing posts
DROP POLICY IF EXISTS "post_media_select_policy" ON public.post_media;
CREATE POLICY "post_media_select_policy" ON public.post_media
  FOR SELECT USING (true);

-- B) INSERT Policy: Authenticated users can insert media for their posts
DROP POLICY IF EXISTS "post_media_insert_policy" ON public.post_media;
CREATE POLICY "post_media_insert_policy" ON public.post_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.user_id = auth.uid()
    )
    OR auth.uid() IS NOT NULL
  );

-- C) DELETE Policy: Post owners can delete media for their posts
DROP POLICY IF EXISTS "post_media_delete_policy" ON public.post_media;
CREATE POLICY "post_media_delete_policy" ON public.post_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- 5. Backfill existing single-image & single-video posts into post_media
INSERT INTO public.post_media (post_id, media_type, media_url, display_order, layout_type, created_at)
SELECT 
  id AS post_id,
  CASE WHEN video_url IS NOT NULL THEN 'video' ELSE 'image' END AS media_type,
  COALESCE(video_url, image_url) AS media_url,
  0 AS display_order,
  'single' AS layout_type,
  created_at
FROM public.posts
WHERE (image_url IS NOT NULL OR video_url IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.post_media pm WHERE pm.post_id = posts.id
  );
