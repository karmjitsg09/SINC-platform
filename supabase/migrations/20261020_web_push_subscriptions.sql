-- ============================================================
-- SINC PLATFORM — WEB PUSH NOTIFICATIONS DATABASE SCHEMA
-- Migration: 20261020_web_push_subscriptions.sql
-- ============================================================

-- 1. PUSH SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure user_agent and is_active columns exist if table was partially defined
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. NOTIFICATION PREFERENCES EXTENSION ON USER_PRIVATE_DETAILS (IF TABLE EXISTS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_private_details'
  ) THEN
    ALTER TABLE public.user_private_details 
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB 
      DEFAULT '{"web_push_enabled": true, "direct_messages": true, "follow_requests": true, "social_interactions": true}'::jsonb;
  END IF;
END $$;

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subs_updated ON public.push_subscriptions(updated_at DESC);

-- 4. AUTO-UPDATE TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_push_subscription_timestamp ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscription_timestamp
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_push_subscription_timestamp();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

-- Policy 1: SELECT
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: INSERT
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = user_id
  );

-- Policy 3: UPDATE
CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: DELETE
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
