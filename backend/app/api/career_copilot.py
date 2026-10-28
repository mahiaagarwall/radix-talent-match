"""Career Copilot API Endpoints for RADIX / PARALLAX Talent Match.

Provides endpoints for:
1. Job Finder: Candidate-to-Job multi-factor recommendation and ranking
2. Resume Coach: Safe, anti-fabrication resume bullet enhancement
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from app.db.fixtures import JD_FIXTURES
from app.db.jd_repository import jd_repository
from app.schemas.career_copilot import (
    JobRecommendationRequest,
    JobRecommendationResponse,
    ResumeCoachRequest,
    ResumeCoachResponse,
)
from app.services.job_finder import recommend_jobs
from app.services.resume_coach import improve_resume_bullet

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/career-copilot", tags=["Career Copilot"])


@router.post(
    "/jobs/recommend",
    response_model=JobRecommendationResponse,
    summary="Recommend and rank suitable jobs for a candidate profile",
)
def recommend_jobs_endpoint(request: JobRecommendationRequest):
    """Evaluates candidate skills, projects, and background against available jobs.

    Returns ranked list of matching jobs with weighted scores, match tiers, and explainable breakdowns.
    """
    try:
        return recommend_jobs(request)
    except Exception as exc:
        logger.error("Job recommendation error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate job recommendations: {str(exc)}",
        )


@router.get(
    "/jobs/available",
    summary="List available jobs for selection in Career Copilot",
)
def get_available_jobs_endpoint() -> List[Dict[str, Any]]:
    """Returns summarized list of available jobs for target matching."""
    jobs: Dict[str, Dict[str, Any]] = {}
    for key, f in JD_FIXTURES.items():
        jid = f.get("jd_id") or key
        jobs[jid] = {
            "jd_id": jid,
            "company": f.get("company", "Company"),
            "role": f.get("role", "Software Role"),
            "skills": [s.get("skill_name") if isinstance(s, dict) else str(s) for s in f.get("skills", [])],
        }

    for jd in jd_repository.list_all():
        jid = jd.get("jd_id")
        if jid:
            jobs[jid] = {
                "jd_id": jid,
                "company": jd.get("company", "Company"),
                "role": jd.get("role", "Software Role"),
                "skills": [s.get("skill_name") if isinstance(s, dict) else str(s) for s in jd.get("skills", [])],
            }

    return list(jobs.values())


@router.post(
    "/resume-coach/improve",
    response_model=ResumeCoachResponse,
    summary="Improve resume bullet point without fabricating achievements",
)
def improve_resume_bullet_endpoint(request: ResumeCoachRequest):
    """Transforms weak/passive bullet points into impactful action-oriented statements.

    Strictly guarantees zero invented metrics, false percentages, or unverified achievements.
    """
    try:
        return improve_resume_bullet(request)
    except Exception as exc:
        logger.error("Resume Coach error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process bullet improvement: {str(exc)}",
        )
