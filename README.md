# PARALLAX · Talent Intelligence

> **See Talent in True Depth.**  
> Analyze job descriptions, uncover candidate skills, assess technical readiness, and discover the right talent for every role — with evidence behind every match.

One integrated talent-assessment application with five connected modules:

| Step | Module | Owner | Route |
|---|---|---|---|
| 1 | JD Analytics | Krishna Pandey | `/jd-analytics`, `/jd-analytics/:jdId` |
| 2 | Resume Parsing | Mahi Aggarwal | `/resume-parsing` |
| 3 | Profile Builder | Aashish Kumar | `/profile-builder`, `/profile-builder/:profileId` |
| 4 | Talent Check | Krishna Khanna | `/talent-check` |
| 5 | Skill Matching (+ Scrum Master) | Akshat Mehra | `/skill-matching` |

Plus `/` (dashboard), `/company-directory` (Company Directory, see below), `/results`, `/results/:resultId`, `/settings`, and a not-found page.

**Talent Check** answers "how ready is this candidate for this *company* across the 12 RADIX skillsets?"
**Skill Matching** answers "how well does this candidate fit this *job posting*?"
They are separate scores and are never combined.

---

## Integration Status

| Area | State |
|---|---|
| **Frontend** (React 18 + Vite 5 + CSS tokens; Tailwind scoped to the Company Directory) | Last verified run: 89 Vitest tests passed (9 files), ESLint clean, `tsc` + production build passing |
| **Backend** (Python FastAPI) | Last verified run: 211 pytest tests passed (offline fixtures and mocked LLM providers; live Supabase and live LLM calls are not exercised by the suite) |
| **JD Analytics** | Fully functional: PDF/DOCX extraction, rule-based & LLM extraction, JD persistence and `/api/jd` repository |
| **Resume Parsing** | Fully functional: PDF/DOCX extraction, contact extraction, skill taxonomy, fallback store, prefill integration |
| **Profile Builder** | Fully functional: CRUD via `/api/profiles` with stable `prf_*` IDs, relational `profile_skills`, prefill from resume |
| **Talent Check** | Fully functional: 12 RADIX categories readiness scoring, official `talent_check_company_skillsets.json` loader, single assessment and side-by-side candidate comparison (`/api/talent-check/compare`) |
| **Skill Matching** | Fully functional: deterministic 4-tier matching engine, weighted scoring formula, `skill_match_results` persistence |
| **Company Directory** | Read-only company research (search, category filters, company intelligence, skill roadmaps) from the company Supabase project; see below |
| **Supabase PostgreSQL** | Unified schema and migrations in `backend/migrations/`; zero hardcoded credentials; safe offline fixture fallbacks |

---

## Tech Stack

- **Frontend:** React 18 · Vite 5 · JavaScript · React Router 6 · Recharts · Lucide React · Vitest · Testing Library. The Company Directory feature is TypeScript with scoped Tailwind 3, React Query 5 and supabase-js 2.109 (the newest release that supports Node 20).
- **Backend:** Python 3.10+ (verified on Python 3.12.2) · FastAPI · Pydantic v2 · Uvicorn · PyPDF · python-docx · pytest
- **Database:** Supabase PostgreSQL (PostgREST client) with in-memory fixture fallback stores

---

## Getting Started

### 1. Backend Setup

From the project root:

```bash
cd backend
python -m venv .venv

# On Windows (cmd.exe or PowerShell):
.\.venv\Scripts\activate

# On Git Bash:
source .venv/Scripts/activate

# On Linux / macOS:
source .venv/bin/activate

# Install dependencies:
pip install -r requirements.txt

# Start the unified FastAPI backend:
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
- Health check: `http://localhost:8000/api/health`
- OpenAPI Swagger documentation: `http://localhost:8000/docs`

### 2. Frontend Setup

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

For the Company Directory, copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public anon key only). Then restart `npm run dev`, because Vite reads env files only at startup. Without them the directory shows a configuration error instead of data; the rest of the app is unaffected.

**Production hosting:** this is a single-page app. Configure the host to serve `index.html` for unknown paths (SPA fallback); otherwise refreshing a deep link such as `/company-directory/company/skills` returns 404. `vite preview` already does this. Set `CORS_ALLOW_ORIGINS` in `backend/.env` to the deployed frontend origin.

---

## Running Tests

### Backend Tests (pytest)
```bash
cd backend
.\.venv\Scripts\pytest -v
# Last verified run: 211 passed
```

### Backend Acceptance Test
```bash
cd backend
python run_acceptance_test.py
# Runs side-by-side comparison of candidate profiles against company requirements
```

### Frontend Tests (Vitest)
```bash
cd frontend
npm test -- --run
# Last verified run: 89 passed across 9 test files
```

### Frontend Lint & Production Build
```bash
cd frontend
npm run lint        # ESLint (JavaScript)
npm run typecheck   # TypeScript check of the Company Directory
npm run build       # typecheck + production bundle into dist/
```

