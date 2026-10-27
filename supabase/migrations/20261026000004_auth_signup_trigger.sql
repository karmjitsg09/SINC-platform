-- Migration: 20261026000004_auth_signup_trigger.sql
-- Description: Creates the automatic profile creation trigger on auth.users.
-- Note: Derived from docs/archive/schemas/supabase_auth_trigger.sql.
-- Hardened with SECURITY DEFINER and SET search_path = '' (fully qualified names).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  raw_name TEXT;
  raw_username TEXT;
BEGIN
  -- Extract name from metadata or email prefix
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
  
  -- 2. Safely provision initial private details row
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_private_details'
  ) THEN
    INSERT INTO public.user_private_details (
      user_id,
      email,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Revoke public execution and restrict
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_auth_admin, service_role;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
