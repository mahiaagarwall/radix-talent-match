-- RADIX Talent Match: Migration 001 — Create Profiles
-- Module: Profile Builder (P1 - Aashish Kumar)
-- Purpose: Persist candidate profiles, nested details, skills, and resume references

CREATE TABLE IF NOT EXISTS candidate_profiles (
    profile_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    education JSONB NOT NULL DEFAULT '[]'::jsonb,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    internships JSONB NOT NULL DEFAULT '[]'::jsonb,
    hackathons JSONB NOT NULL DEFAULT '[]'::jsonb,
    certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    resume_reference JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_created_at ON candidate_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_name ON candidate_profiles(name);

-- Relational table for normalized skill access across modules
CREATE TABLE IF NOT EXISTS profile_skills (
    skill_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES candidate_profiles(profile_id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    category_code TEXT NOT NULL,
    evidence TEXT DEFAULT '',
    confidence TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_skills_profile_id ON profile_skills(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_skills_category ON profile_skills(category_code);

-- Convenient alias view matching endpoint /api/profiles
CREATE OR REPLACE VIEW profiles AS SELECT * FROM candidate_profiles;

-- RLS policies: allow full access for authenticated and anonymous roles in hackathon app
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_skills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'candidate_profiles' AND policyname = 'Allow all operations on candidate_profiles'
    ) THEN
        CREATE POLICY "Allow all operations on candidate_profiles" ON candidate_profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profile_skills' AND policyname = 'Allow all operations on profile_skills'
    ) THEN
        CREATE POLICY "Allow all operations on profile_skills" ON profile_skills FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
