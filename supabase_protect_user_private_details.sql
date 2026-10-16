-- ============================================================================
-- SUPABASE MIGRATION: SEPARATE SENSITIVE USER PII INTO USER_PRIVATE_DETAILS
-- File: supabase_protect_user_private_details.sql / supabase/migrations/20261016_protect_user_private_details.sql
-- ============================================================================
-- 
-- PURPOSE:
-- Protect sensitive Personally Identifiable Information (PII) from anonymous exposure.
-- The public.profiles table has an open SELECT policy: USING (true).
-- This migration ensures that sensitive columns:
--   - date_of_birth
--   - gender, gender_custom
--   - location_address, location_landmark, location_pincode
--   - location_latitude, location_longitude
--   - privacy_settings
-- are isolated into a separate table (public.user_private_details) with strict
-- Row Level Security (RLS) restricting SELECT/INSERT/UPDATE to the owning user only:
--   USING (auth.uid() = user_id).
--
-- All existing data is safely migrated without dropping any user information.
-- ============================================================================

-- 1. CREATE USER_PRIVATE_DETAILS TABLE
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

-- 2. MIGRATE EXISTING SENSITIVE DATA FROM PROFILES (IF COLUMNS EXIST)
-- Safely copies any previously populated sensitive values into user_private_details
DO $$
BEGIN
    -- Check if date_of_birth exists on public.profiles before copying
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'date_of_birth'
    ) THEN
        INSERT INTO public.user_private_details (
            user_id,
            date_of_birth,
            gender,
            gender_custom,
            location_address,
            location_landmark,
            location_pincode,
            location_latitude,
            location_longitude,
            privacy_settings,
            updated_at
        )
        SELECT 
            p.id AS user_id,
            p.date_of_birth,
            p.gender,
            p.gender_custom,
            p.location_address,
            p.location_landmark,
            p.location_pincode,
            p.location_latitude,
            p.location_longitude,
            COALESCE(p.privacy_settings, '{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}'::jsonb),
            NOW()
        FROM public.profiles p
        ON CONFLICT (user_id) DO UPDATE SET
            date_of_birth = EXCLUDED.date_of_birth,
            gender = EXCLUDED.gender,
            gender_custom = EXCLUDED.gender_custom,
            location_address = EXCLUDED.location_address,
            location_landmark = EXCLUDED.location_landmark,
            location_pincode = EXCLUDED.location_pincode,
            location_latitude = EXCLUDED.location_latitude,
            location_longitude = EXCLUDED.location_longitude,
            privacy_settings = EXCLUDED.privacy_settings,
            updated_at = NOW();

        -- Drop sensitive columns from public.profiles so public reads cannot access them
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS date_of_birth;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS gender;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS gender_custom;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS location_address;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS location_landmark;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS location_pincode;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS location_latitude;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS location_longitude;
        ALTER TABLE public.profiles DROP COLUMN IF EXISTS privacy_settings;
    END IF;
END $$;

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.user_private_details ENABLE ROW LEVEL SECURITY;

-- 4. STRICT RLS POLICIES (OWNER-ONLY ACCESS)
-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can only view their own private details" ON public.user_private_details;
DROP POLICY IF EXISTS "Users can only insert their own private details" ON public.user_private_details;
DROP POLICY IF EXISTS "Users can only update their own private details" ON public.user_private_details;
DROP POLICY IF EXISTS "Users can only delete their own private details" ON public.user_private_details;

-- SELECT: Only the authenticated user whose ID matches user_id can read their private details
CREATE POLICY "Users can only view their own private details"
    ON public.user_private_details FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: Only the authenticated user can insert their own private details
CREATE POLICY "Users can only insert their own private details"
    ON public.user_private_details FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Only the authenticated user can update their own private details
CREATE POLICY "Users can only update their own private details"
    ON public.user_private_details FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Only the authenticated user can delete their own private details
CREATE POLICY "Users can only delete their own private details"
    ON public.user_private_details FOR DELETE
    USING (auth.uid() = user_id);

-- 5. INDEXES FOR FAST LOOKUP
CREATE INDEX IF NOT EXISTS idx_user_private_details_user_id ON public.user_private_details(user_id);

-- 6. COMMENTS FOR AUDIT TRAIL
COMMENT ON TABLE public.user_private_details IS 'Stores sensitive PII (DOB, gender, exact physical address coordinates, privacy settings) protected by owner-only RLS.';
COMMENT ON COLUMN public.user_private_details.user_id IS 'References auth.users.id; primary key ensuring 1-to-1 relationship with authenticated user.';
