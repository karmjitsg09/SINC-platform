-- ============================================================
-- UNIFIED NOTIFICATION SYSTEM DATABASE SCHEMA FOR SUPABASE
-- Centralized notifications table for follow requests, likes,
-- comments, mentions, messages, domain & job activity.
-- ============================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'follow_request',
      'follow_accepted',
      'post_like',
      'post_comment',
      'comment_reply',
      'mention',
      'message',
      'domain_activity',
      'job_activity',
      'system'
    )
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('user', 'post', 'comment', 'conversation', 'domain', 'job', 'system', 'follow_request')
  ),
  entity_id TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MIGRATION FOR EXISTING TABLES (If notifications table already exists)
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_entity_type_check 
  CHECK (entity_type IN ('user', 'post', 'comment', 'conversation', 'domain', 'job', 'system', 'follow_request'));

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications(recipient_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow users to update their own notification read status" ON public.notifications;

-- Allow users to view ONLY their own received notifications
CREATE POLICY "Allow users to read their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- Allow authenticated users to create notifications
CREATE POLICY "Allow authenticated users to create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update read state of their own notifications
CREATE POLICY "Allow users to update their own notification read status"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_id);

-- ============================================================
-- SUPABASE REALTIME PUBLICATION
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
