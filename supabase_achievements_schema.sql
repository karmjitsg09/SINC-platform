-- Achievements Table Schema for Sync Platform
-- Table: public.achievements

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization TEXT,
  achievement_date DATE,
  description TEXT,
  credential_id TEXT,
  credential_url TEXT,
  image_url TEXT,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON public.achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_date ON public.achievements(achievement_date DESC);

-- Enable Row Level Security
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;
DROP POLICY IF EXISTS "Users can insert their own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can update their own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can delete their own achievements" ON public.achievements;

-- 1. Anyone can view public profile achievement records
CREATE POLICY "Achievements are viewable by everyone"
  ON public.achievements FOR SELECT
  USING (true);

-- 2. Authenticated users can insert their own achievements
CREATE POLICY "Users can insert their own achievements"
  ON public.achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update only their own achievements
CREATE POLICY "Users can update their own achievements"
  ON public.achievements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete only their own achievements
CREATE POLICY "Users can delete their own achievements"
  ON public.achievements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
