-- ============================================================
-- DEDICATED MESSAGING SYSTEM DATABASE SCHEMA FOR SUPABASE
-- Subsystem for Direct & Group Conversations, Messages, Status,
-- Read Receipts, Attachments, and Settings.
-- ============================================================
 
-- 1. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  title TEXT,
  avatar_url TEXT,
  last_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONVERSATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  CONSTRAINT unique_conversation_member UNIQUE (conversation_id, user_id)
);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Foreign Key for last_message_id on conversations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_conversations_last_message'
  ) THEN
    ALTER TABLE public.conversations 
      ADD CONSTRAINT fk_conversations_last_message 
      FOREIGN KEY (last_message_id) 
      REFERENCES public.messages(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4. MESSAGE STATUS TABLE (Sent / Delivered / Read)
CREATE TABLE IF NOT EXISTS public.message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_message_user_status UNIQUE (message_id, user_id)
);

-- 5. ATTACHMENTS TABLE (Future Media & File Support)
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CONVERSATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_conversation_user_settings UNIQUE (conversation_id, user_id)
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv_user ON public.conversation_members(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_status_message_user ON public.message_status(message_id, user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.attachments(message_id);

-- ============================================================
-- ============================================================
-- HELPER FUNCTION TO PREVENT RLS RECURSION
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_member_of(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_member_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of(UUID, UUID) TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if existing to avoid conflicts
DROP POLICY IF EXISTS "Allow members to view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow authenticated users to create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow members to update conversation last_message_id" ON public.conversations;
DROP POLICY IF EXISTS "Allow members to view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow authenticated users to add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow user to update own membership (last_read_at, muted)" ON public.conversation_members;
DROP POLICY IF EXISTS "Allow members to view conversation messages" ON public.messages;
DROP POLICY IF EXISTS "Allow members to send messages as themselves" ON public.messages;
DROP POLICY IF EXISTS "Allow users to view message status" ON public.message_status;
DROP POLICY IF EXISTS "Allow users to insert/update their own status" ON public.message_status;
DROP POLICY IF EXISTS "Allow users to update status for themselves" ON public.message_status;
DROP POLICY IF EXISTS "Allow conversation members to view attachments" ON public.attachments;
DROP POLICY IF EXISTS "Allow users to manage their own conversation settings" ON public.conversation_settings;

-- CONVERSATIONS RLS
CREATE POLICY "Allow members to view their conversations"
  ON public.conversations FOR SELECT
  USING (public.is_member_of(id, auth.uid()));

CREATE POLICY "Allow authenticated users to create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow members to update conversation last_message_id"
  ON public.conversations FOR UPDATE
  USING (public.is_member_of(id, auth.uid()));

-- CONVERSATION MEMBERS RLS
CREATE POLICY "Allow members to view conversation members"
  ON public.conversation_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_member_of(conversation_id, auth.uid()));

CREATE POLICY "Allow authenticated users to add members"
  ON public.conversation_members FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow user to update own membership (last_read_at, muted)"
  ON public.conversation_members FOR UPDATE
  USING (user_id = auth.uid());

-- MESSAGES RLS
CREATE POLICY "Allow members to view conversation messages"
  ON public.messages FOR SELECT
  USING (public.is_member_of(conversation_id, auth.uid()));

CREATE POLICY "Allow members to send messages as themselves"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    public.is_member_of(conversation_id, auth.uid())
  );

-- MESSAGE STATUS RLS
CREATE POLICY "Allow users to view message status"
  ON public.message_status FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow users to insert/update their own status"
  ON public.message_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to update status for themselves"
  ON public.message_status FOR UPDATE
  USING (user_id = auth.uid());

-- ATTACHMENTS RLS
CREATE POLICY "Allow conversation members to view attachments"
  ON public.attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id AND public.is_member_of(m.conversation_id, auth.uid())
    )
  );

-- CONVERSATION SETTINGS RLS
CREATE POLICY "Allow users to manage their own conversation settings"
  ON public.conversation_settings FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- SUPABASE REALTIME PUBLICATION
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  END IF;
END $$;