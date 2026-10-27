-- Reconstructed from the live production catalog via read-only role on 2026-10-25. Already applied in production. Replace with a supabase db dump when Docker is available.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- ============================================================================
-- PUBLIC SCHEMA TABLES & CONSTRAINTS
-- ============================================================================

-- CreateTable
CREATE TABLE "public"."conversation_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_message_id" UUID,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."follow_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "follower_user_id" UUID NOT NULL,
    "following_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_status" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL DEFAULT 'user',
    "entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_saves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_saves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."post_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "video_url" TEXT,
    "domain" TEXT,
    "post_type" TEXT NOT NULL DEFAULT 'text',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."update_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "update_id" UUID NOT NULL,
    "viewer_id" UUID NOT NULL,
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "update_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" TEXT NOT NULL,
    "content" TEXT,
    "media_url" TEXT,
    "media_type" TEXT NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '24:00:00'::interval),

    CONSTRAINT "updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_conversation_members_conversation" ON "public"."conversation_members"("conversation_id" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_members_user" ON "public"."conversation_members"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_conversation_member" ON "public"."conversation_members"("conversation_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_follow_requests_follower" ON "public"."follow_requests"("follower_user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_follow_requests_following" ON "public"."follow_requests"("following_user_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_follower_following" ON "public"."follow_requests"("follower_user_id" ASC, "following_user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_message_status_message" ON "public"."message_status"("message_id" ASC);

-- CreateIndex
CREATE INDEX "idx_message_status_user" ON "public"."message_status"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "message_status_unique" ON "public"."message_status"("message_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_messages_conversation_created" ON "public"."messages"("conversation_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_messages_conversation_time" ON "public"."messages"("conversation_id" ASC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_messages_sender" ON "public"."messages"("sender_id" ASC);

-- CreateIndex
CREATE INDEX "post_comments_created_at_idx" ON "public"."post_comments"("created_at" ASC);

-- CreateIndex
CREATE INDEX "post_comments_post_id_idx" ON "public"."post_comments"("post_id" ASC);

-- CreateIndex
CREATE INDEX "post_comments_user_id_idx" ON "public"."post_comments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "post_likes_post_id_idx" ON "public"."post_likes"("post_id" ASC);

-- CreateIndex
CREATE INDEX "post_likes_user_id_idx" ON "public"."post_likes"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_post_user_like" ON "public"."post_likes"("post_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "post_saves_post_id_idx" ON "public"."post_saves"("post_id" ASC);

-- CreateIndex
CREATE INDEX "post_saves_user_id_idx" ON "public"."post_saves"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_post_user_save" ON "public"."post_saves"("post_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "post_shares_post_id_idx" ON "public"."post_shares"("post_id" ASC);

-- CreateIndex
CREATE INDEX "post_shares_recipient_id_idx" ON "public"."post_shares"("recipient_id" ASC);

-- CreateIndex
CREATE INDEX "post_shares_sender_id_idx" ON "public"."post_shares"("sender_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_post_sender_recipient" ON "public"."post_shares"("post_id" ASC, "sender_id" ASC, "recipient_id" ASC);

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "public"."posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "posts_domain_idx" ON "public"."posts"("domain" ASC);

-- CreateIndex
CREATE INDEX "posts_user_id_idx" ON "public"."posts"("user_id" ASC);

-- CreateIndex
CREATE INDEX "idx_profiles_name" ON "public"."profiles"("name" ASC);

-- CreateIndex
CREATE INDEX "idx_profiles_username" ON "public"."profiles"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "public"."profiles"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "update_views_unique_view" ON "public"."update_views"("update_id" ASC, "viewer_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "fk_conversations_last_message" FOREIGN KEY ("last_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."follow_requests" ADD CONSTRAINT "follow_requests_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."follow_requests" ADD CONSTRAINT "follow_requests_following_user_id_fkey" FOREIGN KEY ("following_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."message_status" ADD CONSTRAINT "fk_message_status_message" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_likes" ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_saves" ADD CONSTRAINT "post_saves_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_saves" ADD CONSTRAINT "post_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_shares" ADD CONSTRAINT "post_shares_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_shares" ADD CONSTRAINT "post_shares_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."post_shares" ADD CONSTRAINT "post_shares_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."update_views" ADD CONSTRAINT "update_views_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "public"."updates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."update_views" ADD CONSTRAINT "update_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."updates" ADD CONSTRAINT "updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_member_of(_conversation_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversation_members
        WHERE conversation_id = _conversation_id
          AND user_id = _user_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.update_posts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Cross-schema foreign keys pointing to auth.users
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Check Constraints
ALTER TABLE "public"."follow_requests" ADD CONSTRAINT "follow_requests_status_check" CHECK (status IN ('pending', 'accepted', 'rejected'));
ALTER TABLE "public"."message_status" ADD CONSTRAINT "message_status_status_check" CHECK (status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text]));
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_entity_type_check" CHECK (entity_type = ANY (ARRAY['user'::text, 'post'::text, 'comment'::text, 'conversation'::text, 'domain'::text, 'job'::text, 'system'::text, 'follow_request'::text]));
ALTER TABLE "public"."updates" ADD CONSTRAINT "updates_has_content" CHECK (((NULLIF(btrim(content), ''::text) IS NOT NULL) OR (media_url IS NOT NULL)));
ALTER TABLE "public"."updates" ADD CONSTRAINT "updates_media_type_check" CHECK (media_type = ANY (ARRAY['none'::text, 'image'::text, 'video'::text]));

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER posts_updated_at_trigger BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION update_posts_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE "public"."conversation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."follow_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."message_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_saves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."update_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."updates" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES
-- ============================================================================
CREATE POLICY "conversation_members_insert_authenticated" ON "public"."conversation_members"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK (true);

CREATE POLICY "conversation_members_select_member" ON "public"."conversation_members"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR is_member_of(conversation_id, auth.uid()))) ;

CREATE POLICY "conv_insert_authenticated" ON "public"."conversations"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "conv_select_member" ON "public"."conversations"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id IN ( SELECT conversation_members.conversation_id
   FROM conversation_members
  WHERE (conversation_members.user_id = auth.uid())))) ;

CREATE POLICY "conv_update_member" ON "public"."conversations"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((id IN ( SELECT conversation_members.conversation_id
   FROM conversation_members
  WHERE (conversation_members.user_id = auth.uid())))) WITH CHECK ((id IN ( SELECT conversation_members.conversation_id
   FROM conversation_members
  WHERE (conversation_members.user_id = auth.uid()))));

CREATE POLICY "Allow recipient or sender to update follow request status" ON "public"."follow_requests"
  AS PERMISSIVE FOR UPDATE TO public
  USING (((auth.uid() = following_user_id) OR (auth.uid() = follower_user_id))) ;

CREATE POLICY "Allow users to send follow requests" ON "public"."follow_requests"
  AS PERMISSIVE FOR INSERT TO public
   WITH CHECK ((auth.uid() = follower_user_id));

CREATE POLICY "Allow users to view follow requests involving them" ON "public"."follow_requests"
  AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = follower_user_id) OR (auth.uid() = following_user_id))) ;

CREATE POLICY "Users can create message status" ON "public"."message_status"
  AS PERMISSIVE FOR INSERT TO public
   WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can update message status" ON "public"."message_status"
  AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid())) ;

