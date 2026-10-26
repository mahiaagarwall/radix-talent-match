# Backend (FastAPI)

Implemented so far: `GET /api/health`, `GET /api/companies` (Supabase), and **Resume Parsing**
(`POST /api/resumes/parse`, `GET /api/resumes/{id}`). Other module endpoints still return 501.

## Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # then fill in values; never commit .env
uvicorn app.main:app --reload --port 8000
```

Try it: `curl -F "file=@../data/resumes/pdf/Ananya Rao.pdf" http://localhost:8000/api/resumes/parse`

## Tests

```bash
cd backend
.venv\Scripts\activate
python -m pytest -q
```
Gemini and Supabase are mocked, so tests are free and offline.

## Resume Parsing (owner: Mahi Aggarwal)

```
upload → document_reader (PDF/DOCX → text)
       → resume_sections (split Education / Technical Skills / Projects / ...)
       → skill_extractor (skills, evidence, confidence rule)
       → [optional] llm_service (Gemini) → cross-checked against the text
       → schemas/resume.py (Pydantic validation)
       → db/resume_repository (one transaction) → response
```

| File | Job |
|---|---|
| `app/services/document_reader.py` | Read PDF (pypdf) / DOCX (python-docx); clear errors for empty, corrupt, encrypted, scanned files |
| `app/services/resume_sections.py` | Split sections; parse education, projects, internships, hackathons, certifications, roles |
| `app/services/skill_catalog.py` | Known skills → category, aliases, evidence patterns (add new skills here) |
| `app/services/skill_extractor.py` | Skills + confidence rule + LLM verification |
| `app/services/llm_service.py` | Gemini REST call (only if `GEMINI_API_KEY` is set) |
| `app/services/resume_extractor.py` | Orchestrates the pipeline |
| `app/services/resume_service.py` | HTTP error mapping and saving |
| `app/db/resume_repository.py` | Atomic save / load, reusing `get_db_connection()` |
| `sql/001_resume_tables.sql` | Tables to paste into the Supabase SQL editor |

Settings (`backend/.env`):
- `GEMINI_API_KEY`: free key from https://aistudio.google.com/apikey. If it's empty, parsing uses rules only.
- `SAVE_PARSED_RESUMES=false` skips the database. Use it until the SQL has been run; otherwise the
  endpoint returns 503 "parsed but NOT saved".
