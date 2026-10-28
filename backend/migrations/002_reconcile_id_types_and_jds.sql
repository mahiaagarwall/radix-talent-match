-- ==============================================================================
-- RADIX Talent Match: Migration 002 — Reconcile ID Types, Job Descriptions & Matching
-- Modules: Skill Matching (Akshat Mehra) & JD Analytics (Krishna Pandey)
-- Purpose: 
--   1. Reconcile skill_match_results table to use TEXT for profile_id and jd_id
--      to match candidate_profiles (prf_*) and job_descriptions (jd_* / slug).
--   2. Ensure persistent storage for job_descriptions and the jds view.
-- ==============================================================================

-- 1. Job Descriptions Persistence Table
CREATE TABLE IF NOT EXISTS public.job_descriptions (
    jd_id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    role_category TEXT,
    location TEXT,
    employment_type TEXT,
    source_type TEXT NOT NULL DEFAULT 'jd',
    source_file TEXT,
    source_kind TEXT DEFAULT 'upload',
    experience_requirements TEXT,
    education_requirements TEXT,
    raw_text TEXT,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_descriptions_created_at ON public.job_descriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_company ON public.job_descriptions(company);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_role ON public.job_descriptions(role);

-- Convenient alias view matching endpoint /api/jd
CREATE OR REPLACE VIEW public.jds AS SELECT * FROM public.job_descriptions;

-- Enable RLS on job_descriptions
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'job_descriptions' AND policyname = 'Allow all operations on job_descriptions'
    ) THEN
        CREATE POLICY "Allow all operations on job_descriptions" ON public.job_descriptions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 2. Skill Match Results Table (Reconciled with TEXT profile_id and jd_id)
CREATE TABLE IF NOT EXISTS public.skill_match_results (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL,
    jd_id TEXT NOT NULL,
    match_score NUMERIC(5, 2) CHECK (match_score >= 0 AND match_score <= 100),
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    partial_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    scoring_version TEXT NOT NULL DEFAULT 'v1',
    scoring_status TEXT NOT NULL DEFAULT 'completed' CHECK (scoring_status IN ('completed', 'not_scored')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- If skill_match_results was previously created with UUID profile_id / jd_id, alter to TEXT safely
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'skill_match_results' 
          AND column_name = 'profile_id' 
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.skill_match_results ALTER COLUMN profile_id TYPE TEXT USING profile_id::text;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'skill_match_results' 
          AND column_name = 'jd_id' 
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.skill_match_results ALTER COLUMN jd_id TYPE TEXT USING jd_id::text;
    END IF;
END $$;

-- Performance indexes on query keys
CREATE INDEX IF NOT EXISTS idx_skill_match_results_profile_id 
    ON public.skill_match_results(profile_id);

CREATE INDEX IF NOT EXISTS idx_skill_match_results_jd_id 
    ON public.skill_match_results(jd_id);

CREATE INDEX IF NOT EXISTS idx_skill_match_results_created_at 
    ON public.skill_match_results(created_at DESC);

-- Row Level Security (RLS) for skill_match_results
ALTER TABLE public.skill_match_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'skill_match_results' AND policyname = 'Allow read skill_match_results'
    ) THEN
        CREATE POLICY "Allow read skill_match_results" ON public.skill_match_results FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'skill_match_results' AND policyname = 'Allow insert skill_match_results'
    ) THEN
        CREATE POLICY "Allow insert skill_match_results" ON public.skill_match_results FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'skill_match_results' AND policyname = 'Allow update skill_match_results'
    ) THEN
        CREATE POLICY "Allow update skill_match_results" ON public.skill_match_results FOR UPDATE USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'skill_match_results' AND policyname = 'Allow delete skill_match_results'
    ) THEN
        CREATE POLICY "Allow delete skill_match_results" ON public.skill_match_results FOR DELETE USING (true);
    END IF;
END $$;
