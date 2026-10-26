-- RADIX Talent Match — Resume Parsing tables (owner: Mahi Aggarwal)
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- Does not touch existing tables (companies, company_skill_levels, skill_set_master).

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- One row per uploaded resume file (identified by its SHA-256 so re-uploads update, not duplicate).
create table if not exists public.parsed_resumes (
    resume_id       uuid primary key default gen_random_uuid(),
    source_file     text        not null,
    file_sha256     char(64)    not null unique,
    candidate_name  text        not null check (length(trim(candidate_name)) > 0),
    email           text        check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    headline        text        not null default '',
    education       jsonb       not null default '[]'::jsonb check (jsonb_typeof(education) = 'array'),
    projects        jsonb       not null default '[]'::jsonb check (jsonb_typeof(projects) = 'array'),
    internships     jsonb       not null default '[]'::jsonb check (jsonb_typeof(internships) = 'array'),
    hackathons      jsonb       not null default '[]'::jsonb check (jsonb_typeof(hackathons) = 'array'),
    certifications  jsonb       not null default '[]'::jsonb check (jsonb_typeof(certifications) = 'array'),
    achievements    jsonb       not null default '[]'::jsonb check (jsonb_typeof(achievements) = 'array'),
    preferred_roles jsonb       not null default '[]'::jsonb check (jsonb_typeof(preferred_roles) = 'array'),
    parsed_json     jsonb       not null,                       -- full validated API response
    parser_mode     text        not null check (parser_mode in ('rules', 'llm')),
    source_tag      text        not null default 'upload',      -- e.g. 'upload', 'sample-pack', 'dataset'
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists parsed_resumes_email_idx on public.parsed_resumes (lower(email));
create index if not exists parsed_resumes_name_idx  on public.parsed_resumes (lower(candidate_name));

-- One row per extracted skill (shared skill contract).
create table if not exists public.resume_skills (
    skill_id      bigint generated always as identity primary key,
    resume_id     uuid   not null references public.parsed_resumes (resume_id) on delete cascade,
    skill_name    text   not null check (length(trim(skill_name)) > 0),
    category_code text   not null check (category_code in
                     ('COD','DSA','OOD','APTI','COMM','AI','CLOUD','SQL','SWE','SYSD','NETW','OS','OTHER')),
    evidence      text   not null default '',
    confidence    text   not null check (confidence in ('high','medium','low'))
);

create unique index if not exists resume_skills_unique_name on public.resume_skills (resume_id, lower(skill_name));
create index if not exists resume_skills_category_idx on public.resume_skills (category_code);

-- Talent Check helper: evidence per RADIX category for each resume.
create or replace view public.resume_category_evidence as
select
    s.resume_id,
    s.category_code,
    count(*)                                              as skill_count,
    count(*) filter (where s.confidence = 'high')         as high_count,
    count(*) filter (where s.confidence = 'medium')       as medium_count,
    count(*) filter (where s.confidence = 'low')          as low_count,
    array_agg(s.skill_name order by s.skill_name)         as skills
from public.resume_skills s
group by s.resume_id, s.category_code;

-- Candidate data is personal information: block the public anon/authenticated API roles.
-- The FastAPI backend connects with the database owner role, which bypasses RLS.
alter table public.parsed_resumes enable row level security;
alter table public.resume_skills  enable row level security;
revoke all on public.parsed_resumes, public.resume_skills, public.resume_category_evidence from anon, authenticated;
