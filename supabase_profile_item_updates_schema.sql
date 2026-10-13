-- ============================================================
-- PROFILE ITEM UPDATES SCHEMA FOR SUPABASE
-- Universal progress / history updates for:
-- Projects, Experience, Education, Certifications, Achievements
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profile_item_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('project', 'experience', 'education', 'certification', 'achievement')),
  item_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'In Progress' CHECK (status IN ('Planned', 'In Progress', 'Completed', 'Updated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_item_updates_item ON public.profile_item_updates(item_type, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_item_updates_user ON public.profile_item_updates(user_id);

-- Enable Row Level Security
ALTER TABLE public.profile_item_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Profile item updates are viewable by everyone" ON public.profile_item_updates;
DROP POLICY IF EXISTS "Users can insert their own profile item updates" ON public.profile_item_updates;
DROP POLICY IF EXISTS "Users can update their own profile item updates" ON public.profile_item_updates;
DROP POLICY IF EXISTS "Users can delete their own profile item updates" ON public.profile_item_updates;

-- 1. SELECT: Anyone can view profile item updates
CREATE POLICY "Profile item updates are viewable by everyone"
  ON public.profile_item_updates FOR SELECT
  USING (true);

-- 2. INSERT: Authenticated users can insert their own updates only
CREATE POLICY "Users can insert their own profile item updates"
  ON public.profile_item_updates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE: Users can update only their own updates
CREATE POLICY "Users can update their own profile item updates"
  ON public.profile_item_updates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Users can delete only their own updates
CREATE POLICY "Users can delete their own profile item updates"
  ON public.profile_item_updates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
