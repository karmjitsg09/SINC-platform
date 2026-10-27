-- ============================================================================
-- Migration: 20261026000007_rls_insert_returning_fix.sql
-- Description: Enforces strict, verified access controls:
--              1. Author fast-path SELECT for posts, post_media, post_likes, post_comments
--                 (strictly letting authors view only their OWN rows).
--              2. push_subscriptions: authenticated users may ONLY select/insert/update/delete
--                 rows where user_id = (select auth.uid()).
--              3. push_idempotency_keys: strictly zero client access (service_role only).
--              4. notifications: recipients may ONLY select/update/delete their own rows.
--                 Client inserts strictly require actor_id = (select auth.uid()) and must be
--                 cryptographically tied to a real event (follow request, like, comment, message, share).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. POSTS: Fast-path for author's own rows; can_view_post for others
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "posts_select_visibility" ON public.posts;
CREATE POLICY "posts_select_visibility" ON public.posts
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.can_view_post((select auth.uid()), id)
  );

-- ----------------------------------------------------------------------------
-- 2. POST MEDIA: Fast-path for post owner's own media; can_view_post for others
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "post_media_select_visibility" ON public.post_media;
CREATE POLICY "post_media_select_visibility" ON public.post_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = (select auth.uid()))
    OR public.can_view_post((select auth.uid()), post_id)
  );

-- ----------------------------------------------------------------------------
-- 3. POST LIKES: Fast-path for liker's own like; can_view_post for others
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "post_likes_select_visibility" ON public.post_likes;
CREATE POLICY "post_likes_select_visibility" ON public.post_likes
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.can_view_post((select auth.uid()), post_id)
  );

-- ----------------------------------------------------------------------------
-- 4. POST COMMENTS: Fast-path for author's own comment; can_view_post for others
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "post_comments_delete_authorized" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_select_visibility" ON public.post_comments;
CREATE POLICY "post_comments_select_visibility" ON public.post_comments
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (public.can_view_post((select auth.uid()), post_id) AND NOT public.is_blocked((select auth.uid()), user_id))
  );

-- ----------------------------------------------------------------------------
-- 5. PUSH SUBSCRIPTIONS: Strictly own rows only
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. PUSH IDEMPOTENCY KEYS: Zero client access (service_role only)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.push_idempotency_keys FROM anon, authenticated, public;
GRANT ALL ON public.push_idempotency_keys TO service_role;

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATIONS: Event Validation Helper Function (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_notification_event(
  p_actor_id uuid,
  p_recipient_id uuid,
  p_type text,
  p_entity_type text,
  p_entity_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Basic validity checks
  IF p_actor_id IS NULL OR p_recipient_id IS NULL OR p_actor_id = p_recipient_id THEN
    RETURN false;
  END IF;

  -- Blocked check
  IF public.is_blocked(p_actor_id, p_recipient_id) THEN
    RETURN false;
  END IF;

  -- 1. Follow Request: follower is actor, following is recipient
  IF p_type IN ('follow_request', 'follow') OR p_entity_type = 'follow_request' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follow_requests fr
      WHERE fr.follower_user_id = p_actor_id
        AND fr.following_user_id = p_recipient_id
        AND (p_entity_id IS NULL OR fr.id::text = p_entity_id)
    );
  END IF;

  -- 2. Follow Accepted: following is actor, follower is recipient, status accepted
  IF p_type IN ('follow_accepted', 'follow_accept') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follow_requests fr
      WHERE fr.following_user_id = p_actor_id
        AND fr.follower_user_id = p_recipient_id
        AND fr.status = 'accepted'
    );
  END IF;

  -- 3. Post Like: actor liked a post authored by recipient
  IF p_type IN ('like', 'post_like') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.post_likes pl
      JOIN public.posts p ON p.id = pl.post_id
      WHERE pl.user_id = p_actor_id
        AND p.user_id = p_recipient_id
        AND (p_entity_id IS NULL OR pl.post_id::text = p_entity_id)
    );
  END IF;

  -- 4. Post Comment: actor commented on a post authored by recipient
  IF p_type IN ('comment', 'post_comment') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.post_comments pc
      JOIN public.posts p ON p.id = pc.post_id
      WHERE pc.user_id = p_actor_id
        AND p.user_id = p_recipient_id
        AND (p_entity_id IS NULL OR pc.id::text = p_entity_id OR pc.post_id::text = p_entity_id)
    );
  END IF;

  -- 5. Direct Message: actor sent a message to a conversation containing recipient
  IF p_type IN ('message', 'direct_message') OR p_entity_type = 'conversation' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.sender_id = p_actor_id
        AND cm.user_id = p_recipient_id
        AND (p_entity_id IS NULL OR m.id::text = p_entity_id OR m.conversation_id::text = p_entity_id)
    );
  END IF;

  -- 6. Post Share: actor shared a post with recipient
  IF p_type IN ('share', 'post_share') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.post_shares ps
      WHERE ps.sender_id = p_actor_id
        AND ps.recipient_id = p_recipient_id
        AND (p_entity_id IS NULL OR ps.post_id::text = p_entity_id)
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_valid_notification_event(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_notification_event(uuid, uuid, text, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 8. NOTIFICATIONS: Recipient-only read/update/delete; Verified Event client insert
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;

-- Recipients may ONLY select their own incoming notifications
CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = (select auth.uid()));

-- Recipients may ONLY update their own incoming notifications (e.g. is_read)
CREATE POLICY "notifications_update_recipient" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = (select auth.uid()))
  WITH CHECK (recipient_id = (select auth.uid()));

-- Recipients may ONLY delete their own incoming notifications
CREATE POLICY "notifications_delete_recipient" ON public.notifications
  FOR DELETE TO authenticated
  USING (recipient_id = (select auth.uid()));

-- Clients may insert notifications ONLY if actor is self, not blocked, and tied to a real event
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (select auth.uid())
    AND (select auth.uid()) <> recipient_id
    AND NOT public.is_blocked((select auth.uid()), recipient_id)
    AND public.is_valid_notification_event((select auth.uid()), recipient_id, type, entity_type, entity_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
