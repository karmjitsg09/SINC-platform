-- ============================================================
-- AUTOMATIC PROFILE CREATION TRIGGER FOR SUPABASE AUTH
-- Automatically creates a corresponding row in public.profiles
-- whenever a new user registers in auth.users.
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

  -- Insert profile row referencing auth.users.id
  INSERT INTO public.profiles (id, name, username, role)
  VALUES (
    NEW.id,
    raw_name,
    raw_username,
    'Member'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
