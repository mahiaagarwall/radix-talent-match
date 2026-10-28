"""RADIX Talent Match — Unified FastAPI Application Entry Point.

Integrates all 5 modules:
1. JD Analytics (Krishna Pandey)
2. Resume Parsing (Mahi Aggarwal)
3. Profile Builder (Aashish Kumar)
4. Talent Check (Krishna Khanna)
5. Skill Matching (Akshat Mehra)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as api_router
from app.config import get_settings
from app.db.supabase import check_db_health

app = FastAPI(
    title="RADIX Talent Match API",
    description="Unified API combining Resume Parsing, Profile Builder, JD Analytics, Talent Check, and Skill Matching.",
    version="1.0.0",
)

# CORS: only the origins listed in CORS_ALLOW_ORIGINS (default: local Vite dev/preview).
# The frontend sends no cookies or auth headers, so credentials stay disabled.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.get("/health", summary="Health check endpoint")
def health():
    """Health endpoint conforming to JD Analyzer specification."""
    settings = get_settings()
    return {
        "status": "ok",
        "service": "jd-analyzer",
        "groq_configured": settings.groq_configured,
        "supabase_configured": settings.supabase_configured,
        "llm": settings.llm_status(),
    }


@app.get("/api/health", summary="Unified API health check endpoint")
def api_health():
    """Full health check endpoint reporting status of all modules and database."""
    db_health = check_db_health()
    settings = get_settings()
    return {
        "status": "ok",
        "service": "radix-talent-match",
        "version": "1.0.0",
        "modules_implemented": [
            "resume_parsing",
            "profile_builder",
            "jd_analytics",
            "talent_check",
            "skill_matching",
        ],
        "database": db_health,
        "groq_configured": settings.groq_configured,
        "supabase_configured": settings.supabase_configured,
        "llm": settings.llm_status(),
    }


# Register unified API router with /api prefix
app.include_router(api_router, prefix="/api")
