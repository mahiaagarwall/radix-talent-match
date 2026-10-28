# RADIX Talent Match — Database Migrations

This directory contains the authoritative SQL migration scripts for the unified Supabase PostgreSQL database supporting all 5 modules.

## Target Database
- **Supabase Project URL:** Managed via `SUPABASE_URL` in environment configuration (`.env`).
- **Access Role:** Service role or authenticated admin via the Supabase Dashboard SQL Editor.

---

## Migration Scripts Order

Run these scripts in numeric order in the Supabase Dashboard **SQL Editor**:

### 1. `001_create_profiles.sql` (Owner: Aashish Kumar)
- Creates `candidate_profiles` table with JSONB columns for candidate profile information (`education`, `skills`, `projects`, `internships`, `hackathons`, `certifications`, `preferred_roles`, `resume_reference`).
- Creates relational `profile_skills` table with indexed `profile_id` and `category_code`.
- Creates `profiles` view alias for `/api/profiles` compatibility.
- Configures Row Level Security (RLS) policies.

### 2. `002_reconcile_id_types_and_jds.sql` (Owners: Akshat Mehra & Krishna Pandey)
- Creates `job_descriptions` table for persistent JD storage with JSONB `skills` list.
- Creates `jds` view alias for `/api/jd` compatibility.
- Creates or reconciles `skill_match_results` table to use `TEXT` for `profile_id` and `jd_id`, enabling seamless foreign references to `prf_*` and `jd_*` string identifiers without ID truncation or synthetic conversions.
- Configures RLS policies and performance indexes for match queries.

### 3. `003_add_canonical_skills.sql` (Owners: Krishna Pandey & Krishna Khanna)
- Idempotently inserts application support and software engineering canonical skills into `public.skill_set_master`.
- Ensures JD Analytics and Talent Check reach required target competencies without padding with unrelated skills.

---

## Local Development & Fallbacks
If Supabase is temporarily unreachable or offline:
- All repositories (`ProfileRepository`, `JdRepository`, `SkillMatchRepository`) maintain in-memory fallbacks seeded with verified sample fixtures (`Ananya Rao`, `Rohan Verma`, `Google SWE`, `FinTech Backend`, etc.).
- Module evaluation, skill matching scoring, and comparison tests continue to pass 100%.
