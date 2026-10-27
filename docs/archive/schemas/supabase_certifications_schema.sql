-- Certifications Table Schema for Sync Platform
-- Table: public.certifications

CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuing_organization TEXT,
  issue_date DATE,
  expiration_date DATE,
  does_not_expire BOOLEAN DEFAULT false,
  credential_id TEXT,
  credential_url TEXT,
  description TEXT,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_certifications_user_id ON public.certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_issue_date ON public.certifications(issue_date DESC);

-- Enable Row Level Security
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Certifications are viewable by everyone" ON public.certifications;
DROP POLICY IF EXISTS "Users can insert their own certifications" ON public.certifications;
DROP POLICY IF EXISTS "Users can update their own certifications" ON public.certifications;
DROP POLICY IF EXISTS "Users can delete their own certifications" ON public.certifications;

-- 1. Anyone can view public profile certification records
CREATE POLICY "Certifications are viewable by everyone"
  ON public.certifications FOR SELECT
  USING (true);

-- 2. Authenticated users can insert their own certification records
CREATE POLICY "Users can insert their own certifications"
  ON public.certifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update only their own certification records
CREATE POLICY "Users can update their own certifications"
  ON public.certifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete only their own certification records
CREATE POLICY "Users can delete their own certifications"
  ON public.certifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
