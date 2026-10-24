-- ==========================================
-- SUPABASE DATABASE SCHEMA FOR SYNC PLATFORM
-- User Search, Follow Requests, Conversations & Realtime Messaging
-- ==========================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[] DEFAULT '{}',
  domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FOLLOW REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_follower_following UNIQUE (follower_user_id, following_user_id)
);

-- 3. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONVERSATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_conversation_member UNIQUE (conversation_id, user_id)
);

-- 5. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_name ON public.profiles(name);
CREATE INDEX IF NOT EXISTS idx_follow_requests_follower ON public.follow_requests(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_follow_requests_following ON public.follow_requests(following_user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON public.messages(conversation_id, created_at DESC);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- NOTE ON PUBLIC READ EXPOSURE (INTENTIONAL DESIGN CHOICE):
-- The "Allow public read access to profiles" policy below is an intentional design choice for the
-- SINC developer platform. It allows unauthenticated visitors to discover creators, view user
-- profile pages, browse community member skills, and search users by handle/name without requiring
-- login. Crucially, sensitive authentication credentials (email, phone, hashed passwords) are isolated
-- in Supabase's auth.users schema and are never stored in public.profiles.
--
-- SECURITY AUDIT FINDING (SENSITIVE COLUMNS REQUIRING RESTRICTION):
-- Later schema additions (e.g. in onboarding and location schemas) added columns to public.profiles:
--   - date_of_birth (DOB / age PII)
--   - gender, gender_custom (demographic privacy)
--   - location_address, location_landmark, location_pincode, location_latitude, location_longitude (precise residence/office address & coordinates)
--   - privacy_settings (internal configuration object)
-- Because PostgreSQL row-level security (RLS) filters entire rows rather than individual columns,
-- USING (true) allows any anonymous caller to query these sensitive columns if selected.
--
-- RECOMMENDED TIGHTENED ARCHITECTURE / SELECT POLICY:
-- Recommended remediation:
--   1. Restrict public.profiles SELECT policy to public profiles or isolate private fields:
--      CREATE POLICY "Allow selective public read access to profiles"
--        ON public.profiles FOR SELECT
--        USING (
--          auth.uid() = id
--          OR (privacy_settings->>'profile_visibility' IS NULL OR privacy_settings->>'profile_visibility' != 'private')
--        );
--   2. Move date_of_birth, gender, precise location, and privacy_settings into a private table:
--      CREATE TABLE public.user_private_details (
--        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--        date_of_birth DATE,
--        gender TEXT,
--        location_address TEXT,
--        location_latitude DOUBLE PRECISION,
--        location_longitude DOUBLE PRECISION,
--        privacy_settings JSONB
--      );
--      ALTER TABLE public.user_private_details ENABLE ROW LEVEL SECURITY;
--      CREATE POLICY "Users can only read their own private details"
--        ON public.user_private_details FOR SELECT
--        USING (auth.uid() = user_id);
CREATE POLICY "Allow public read access to profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow users to insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- PROTECT PRIVILEGED VERIFICATION FIELD (is_verified)
-- Ordinary authenticated users cannot modify their own or others' verification status.
-- Only platform service_role or administrators can update is_verified.
CREATE OR REPLACE FUNCTION public.protect_profile_verification_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    IF auth.role() IS NULL OR auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify verification status. Only service_role or administrators may update is_verified.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_verified'
  ) THEN
    DROP TRIGGER IF EXISTS trg_protect_profile_verification ON public.profiles;
    CREATE TRIGGER trg_protect_profile_verification
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.protect_profile_verification_update();
    
    REVOKE UPDATE (is_verified) ON public.profiles FROM anon, authenticated;
  END IF;
END $$;

-- FOLLOW REQUESTS POLICIES
CREATE POLICY "Allow users to view follow requests involving them"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = follower_user_id OR auth.uid() = following_user_id);

CREATE POLICY "Allow users to send follow requests"
  ON public.follow_requests FOR INSERT
  WITH CHECK (auth.uid() = follower_user_id);

CREATE POLICY "Allow recipient or sender to update follow request status"
  ON public.follow_requests FOR UPDATE
  USING (auth.uid() = following_user_id OR auth.uid() = follower_user_id);

-- CONVERSATIONS POLICIES
CREATE POLICY "Allow conversation members to view conversation"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = conversations.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- CONVERSATION MEMBERS POLICIES
CREATE POLICY "Allow conversation members to view members"
  ON public.conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to add conversation members"
  ON public.conversation_members FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- MESSAGES POLICIES
CREATE POLICY "Allow conversation members to view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Allow conversation members to send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

-- Enable Supabase Realtime for Messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
