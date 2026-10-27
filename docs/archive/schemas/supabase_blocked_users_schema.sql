-- ============================================================
-- BLOCKED USERS DATABASE SCHEMA & MIGRATION FOR SUPABASE
-- Tables, RLS policies, performance indexes, and atomic RPC
-- ============================================================

-- 1. CREATE BLOCKED_USERS TABLE
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_blocker_blocked UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT check_not_blocking_self CHECK (blocker_user_id <> blocked_user_id)
);

-- 2. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_pair ON public.blocked_users(blocker_user_id, blocked_user_id);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_select_policy" ON public.blocked_users;
CREATE POLICY "blocked_users_select_policy"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_user_id OR auth.uid() = blocked_user_id);

DROP POLICY IF EXISTS "blocked_users_insert_policy" ON public.blocked_users;
CREATE POLICY "blocked_users_insert_policy"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_user_id AND blocker_user_id <> blocked_user_id);

DROP POLICY IF EXISTS "blocked_users_delete_policy" ON public.blocked_users;
CREATE POLICY "blocked_users_delete_policy"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_user_id);

-- 4. DATABASE-LEVEL ENFORCEMENT ON FOLLOW_REQUESTS
-- Blocked user cannot insert a follow request
DROP POLICY IF EXISTS "Allow users to send follow requests" ON public.follow_requests;
CREATE POLICY "Allow users to send follow requests"
  ON public.follow_requests FOR INSERT
  WITH CHECK (
    auth.uid() = follower_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE blocker_user_id = following_user_id
        AND blocked_user_id = auth.uid()
    )
  );

-- Blocked user cannot re-open an existing follow request
DROP POLICY IF EXISTS "Allow recipient or sender to update follow request status" ON public.follow_requests;
CREATE POLICY "Allow recipient or sender to update follow request status"
  ON public.follow_requests FOR UPDATE
  USING (auth.uid() = following_user_id OR auth.uid() = follower_user_id)
  WITH CHECK (
    (status <> 'pending' OR auth.uid() <> follower_user_id OR NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE blocker_user_id = following_user_id
        AND blocked_user_id = auth.uid()
    ))
  );

-- 5. ATOMIC RPC FUNCTION: reject_and_block_user
CREATE OR REPLACE FUNCTION public.reject_and_block_user(
  p_target_user_id UUID,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_current_user_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot block yourself');
  END IF;

  -- 1. Insert or confirm block in public.blocked_users
  INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id)
  VALUES (v_current_user_id, p_target_user_id)
  ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING;

  -- 2. Reject pending or active follow requests between them
  UPDATE public.follow_requests
  SET status = 'rejected', updated_at = NOW()
  WHERE (follower_user_id = p_target_user_id AND following_user_id = v_current_user_id)
     OR (follower_user_id = v_current_user_id AND following_user_id = p_target_user_id);

  -- 3. Mark any follow_request notifications from target user as read
  UPDATE public.notifications
  SET is_read = true
  WHERE recipient_id = v_current_user_id
    AND actor_id = p_target_user_id
    AND type = 'follow_request';

  RETURN jsonb_build_object('success', true);
END;
$$;
