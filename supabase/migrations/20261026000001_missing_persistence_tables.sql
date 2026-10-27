-- Migration: 20261026000001_missing_persistence_tables.sql
-- Description: Adds missing database tables and columns discovered in persistence gaps audit.
-- Consolidates and supersedes unapplied draft migrations (20261016, 20261020, 20261025).

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO EXISTING PRODUCTION TABLES
-- ============================================================================

-- A) Profiles: Privacy switch and verification badge fields
ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'none';

-- B) Posts: Privacy toggle
ALTER TABLE "public"."posts"
  ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false;

-- C) Follow Requests: Authoritative acceptance timestamp
ALTER TABLE "public"."follow_requests"
  ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ(6);

-- Trigger to set accepted_at strictly upon transition to 'accepted'
CREATE OR REPLACE FUNCTION public.set_follow_request_accepted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
    NEW.accepted_at := now();
  ELSE
    NEW.accepted_at := OLD.accepted_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_request_accepted_at ON public.follow_requests;
CREATE TRIGGER trg_follow_request_accepted_at
  BEFORE UPDATE ON public.follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_follow_request_accepted_at();

-- ============================================================================
-- 2. CREATE MISSING PERSISTENCE TABLES
-- ============================================================================

-- A) Blocked Users (Bidirectional user blocking)
CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "blocker_user_id" UUID NOT NULL,
  "blocked_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blocked_users_unique" UNIQUE ("blocker_user_id", "blocked_user_id"),
  CONSTRAINT "blocked_users_no_self_block" CHECK ("blocker_user_id" <> "blocked_user_id"),
  CONSTRAINT "blocked_users_blocker_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "blocked_users_blocked_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_blocked_users_blocker" ON "public"."blocked_users"("blocker_user_id");
CREATE INDEX IF NOT EXISTS "idx_blocked_users_blocked" ON "public"."blocked_users"("blocked_user_id");

-- B) User Private Details (Isolated sensitive data)
CREATE TABLE IF NOT EXISTS "public"."user_private_details" (
  "user_id" UUID NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "location_data" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "user_private_details_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_private_details_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

-- C) Profile Projects
CREATE TABLE IF NOT EXISTS "public"."profile_projects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "role" TEXT,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "project_url" TEXT,
  "repo_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_projects_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_profile_projects_user" ON "public"."profile_projects"("user_id");

-- D) Profile Experience
CREATE TABLE IF NOT EXISTS "public"."profile_experience" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "company" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "location" TEXT,
  "start_date" TEXT,
  "end_date" TEXT,
  "is_current" BOOLEAN DEFAULT false,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_experience_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_experience_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_profile_experience_user" ON "public"."profile_experience"("user_id");

-- E) Profile Education
CREATE TABLE IF NOT EXISTS "public"."profile_education" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "institution" TEXT NOT NULL,
  "degree" TEXT,
  "field_of_study" TEXT,
  "start_year" TEXT,
  "end_year" TEXT,
  "grade" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_education_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_education_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_profile_education_user" ON "public"."profile_education"("user_id");

-- F) Profile Certifications
CREATE TABLE IF NOT EXISTS "public"."profile_certifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "issue_date" TEXT,
  "expiry_date" TEXT,
  "credential_id" TEXT,
  "credential_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_certifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_certifications_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_profile_certifications_user" ON "public"."profile_certifications"("user_id");

-- G) Profile Achievements
CREATE TABLE IF NOT EXISTS "public"."profile_achievements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "date" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_achievements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_achievements_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_profile_achievements_user" ON "public"."profile_achievements"("user_id");

-- H) Profile Item Updates (Changelogs)
CREATE TABLE IF NOT EXISTS "public"."profile_item_updates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "item_type" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "profile_item_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_item_updates_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_profile_item_updates_item" ON "public"."profile_item_updates"("item_type", "item_id");
CREATE INDEX IF NOT EXISTS "idx_profile_item_updates_user" ON "public"."profile_item_updates"("user_id");

-- I) Domains (Reference Data)
CREATE TABLE IF NOT EXISTS "public"."domains" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon_type" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- Seed authoritative reference domains
INSERT INTO "public"."domains" ("id", "name", "icon_type", "description")
VALUES 
  ('tech', 'Tech', 'tech', 'Software architecture, frontend frameworks, cloud systems, and open-source tools.'),
  ('marketing', 'Marketing', 'marketing', 'Performance marketing, SEO, conversion rate optimization, and brand strategy.'),
  ('social_media', 'Social Media', 'social', 'High-converting content, organic community building, and distribution tactics.'),
  ('design', 'Design', 'design', 'Design systems, micro-interactions, dark mode color science, and UI/UX patterns.'),
  ('growth', 'Growth', 'growth', 'Customer acquisition, viral loops, retention optimization, and analytics.'),
  ('ai', 'Artificial Intelligence', 'ai', 'Applied AI, LLMs, machine learning models, and intelligent workflows.')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "public"."domains" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "domains_select_all" ON "public"."domains";
CREATE POLICY "domains_select_all" ON "public"."domains"
  FOR SELECT TO authenticated, anon
  USING (true);

GRANT SELECT ON "public"."domains" TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON "public"."domains" FROM anon, authenticated, public;

-- J) User Domains (Domain Memberships)
CREATE TABLE IF NOT EXISTS "public"."user_domains" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "domain_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "user_domains_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_domains_unique" UNIQUE ("user_id", "domain_id"),
  CONSTRAINT "user_domains_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_user_domains_lookup" ON "public"."user_domains"("user_id", "domain_id");

-- J) Domain Messages (Channel Discussions)
CREATE TABLE IF NOT EXISTS "public"."domain_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domain_id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "domain_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "domain_messages_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_domain_messages_channel" ON "public"."domain_messages"("domain_id", "channel_id", "created_at");

-- K) Post Media (Multi-Media Attachments)
CREATE TABLE IF NOT EXISTS "public"."post_media" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "media_url" TEXT NOT NULL,
  "media_type" TEXT DEFAULT 'image',
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "post_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "post_media_post_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_post_media_order" ON "public"."post_media"("post_id", "display_order");

-- L) Push Subscriptions (Device Push Subscriptions)
CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user" ON "public"."push_subscriptions"("user_id");

-- M) Push Idempotency Keys (Durable Replay Lockout)
CREATE TABLE IF NOT EXISTS "public"."push_idempotency_keys" (
  "idempotency_key" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "push_idempotency_keys_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX IF NOT EXISTS "idx_push_idempotency_expires" ON "public"."push_idempotency_keys"("expires_at");

-- Enable Row Level Security on all newly created tables
ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_private_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_experience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_education" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profile_item_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."domain_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."push_idempotency_keys" ENABLE ROW LEVEL SECURITY;