CREATE POLICY "Users can view message status" ON "public"."message_status"
  AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid())) ;

CREATE POLICY "msg_insert_member" ON "public"."messages"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK (((sender_id = auth.uid()) AND (conversation_id IN ( SELECT conversation_members.conversation_id
   FROM conversation_members
  WHERE (conversation_members.user_id = auth.uid())))));

CREATE POLICY "msg_select_member" ON "public"."messages"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((conversation_id IN ( SELECT conversation_members.conversation_id
   FROM conversation_members
  WHERE (conversation_members.user_id = auth.uid())))) ;

CREATE POLICY "Allow authenticated users to create notifications" ON "public"."notifications"
  AS PERMISSIVE FOR INSERT TO public
   WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE POLICY "Allow users to read their own notifications" ON "public"."notifications"
  AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = recipient_id)) ;

CREATE POLICY "Allow users to update their own notification read status" ON "public"."notifications"
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = recipient_id)) ;

CREATE POLICY "post_comments_delete_own" ON "public"."post_comments"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id)) ;

CREATE POLICY "post_comments_insert_own" ON "public"."post_comments"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "post_comments_select_authenticated" ON "public"."post_comments"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true) ;

CREATE POLICY "post_comments_update_own" ON "public"."post_comments"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "post_likes_delete_own" ON "public"."post_likes"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id)) ;

CREATE POLICY "post_likes_insert_own" ON "public"."post_likes"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "post_likes_select_authenticated" ON "public"."post_likes"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true) ;

CREATE POLICY "post_saves_delete_own" ON "public"."post_saves"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id)) ;

CREATE POLICY "post_saves_insert_own" ON "public"."post_saves"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "post_saves_select_authenticated" ON "public"."post_saves"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true) ;

CREATE POLICY "post_shares_insert_own" ON "public"."post_shares"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK ((auth.uid() = sender_id));

CREATE POLICY "post_shares_select_authenticated" ON "public"."post_shares"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true) ;

CREATE POLICY "posts_delete_own" ON "public"."posts"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id)) ;

CREATE POLICY "posts_insert_own" ON "public"."posts"
  AS PERMISSIVE FOR INSERT TO authenticated
   WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "posts_select_authenticated" ON "public"."posts"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true) ;

CREATE POLICY "posts_update_own" ON "public"."posts"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Allow public read access to profiles" ON "public"."profiles"
  AS PERMISSIVE FOR SELECT TO public
  USING (true) ;

CREATE POLICY "Allow users to insert their own profile" ON "public"."profiles"
  AS PERMISSIVE FOR INSERT TO public
   WITH CHECK ((auth.uid() = id));

CREATE POLICY "Allow users to update their own profile" ON "public"."profiles"
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id)) ;

CREATE POLICY "update_views_insert_own_policy" ON "public"."update_views"
  AS PERMISSIVE FOR INSERT TO public
   WITH CHECK ((auth.uid() = viewer_id));

CREATE POLICY "updates_delete_own_policy" ON "public"."updates"
  AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id)) ;

CREATE POLICY "updates_insert_own_policy" ON "public"."updates"
  AS PERMISSIVE FOR INSERT TO public
   WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "updates_select_active_policy" ON "public"."updates"
  AS PERMISSIVE FOR SELECT TO public
  USING ((expires_at > now())) ;

CREATE POLICY "updates_update_own_policy" ON "public"."updates"
  AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

