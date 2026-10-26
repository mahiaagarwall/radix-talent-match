# Backend (FastAPI) — integration skeleton

Not implemented yet. `app/main.py` exposes `GET /api/health` and 501 stubs for every module endpoint,
with Pydantic models in `app/schemas/contracts.py` that mirror `docs/api-contract.md`.

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Suggested files per the team guide: `api/` (one router per module), `services/` (document reader,
extractors, scorers), `db/` (Supabase client), `schemas/`. Supabase credentials go in `backend/.env`
(see the root `.env.example`) — never commit them.
