-- ============================================================
-- PROFILE STRUCTURED LOCATION SCHEMA FOR SUPABASE
-- Adds structured address and geolocation fields to public.profiles
-- ============================================================

-- Backward-compatible: Ensure base location text column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Broad public location fields (for discovery/networking search)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_place_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_country TEXT DEFAULT 'India';

-- Structured precise address & GPS coordinates in user_private_details (owner-only RLS)
CREATE TABLE IF NOT EXISTS public.user_private_details (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_address TEXT,
  location_landmark TEXT,
  location_pincode TEXT,
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION
);
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_landmark TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_pincode TEXT;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION;
ALTER TABLE public.user_private_details ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION;

-- Indexes for performance on public city/state search
CREATE INDEX IF NOT EXISTS idx_profiles_location_city ON public.profiles(location_city);
CREATE INDEX IF NOT EXISTS idx_profiles_location_state ON public.profiles(location_state);
