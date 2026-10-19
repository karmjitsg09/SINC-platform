-- ============================================================================
-- SUPABASE MIGRATION: SEPARATE SENSITIVE USER PII INTO USER_PRIVATE_DETAILS
-- Files: supabase_protect_user_private_details.sql / supabase/migrations/20261016_protect_user_private_details.sql
-- ============================================================================
-- 
-- PURPOSE:
-- Eliminate anonymous/unauthorized access to sensitive Personally Identifiable Information (PII).
-- In the original schema, public.profiles had an open SELECT policy: USING (true).
-- Later additions placed sensitive fields into public.profiles:
--   - date_of_birth (DOB / age PII)
--   - gender, gender_custom (demographic privacy)
--   - location_address, location_area, location_landmark, location_pincode,
--     location_latitude, location_longitude (precise residence & GPS coordinates)
--   - privacy_settings (personal visibility controls)
--
-- This migration guarantees:
-- 1. All sensitive fields are isolated into public.user_private_details.
-- 2. user_private_details has strict owner-only RLS: USING (auth.uid() = user_id).
-- 3. Every source column on public.profiles is inspected INDEPENDENTLY so missing columns
--    never abort or corrupt the migration (supports partial onboarding / location schema variants).
-- 4. Existing data is completely preserved before any source columns are dropped.
-- 5. Safe to rerun (idempotent) with preflight, post-migration verification, and rollback SQL.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PREFLIGHT SAFETY CHECK
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE EXCEPTION 'PREFLIGHT FAILED: public.profiles table does not exist. Aborting migration.';
    END IF;
    RAISE NOTICE 'PREFLIGHT PASSED: public.profiles table verified.';
END $$;

-- ============================================================================
-- 2. CREATE USER_PRIVATE_DETAILS TABLE & EXTEND COLUMNS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_private_details (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender TEXT,
    gender_custom TEXT,
    location_address TEXT,
    location_area TEXT,
    location_landmark TEXT,
    location_pincode TEXT,
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    privacy_settings JSONB DEFAULT '{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all expected columns exist even if user_private_details was partially created earlier
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS gender_custom TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_area TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_landmark TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_pincode TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}'::jsonb;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 3. INDEPENDENT COLUMN DETECTION, DATA PRESERVATION & MIGRATION
-- ============================================================================
DO $$
DECLARE
    has_dob BOOLEAN;
    has_gender BOOLEAN;
    has_gender_custom BOOLEAN;
    has_loc_addr BOOLEAN;
    has_loc_area BOOLEAN;
    has_loc_landmark BOOLEAN;
    has_loc_pincode BOOLEAN;
    has_loc_lat BOOLEAN;
    has_loc_lng BOOLEAN;
    has_privacy BOOLEAN;
    
    select_clauses TEXT := 'p.id AS user_id';
    has_any_source_col BOOLEAN := FALSE;
    copy_query TEXT;
    source_profiles_count INT := 0;
    migrated_count INT := 0;
