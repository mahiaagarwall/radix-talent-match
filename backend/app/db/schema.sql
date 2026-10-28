-- ==============================================================================
-- RADIX Talent Match — Skill Matching Schema
-- Table: skill_match_results
-- Module Owner: Akshat Mehra (Skill Matching & Scrum Master)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table definition for persisting skill matching results
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

-- Performance indexes on query keys
CREATE INDEX IF NOT EXISTS idx_skill_match_results_profile_id 
    ON public.skill_match_results(profile_id);

CREATE INDEX IF NOT EXISTS idx_skill_match_results_jd_id 
    ON public.skill_match_results(jd_id);

CREATE INDEX IF NOT EXISTS idx_skill_match_results_created_at 
    ON public.skill_match_results(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE public.skill_match_results ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated service role and anon for hackathon demo
CREATE POLICY "Allow read skill_match_results" 
    ON public.skill_match_results
    FOR SELECT 
    USING (true);

-- Allow insert via service role / API
CREATE POLICY "Allow insert skill_match_results" 
    ON public.skill_match_results
    FOR INSERT 
    WITH CHECK (true);

-- ==============================================================================
-- NOTE ON FOREIGN KEYS:
-- Foreign keys to candidate profile and job description tables are omitted
-- pending confirmation from module owners:
-- 1. Aashish Kumar (Profile Builder) — table name (e.g., profiles / candidate_profiles)
--    and ID column type (UUID vs TEXT).
-- 2. Krishna Pandey (JD Analytics) — table name (e.g., job_descriptions / jds)
--    and ID column type (UUID vs TEXT).
--
-- Once confirmed, the following constraints may be added:
-- ALTER TABLE public.skill_match_results
--     ADD CONSTRAINT fk_skill_match_profile
--     FOREIGN KEY (profile_id) REFERENCES public.profiles(profile_id)
--     ON DELETE CASCADE;
--
-- ALTER TABLE public.skill_match_results
--     ADD CONSTRAINT fk_skill_match_jd
--     FOREIGN KEY (jd_id) REFERENCES public.job_descriptions(jd_id)
--     ON DELETE CASCADE;
-- ==============================================================================
