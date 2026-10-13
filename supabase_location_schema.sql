-- ============================================================
-- PROFILE STRUCTURED LOCATION SCHEMA FOR SUPABASE
-- Adds structured address and geolocation fields to public.profiles
-- ============================================================

-- Backward-compatible: Ensure base location text column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Structured address fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_place_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_area TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_landmark TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_country TEXT DEFAULT 'India';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_pincode TEXT;

-- Geolocation coordinates (double precision)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_location_city ON public.profiles(location_city);
CREATE INDEX IF NOT EXISTS idx_profiles_location_state ON public.profiles(location_state);
