"""Response model for POST /api/resumes/parse (docs/api-contract.md §3).

FastAPI validates every response against this model, so the endpoint cannot
return a shape that breaks the contract (e.g. a category_code outside the 13 codes).
"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.contracts import CategoryCode, Confidence


class ResumeSkill(BaseModel):
    skill_name: str = Field(min_length=1)
    category_code: CategoryCode
    evidence: str = ""
    confidence: Confidence


class EducationEntry(BaseModel):
    degree: str = ""
    field: str = ""
    institution: str = ""
    graduation_year: str = ""
    grade: str = ""


class ProjectEntry(BaseModel):
    title: str
    description: str = ""


class InternshipEntry(BaseModel):
    role: str
    organization: str = ""
    description: str = ""


class HackathonEntry(BaseModel):
    name: str
    result: str = ""
    description: str = ""


class CertificationEntry(BaseModel):
    name: str
    issuer: str = ""


class PersistenceStatus(BaseModel):
    # saved   → new row in parsed_resumes
    # updated → this exact file was uploaded before; its row was refreshed
    # disabled → SAVE_PARSED_RESUMES is off
    # skipped → not saved because a required field (the name) is missing
    # failed  → the database save failed; the parsed data below is still valid
    status: Literal["saved", "updated", "disabled", "skipped", "failed"]
    message: str


class ParsedResumeResponse(BaseModel):
    source_type: Literal["resume"] = "resume"
    source_file: str
    name: str
    email: Optional[str] = None
    headline: str = ""
    education: List[EducationEntry] = Field(default_factory=list)
    skills: List[ResumeSkill] = Field(default_factory=list)
    projects: List[ProjectEntry] = Field(default_factory=list)
    internships: List[InternshipEntry] = Field(default_factory=list)
    hackathons: List[HackathonEntry] = Field(default_factory=list)
    certifications: List[CertificationEntry] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    preferred_roles: List[str] = Field(default_factory=list)
    # The parsed_resumes.resume_id (UUID) when saved, otherwise null. Use it as
    # profile_id for Talent Check / GET /api/profiles/{id}.
    resume_reference: Optional[str] = None
    parser_mode: Literal["rules", "llm"] = "rules"
    warnings: List[str] = Field(default_factory=list)
    persistence: PersistenceStatus
