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


@router.get("/profiles/{profile_id}")
def get_profile(profile_id: str):
    _todo("Profile Builder", "Aashish Kumar")


@router.patch("/profiles/{profile_id}")
def update_profile(profile_id: str, profile: Profile):
    _todo("Profile Builder", "Aashish Kumar")


# Talent Check — Krishna Khanna
@router.post("/talent-check")
def talent_check(req: TalentCheckRequest):
    _todo("Talent Check", "Krishna Khanna")


# Skill Matching — Akshat Mehra
@router.post("/skill-match")
def skill_match(req: SkillMatchRequest):
    _todo("Skill Matching", "Akshat Mehra")


# Companies & Skillsets from Supabase
@router.get("/companies")
def get_companies():
    from app.db import get_companies_requirements
    return get_companies_requirements()
