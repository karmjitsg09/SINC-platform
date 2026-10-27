-- ============================================================
-- AUTOMATIC PROFILE CREATION TRIGGER FOR SUPABASE AUTH
-- Automatically creates a corresponding row in public.profiles
-- and public.user_private_details whenever a new user registers in auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  raw_name TEXT;
  raw_username TEXT;
BEGIN
  -- Extract name from metadata or email
  raw_name := COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1));
  
  -- Generate clean unique username
  raw_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  IF raw_username IS NULL OR raw_username = '' THEN
    raw_username := 'user';
  END IF;
  raw_username := raw_username || '_' || SUBSTRING(NEW.id::text FROM 1 FOR 4);

  -- 1. Insert public profile row referencing auth.users.id
  INSERT INTO public.profiles (id, name, username, role)
  VALUES (
    NEW.id,
    raw_name,
    raw_username,
    'Member'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- 2. Safely provision initial private details row if user_private_details table is installed.
  -- Guarded by dynamic check so trigger never breaks sign-up if migration is pending.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_private_details'
  ) THEN
    INSERT INTO public.user_private_details (
      user_id,
      privacy_settings,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      '{"dob_visibility":"followers","gender_visibility":"only_me","location_visibility":"followers","profile_visibility":"everyone"}'::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
