"""Pydantic mirrors of docs/api-contract.md (draft — lock in with the team)."""

import re
from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator

CategoryCode = Literal["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"]
Confidence = Literal["high", "medium", "low"]

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class Skill(BaseModel):
    skill_name: str
    category_code: CategoryCode
    evidence: str = ""
    confidence: Confidence
    requirement: Optional[Literal["required", "preferred"]] = None  # proposed, JD skills only

    @field_validator("skill_name")
    @classmethod
    def validate_skill_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Skill name cannot be empty.")
        return s


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
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Candidate name cannot be empty.")
        return s

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                return None
            if not EMAIL_REGEX.match(s):
                raise ValueError("Enter a valid email address.")
            return s
        return None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    education: Optional[list[dict]] = None
    skills: Optional[list[Skill]] = None
    projects: Optional[list[dict]] = None
    internships: Optional[list[dict]] = None
    hackathons: Optional[list[dict]] = None
    certifications: Optional[list[dict]] = None
    preferred_roles: Optional[list[str]] = None
    resume_reference: Optional[ResumeReference] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Candidate name cannot be empty.")
            return s
        return None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                return None
            if not EMAIL_REGEX.match(s):
                raise ValueError("Enter a valid email address.")
            return s
        return None


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
