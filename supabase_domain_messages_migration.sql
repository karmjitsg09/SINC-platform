-- ============================================================
-- SINC PLATFORM: DOMAIN CHANNEL MESSAGING MIGRATION
-- Enables persistent, authorized messaging and Supabase Realtime
-- for Domain Channels (e.g., Tech / General, Doubt, Work/Job).
-- ============================================================

-- 1. Create public.domain_messages table
CREATE TABLE IF NOT EXISTS public.domain_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id TEXT NOT NULL,
  channel_id TEXT NOT NULL DEFAULT 'general',
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for high-performance retrieval and filtering
CREATE INDEX IF NOT EXISTS idx_domain_messages_lookup 
  ON public.domain_messages(domain_id, channel_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_domain_messages_user 
  ON public.domain_messages(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.domain_messages ENABLE ROW LEVEL SECURITY;

-- 4. Helper function to verify domain membership against profiles.domains
-- Supports both domain slugs (e.g., 'tech') and canonical names (e.g., 'Technology')
CREATE OR REPLACE FUNCTION public.is_domain_member(_domain_id TEXT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (
        _domain_id = ANY(domains)
        OR (_domain_id = 'tech' AND ('Technology' = ANY(domains) OR 'tech' = ANY(domains)))
        OR (_domain_id = 'social_media' AND ('Social Media' = ANY(domains) OR 'social_media' = ANY(domains)))
        OR EXISTS (
          SELECT 1 FROM unnest(domains) d
          WHERE LOWER(d) = LOWER(_domain_id) 
             OR REPLACE(LOWER(d), ' ', '_') = LOWER(_domain_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_domain_member(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_domain_member(TEXT, UUID) TO authenticated;

-- 5. RLS Policies: Only authorized domain members can read and post
DROP POLICY IF EXISTS "Domain members can read domain messages" ON public.domain_messages;
DROP POLICY IF EXISTS "Domain members can insert domain messages" ON public.domain_messages;

CREATE POLICY "Domain members can read domain messages"
  ON public.domain_messages FOR SELECT
  USING (
    public.is_domain_member(domain_id, auth.uid())
  );

CREATE POLICY "Domain members can insert domain messages"
  ON public.domain_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_domain_member(domain_id, auth.uid())
  );

-- 6. Enable Supabase Realtime for domain_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'domain_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.domain_messages;
  END IF;
END $$;
