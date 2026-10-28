"""FastAPI router for the Skill Matching module.

Module Owner: Akshat Mehra (Skill Matching & Scrum Master)
Endpoint: POST /api/skill-match
"""

import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.skill_match import (
    SkillMatchRequest,
    SkillMatchResponse,
)
from app.services.skill_matcher import match_skills
from app.db.skill_match_repository import repository

router = APIRouter(tags=["Skill Matching"])


@router.post(
    "/skill-match",
    response_model=SkillMatchResponse,
    summary="Compare a saved candidate profile with an analyzed job description",
    description="Matches profile skills against JD requirements deterministically, computes a weighted match score, generates gap recommendations, and persists the result to Supabase when configured.",
)
def run_skill_match_endpoint(req: SkillMatchRequest) -> SkillMatchResponse:
    # 1. Resolve candidate profile
    profile = req.profile_data
    if not profile:
        profile = repository.get_profile(req.profile_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate profile '{req.profile_id}' was not found. Please verify the ID or save a profile first.",
            )

    # 2. Resolve job description
    jd = req.jd_data
    if not jd:
        jd = repository.get_jd(req.jd_id)
        if not jd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job description '{req.jd_id}' was not found. Please verify the ID or analyze a JD first.",
            )

    # 3. Execute deterministic matching logic
    try:
        response = match_skills(profile_data=profile, jd_data=jd)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process skill matching: {str(exc)}",
        )

    # 4. Attempt persistence to Supabase
    persisted, match_id, error = repository.save_match_result(response)
    response.persisted = persisted
    if persisted and match_id:
        response.match_id = match_id
        response.result_id = match_id
        repository.record_memory_alias(match_id, response)
    else:
        response.match_id = None
        # Generate an ephemeral identifier for UI tracking without falsifying persistence
        ephemeral_id = f"sm_ephemeral_{uuid.uuid4().hex[:10]}"
        response.result_id = ephemeral_id
        response.persistence_error = error
        repository.record_memory_alias(ephemeral_id, response)

    return response


@router.get(
    "/skill-match/{match_id}",
    summary="Get saved skill match result by ID",
)
def get_skill_match_by_id(match_id: str):
    record = repository.get_match_result(match_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Match result '{match_id}' not found in Supabase.",
        )
    return record


@router.get(
    "/skill-match",
    summary="List recent saved skill match results",
)
def list_skill_matches(limit: int = Query(default=20, ge=1, le=100)):
    return repository.list_match_results(limit=limit)
