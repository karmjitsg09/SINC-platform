-- Education Table Schema for Sync Platform
-- Table: public.education

CREATE TABLE IF NOT EXISTS public.education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  grade TEXT,
  activities TEXT,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_education_user_id ON public.education(user_id);
CREATE INDEX IF NOT EXISTS idx_education_start_date ON public.education(start_date DESC);

-- Enable Row Level Security
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Education is viewable by everyone" ON public.education;
DROP POLICY IF EXISTS "Users can insert their own education" ON public.education;
DROP POLICY IF EXISTS "Users can update their own education" ON public.education;
DROP POLICY IF EXISTS "Users can delete their own education" ON public.education;

-- 1. Anyone can view public profile education records
CREATE POLICY "Education is viewable by everyone"
  ON public.education FOR SELECT
  USING (true);

-- 2. Authenticated users can insert their own education records
CREATE POLICY "Users can insert their own education"
  ON public.education FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update only their own education records
CREATE POLICY "Users can update their own education"
  ON public.education FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete only their own education records
CREATE POLICY "Users can delete their own education"
  ON public.education FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
