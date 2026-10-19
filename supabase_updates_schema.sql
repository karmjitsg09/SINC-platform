-- ============================================================
-- TEMPORARY UPDATES / STORIES SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS public.updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT updates_has_content CHECK (NULLIF(BTRIM(content), '') IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_updates_active ON public.updates (expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_user_active ON public.updates (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_category_active ON public.updates (category_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.update_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES public.updates(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT update_views_unique_view UNIQUE (update_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_update_views_viewer ON public.update_views (viewer_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_update_views_update ON public.update_views (update_id);

ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "updates_select_active_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_insert_own_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_update_own_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_delete_own_policy" ON public.updates;
DROP POLICY IF EXISTS "update_views_select_own_policy" ON public.update_views;
DROP POLICY IF EXISTS "update_views_insert_own_policy" ON public.update_views;

CREATE POLICY "updates_select_active_policy" ON public.updates
  FOR SELECT USING (expires_at > NOW() AND (auth.uid() = user_id OR public.can_view_user_content(user_id)));

CREATE POLICY "updates_insert_own_policy" ON public.updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "updates_update_own_policy" ON public.updates
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "updates_delete_own_policy" ON public.updates
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "update_views_select_own_policy" ON public.update_views
  FOR SELECT USING (auth.uid() = viewer_id);

CREATE POLICY "update_views_insert_own_policy" ON public.update_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.updates;
  END IF;
END $$;

-- Optional media bucket used by the authenticated story composer.
INSERT INTO storage.buckets (id, name, public)
VALUES ('updates-media', 'updates-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "updates_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_owner_delete" ON storage.objects;

CREATE POLICY "updates_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'updates-media');

CREATE POLICY "updates_media_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'updates-media'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "updates_media_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'updates-media'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );
