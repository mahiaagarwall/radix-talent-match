"""Parsed-resume response model — docs/api-contract.md §3.

Reuses the shared `Skill` model so every module validates skills the same way.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.contracts import Skill


class EducationEntry(BaseModel):
    degree: str = ""
    field: str = ""
    institution: str = ""
    graduation_year: str = ""
    grade: str = ""


class ProjectEntry(BaseModel):
    title: str = ""
    description: str = ""


class InternshipEntry(BaseModel):
    role: str = ""
    organization: str = ""
    description: str = ""


class HackathonEntry(BaseModel):
    name: str = ""
    result: str = ""
    description: str = ""


class CertificationEntry(BaseModel):
    name: str
    issuer: str = ""


class ParsedResume(BaseModel):
    source_type: Literal["resume"] = "resume"
    source_file: Optional[str] = None
    name: str = Field(min_length=1)
    email: Optional[str] = None
    headline: str = ""
    education: list[EducationEntry] = []
    skills: list[Skill] = []
    projects: list[ProjectEntry] = []
    internships: list[InternshipEntry] = []
    hackathons: list[HackathonEntry] = []
    certifications: list[CertificationEntry] = []
    achievements: list[str] = []
    preferred_roles: list[str] = []
    # Database id of the stored parse (null when persistence is off). See api-contract §3.
    resume_reference: Optional[str] = None
