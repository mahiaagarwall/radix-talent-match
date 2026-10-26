"""Module routers. Each stub returns 501 until its owner implements it."""

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.schemas.contracts import Profile, SkillMatchRequest, TalentCheckRequest

router = APIRouter()


def _todo(module: str, owner: str):
    raise HTTPException(status_code=501, detail=f"{module} is not implemented yet (owner: {owner}).")


# JD Analytics — Krishna Pandey (backend/app/api/jd_analytics.py suggested)
@router.post("/jd/analyze")
async def analyze_jd(file: UploadFile = File(...)):
    _todo("JD Analytics", "Krishna Pandey")


# Resume Parsing — Mahi Aggarwal
@router.post("/resumes/parse")
async def parse_resume(file: UploadFile = File(...)):
    _todo("Resume Parsing", "Mahi Aggarwal")


# Profile Builder — Aashish Kumar
@router.post("/profiles")
def create_profile(profile: Profile):
    _todo("Profile Builder", "Aashish Kumar")


@router.get("/profiles")
def list_profiles():
    from app.services.profile_loader import list_candidate_profiles, get_candidate_profile
    summaries = list_candidate_profiles()
    full_profiles = []
    for s in summaries:
        try:
            full_profiles.append(get_candidate_profile(s["profile_id"]))
        except Exception:
            full_profiles.append(s)
    return full_profiles


@router.get("/profiles/{profile_id}")
def get_profile(profile_id: str):
    from app.services.profile_loader import get_candidate_profile
    try:
        return get_candidate_profile(profile_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/profiles/{profile_id}")
def update_profile(profile_id: str, profile: Profile):
    _todo("Profile Builder", "Aashish Kumar")


# Talent Check — Krishna Khanna
from app.api.talent_check import router as talent_check_router

router.include_router(talent_check_router)


# Skill Matching — Akshat Mehra
@router.post("/skill-match")
def skill_match(req: SkillMatchRequest):
    _todo("Skill Matching", "Akshat Mehra")


# Companies & Skillsets from Supabase
@router.get("/companies")
def get_companies():
    from app.db import get_companies_requirements
    return get_companies_requirements()
