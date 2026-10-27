-- Migration: 20261026000003_schema_fixes_and_performance_rules.sql
-- Description:
-- 1. Preserves cross-schema foreign keys to auth.users (profiles.id, notifications.recipient_id, notifications.actor_id) as defined in production baseline.
-- 2. Sets helper functions (is_blocked, can_view_user_content, can_view_post) as SECURITY DEFINER with SET search_path = '' (fully qualified names).
-- 3. Grants execute on helper functions to authenticated and service_role only (revokes public execution).
-- 4. Replaces auth.uid() in all RLS policies with (select auth.uid()) for subquery caching / performance.
-- 5. Ensures basic profile info is visible to signed-in users unless blocked (including private profiles for search/follow).
-- 6. Installs deliberate access rules for domain_messages, user_domains, post_media, verification_requests, and profile section tables.

-- ============================================================================
-- 1. CROSS-SCHEMA FOREIGN KEYS PRESERVED (NO DROPS)
-- ============================================================================
-- Note: Foreign keys profiles_id_fkey, notifications_recipient_id_fkey,
-- and notifications_actor_id_fkey are established in the baseline and retained.

-- ============================================================================
-- 2. HARDEN SECURITY DEFINER HELPER FUNCTIONS (SET search_path = '')
-- ============================================================================

-- A) Bidirectional Block Check
CREATE OR REPLACE FUNCTION public.is_blocked(_user_a UUID, _user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_user_id = _user_a AND blocked_user_id = _user_b)
       OR (blocker_user_id = _user_b AND blocked_user_id = _user_a)
  );
$$;

-- B) User Content Visibility (Public Profile vs Private Followers-Only + Block Check)
CREATE OR REPLACE FUNCTION public.can_view_user_content(_viewer_id UUID, _author_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    -- Author can always view own content
    _viewer_id = _author_id
    OR (
      -- Never view if blocked in either direction
      NOT public.is_blocked(_viewer_id, _author_id)
      AND (
        -- If author profile is NOT private: visible
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = _author_id AND is_private = false
        )
        -- If author profile IS private: only accepted followers can view
        OR EXISTS (
          SELECT 1 FROM public.follow_requests
          WHERE follower_user_id = _viewer_id
            AND following_user_id = _author_id
            AND status = 'accepted'
        )
      )
    )
  );
$$;

-- C) Post Visibility (Checks post.is_private, author profile.is_private, and blocks)
CREATE OR REPLACE FUNCTION public.can_view_post(_viewer_id UUID, _post_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.id = _post_id
      AND (
        -- Author can always view own post
        p.user_id = _viewer_id
        OR (
          -- No block in either direction
          NOT public.is_blocked(_viewer_id, p.user_id)
          AND (
            -- Neither post nor author profile is private
            (p.is_private = false AND pr.is_private = false)
            -- Or viewer is accepted follower of post author
            OR EXISTS (
              SELECT 1 FROM public.follow_requests
              WHERE follower_user_id = _viewer_id
                AND following_user_id = p.user_id
                AND status = 'accepted'
            )
          )
        )
      )
  );
$$;

-- Revoke public execution and restrict to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.is_blocked(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_blocked(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_view_user_content(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_user_content(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_view_post(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_post(UUID, UUID) TO authenticated, service_role;

-- ============================================================================
-- 3. REFRESH POLICIES WITH (select auth.uid()) & DELIBERATE RULES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES: Basic profile info visible to every signed-in user unless blocked
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_unblocked" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_unblocked" ON public.profiles
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked((select auth.uid()), id));

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- POSTS: Visibility governed by public.can_view_post with (select auth.uid())
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "posts_select_visibility" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;

CREATE POLICY "posts_select_visibility" ON public.posts
  FOR SELECT TO authenticated
  USING (public.can_view_post((select auth.uid()), id));

CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- POST MEDIA: Viewable if post viewable; owner creates/deletes
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "post_media_select_visibility" ON public.post_media;
DROP POLICY IF EXISTS "post_media_insert_owner" ON public.post_media;
DROP POLICY IF EXISTS "post_media_delete_owner" ON public.post_media;

CREATE POLICY "post_media_select_visibility" ON public.post_media
  FOR SELECT TO authenticated
  USING (public.can_view_post((select auth.uid()), post_id));

CREATE POLICY "post_media_insert_owner" ON public.post_media
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = (select auth.uid())));

CREATE POLICY "post_media_delete_owner" ON public.post_media
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = (select auth.uid())));

-- ----------------------------------------------------------------------------
-- POST COMMENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "post_comments_select_visibility" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_update_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;

CREATE POLICY "post_comments_select_visibility" ON public.post_comments
  FOR SELECT TO authenticated
  USING (public.can_view_post((select auth.uid()), post_id) AND NOT public.is_blocked((select auth.uid()), user_id));

CREATE POLICY "post_comments_insert_own" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.can_view_post((select auth.uid()), post_id));

