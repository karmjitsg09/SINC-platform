-- ============================================================
-- SUPABASE MIGRATION: QUESTION-BASED PROFILE SETUP & ONBOARDING
-- Adds columns to profiles and creates user_domains membership table
-- ============================================================

-- 1. ADD NEW PUBLIC COLUMNS TO PROFILES TABLE
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profession_type TEXT,
  ADD COLUMN IF NOT EXISTS profession_details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skills_technical TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_soft TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_tools TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_technologies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skills_expertise TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS other_links JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_work_location TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS professional_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_setup_completed_steps INTEGER[] DEFAULT '{}';

-- 1B. ADD SENSITIVE PRIVATE COLUMNS TO USER_PRIVATE_DETAILS (OWNER-ONLY RLS)
CREATE TABLE IF NOT EXISTS public.user_private_details (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender TEXT,
  gender_custom TEXT,
  location_address TEXT,
  location_landmark TEXT,
  location_pincode TEXT,
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION,
  privacy_settings JSONB DEFAULT '{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_private_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only view their own private details" ON public.user_private_details;
CREATE POLICY "Users can only view their own private details"
  ON public.user_private_details FOR SELECT
  USING (auth.uid() = user_id);

-- 2. CREATE USER_DOMAINS MEMBERSHIP TABLE
CREATE TABLE IF NOT EXISTS public.user_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_domain UNIQUE (user_id, domain_id)
);

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_domains_user_id ON public.user_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_user_domains_domain_id ON public.user_domains(domain_id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed);

-- 4. ROW LEVEL SECURITY (RLS) FOR USER_DOMAINS
ALTER TABLE public.user_domains ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own and others' public domain memberships
CREATE POLICY "Allow public read access to user_domains"
  ON public.user_domains FOR SELECT
  USING (true);

-- Allow authenticated users to insert their own domain memberships
CREATE POLICY "Allow users to insert their own domain memberships"
  ON public.user_domains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own domain memberships
CREATE POLICY "Allow users to delete their own domain memberships"
  ON public.user_domains FOR DELETE
  USING (auth.uid() = user_id);

-- 5. CREATE DOMAIN GROUP MESSAGES TABLE WITH RLS
CREATE TABLE IF NOT EXISTS public.domain_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id TEXT NOT NULL,
  channel_id TEXT NOT NULL DEFAULT 'general',
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_messages_domain ON public.domain_messages(domain_id, channel_id, created_at);

ALTER TABLE public.domain_messages ENABLE ROW LEVEL SECURITY;

-- Member-only SELECT: only users who belong to this domain can read its messages
CREATE POLICY "Domain members can read domain messages"
  ON public.domain_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_domains
      WHERE user_domains.domain_id = domain_messages.domain_id
        AND user_domains.user_id = auth.uid()
    )
  );

-- Member-only INSERT: only users who belong to this domain can post messages
CREATE POLICY "Domain members can insert domain messages"
  ON public.domain_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.user_domains
      WHERE user_domains.domain_id = domain_messages.domain_id
        AND user_domains.user_id = auth.uid()
    )
  );

-- 6. SUPABASE STORAGE BUCKET: profile-photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for profile photos
CREATE POLICY "Public profile photos read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Authenticated users can upload their own profile photos
CREATE POLICY "Users can upload own profile photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND auth.role() = 'authenticated'
  );