BEGIN
    -- Check each sensitive column in public.profiles independently
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'date_of_birth') INTO has_dob;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'gender') INTO has_gender;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'gender_custom') INTO has_gender_custom;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_address') INTO has_loc_addr;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_area') INTO has_loc_area;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_landmark') INTO has_loc_landmark;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_pincode') INTO has_loc_pincode;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_latitude') INTO has_loc_lat;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location_longitude') INTO has_loc_lng;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'privacy_settings') INTO has_privacy;

    -- Dynamically assemble SELECT expressions per column
    IF has_dob THEN select_clauses := select_clauses || ', p.date_of_birth'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::date AS date_of_birth'; END IF;
    IF has_gender THEN select_clauses := select_clauses || ', p.gender'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::text AS gender'; END IF;
    IF has_gender_custom THEN select_clauses := select_clauses || ', p.gender_custom'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::text AS gender_custom'; END IF;
    IF has_loc_addr THEN select_clauses := select_clauses || ', p.location_address'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::text AS location_address'; END IF;
    IF has_loc_area THEN select_clauses := select_clauses || ', p.location_area'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::text AS location_area'; END IF;
    IF has_loc_landmark THEN select_clauses := select_clauses || ', p.location_landmark'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::text AS location_landmark'; END IF;
    IF has_loc_pincode THEN select_clauses := select_clauses || ', p.location_pincode'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::text AS location_pincode'; END IF;
    IF has_loc_lat THEN select_clauses := select_clauses || ', p.location_latitude'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::double precision AS location_latitude'; END IF;
    IF has_loc_lng THEN select_clauses := select_clauses || ', p.location_longitude'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', NULL::double precision AS location_longitude'; END IF;
    IF has_privacy THEN select_clauses := select_clauses || ', COALESCE(p.privacy_settings, ''{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}''::jsonb)'; has_any_source_col := TRUE; ELSE select_clauses := select_clauses || ', ''{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}''::jsonb AS privacy_settings'; END IF;

    -- Count existing profiles
    SELECT COUNT(*) INTO source_profiles_count FROM public.profiles;

    -- Execute data migration if any profiles exist
    IF source_profiles_count > 0 THEN
        copy_query := '
            INSERT INTO public.user_private_details (
                user_id,
                date_of_birth,
                gender,
                gender_custom,
                location_address,
                location_area,
                location_landmark,
                location_pincode,
                location_latitude,
                location_longitude,
                privacy_settings,
                updated_at
            )
            SELECT ' || select_clauses || ', NOW()
            FROM public.profiles p
            ON CONFLICT (user_id) DO UPDATE SET
                date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.user_private_details.date_of_birth),
                gender = COALESCE(EXCLUDED.gender, public.user_private_details.gender),
                gender_custom = COALESCE(EXCLUDED.gender_custom, public.user_private_details.gender_custom),
                location_address = COALESCE(EXCLUDED.location_address, public.user_private_details.location_address),
                location_area = COALESCE(EXCLUDED.location_area, public.user_private_details.location_area),
                location_landmark = COALESCE(EXCLUDED.location_landmark, public.user_private_details.location_landmark),
                location_pincode = COALESCE(EXCLUDED.location_pincode, public.user_private_details.location_pincode),
                location_latitude = COALESCE(EXCLUDED.location_latitude, public.user_private_details.location_latitude),
                location_longitude = COALESCE(EXCLUDED.location_longitude, public.user_private_details.location_longitude),
                privacy_settings = COALESCE(EXCLUDED.privacy_settings, public.user_private_details.privacy_settings),
                updated_at = NOW()';
                
        EXECUTE copy_query;
        GET DIAGNOSTICS migrated_count = ROW_COUNT;
        RAISE NOTICE 'Preserved % profiles into user_private_details.', migrated_count;
    END IF;

    -- Drop each sensitive column from public.profiles only if it existed
    IF has_dob THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN date_of_birth'; RAISE NOTICE 'Dropped profiles.date_of_birth'; END IF;
    IF has_gender THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN gender'; RAISE NOTICE 'Dropped profiles.gender'; END IF;
    IF has_gender_custom THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN gender_custom'; RAISE NOTICE 'Dropped profiles.gender_custom'; END IF;
    IF has_loc_addr THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN location_address'; RAISE NOTICE 'Dropped profiles.location_address'; END IF;
    IF has_loc_area THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN location_area'; RAISE NOTICE 'Dropped profiles.location_area'; END IF;
    IF has_loc_landmark THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN location_landmark'; RAISE NOTICE 'Dropped profiles.location_landmark'; END IF;
    IF has_loc_pincode THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN location_pincode'; RAISE NOTICE 'Dropped profiles.location_pincode'; END IF;
    IF has_loc_lat THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN location_latitude'; RAISE NOTICE 'Dropped profiles.location_latitude'; END IF;
    IF has_loc_lng THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN location_longitude'; RAISE NOTICE 'Dropped profiles.location_longitude'; END IF;
    IF has_privacy THEN EXECUTE 'ALTER TABLE public.profiles DROP COLUMN privacy_settings'; RAISE NOTICE 'Dropped profiles.privacy_settings'; END IF;
END $$;

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY & DEFINE STRICT POLICIES
-- ============================================================================
ALTER TABLE public.user_private_details ENABLE ROW LEVEL SECURITY;

-- Remove existing policies for clean idempotency
DROP POLICY IF EXISTS "Users can only view their own private details" ON public.user_private_details;
DROP POLICY IF EXISTS "Users can only insert their own private details" ON public.user_private_details;
DROP POLICY IF EXISTS "Users can only update their own private details" ON public.user_private_details;
DROP POLICY IF EXISTS "Users can only delete their own private details" ON public.user_private_details;

-- SELECT: Authenticated owner only
CREATE POLICY "Users can only view their own private details"
    ON public.user_private_details FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: Authenticated owner only
CREATE POLICY "Users can only insert their own private details"
    ON public.user_private_details FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Authenticated owner only
CREATE POLICY "Users can only update their own private details"
    ON public.user_private_details FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Authenticated owner only
CREATE POLICY "Users can only delete their own private details"
    ON public.user_private_details FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 5. PERFORMANCE INDEXES & TABLE AUDIT COMMENTS
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_private_details_user_id ON public.user_private_details(user_id);
CREATE INDEX IF NOT EXISTS idx_user_private_details_updated ON public.user_private_details(updated_at DESC);

COMMENT ON TABLE public.user_private_details IS 'Stores sensitive PII (DOB, gender, physical address, GPS coordinates, personal privacy settings) strictly protected by owner-only RLS.';
COMMENT ON COLUMN public.user_private_details.user_id IS 'Foreign key to auth.users.id; primary key ensuring 1-to-1 relationship with the authenticated user account.';

