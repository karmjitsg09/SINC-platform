-- Experience Table Schema for Sync Platform
-- Table: public.experience

CREATE TABLE IF NOT EXISTS public.experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  employment_type TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_experience_user_id ON public.experience(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_start_date ON public.experience(start_date DESC);

-- Enable Row Level Security
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure clean state
DROP POLICY IF EXISTS "Experience is viewable by everyone" ON public.experience;
DROP POLICY IF EXISTS "Users can insert their own experience" ON public.experience;
DROP POLICY IF EXISTS "Users can update their own experience" ON public.experience;
DROP POLICY IF EXISTS "Users can delete their own experience" ON public.experience;

-- 1. Anyone can view public profile experiences
CREATE POLICY "Experience is viewable by everyone"
  ON public.experience FOR SELECT
  USING (true);

-- 2. Authenticated users can insert their own experience records
CREATE POLICY "Users can insert their own experience"
  ON public.experience FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update only their own experience records
CREATE POLICY "Users can update their own experience"
  ON public.experience FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete only their own experience records
CREATE POLICY "Users can delete their own experience"
  ON public.experience FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
