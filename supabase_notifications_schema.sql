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
-- CONSTRAINTS MIGRATION (Ensure entity_type & type check constraints)
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_entity_type_check 
  CHECK (entity_type IN ('user', 'post', 'comment', 'conversation', 'domain', 'job', 'system', 'follow_request'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow_request', 'follow_accepted', 'post_like', 'post_comment', 'comment_reply', 'mention', 'message', 'domain_activity', 'job_activity', 'system'));

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow users to update their own notification read status" ON public.notifications;

-- 1. SELECT: Users can only read notifications intended for them
CREATE POLICY "Allow users to read their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- 2. INSERT: Authenticated users can create notifications attributing themselves as actor
CREATE POLICY "Allow authenticated users to create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = actor_id AND
    recipient_id != actor_id
  );

-- 3. UPDATE: Recipients can update the read status of their own notifications
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

-- ============================================================
-- OPTIONAL AUTOMATED DATABASE TRIGGERS (SECURITY DEFINER)
-- Creates follow_request & follow_accepted notifications automatically
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_follow_request_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_username TEXT;
  responder_username TEXT;
BEGIN
  -- 1. When a new follow request is created (pending)
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
    SELECT COALESCE(username, name, 'user') INTO sender_username
    FROM public.profiles
    WHERE id = NEW.follower_user_id;

    INSERT INTO public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      is_read
    ) VALUES (
      NEW.following_user_id,
      NEW.follower_user_id,
      'follow_request',
      'Follow Request',
      '@' || COALESCE(sender_username, 'user') || ' sent you a follow request.',
      'follow_request',
      NEW.id::text,
      FALSE
    );
  END IF;

  -- 2. When a follow request is accepted
  IF (TG_OP = 'UPDATE' AND OLD.status != 'accepted' AND NEW.status = 'accepted') THEN
    SELECT COALESCE(username, name, 'user') INTO responder_username
    FROM public.profiles
    WHERE id = NEW.following_user_id;

    -- Mark recipient's original follow_request notification as read
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE recipient_id = NEW.following_user_id
      AND actor_id = NEW.follower_user_id
      AND type = 'follow_request';

    -- Notify follower that request was accepted
    INSERT INTO public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      is_read
    ) VALUES (
      NEW.follower_user_id,
      NEW.following_user_id,
      'follow_accepted',
      'Follow Accepted',
      '@' || COALESCE(responder_username, 'user') || ' accepted your follow request.',
      'user',
      NEW.following_user_id::text,
      FALSE
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_follow_request_notification ON public.follow_requests;
CREATE TRIGGER trg_follow_request_notification
  AFTER INSERT OR UPDATE ON public.follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_follow_request_notification();