-- ============================================================================
-- 6. SERVER-SIDE PROFILE VISIBILITY HELPER (SECURITY DEFINER)
-- Prevents recursive RLS, enforces profile_visibility, and respects block relationships
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_view_user_content(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_viewer_id UUID := auth.uid();
    v_visibility TEXT;
    v_is_verified BOOLEAN;
    v_is_blocked BOOLEAN := FALSE;
BEGIN
    -- Account owner can always view their own profile content
    IF v_viewer_id IS NOT NULL AND v_viewer_id = target_user_id THEN
        RETURN TRUE;
    END IF;

    -- Block check: Blocked relationships prevent viewing content
    IF v_viewer_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'blocked_users'
        ) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.blocked_users
                WHERE (blocker_user_id = target_user_id AND blocked_user_id = v_viewer_id)
                   OR (blocker_user_id = v_viewer_id AND blocked_user_id = target_user_id)
            ) INTO v_is_blocked;

            IF v_is_blocked THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;

    -- Extract visibility mode from user_private_details
    SELECT COALESCE(privacy_settings->>'profile_visibility', 'everyone')
    INTO v_visibility
    FROM public.user_private_details
    WHERE user_id = target_user_id;

    -- Default to everyone if unset or record missing
    IF v_visibility IS NULL OR v_visibility = 'everyone' THEN
        RETURN TRUE;
    END IF;

    -- Unauthenticated viewers cannot view restricted profile content
    IF v_viewer_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Followers-only check: strictly require accepted follow request (pending does NOT grant access)
    IF v_visibility = 'followers_only' OR v_visibility = 'followers' OR v_visibility = 'private' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.follow_requests
            WHERE following_user_id = target_user_id
              AND follower_user_id = v_viewer_id
              AND status = 'accepted'
        );
    END IF;

    -- Verified-profile check: viewer profile must have is_verified = TRUE
    IF v_visibility = 'verified_profile' THEN
        SELECT is_verified INTO v_is_verified
        FROM public.profiles
        WHERE id = v_viewer_id;
        RETURN COALESCE(v_is_verified, FALSE);
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================================
-- 7. VERIFICATION STATUS PROTECTION TRIGGER & ADMIN RPC
-- Prevent ordinary users from self-verifying or modifying another user verification status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_verification_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If is_verified is being modified
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
        -- Only service_role or privileged platform administrator may update is_verified
        IF auth.role() IS NULL OR auth.role() <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify verification status. Only service_role or platform administrators may update is_verified.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to public.profiles if is_verified exists
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
        
        -- Revoke direct column update privilege from ordinary client roles
        REVOKE UPDATE (is_verified) ON public.profiles FROM anon, authenticated;
        RAISE NOTICE 'Protected is_verified column and attached trigger trg_protect_profile_verification.';
    END IF;
END $$;

-- Dedicated administrative RPC to set verification status safely
CREATE OR REPLACE FUNCTION public.admin_set_user_verification(
    target_user_id UUID,
    new_verified_status BOOLEAN
)
RETURNS JSONB AS $$
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Access denied: Only platform administrators or service_role may modify verification status.';
    END IF;

    UPDATE public.profiles
    SET is_verified = new_verified_status,
        updated_at = NOW()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'is_verified', new_verified_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_verification(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_verification(UUID, BOOLEAN) TO service_role;

COMMIT;

-- ============================================================================
-- 7. POST-MIGRATION VERIFICATION QUERIES (RUN IN SUPABASE SQL EDITOR TO VERIFY)
-- ============================================================================
-- 1. Confirm zero sensitive columns exist in public.profiles:
--    SELECT column_name 
--    FROM information_schema.columns 
--    WHERE table_schema = 'public' 
--      AND table_name = 'profiles' 
--      AND column_name IN ('date_of_birth', 'gender', 'gender_custom', 'location_address', 'location_area', 'location_landmark', 'location_pincode', 'location_latitude', 'location_longitude', 'privacy_settings');
--    --> Expected: 0 rows returned.
--
-- 2. Confirm user_private_details exists with RLS enabled:
--    SELECT tablename, rowsecurity 
--    FROM pg_tables 
--    WHERE schemaname = 'public' AND tablename = 'user_private_details';
--    --> Expected: 1 row with rowsecurity = true.
--
-- 3. Confirm active RLS policies:
--    SELECT policyname, permissive, roles, cmd, qual, with_check 
--    FROM pg_policies 
--    WHERE tablename = 'user_private_details';
--    --> Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE) with auth.uid() = user_id.

-- ============================================================================
-- 8. DOCUMENTED ROLLBACK / RECOVERY SCRIPT (IF NEEDED)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender_custom TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_address TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_area TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_landmark TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_pincode TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_settings JSONB;
--
-- UPDATE public.profiles p
-- SET
--     date_of_birth = u.date_of_birth,
--     gender = u.gender,
--     gender_custom = u.gender_custom,
--     location_address = u.location_address,
--     location_area = u.location_area,
--     location_landmark = u.location_landmark,
--     location_pincode = u.location_pincode,
--     location_latitude = u.location_latitude,
--     location_longitude = u.location_longitude,
--     privacy_settings = u.privacy_settings
-- FROM public.user_private_details u
-- WHERE p.id = u.user_id;
--
-- DROP TABLE IF EXISTS public.user_private_details CASCADE;
-- DROP FUNCTION IF EXISTS public.can_view_user_content(UUID);
-- COMMIT;
