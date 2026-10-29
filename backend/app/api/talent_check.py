"""Talent Check API endpoints (Owner: Krishna Khanna).

Endpoints:
- POST /api/talent-check: Evaluates a candidate profile against one company across all 12 RADIX categories.
- POST /api/talent-check/compare: Compares two candidate profiles against the same company and explains
  score differences and gaps across all 12 categories (acceptance test requirement).
- GET /api/talent-check/companies: Lists available companies and requirements from talent_check_company_skillsets.json.
- GET /api/talent-check/companies/{company_id}: Retrieves details for a specific company.
- GET /api/talent-check/candidates: Lists available candidates across Supabase and local fixtures.
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any

from app.schemas.talent_check import (
    TalentCheckRequest,
    TalentCheckResult,
    TalentCheckComparisonRequest,
    TalentCheckComparisonResult,
    CompanyInfo,
)
from app.services.company_requirements import (
    load_company_skillsets,
    get_company_by_id_or_name,
)
from app.services.readiness_scorer import (
    calculate_readiness,
    compare_candidates_readiness,
)
from app.services.profile_loader import (
    get_candidate_profile,
    list_candidate_profiles,
)
from app.db.talent_check_repository import repository as talent_check_repo

router = APIRouter(tags=["Talent Check"])


@router.post(
    "/talent-check",
    response_model=TalentCheckResult,
    summary="Run Talent Check for a candidate against a company",
)
def run_talent_check_endpoint(req: TalentCheckRequest) -> TalentCheckResult:
    """Evaluates how a candidate compares with one company's expected levels

    across all 12 RADIX skillsets.
    """
    try:
        profile = get_candidate_profile(req.profile_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate profile not found: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load candidate profile: {str(e)}",
        )

    try:
        company = get_company_by_id_or_name(req.company_id)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company not found: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load company requirements: {str(e)}",
        )

    result = TalentCheckResult(**calculate_readiness(profile, company))
    # Keep the run so the Dashboard and Results page can list it via /api/results.
    talent_check_repo.save(result.model_dump())
    return result


@router.post(
    "/talent-check/compare",
    response_model=TalentCheckComparisonResult,
    summary="Compare two candidate profiles against the same company",
)
def compare_talent_check_endpoint(req: TalentCheckComparisonRequest) -> TalentCheckComparisonResult:
    """Compares two candidates side-by-side against one company across all 12 RADIX skillsets,

    explaining score differences and category gaps (acceptance test requirement).
    """
    try:
        profile_a = get_candidate_profile(req.profile_id_a)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate A not found: {str(e)}",
        )

    try:
        profile_b = get_candidate_profile(req.profile_id_b)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate B not found: {str(e)}",
        )

    try:
        company = get_company_by_id_or_name(req.company_id)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company not found: {str(e)}",
        )

    comparison = compare_candidates_readiness(profile_a, profile_b, company)
    return TalentCheckComparisonResult(**comparison)


@router.get(
    "/talent-check/companies",
    response_model=List[CompanyInfo],
    summary="List all companies with requirements from talent_check_company_skillsets.json",
)
def list_companies_endpoint() -> List[CompanyInfo]:
    """Returns all companies loaded from data/talent_check_company_skillsets.json."""
    try:
        data = load_company_skillsets()
        out = []
        for c in data["companies"]:
            out.append(CompanyInfo(
                company_id=c["company_id"],
                company_name=c["company_name"],
                short_name=c.get("short_name"),
                category=c.get("category"),
                skillsets=c.get("requirements", {}),
                missing_categories=c.get("missing_categories", []),
                synthetic=c.get("synthetic", False),
            ))
        return out
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/talent-check/companies/{company_id}",
    response_model=CompanyInfo,
    summary="Get single company requirements",
)
def get_company_endpoint(company_id: str) -> CompanyInfo:
    """Returns the requirements for a single company."""
    try:
        c = get_company_by_id_or_name(company_id)
        return CompanyInfo(
            company_id=c["company_id"],
            company_name=c["company_name"],
            short_name=c.get("short_name"),
            category=c.get("category"),
            skillsets=c.get("requirements", {}),
            missing_categories=c.get("missing_categories", []),
            synthetic=c.get("synthetic", False),
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/talent-check/candidates",
    summary="List available candidates across Supabase and fixtures",
)
def list_candidates_endpoint() -> List[Dict[str, Any]]:
    """Returns candidates available for assessment."""
    return list_candidate_profiles()
