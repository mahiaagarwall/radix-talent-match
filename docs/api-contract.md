# RADIX Talent Match — API & Data Contract (draft for team lock-in)

Status: **proposed**. The participant brief (p. 9–10) says the shapes are "a starting point, not a final spec"
and must be agreed by the team. This file records what the frontend currently sends and accepts, and
every place it differs from the brief or the team guide. Contract owner: Akshat Mehra (Scrum Master).

## 1. Skill object (shared by every module)

```json
{
  "skill_name": "Python",
  "category_code": "COD",
  "evidence": "Built applications using Python",
  "confidence": "high"
}
```

- `category_code` — exactly one of `COD DSA OOD APTI COMM AI CLOUD SQL SWE SYSD NETW OS OTHER`.
- `confidence` — `high | medium | low`. **Extraction confidence**, i.e. how well the evidence supports the
  skill. It is never a proficiency level.
- Proposed optional extension on JD skills only: `"requirement": "required" | "preferred"`
  ("Nice to Have" sections → `preferred`). Missing → treated as `required`.
- Frontend-only field `origin` (`extracted | edited | manual`) exists on profile entries for the
  "extracted vs. edited" UI. It is **stripped** before any API call.

## 2. Endpoints

| Module | Method & path | Source | Request | Response |
|---|---|---|---|---|
| JD Analytics | `POST /api/jd/analyze` | guide | multipart `file` (+ optional `company`, `role`) **or** JSON `{text, company, role}` | JD record (§4) |
| Resume Parsing | `POST /api/resumes/parse` | guide | multipart `file` | Parsed resume (§3) |
| Profile Builder | `POST /api/profiles` | guide | Profile (§5) without `profile_id` | Saved profile with `profile_id` |
| Profile Builder | `GET /api/profiles/{id}` | guide | — | Profile |
| Profile Builder | `PATCH /api/profiles/{id}` | guide | Full profile | Updated profile |
| Talent Check | `POST /api/talent-check` | guide | `{profile_id, company_id}` | Talent Check result (§7) |
| Skill Matching | `POST /api/skill-match` | guide | `{profile_id, jd_id}` | Skill Match result (§6) |
| Profiles list | `GET /api/profiles` | **proposed** | — | `Profile[]` (or `{items: []}`) |
| JD list / get | `GET /api/jd`, `GET /api/jd/{id}` | **proposed** | — | JD record(s) |
| JD save | `POST /api/jd`, `PATCH /api/jd/{id}` | **proposed** | JD record | JD record |
| Companies | `GET /api/companies` | **proposed** | — | requirements file content (§8) |
| Results | `GET /api/results`, `GET /api/results/{id}` | **proposed** | — | results |
| Health | `GET /api/health` | **proposed** | — | any JSON, 200 |

All paths live in `frontend/src/app/config.js` (`ENDPOINTS`). Errors: FastAPI's default
`{"detail": "..."}` or validation `{"detail": [{loc, msg}]}` are both rendered to the user.

## 3. Parsed resume (`POST /api/resumes/parse`)

```json
{
  "source_type": "resume",
  "source_file": "Ananya Rao.pdf",
  "name": "Ananya Rao",
  "email": null,
  "headline": "Systems-leaning generalist — ...",
  "education": [{"degree": "B.Tech", "field": "...", "institution": "", "graduation_year": "2026", "grade": "CGPA 8.6 / 10"}],
  "skills": [<skill>],
  "projects": [{"title": "...", "description": "..."}],
  "internships": [{"role": "...", "organization": "...", "description": "..."}],
  "hackathons": [{"name": "...", "result": "...", "description": "..."}],
  "certifications": [{"name": "...", "issuer": "..."}],
  "achievements": ["..."],
  "preferred_roles": ["..."],
  "resume_reference": "uuid-of-parsed_resumes-row or null"
}
```
Tolerated variations: `candidate: {...}` wrapper, `experience` instead of `internships`, string
`education`, string certifications.

**Implemented (Mahi, branch `mahi`):**
- Resume skills use exactly the 4 skill fields (no `requirement`). Confidence is computed by the
  rule in `docs/scoring-rules.md`, never copied from the LLM. `email` is only ever taken from the text.
- `resume_reference` = the `parsed_resumes.resume_id` (UUID) when the parse was saved, else `null`.
  The original file is not uploaded to Supabase Storage yet.
- Errors: `400` bad file (empty / not PDF-DOCX / corrupt / encrypted / no text layer / >10 MB),
  `422` no usable content (e.g. no name), `502` LLM failure, `503` parsed but database save failed.
- `GET /api/resumes/{resume_id}` returns the stored JSON (404 if unknown).
- Tables: `backend/sql/001_resume_tables.sql` (`parsed_resumes`, `resume_skills`, and the view
  `resume_category_evidence` for Talent Check: skill counts per RADIX category per resume).

