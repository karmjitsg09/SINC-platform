-- Migration: 20261026000005_storage_buckets_and_policies.sql
-- Description: Creates storage buckets ('avatars', 'post-media', 'updates-media')
-- and establishes deliberate, privacy-preserving Row Level Security policies on storage.objects.
-- Ensures post media and updates of private accounts are shielded from strangers per ACCESS_RULES.md.

-- ============================================================================
-- 1. CREATE STORAGE BUCKETS (IDEMPOTENT)
-- ============================================================================

-- A) Avatars Bucket (Public read for unblocked users, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- B) Post Media Bucket (Public read for browser <img> tags, 50MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- C) Updates Media Bucket (Public read for browser <img> tags, 50MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'updates-media',
  'updates-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. STORAGE POLICIES ON storage.objects
-- ============================================================================

-- Drop existing SINC policies to apply idempotent updates
DROP POLICY IF EXISTS "avatars_select_unblocked" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_owner" ON storage.objects;

DROP POLICY IF EXISTS "post_media_select_visibility" ON storage.objects;
DROP POLICY IF EXISTS "post_media_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "post_media_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "post_media_delete_owner" ON storage.objects;

DROP POLICY IF EXISTS "updates_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_select_visibility" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "updates_media_update_owner" ON storage.objects;

-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- AVATARS POLICIES
-- Path: avatars/<userId>/<filename> or <userId>/<filename>
-- ----------------------------------------------------------------------------
CREATE POLICY "avatars_select_unblocked" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (select auth.uid())::text = (storage.foldername(name))[1]
      OR (select auth.uid())::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "avatars_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (select auth.uid())::text = (storage.foldername(name))[1]
      OR (select auth.uid())::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "avatars_update_owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (select auth.uid())::text = (storage.foldername(name))[1]
      OR (select auth.uid())::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "avatars_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (select auth.uid())::text = (storage.foldername(name))[1]
      OR (select auth.uid())::text = (storage.foldername(name))[2]
    )
  );

-- ----------------------------------------------------------------------------
-- POST-MEDIA POLICIES
-- Path: posts/<userId>/<postId>/<filename>
-- ----------------------------------------------------------------------------
CREATE POLICY "post_media_select_visibility" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (
      (select auth.uid())::text = (storage.foldername(name))[1]
      OR (select auth.uid())::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "post_media_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

CREATE POLICY "post_media_update_owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

CREATE POLICY "post_media_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

-- ----------------------------------------------------------------------------
-- UPDATES-MEDIA POLICIES
-- Path: stories/<userId>/<filename> or updates/<userId>/<filename>
-- ----------------------------------------------------------------------------
CREATE POLICY "updates_media_select_visibility" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'updates-media'
    AND (
      (select auth.uid())::text = (storage.foldername(name))[1]
      OR (select auth.uid())::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "updates_media_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'updates-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

CREATE POLICY "updates_media_update_owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'updates-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

CREATE POLICY "updates_media_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'updates-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