CREATE POLICY "post_comments_update_own" ON public.post_comments
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "post_comments_delete_own" ON public.post_comments
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- POST LIKES, SAVES, SHARES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "post_likes_select_visibility" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;

CREATE POLICY "post_likes_select_visibility" ON public.post_likes
  FOR SELECT TO authenticated
  USING (public.can_view_post((select auth.uid()), post_id));

CREATE POLICY "post_likes_insert_own" ON public.post_likes
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.can_view_post((select auth.uid()), post_id));

CREATE POLICY "post_likes_delete_own" ON public.post_likes
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "post_saves_select_own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_insert_own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_delete_own" ON public.post_saves;

CREATE POLICY "post_saves_select_own" ON public.post_saves
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "post_saves_insert_own" ON public.post_saves
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND public.can_view_post((select auth.uid()), post_id));

CREATE POLICY "post_saves_delete_own" ON public.post_saves
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "post_shares_select_visibility" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_insert_own" ON public.post_shares;

CREATE POLICY "post_shares_select_visibility" ON public.post_shares
  FOR SELECT TO authenticated
  USING (
    ((select auth.uid()) = sender_id OR (select auth.uid()) = recipient_id)
    AND NOT public.is_blocked((select auth.uid()), sender_id)
    AND NOT public.is_blocked((select auth.uid()), recipient_id)
  );

CREATE POLICY "post_shares_insert_own" ON public.post_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND public.can_view_post((select auth.uid()), post_id)
    AND NOT public.is_blocked((select auth.uid()), recipient_id)
  );

-- ----------------------------------------------------------------------------
-- BLOCKED USERS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;

CREATE POLICY "blocked_users_select_own" ON public.blocked_users
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = blocker_user_id);

CREATE POLICY "blocked_users_insert_own" ON public.blocked_users
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = blocker_user_id AND (select auth.uid()) <> blocked_user_id);

CREATE POLICY "blocked_users_delete_own" ON public.blocked_users
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = blocker_user_id);

-- ----------------------------------------------------------------------------
-- FOLLOW REQUESTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "follow_requests_select_members" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_insert_sender" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_update_target" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_delete_members" ON public.follow_requests;

CREATE POLICY "follow_requests_select_members" ON public.follow_requests
  FOR SELECT TO authenticated
  USING (
    ((select auth.uid()) = follower_user_id OR (select auth.uid()) = following_user_id)
    AND NOT public.is_blocked(follower_user_id, following_user_id)
  );

CREATE POLICY "follow_requests_insert_sender" ON public.follow_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = follower_user_id
    AND follower_user_id <> following_user_id
    AND NOT public.is_blocked((select auth.uid()), following_user_id)
  );

CREATE POLICY "follow_requests_update_target" ON public.follow_requests
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = following_user_id OR (select auth.uid()) = follower_user_id)
  WITH CHECK ((select auth.uid()) = following_user_id OR (select auth.uid()) = follower_user_id);

CREATE POLICY "follow_requests_delete_members" ON public.follow_requests
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = follower_user_id OR (select auth.uid()) = following_user_id);

-- ----------------------------------------------------------------------------
-- USER PRIVATE DETAILS: Strict Owner Only
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_private_details_owner_all" ON public.user_private_details;

CREATE POLICY "user_private_details_owner_all" ON public.user_private_details
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- PROFILE SECTIONS (Projects, Experience, Education, Certifications, Achievements)
-- Viewable per POST_VISIBILITY (can_view_user_content); modifiable by owner
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profile_projects_select" ON public.profile_projects;
DROP POLICY IF EXISTS "profile_projects_owner_mod" ON public.profile_projects;
CREATE POLICY "profile_projects_select" ON public.profile_projects
  FOR SELECT TO authenticated
  USING (public.can_view_user_content((select auth.uid()), user_id));
CREATE POLICY "profile_projects_owner_mod" ON public.profile_projects
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "profile_experience_select" ON public.profile_experience;
DROP POLICY IF EXISTS "profile_experience_owner_mod" ON public.profile_experience;
CREATE POLICY "profile_experience_select" ON public.profile_experience
  FOR SELECT TO authenticated
  USING (public.can_view_user_content((select auth.uid()), user_id));
CREATE POLICY "profile_experience_owner_mod" ON public.profile_experience
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "profile_education_select" ON public.profile_education;
DROP POLICY IF EXISTS "profile_education_owner_mod" ON public.profile_education;
CREATE POLICY "profile_education_select" ON public.profile_education
  FOR SELECT TO authenticated
  USING (public.can_view_user_content((select auth.uid()), user_id));
CREATE POLICY "profile_education_owner_mod" ON public.profile_education
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "profile_certifications_select" ON public.profile_certifications;
DROP POLICY IF EXISTS "profile_certifications_owner_mod" ON public.profile_certifications;
CREATE POLICY "profile_certifications_select" ON public.profile_certifications
  FOR SELECT TO authenticated
  USING (public.can_view_user_content((select auth.uid()), user_id));
