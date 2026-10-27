-- Migration: 20261026000002_intended_access_rules.sql
-- Description: Installs authoritative intended access rules and RLS policies following POST_VISIBILITY (public-toggle).
-- Replaces over-broad policies: enforces bidirectional blocking, followers-only private visibility, member-only conversations, owner-only private details, and server-only push tables.

-- ============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS FOR RLS EVALUATION
-- ============================================================================

-- A) Bidirectional Block Check
CREATE OR REPLACE FUNCTION public.is_blocked(_user_a UUID, _user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
SET search_path TO 'public'
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
SET search_path TO 'public'
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

-- ============================================================================
-- 2. DROP OVER-BROAD POLICIES FROM BASELINE
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;

-- Posts
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;

-- Post Comments
DROP POLICY IF EXISTS "post_comments_select_authenticated" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_update_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;

-- Post Likes
DROP POLICY IF EXISTS "post_likes_select_authenticated" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;

-- Post Saves
DROP POLICY IF EXISTS "post_saves_select_authenticated" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_insert_own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_delete_own" ON public.post_saves;

-- Post Shares
DROP POLICY IF EXISTS "post_shares_select_authenticated" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_insert_own" ON public.post_shares;

-- Updates & Views
DROP POLICY IF EXISTS "updates_select_active_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_insert_own_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_update_own_policy" ON public.updates;
DROP POLICY IF EXISTS "updates_delete_own_policy" ON public.updates;
DROP POLICY IF EXISTS "update_views_insert_own_policy" ON public.update_views;

-- Follow Requests
DROP POLICY IF EXISTS "Allow users to view follow requests involving them" ON public.follow_requests;
DROP POLICY IF EXISTS "Allow users to send follow requests" ON public.follow_requests;
DROP POLICY IF EXISTS "Allow recipient or sender to update follow request status" ON public.follow_requests;

-- Notifications
DROP POLICY IF EXISTS "Allow users to read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow users to update their own notification read status" ON public.notifications;

-- Conversations & Messages
DROP POLICY IF EXISTS "conv_select_member" ON public.conversations;
DROP POLICY IF EXISTS "conv_insert_authenticated" ON public.conversations;
DROP POLICY IF EXISTS "conv_update_member" ON public.conversations;
DROP POLICY IF EXISTS "msg_select_member" ON public.messages;
DROP POLICY IF EXISTS "msg_insert_member" ON public.messages;
DROP POLICY IF EXISTS "conversation_members_select_member" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert_authenticated" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view message status" ON public.message_status;
DROP POLICY IF EXISTS "Users can create message status" ON public.message_status;
DROP POLICY IF EXISTS "Users can update message status" ON public.message_status;

-- Also drop intended policy names to guarantee idempotency on retries/re-runs
DROP POLICY IF EXISTS "profiles_select_unblocked" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "posts_select_visibility" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
DROP POLICY IF EXISTS "post_media_select_visibility" ON public.post_media;
DROP POLICY IF EXISTS "post_media_insert_owner" ON public.post_media;
DROP POLICY IF EXISTS "post_media_delete_owner" ON public.post_media;
DROP POLICY IF EXISTS "post_comments_select_visibility" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_update_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_authorized" ON public.post_comments;
DROP POLICY IF EXISTS "post_likes_select_visibility" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;
DROP POLICY IF EXISTS "post_saves_select_own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_insert_own" ON public.post_saves;
DROP POLICY IF EXISTS "post_saves_delete_own" ON public.post_saves;
DROP POLICY IF EXISTS "post_shares_select_involved" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_select_participant" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_insert_own" ON public.post_shares;
DROP POLICY IF EXISTS "updates_select_visibility" ON public.updates;
DROP POLICY IF EXISTS "updates_select_unblocked" ON public.updates;
DROP POLICY IF EXISTS "updates_insert_own" ON public.updates;
DROP POLICY IF EXISTS "updates_update_own" ON public.updates;
DROP POLICY IF EXISTS "updates_delete_own" ON public.updates;
DROP POLICY IF EXISTS "update_views_select_authorized" ON public.update_views;
DROP POLICY IF EXISTS "update_views_insert_viewer" ON public.update_views;
DROP POLICY IF EXISTS "profile_projects_select" ON public.profile_projects;
DROP POLICY IF EXISTS "profile_projects_all_own" ON public.profile_projects;
DROP POLICY IF EXISTS "profile_experience_select" ON public.profile_experience;
DROP POLICY IF EXISTS "profile_experience_all_own" ON public.profile_experience;
DROP POLICY IF EXISTS "profile_education_select" ON public.profile_education;
DROP POLICY IF EXISTS "profile_education_all_own" ON public.profile_education;
DROP POLICY IF EXISTS "profile_certifications_select" ON public.profile_certifications;
DROP POLICY IF EXISTS "profile_certifications_all_own" ON public.profile_certifications;
DROP POLICY IF EXISTS "profile_achievements_select" ON public.profile_achievements;
DROP POLICY IF EXISTS "profile_achievements_all_own" ON public.profile_achievements;
DROP POLICY IF EXISTS "profile_item_updates_select" ON public.profile_item_updates;
DROP POLICY IF EXISTS "profile_item_updates_all_own" ON public.profile_item_updates;
DROP POLICY IF EXISTS "follow_requests_select_involved" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_select_participant" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_insert_sender" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_insert_own" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_update_involved" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_update_recipient" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_delete_involved" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_delete_participant" ON public.follow_requests;
DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;
DROP POLICY IF EXISTS "user_domains_select" ON public.user_domains;
DROP POLICY IF EXISTS "user_domains_select_all" ON public.user_domains;
DROP POLICY IF EXISTS "user_domains_all_own" ON public.user_domains;
DROP POLICY IF EXISTS "user_domains_insert_own" ON public.user_domains;
DROP POLICY IF EXISTS "user_domains_delete_own" ON public.user_domains;
DROP POLICY IF EXISTS "domain_messages_select" ON public.domain_messages;
DROP POLICY IF EXISTS "domain_messages_insert_own" ON public.domain_messages;
DROP POLICY IF EXISTS "domain_messages_delete_own" ON public.domain_messages;
DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_authenticated" ON public.conversations;
DROP POLICY IF EXISTS "conversation_members_select_member" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert_authenticated" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert_member" ON public.conversation_members;
DROP POLICY IF EXISTS "messages_select_member" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
DROP POLICY IF EXISTS "message_status_select_own" ON public.message_status;
DROP POLICY IF EXISTS "message_status_select_member" ON public.message_status;
DROP POLICY IF EXISTS "message_status_all_own" ON public.message_status;
DROP POLICY IF EXISTS "message_status_insert_own" ON public.message_status;
DROP POLICY IF EXISTS "message_status_update_own" ON public.message_status;
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications;
DROP POLICY IF EXISTS "push_subscriptions_service_role" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_idempotency_keys_service_role" ON public.push_idempotency_keys;
DROP POLICY IF EXISTS "user_private_details_all_own" ON public.user_private_details;
DROP POLICY IF EXISTS "user_private_details_select_own" ON public.user_private_details;
DROP POLICY IF EXISTS "user_private_details_insert_own" ON public.user_private_details;
DROP POLICY IF EXISTS "user_private_details_update_own" ON public.user_private_details;
DROP POLICY IF EXISTS "user_private_details_delete_own" ON public.user_private_details;



-- ============================================================================
-- 3. INSTALL INTENDED ACCESS RULES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES (Public unless blocked)
-- ----------------------------------------------------------------------------
CREATE POLICY "profiles_select_unblocked" ON public.profiles
  FOR SELECT TO public
  USING (NOT public.is_blocked(auth.uid(), id));

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- POSTS (Per POST_VISIBILITY: public-toggle + followers-only + block check)
-- ----------------------------------------------------------------------------
CREATE POLICY "posts_select_visibility" ON public.posts
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), id));

CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- POST MEDIA
-- ----------------------------------------------------------------------------
CREATE POLICY "post_media_select_visibility" ON public.post_media
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id));

CREATE POLICY "post_media_insert_owner" ON public.post_media
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));

CREATE POLICY "post_media_delete_owner" ON public.post_media
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- POST COMMENTS
-- ----------------------------------------------------------------------------
CREATE POLICY "post_comments_select_visibility" ON public.post_comments
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id) AND NOT public.is_blocked(auth.uid(), user_id));

CREATE POLICY "post_comments_insert_own" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(auth.uid(), post_id));

CREATE POLICY "post_comments_update_own" ON public.post_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_delete_authorized" ON public.post_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- POST LIKES
-- ----------------------------------------------------------------------------
CREATE POLICY "post_likes_select_visibility" ON public.post_likes
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id) AND NOT public.is_blocked(auth.uid(), user_id));

CREATE POLICY "post_likes_insert_own" ON public.post_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(auth.uid(), post_id));

CREATE POLICY "post_likes_delete_own" ON public.post_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- POST SAVES (Strictly private to the user who saved)
-- ----------------------------------------------------------------------------
CREATE POLICY "post_saves_select_own" ON public.post_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "post_saves_insert_own" ON public.post_saves
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(auth.uid(), post_id));

CREATE POLICY "post_saves_delete_own" ON public.post_saves
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- POST SHARES
-- ----------------------------------------------------------------------------
CREATE POLICY "post_shares_select_involved" ON public.post_shares
  FOR SELECT TO authenticated
  USING ((auth.uid() = sender_id OR auth.uid() = recipient_id) AND NOT public.is_blocked(auth.uid(), sender_id) AND NOT public.is_blocked(auth.uid(), recipient_id));

CREATE POLICY "post_shares_insert_own" ON public.post_shares
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND NOT public.is_blocked(auth.uid(), recipient_id) AND public.can_view_post(auth.uid(), post_id));

-- ----------------------------------------------------------------------------
-- UPDATES / STORIES
-- ----------------------------------------------------------------------------
CREATE POLICY "updates_select_visibility" ON public.updates
  FOR SELECT TO authenticated
  USING (expires_at > now() AND public.can_view_user_content(auth.uid(), user_id));

