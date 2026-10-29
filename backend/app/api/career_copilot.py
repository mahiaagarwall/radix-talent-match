"""Career Copilot API Endpoints for RADIX / PARALLAX Talent Match.

Provides endpoints for:
1. Job Finder: Candidate-to-Job multi-factor recommendation and ranking
2. Resume Coach: Safe, anti-fabrication resume bullet enhancement
3. Resume Coach: requirement-by-requirement gap analysis against one job description
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.db.fixtures import JD_FIXTURES
from app.db.jd_repository import jd_repository
from app.schemas.career_copilot import (
    JobRecommendationRequest,
    JobRecommendationResponse,
    ResumeCoachRequest,
    ResumeCoachResponse,
    ResumeGapAnalysisResponse,
)
from app.services.job_finder import recommend_jobs
from app.services.resume_coach import improve_resume_bullet
from app.services.resume_gap_analysis import GapAnalysisError, analyze, resolve_job, resolve_resume
from app.services.resume_text_extractor import max_upload_bytes

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


def _run_gap_analysis(filename: Optional[str], content_type: str, data: Optional[bytes], resume_text: Optional[str], jd_text: Optional[str], jd_id: Optional[str]):
    resume, resume_source = resolve_resume(filename, content_type, data, resume_text)
    job, job_source = resolve_job(jd_text, jd_id)
    return analyze(resume, resume_source, job, job_source)


@router.post(
    "/resume-coach/gap-analysis",
    response_model=ResumeGapAnalysisResponse,
    summary="Compare one resume with one specific job description",
    responses={
        400: {"description": "Missing or ambiguous resume / job input"},
        404: {"description": "Stored job description not found"},
        413: {"description": "File or text too large"},
        415: {"description": "Unsupported file type"},
        422: {"description": "Unreadable file, or too little text to analyze"},
        502: {"description": "The LLM providers failed"},
        503: {"description": "No LLM provider configured"},
    },
)
async def resume_gap_analysis_endpoint(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    jd_text: Optional[str] = Form(None),
    jd_id: Optional[str] = Form(None),
):
    """multipart/form-data: resume_file (PDF/DOCX/TXT) or resume_text, plus jd_text or jd_id.

    Nothing is stored; the uploaded resume and saved profile are never modified.
    """
    filename, content_type, data = None, "", None
    if resume_file is not None and resume_file.filename:
        filename, content_type = resume_file.filename, resume_file.content_type or ""
        data = await resume_file.read(max_upload_bytes() + 1)
        await resume_file.close()
    try:
        return await run_in_threadpool(_run_gap_analysis, filename, content_type, data, resume_text, jd_text, jd_id or None)
    except GapAnalysisError as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})
    except Exception as exc:
        logger.error("Resume gap analysis failed unexpectedly: %s", type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "The analysis failed because of an unexpected server error.", "code": "analysis_failed"})