CREATE POLICY "profile_certifications_owner_mod" ON public.profile_certifications
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "profile_achievements_select" ON public.profile_achievements;
DROP POLICY IF EXISTS "profile_achievements_owner_mod" ON public.profile_achievements;
CREATE POLICY "profile_achievements_select" ON public.profile_achievements
  FOR SELECT TO authenticated
  USING (public.can_view_user_content((select auth.uid()), user_id));
CREATE POLICY "profile_achievements_owner_mod" ON public.profile_achievements
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- USER DOMAINS & DOMAIN MESSAGES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_domains_select" ON public.user_domains;
DROP POLICY IF EXISTS "user_domains_owner_mod" ON public.user_domains;
CREATE POLICY "user_domains_select" ON public.user_domains
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked((select auth.uid()), user_id));
CREATE POLICY "user_domains_owner_mod" ON public.user_domains
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "domain_messages_select" ON public.domain_messages;
DROP POLICY IF EXISTS "domain_messages_insert" ON public.domain_messages;
DROP POLICY IF EXISTS "domain_messages_delete_own" ON public.domain_messages;
CREATE POLICY "domain_messages_select" ON public.domain_messages
  FOR SELECT TO authenticated
  USING (NOT public.is_blocked((select auth.uid()), user_id));
CREATE POLICY "domain_messages_insert" ON public.domain_messages
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "domain_messages_delete_own" ON public.domain_messages
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- VERIFICATION REQUESTS: Table DDL & Owner view/create only
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    document_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT verification_requests_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user ON public.verification_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests (status);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_requests_owner_select" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_owner_insert" ON public.verification_requests;
CREATE POLICY "verification_requests_owner_select" ON public.verification_requests
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "verification_requests_owner_insert" ON public.verification_requests
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS: Recipient only
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;

CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = recipient_id);

CREATE POLICY "notifications_update_recipient" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = recipient_id)
  WITH CHECK ((select auth.uid()) = recipient_id);

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = actor_id
    AND (select auth.uid()) <> recipient_id
    AND NOT public.is_blocked((select auth.uid()), recipient_id)
  );

-- ----------------------------------------------------------------------------
-- CONVERSATIONS & CONVERSATION MEMBERS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_select_members" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_authenticated" ON public.conversations;

CREATE POLICY "conversations_select_members" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_member_of((select auth.uid()), id));

CREATE POLICY "conversations_insert_authenticated" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "conversation_members_select_members" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert_members" ON public.conversation_members;

CREATE POLICY "conversation_members_select_members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (public.is_member_of((select auth.uid()), conversation_id));

CREATE POLICY "conversation_members_insert_members" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    OR public.is_member_of((select auth.uid()), conversation_id)
  );

-- ----------------------------------------------------------------------------
-- MESSAGES & MESSAGE STATUS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_select_members" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;

CREATE POLICY "messages_select_members" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_member_of((select auth.uid()), conversation_id)
    AND NOT public.is_blocked((select auth.uid()), sender_id)
  );

CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND public.is_member_of((select auth.uid()), conversation_id)
  );

DROP POLICY IF EXISTS "message_status_select_members" ON public.message_status;
DROP POLICY IF EXISTS "message_status_insert_own" ON public.message_status;
DROP POLICY IF EXISTS "message_status_update_own" ON public.message_status;

CREATE POLICY "message_status_select_members" ON public.message_status
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_member_of((select auth.uid()), m.conversation_id)
    )
  );

CREATE POLICY "message_status_insert_own" ON public.message_status
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "message_status_update_own" ON public.message_status
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- UPDATES & UPDATE VIEWS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "updates_select_followers" ON public.updates;
DROP POLICY IF EXISTS "updates_insert_own" ON public.updates;
DROP POLICY IF EXISTS "updates_delete_own" ON public.updates;

CREATE POLICY "updates_select_followers" ON public.updates
  FOR SELECT TO authenticated
  USING (
    expires_at > CURRENT_TIMESTAMP
    AND public.can_view_user_content((select auth.uid()), user_id)
  );

CREATE POLICY "updates_insert_own" ON public.updates
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "updates_delete_own" ON public.updates
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "update_views_select_owner_viewer" ON public.update_views;
DROP POLICY IF EXISTS "update_views_insert_viewer" ON public.update_views;

CREATE POLICY "update_views_select_owner_viewer" ON public.update_views
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = viewer_id
    OR EXISTS (SELECT 1 FROM public.updates u WHERE u.id = update_id AND u.user_id = (select auth.uid()))
  );

CREATE POLICY "update_views_insert_viewer" ON public.update_views
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = viewer_id
    AND EXISTS (
      SELECT 1 FROM public.updates u
      WHERE u.id = update_id
        AND u.expires_at > CURRENT_TIMESTAMP
        AND public.can_view_user_content((select auth.uid()), u.user_id)
    )
  );
