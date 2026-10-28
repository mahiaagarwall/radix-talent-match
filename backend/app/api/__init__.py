"""Unified API Router for RADIX Talent Match.

Integrates routers for all 5 modules:
1. JD Analytics (Krishna Pandey)
2. Resume Parsing (Mahi Aggarwal)
3. Profile Builder (Aashish Kumar)
4. Talent Check (Krishna Khanna)
5. Skill Matching (Akshat Mehra)

Zero 501 placeholder handlers. All routes backed by live business logic.
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any

from app.api.profiles import router as profiles_router
from app.api.resume_parsing import router as resume_parsing_router
from app.api.jd import router as jd_router
from app.api.talent_check import router as talent_check_router
from app.api.skill_matching import router as skill_matching_router
from app.services.company_requirements import load_company_skillsets
from app.db.skill_match_repository import repository as skill_match_repo

router = APIRouter()

# Include all module routers
router.include_router(profiles_router)
router.include_router(resume_parsing_router)
router.include_router(jd_router)
router.include_router(talent_check_router)
router.include_router(skill_matching_router)


@router.get(
    "/companies",
    summary="List company skillsets and requirements for Talent Check",
    tags=["Talent Check"],
)
def get_companies_endpoint():
    """Returns normalized company requirements from talent_check_company_skillsets.json."""
    try:
        data = load_company_skillsets()
        return data
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Company skillsets requirements unavailable: {str(exc)}",
        )


@router.get(
    "/results",
    summary="List persisted assessment results",
    tags=["Results"],
)
def list_results_endpoint(limit: int = 50):
    """Returns combined assessment results (skill matches and talent checks)."""
    matches = skill_match_repo.list_match_results(limit=limit)
    return matches


@router.get(
    "/results/{result_id}",
    summary="Get assessment result details by ID",
    tags=["Results"],
)
def get_result_endpoint(result_id: str):
    """Retrieve an assessment result by result_id or match_id."""
    res = skill_match_repo.get_match_result(result_id)
    if res:
        res_copy = dict(res)
        res_copy["result_id"] = res_copy.get("result_id") or res_copy.get("match_id") or result_id
        res_copy["type"] = res_copy.get("type") or "skill_match"
        return res_copy
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Result '{result_id}' was not found.",
    )