---

## Unified API Endpoints

All routes are served by the unified FastAPI server:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | JD Analyzer health status |
| `GET` | `/api/health` | Comprehensive system health check |
| `POST` | `/api/resumes/parse` | Parse resume document (PDF/DOCX) or form data |
| `POST` | `/api/profiles` | Create candidate profile (`prf_*`) |
| `GET` | `/api/profiles` | List all candidate profiles |
| `GET` | `/api/profiles/{profile_id}` | Retrieve specific candidate profile | 
| `PATCH` | `/api/profiles/{profile_id}` | Update candidate profile | 
| `DELETE` | `/api/profiles/{profile_id}` | Delete candidate profile | 
| `POST` | `/api/jd/analyze` | Analyze job description (file or JSON text) | 
| `POST` | `/api/jd` | Save analyzed job description | 
| `GET` | `/api/jd` | List all job descriptions | 
| `GET` | `/api/jd/{jd_id}` | Retrieve specific job description | 
| `PATCH` | `/api/jd/{jd_id}` | Update job description |
| `POST` | `/api/talent-check` | Evaluate candidate readiness against company | 
| `POST` | `/api/talent-check/compare` | Side-by-side comparison of two candidates | 
| `GET` | `/api/talent-check/companies` | List companies with requirement profiles | 
| `GET` | `/api/talent-check/candidates` | List available candidates for Talent Check | 
| `GET` | `/api/companies` | Company requirements metadata |
| `POST` | `/api/skill-match` | Deterministic job-specific skill matching |
| `GET` | `/api/skill-match/{match_id}`| Retrieve persisted skill match result | 
| `GET` | `/api/results` | List matching and talent check results | 

---

## Company Directory

Sidebar item directly below **Dashboard**. All routes live under the app's single router:

| Route | Page |
|---|---|
| `/company-directory` | Company grid: search (name, location, category) and category filters with counts |
| `/company-directory/company` | Redirects to `/company-directory/company/intelligence` |
| `/company-directory/company/intelligence` | 22-section company intelligence |
| `/company-directory/company/skills` | Skill intelligence with 10-level roadmaps |

- **Code:** `frontend/src/features/company-directory/`, lazy-loaded from `frontend/src/pages/CompanyDirectory.jsx`.
- **Data (read-only):** a separate Supabase project, reached with the public anon key.
  - Company cards read `company_json(company_id, short_json)`.
  - A company page reads `company_json(..., full_json)` by id.
  - Skills read `company_skill_levels`, `skill_set_master`, `proficiency_levels` and `skill_set_topics`.
  - Each table needs a `SELECT` policy for `anon`. There are no writes, no migrations, and no link to the talent-match tables.
- **Selected company:** stored in `localStorage` under `radix-tm:company-directory:selected-company`, so company pages survive a refresh. The standalone portal's `selected-company` key is migrated once.
- **States:**
  - Skeletons while loading.
  - A Retry error for failures and timeouts (15 s per request).
  - An explicit message for missing env vars and for empty results (no rows, or RLS blocking `anon`).
  - Sample data is never shown as if it were live.
- **Theme:** follows the app's light/dark toggle. Styles are scoped to `.cd-root`, so the directory cannot restyle other pages.
- **Hero background:** `AnimatedParticleBackground` in `frontend/src/components/ui/`, a reusable canvas particle field.
  - Props: `particleCount`, `speed`, `interactive`, `parallaxStrength`, `interactionRadius`, `interactionStrength`, `className`.
  - Usage: make it the first child of a `position: relative; overflow: hidden` container, and give the content `position: relative; z-index: 1`.
  - Behaviour: decorative (`aria-hidden`, `pointer-events: none`), static under `prefers-reduced-motion`, and paused when the tab is hidden or the field is off-screen.

## Supabase Database Configuration & Migrations

Authoritative SQL migrations are located in `backend/migrations/`:

1. `001_create_profiles.sql` — Creates `candidate_profiles`, `profile_skills`, and view `profiles`.
2. `002_reconcile_id_types_and_jds.sql` — Creates `job_descriptions`, view `jds`, and reconciles `skill_match_results` with `TEXT` profile and JD identifiers.
3. `003_add_canonical_skills.sql` — Idempotently populates application support and software engineering skills in `skill_set_master`.

To configure live Supabase persistence:
1. Copy `backend/.env.example` to `backend/.env`.
2. Set your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_KEY`).
3. Optionally set one or more LLM keys (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`) for live JD/resume extraction, with automatic Groq → OpenRouter → Gemini failover. See [backend/README.md](backend/README.md#llm-providers--failover). Without a key, resumes use the rule-based parser and JD analysis returns 503 (or a labelled sample fixture).
4. Run migrations 001–003 in the Supabase SQL editor.

> [!NOTE]
> When Supabase credentials are not provided or the remote database is unreachable, the application automatically runs in safe offline mode with pre-seeded fixtures. No tests or core features are blocked.
