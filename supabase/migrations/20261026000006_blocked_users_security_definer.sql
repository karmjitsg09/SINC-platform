-- ============================================================================
-- SINC — SECURITY DEFINER Function for Blocked Users List
--
-- Allows users to query the basic public profile fields (id, username, name, avatar_url)
-- of accounts they have personally blocked, bypassing the public.profiles RLS
-- check (is_blocked) strictly for their own blocked relationships.
--
-- Security Controls:
-- 1. SECURITY DEFINER with SET search_path = '' (guards against search-path injection).
-- 2. Fully-qualified table and function references (public.blocked_users, public.profiles, auth.uid()).
-- 3. Filtered strictly to auth.uid() = blocker_user_id (cannot inspect anyone else's blocked users).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_blocked_users()
RETURNS TABLE (
  id UUID,
  username TEXT,
  name TEXT,
  avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    p.id,
    p.username,
    p.name,
    p.avatar_url
  FROM public.blocked_users b
  JOIN public.profiles p ON p.id = b.blocked_user_id
  WHERE b.blocker_user_id = (SELECT auth.uid())
  ORDER BY b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_blocked_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_users() TO service_role;
