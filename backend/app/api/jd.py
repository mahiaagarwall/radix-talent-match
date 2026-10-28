"""app/api/jd.py — FastAPI router for JD Analytics module (Owner: Krishna Pandey).

Endpoints:
- POST  /api/jd/analyze   → Upload PDF/DOCX or submit text for structured skill extraction
- POST  /api/jd           → Persist an analyzed/configured Job Description
- GET   /api/jd           → List all saved Job Descriptions
- GET   /api/jd/{jd_id}   → Retrieve a Job Description by ID
- PATCH /api/jd/{jd_id}   → Update a saved Job Description
"""

from __future__ import annotations

import logging
from typing import Optional, List, Dict, Any, Union

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

from app.config import get_settings
from app.db.jd_repository import jd_repository
from app.db.fixtures import find_jd_fixture
from app.jd_parser import ParserError, extract_text
from app.jd_service import analyze_jd
from app.schemas.jd import JDAnalysisResponse, JobMetadataResponse, SkillResult
from app.skill_extractor import ExtractionError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["JD Analytics"])

ACCEPTED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}
ACCEPTED_EXTENSIONS = {".pdf", ".docx"}


def _is_accepted_file(filename: str, content_type: str) -> bool:
    lower = (filename or "").lower()
    return any(lower.endswith(ext) for ext in ACCEPTED_EXTENSIONS) or (
        content_type in ACCEPTED_CONTENT_TYPES
    )


class AnalyzeTextRequest(BaseModel):
    text: str
    company: Optional[str] = None
    role: Optional[str] = None


@router.post(
    "/jd/analyze",
    response_model=JDAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse a job description from PDF/DOCX upload or pasted text",
)
async def analyze_jd_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None),
    company: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
) -> JDAnalysisResponse:
    content_type = request.headers.get("content-type", "")
    source_file = "Pasted text"
    jd_text = ""

    # Check if request is JSON body (pasted text mode)
    if "application/json" in content_type:
        try:
            body = await request.json()
            req_model = AnalyzeTextRequest(**body)
            jd_text = req_model.text.strip()
            if not jd_text:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Job description text cannot be empty.",
                )
            company = req_model.company or company
            role = req_model.role or role
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON request: {str(exc)}",
            )
    else:
        # File upload mode
        if file is None or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file was uploaded. Please upload a PDF or DOCX file or send JSON text.",
            )

        filename = file.filename
        file_ctype = file.content_type or ""
        source_file = filename

        if not _is_accepted_file(filename, file_ctype):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{filename}'. Please upload a PDF (.pdf) or Word document (.docx).",
            )

        try:
            data = await file.read()
        except Exception as exc:
            logger.error("Failed to read uploaded file: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to read the uploaded file. Please try again.",
            )

        try:
            jd_text, _fmt = extract_text(data, filename, file_ctype)
        except ParserError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=exc.user_message,
            )

    # Execute analysis orchestration
    try:
        result = analyze_jd(jd_text)
    except (ExtractionError, ValueError) as exc:
        logger.warning("LLM extraction unavailable (%s). Checking for sample fixture fallback.", exc)
        # Only an uploaded sample file may fall back to its hand-annotated fixture. Pasted text has no
        # identity to match, so it must get an honest 503 rather than an unrelated sample analysis.
        fixture = find_jd_fixture(source_file) if file is not None and source_file != "Pasted text" else None
        if fixture:
            metadata = JobMetadataResponse(
                company_name=company or fixture.get("company", ""),
                job_title=role or fixture.get("role", ""),
                job_summary=fixture.get("role_category", ""),
                employment_type=fixture.get("employment_type", "Full-time"),
                location=fixture.get("location", ""),
                experience_required=fixture.get("experience_requirements", ""),
            )
            skills = [
                SkillResult(
                    skill_name=s["skill_name"],
                    category_code=s.get("category_code", "OTHER"),
                    category_name=s.get("category_code", "OTHER"),
                    requirement_type=s.get("requirement", "required"),
                    importance=s.get("importance", "medium"),
                    target_proficiency=s.get("target_proficiency"),
                    evidence=s.get("evidence", ""),
                    confidence=s.get("confidence", "high"),
                    roadmap_topics=[],
                )
                for s in fixture.get("skills", [])
            ]
            result = JDAnalysisResponse(
                success=True,
                metadata=metadata,
                skills=skills,
                analysis_notes="Extracted from verified sample fixture (LLM offline).",
                company=company or fixture.get("company", ""),
                role=role or fixture.get("role", ""),
                role_category=fixture.get("role_category", ""),
                location=fixture.get("location", ""),
                employment_type=fixture.get("employment_type", "Full-time"),
                source_file=source_file,
                experience_requirements=fixture.get("experience_requirements", ""),
            )
            return result

        if isinstance(exc, ExtractionError):
            logger.error("Skill extraction failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=exc.user_message,
            )
        else:
            logger.error("Configuration error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            )
    except Exception as exc:
        logger.exception("Unexpected error during JD analysis")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during analysis. Please try again.",
        )

    # Populate top-level fields for frontend contract compatibility
    result.company = company or result.metadata.company_name or ""
    result.role = role or result.metadata.job_title or ""
    result.source_file = source_file
    result.location = result.metadata.location or ""
    result.employment_type = result.metadata.employment_type or ""
    result.experience_requirements = result.metadata.experience_required or ""

    return result


@router.post(
    "/jd",
    status_code=status.HTTP_201_CREATED,
    summary="Save an analyzed job description",
)
def save_jd_endpoint(payload: Dict[str, Any]):
    """Persist a job description to Supabase / local repository."""
    if not payload.get("company") and not payload.get("role"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description must have a company or role.",
        )
    saved = jd_repository.save(payload)
    return saved


@router.get(
    "/jd",
    summary="List all saved job descriptions",
)
def list_jds_endpoint():
    """Returns all saved job descriptions ordered by most recent."""
    return jd_repository.list_all()


@router.get(
    "/jd/{jd_id}",
    summary="Retrieve a job description by ID",
)
def get_jd_endpoint(jd_id: str):
    """Retrieves a single job description by its stable ID."""
    found = jd_repository.get_by_id(jd_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job description '{jd_id}' not found.",
        )
    return found


@router.patch(
    "/jd/{jd_id}",
    summary="Update an existing job description",
)
def update_jd_endpoint(jd_id: str, updates: Dict[str, Any]):
    """Updates fields on an existing saved job description."""
    existing = jd_repository.get_by_id(jd_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job description '{jd_id}' not found.",
        )
    merged = {**existing, **updates, "jd_id": jd_id}
    return jd_repository.save(merged)
