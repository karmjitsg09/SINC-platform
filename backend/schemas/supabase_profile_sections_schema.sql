-- ============================================================
-- PROFESSIONAL PROFILE SECTIONS SCHEMA FOR SUPABASE
-- Tables, Indexes, and Row Level Security (RLS) Policies for:
-- Projects, Experience, Education, Certifications, Achievements
-- ============================================================

-- 1. PROFILE PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.profile_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  technologies TEXT[] DEFAULT '{}',
  project_url TEXT,
  github_url TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROFILE EXPERIENCE TABLE
CREATE TABLE IF NOT EXISTS public.profile_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PROFILE EDUCATION TABLE
CREATE TABLE IF NOT EXISTS public.profile_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PROFILE CERTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.profile_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date TEXT,
  credential_id TEXT,
  credential_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PROFILE ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.profile_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization TEXT,
  date TEXT,
  description TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profile_projects_user ON public.profile_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_experience_user ON public.profile_experience(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_education_user ON public.profile_education(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_certifications_user ON public.profile_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_achievements_user ON public.profile_achievements(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.profile_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

-- A) PROJECTS POLICIES
DROP POLICY IF EXISTS "profile_projects_select" ON public.profile_projects;
DROP POLICY IF EXISTS "profile_projects_insert" ON public.profile_projects;
DROP POLICY IF EXISTS "profile_projects_update" ON public.profile_projects;
DROP POLICY IF EXISTS "profile_projects_delete" ON public.profile_projects;

CREATE POLICY "profile_projects_select" ON public.profile_projects FOR SELECT USING (auth.uid() = user_id OR public.can_view_user_content(user_id));
CREATE POLICY "profile_projects_insert" ON public.profile_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_projects_update" ON public.profile_projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_projects_delete" ON public.profile_projects FOR DELETE USING (auth.uid() = user_id);

-- B) EXPERIENCE POLICIES
DROP POLICY IF EXISTS "profile_experience_select" ON public.profile_experience;
DROP POLICY IF EXISTS "profile_experience_insert" ON public.profile_experience;
DROP POLICY IF EXISTS "profile_experience_update" ON public.profile_experience;
DROP POLICY IF EXISTS "profile_experience_delete" ON public.profile_experience;

CREATE POLICY "profile_experience_select" ON public.profile_experience FOR SELECT USING (auth.uid() = user_id OR public.can_view_user_content(user_id));
CREATE POLICY "profile_experience_insert" ON public.profile_experience FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_experience_update" ON public.profile_experience FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_experience_delete" ON public.profile_experience FOR DELETE USING (auth.uid() = user_id);

-- C) EDUCATION POLICIES
DROP POLICY IF EXISTS "profile_education_select" ON public.profile_education;
DROP POLICY IF EXISTS "profile_education_insert" ON public.profile_education;
DROP POLICY IF EXISTS "profile_education_update" ON public.profile_education;
DROP POLICY IF EXISTS "profile_education_delete" ON public.profile_education;

CREATE POLICY "profile_education_select" ON public.profile_education FOR SELECT USING (auth.uid() = user_id OR public.can_view_user_content(user_id));
CREATE POLICY "profile_education_insert" ON public.profile_education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_education_update" ON public.profile_education FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_education_delete" ON public.profile_education FOR DELETE USING (auth.uid() = user_id);

-- D) CERTIFICATIONS POLICIES
DROP POLICY IF EXISTS "profile_certifications_select" ON public.profile_certifications;
DROP POLICY IF EXISTS "profile_certifications_insert" ON public.profile_certifications;
DROP POLICY IF EXISTS "profile_certifications_update" ON public.profile_certifications;
DROP POLICY IF EXISTS "profile_certifications_delete" ON public.profile_certifications;

CREATE POLICY "profile_certifications_select" ON public.profile_certifications FOR SELECT USING (auth.uid() = user_id OR public.can_view_user_content(user_id));
CREATE POLICY "profile_certifications_insert" ON public.profile_certifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_certifications_update" ON public.profile_certifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_certifications_delete" ON public.profile_certifications FOR DELETE USING (auth.uid() = user_id);

-- E) ACHIEVEMENTS POLICIES
DROP POLICY IF EXISTS "profile_achievements_select" ON public.profile_achievements;
DROP POLICY IF EXISTS "profile_achievements_insert" ON public.profile_achievements;
DROP POLICY IF EXISTS "profile_achievements_update" ON public.profile_achievements;
DROP POLICY IF EXISTS "profile_achievements_delete" ON public.profile_achievements;

CREATE POLICY "profile_achievements_select" ON public.profile_achievements FOR SELECT USING (auth.uid() = user_id OR public.can_view_user_content(user_id));
CREATE POLICY "profile_achievements_insert" ON public.profile_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_achievements_update" ON public.profile_achievements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profile_achievements_delete" ON public.profile_achievements FOR DELETE USING (auth.uid() = user_id);
