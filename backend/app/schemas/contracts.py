"""Pydantic mirrors of docs/api-contract.md (draft — lock in with the team)."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

CategoryCode = Literal["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"]
Confidence = Literal["high", "medium", "low"]


class Skill(BaseModel):
    skill_name: str
    category_code: CategoryCode
    evidence: str = ""
    confidence: Confidence
    requirement: Optional[Literal["required", "preferred"]] = None  # proposed, JD skills only


class ResumeReference(BaseModel):
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    storage_path: Optional[str] = None
    source: Optional[str] = None


class Profile(BaseModel):
    profile_id: Optional[str] = None
    name: str = Field(min_length=1)
    email: Optional[str] = None
    education: list[dict] = []
    skills: list[Skill] = []
    projects: list[dict] = []
    internships: list[dict] = []
    hackathons: list[dict] = []
    certifications: list[dict] = []
    preferred_roles: list[str] = []
    resume_reference: Optional[ResumeReference] = None


class JobDescription(BaseModel):
    jd_id: Optional[str] = None
    source_type: Literal["jd"] = "jd"
    source_file: Optional[str] = None
    company: str
    role: str
    role_category: Optional[str] = None
    location: Optional[str] = None
    experience_requirements: Optional[str] = None
    education_requirements: Optional[str] = None
    skills: list[Skill]


class TalentCheckRequest(BaseModel):
    profile_id: str
    company_id: str


class SkillMatchRequest(BaseModel):
    profile_id: str
    jd_id: str