CREATE POLICY "updates_insert_own" ON public.updates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "updates_update_own" ON public.updates
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "updates_delete_own" ON public.updates
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- UPDATE VIEWS
-- ----------------------------------------------------------------------------
CREATE POLICY "update_views_select_authorized" ON public.update_views
  FOR SELECT TO authenticated
  USING (auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.updates WHERE id = update_id AND user_id = auth.uid()));

CREATE POLICY "update_views_insert_viewer" ON public.update_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id AND EXISTS (SELECT 1 FROM public.updates WHERE id = update_id AND public.can_view_user_content(auth.uid(), user_id)));

-- ----------------------------------------------------------------------------
-- PROFILE SECTIONS (Projects, Experience, Education, Certs, Achievements, Updates)
-- ----------------------------------------------------------------------------
CREATE POLICY "profile_projects_select" ON public.profile_projects FOR SELECT TO public USING (public.can_view_user_content(auth.uid(), user_id));
CREATE POLICY "profile_projects_all_own" ON public.profile_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_experience_select" ON public.profile_experience FOR SELECT TO public USING (public.can_view_user_content(auth.uid(), user_id));
CREATE POLICY "profile_experience_all_own" ON public.profile_experience FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_education_select" ON public.profile_education FOR SELECT TO public USING (public.can_view_user_content(auth.uid(), user_id));
CREATE POLICY "profile_education_all_own" ON public.profile_education FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_certifications_select" ON public.profile_certifications FOR SELECT TO public USING (public.can_view_user_content(auth.uid(), user_id));
CREATE POLICY "profile_certifications_all_own" ON public.profile_certifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_achievements_select" ON public.profile_achievements FOR SELECT TO public USING (public.can_view_user_content(auth.uid(), user_id));
CREATE POLICY "profile_achievements_all_own" ON public.profile_achievements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profile_item_updates_select" ON public.profile_item_updates FOR SELECT TO public USING (public.can_view_user_content(auth.uid(), user_id));
CREATE POLICY "profile_item_updates_all_own" ON public.profile_item_updates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- DOMAINS & DOMAIN MESSAGES
-- ----------------------------------------------------------------------------
CREATE POLICY "user_domains_select" ON public.user_domains FOR SELECT TO authenticated USING (NOT public.is_blocked(auth.uid(), user_id));
CREATE POLICY "user_domains_all_own" ON public.user_domains FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "domain_messages_select" ON public.domain_messages FOR SELECT TO authenticated USING (NOT public.is_blocked(auth.uid(), user_id));
CREATE POLICY "domain_messages_insert_own" ON public.domain_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "domain_messages_delete_own" ON public.domain_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- BLOCKED USERS
-- ----------------------------------------------------------------------------
CREATE POLICY "blocked_users_select_own" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_user_id);
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_user_id);
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_user_id);

-- ----------------------------------------------------------------------------
-- USER PRIVATE DETAILS (Strictly owner only)
-- ----------------------------------------------------------------------------
CREATE POLICY "user_private_details_all_own" ON public.user_private_details FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- FOLLOW REQUESTS (Dual-party visibility, anti-block, anti-self-follow)
-- ----------------------------------------------------------------------------
CREATE POLICY "follow_requests_select_involved" ON public.follow_requests
  FOR SELECT TO authenticated
  USING ((auth.uid() = follower_user_id OR auth.uid() = following_user_id) AND NOT public.is_blocked(auth.uid(), follower_user_id) AND NOT public.is_blocked(auth.uid(), following_user_id));

CREATE POLICY "follow_requests_insert_sender" ON public.follow_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_user_id AND NOT public.is_blocked(follower_user_id, following_user_id) AND follower_user_id <> following_user_id);

CREATE POLICY "follow_requests_update_involved" ON public.follow_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = following_user_id OR auth.uid() = follower_user_id);

CREATE POLICY "follow_requests_delete_involved" ON public.follow_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = following_user_id OR auth.uid() = follower_user_id);

-- ----------------------------------------------------------------------------
-- CONVERSATIONS & MESSAGES (Member-only access)
-- ----------------------------------------------------------------------------
CREATE POLICY "conversations_select_member" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_member_of(id, auth.uid()));

CREATE POLICY "conversations_insert_authenticated" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversation_members_select_member" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member_of(conversation_id, auth.uid()));

CREATE POLICY "conversation_members_insert_authenticated" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_member_of(conversation_id, auth.uid()) AND (NOT public.is_blocked(auth.uid(), sender_id) OR sender_id = auth.uid()));

CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_member_of(conversation_id, auth.uid()));

CREATE POLICY "message_status_select_own" ON public.message_status
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "message_status_all_own" ON public.message_status
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS (Strictly recipient only)
-- ----------------------------------------------------------------------------
CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated' AND (actor_id = auth.uid() OR entity_type = 'system'));

CREATE POLICY "notifications_update_recipient" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ----------------------------------------------------------------------------
-- PUSH TABLES (Strictly server-only: service_role)
-- ----------------------------------------------------------------------------
CREATE POLICY "push_subscriptions_service_role" ON public.push_subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "push_idempotency_keys_service_role" ON public.push_idempotency_keys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
