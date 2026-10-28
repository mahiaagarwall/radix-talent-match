# RADIX Talent Match — Backend (FastAPI)

FastAPI application for RADIX Talent Match assessment services.

## Implemented Modules

| Module | Route | Owner | Status |
|---|---|---|---|
| Health Check | `GET /health`, `GET /api/health` | Shared | Active (includes LLM configuration status) |
| Skill Matching | `POST /api/skill-match`, `GET /api/skill-match/{match_id}`, `GET /api/skill-match` | Akshat Mehra | Implemented |
| JD Analytics | `POST /api/jd/analyze`, `/api/jd` | Krishna Pandey | Implemented |
| Resume Parsing | `POST /api/resumes/parse` | Mahi Aggarwal | Implemented |
| Profile Builder | `/api/profiles` (CRUD) | Aashish Kumar | Implemented |
| Talent Check | `POST /api/talent-check`, `POST /api/talent-check/compare` | Krishna Khanna | Implemented |

---

## Setup & Running

### 1. Prerequisites
- Python 3.10+ (verified on Python 3.12.2)
- Windows PowerShell or Bash

### 2. Environment Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Safe Supabase Configuration (Optional)
Create `backend/.env` (do NOT commit this file to version control):
```ini
# Supabase Configuration (leave blank for local fixture mode)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
> [!NOTE]
> If Supabase credentials are not provided, the API runs in offline mode using preloaded sample fixtures and sets `persisted: false` without crashing.

### LLM Providers & Failover
JD analysis (`POST /api/jd/analyze`) and resume parsing (`POST /api/resumes/parse`) share one router, `app/llm_router.py`, configured in `app/config.py`. Copy `backend/.env.example` to `backend/.env` and fill in the keys you have:

| Priority | Provider | Key variable | Model variable (default) |
|---|---|---|---|
| 1 | Groq | `GROQ_API_KEY` | `GROQ_MODEL` (`openai/gpt-oss-120B`) |
| 2 | OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` (`nvidia/nemotron-3.5-super-vl:free`) |
| 3 | Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` (`gemini-3.5-flash`) |

- **Order:** `LLM_PROVIDER` is tried first; the rest follow `LLM_PROVIDER_ORDER` (default `groq,openrouter,gemini`). Providers with no key are skipped.
- **Failover:** rate limits (429), 5xx/overload, timeouts and connection errors get up to `LLM_MAX_RETRIES` (default 1) extra attempts. The retry honours a `Retry-After` of up to `LLM_RETRY_MAX_WAIT_SECONDS` (default 5); a longer wait skips straight to the next provider. Auth (401), permission (403), billing (402), unknown model (404/400) and rejected requests move to the next provider without retrying. A response that fails JSON/schema validation is also replaced by the next provider's. Each request times out after `LLM_TIMEOUT_SECONDS` (45), and one whole operation after `LLM_TOTAL_TIMEOUT_SECONDS` (120).
- **Disable failover:** `LLM_FALLBACK_ENABLED=false` uses `LLM_PROVIDER` only.
- **When every provider fails:** JD analysis returns HTTP 503 listing each provider, its model and its failure category (never keys), or a sample fixture labelled "LLM offline" for known sample files. Resume parsing falls back to the rule-based parser and adds a warning.
- **Which error means what:** `auth_failed` → wrong or revoked key. `permission_denied` → the account can't use that model. `invalid_model` → the model ID is wrong or retired for that provider (check casing). `billing` / `rate_limited` → credits or quota.
- **Health:** `GET /health` and `GET /api/health` include an `llm` block showing keys present (true/false only), models, order and config errors. `connectivity: not_checked` means a configured key has not been proven to work.
- **Settings are cached:** restart the server after editing `.env`.
- **Live check (uses real quota; never run by pytest):** `.\.venv\Scripts\python.exe scripts\llm_smoke_test.py groq` (or `openrouter`, `gemini`). It sends one tiny request to that provider only.
- **Tests:** `.\.venv\Scripts\python.exe -m pytest tests/test_llm_router.py -v` runs mocked HTTP tests. `tests/conftest.py` blocks any real provider call during tests.

### 4. Database Table Migration
Execute `app/db/schema.sql` in your Supabase SQL Editor to create the `skill_match_results` table and performance indexes.

### 5. Running the Backend Server
```powershell
.\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
Server runs at `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.

### 6. Running Backend Tests
```powershell
.\.venv\Scripts\python.exe -m pytest -v
```
Last verified run: 211 passed. The suite never calls a real LLM provider (`tests/conftest.py` blocks it) and never writes to the real database.

**CORS:** only the origins listed in `CORS_ALLOW_ORIGINS` (comma-separated) may call the API. By default these are the local Vite dev and preview servers. Credentials are disabled because the frontend sends no cookies or auth headers.
