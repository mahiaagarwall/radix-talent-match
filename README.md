npm# RADIX Talent Match

One integrated talent-assessment application with five connected modules:

| Step | Module | Owner | Route |
|---|---|---|---|
| 1 | JD Analytics | Krishna Pandey | `/jd-analytics`, `/jd-analytics/:jdId` |
| 2 | Resume Parsing | Mahi Aggarwal | `/resume-parsing` |
| 3 | Profile Builder | Aashish Kumar | `/profile-builder`, `/profile-builder/:profileId` |
| 4 | Talent Check | Krishna Khanna | `/talent-check` |
| 5 | Skill Matching (+ Scrum Master) | Akshat Mehra | `/skill-matching` |

Plus `/` (dashboard), `/results`, `/results/:resultId`, `/settings`, and a not-found page.

**Talent Check** answers "how ready is this candidate for this *company* across the 12 RADIX skillsets?"
**Skill Matching** answers "how well does this candidate fit this *job posting*?" They are separate
scores and are never combined.

## Status — read this first

| Area | State |
|---|---|
| Frontend (all pages, routing, services, state) | Built and tested |
| Demo mode (browser storage + sample-pack fixtures) | Working |
| FastAPI backend | **Skeleton only** — `/api/health` plus 501 stubs |
| Supabase | **Not integrated** |
| Resume / JD document parsing | **Backend responsibility** — not done in the browser |
| `talent_check_company_skillsets.json` | **Missing from the starter pack** — Talent Check shows a setup state until it is supplied |
| Scoring rules | Deterministic demo rules, **pending team agreement** (`docs/scoring-rules.md`) |

## Tech stack

React 18 · Vite 5 · JavaScript · React Router 6 · Recharts · Lucide icons · global CSS architecture
with design tokens · Vitest + Testing Library. Backend target: Python · FastAPI · Supabase.

## Getting started

```bash
cd radix-talent-match/frontend
npm install
npm run dev          # http://localhost:5173
```

On the dashboard, choose **Load sample pack** to load the 4 sample candidates and 6 sample JDs,
then go through the flow: JD Analytics → Resume Parsing → Profile Builder → Talent Check → Skill Matching.

> Network note: on the network where this was built, `registry.npmjs.org` reset connections, so the
> install was done with `npm install --registry=https://registry.npmmirror.com`. The lockfile points
> to registry.npmjs.org, so a plain `npm install` works anywhere the official registry is reachable.

### Scripts (run in `frontend/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (35 tests: routes, navigation, forms, profile CRUD, matching consistency, empty/error states, scoring, file validation) |

## Demo mode vs. API mode

Set with `VITE_DATA_MODE` (`frontend/.env.local`, see `frontend/.env.example`), or switch at runtime
on **Settings**.

**Demo mode** (default)
- Profiles, JDs and results go through a local persistence adapter (`localStorage`) behind the
  service layer. The UI says "local demo storage" and never claims Supabase.
- **Resume Parsing:** uploads are validated (extension, size, empty file, PDF/DOCX signature). If the
  file name matches one of the four supplied resumes, a hand-annotated fixture is shown, labelled
  "Demo fixture". Any other file gets a clear "can't be parsed in demo mode" state and the option to
  enter details by hand. It is never replaced with another candidate's data.
- **JD Analytics:** sample-pack JDs load fixtures. Pasted text goes through a labelled keyword scan
  that only reports terms literally present in the text, quotes the sentence as evidence, and marks
  everything low confidence.
- **Scoring:** deterministic and documented, labelled "Illustrative demo scoring".

**API mode**
- Every call goes to FastAPI at `VITE_API_BASE_URL` through one client (`src/services/apiClient.js`)
  with timeouts, cancellation, multipart uploads and normalized errors.
- Failures are shown as errors. There is **no** silent fallback to demo data.

## Backend integration

1. Implement the endpoints in `docs/api-contract.md` (the guide's seven, plus the proposed list,
   companies, results and health endpoints).
2. `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
3. Set `VITE_DATA_MODE=api` (or use Settings), then use **Test connection** on Settings.
4. Response shapes can vary a little: normalizers in each service accept the brief's field names
   (`cv_file`, string `education`, etc.).

Endpoint paths are defined in one place: `frontend/src/app/config.js`.

## Talent Check requirements file

`talent_check_company_skillsets.json` was **not** in `Talent Match Hackathon.zip`. Per the brief,
get it from the facilitator, then either:
- save it to `data/` and copy it to `frontend/public/data/` (loaded automatically), or
- import it on the Talent Check page (stored in this browser).

Accepted shapes are listed in `docs/api-contract.md §8`. The app never makes up company levels.

## Project structure

```
radix-talent-match/
  frontend/
    src/
      app/            config (env, endpoints), navigation
      components/
        layout/       AppShell, Sidebar, Topbar, GlobalSearch, PageHeader, DemoNotice
        ui/           Button, Card, Badges, Alert, States, Fields, FileDropzone, ScoreRing, ...
        dashboard/    WorkflowSteps, ScoreTrendChart, GapCategoryChart, ActivityFeed
        resume/       ParsedResumeView
        profile/      SkillEditor, EntryListEditor, TagInput, ProfileSelector, OriginBadge
        jd/           JdEditor, JdRequirementsView, JdList
        talent-check/ RequirementsSetup, ReadinessRadar, CategoryMatrix, TalentCheckResultView
        skill-matching/ MatchResultView, MatchTable, CategoryBreakdownChart
        results/      ResultsTable
      context/        AppDataContext (records + active candidate/JD), ToastContext
      data/           RADIX categories, chart colours, fixtures/ (sample pack annotations)
      hooks/          useDocumentTitle, useAsyncTask, useMediaQuery
      pages/          one file per route
      services/       apiClient, mode, storage, localRepository, resume/profile/jd/
                      talentCheck/skillMatch/results/settings services, sampleWorkspace
      styles/         tokens, base, layout, components, pages
      utils/          skillMatcher, readinessScorer, skillNormalizer, companyRequirements,
                      jdKeywordScan, fileValidation, validation, format
    tests/
  backend/            FastAPI skeleton + Pydantic contract models
  data/               supplied resumes and JDs (PDF + DOCX)
  docs/               api-contract.md, scoring-rules.md
```

Each module owner mostly works in their own `pages/<Module>.jsx`, `components/<module>/` and
`services/<module>Service.js`. Shared contracts are in `docs/api-contract.md` and
`src/data/categories.js`.

## Accessibility and responsiveness

Skip link, landmark regions, labelled form controls, `aria-invalid` and error text, visible focus
rings, status shown with an icon and a label (never colour alone), a legend and a table view for
every chart, a keyboard-accessible combobox for global search, a collapsible desktop sidebar and a
mobile drawer (closes with Esc), and tables that scroll horizontally inside their card on narrow
screens. Checked at 1440, 820 and 390 px.

## Known limitations

- No real document parsing, LLM extraction or Supabase persistence (backend scope).
- Company requirements file missing, so Talent Check needs it before it can run.
- Scoring weights, partial value and level rubric are demo defaults until the team agrees on them.
- No authentication. Demo data lives in one browser profile.
- The FastAPI skeleton has not been run in this environment.