## 4. JD record

```json
{
  "jd_id": "stable-id",
  "source_type": "jd",
  "source_file": "Google LLC - Software Engineer.pdf",
  "company": "Google LLC",
  "role": "Software Engineer (SWE)",
  "role_category": "SDE · Product Engineering",
  "location": "Bengaluru, India (Hybrid)",
  "experience_requirements": "string or null",
  "education_requirements": "string or null",
  "skills": [<skill + requirement>]
}
```
Matches the brief's "extracted skill list" plus `jd_id` and metadata. The frontend deduplicates
skills by normalized name before saving.

## 5. Candidate profile

```json
{
  "profile_id": "stable-generated-id",
  "name": "Candidate name",
  "email": "candidate@example.com",
  "education": [ ... ],
  "skills": [<skill>],
  "projects": [ ... ],
  "internships": [ ... ],
  "hackathons": [ ... ],
  "certifications": [ ... ],
  "preferred_roles": ["..."],
  "resume_reference": {"file_name": "...", "file_type": "pdf", "file_size": 113995, "storage_path": null, "source": "..."}
}
```

**Differences from the brief (p. 10) — to resolve as a team:**
- Brief uses `cv_file` (string); frontend uses `resume_reference` (object). The frontend accepts
  `cv_file` from the backend and maps it.
- Brief has `education` as a string; frontend uses an array of objects (accepts a string).
- Brief omits `profile_id` and `projects`; the guide requires both.
- `name` is required. `email` is validated when present but **not required** — none of the four
  supplied resumes contains an email address.

## 6. Skill Match result

```json
{
  "result_id": "...", "type": "skill_match",
  "profile_id": "...", "candidate_name": "...",
  "jd_id": "...", "jd_source_file": "...", "company": "...", "role": "...",
  "match_score": 0,
  "matched_skills": ["..."], "partial_skills": ["..."], "missing_skills": ["..."],
  "skill_results": [{
    "skill_name": "...", "category_code": "...", "requirement": "required",
    "weight": 1, "status": "matched|partial|missing", "match_value": 1,
    "jd_evidence": "...", "candidate_evidence": [<skill>], "reason": "..."
  }],
  "counts": {"matched": 0, "partial": 0, "missing": 0},
  "summary": "...", "recommendations": [{"skill_name": "...", "priority": "high", "text": "..."}],
  "scoring": {"method": "...", "formula": "...", "partial_value": 0.5, "weights": {"required": 1, "preferred": 0.5}},
  "created_at": "ISO-8601"
}
```
Superset of the brief's `{jd_source_file, match_score, matched_skills, missing_skills}`.
Invariant (tested): `match_score == round(100 × Σ weight·match_value / Σ weight)` over `skill_results`.

## 7. Talent Check result

```json
{
  "result_id": "...", "type": "talent_check",
  "profile_id": "...", "candidate_name": "...", "company_id": "...", "company": "...",
  "readiness_score": 0,
  "skillset_gap": [{
    "category_code": "COD", "required_level": 7, "candidate_level": 6,
    "candidate_level_is_estimate": true, "gap": true, "gap_size": 1,
    "status": "meets|close|gap|no-evidence|not-assessed",
    "uncertainty": "low|medium|high", "evidence": [<skill>]
  }],
  "strongest": ["COD"], "priority_gaps": ["APTI"],
  "recommendations": [{"category_code": "APTI", "text": "..."}],
  "summary": "...", "requirements_source": {"file": "...", "synthetic": false},
  "created_at": "ISO-8601"
}
```
Superset of the brief's `{company, skillset_gap[{category_code, required_level, candidate_level, gap}], readiness_score}`.
Always 12 rows (the twelve RADIX skillsets; OTHER is not scored).

## 8. `talent_check_company_skillsets.json` (NOT in the starter pack)

The official file was not in `Talent Match Hackathon.zip`. The brief says to ask the facilitator.
Until its real shape is known, the frontend parser (`src/utils/companyRequirements.js`) accepts:

```json
{ "companies": [ { "company_id": "google", "company_name": "Google LLC",
                   "skillsets": { "COD": 8, "DSA": 9, "...": 0 } } ] }
```
```json
{ "Google LLC": { "COD": 8, "DSA": 9 } }
```
```json
[ { "name": "Google LLC", "levels": [ { "category_code": "COD", "required_level": 8 } ] } ]
```

- Level keys may also be `skill_levels | requirements | expected_levels | levels | skills`.
- Categories may be codes or full names ("Coding").
- Levels must be numbers 0–10 (the brief uses 1–10). Invalid entries are skipped with a warning,
  never guessed. Categories absent from the file show as "Not in file" and are excluded from the score.
- A top-level or per-company `"synthetic": true` flag shows a persistent warning on every result.

If the official shape differs, extend `parseCompanyRequirements` — nothing else needs to change.
