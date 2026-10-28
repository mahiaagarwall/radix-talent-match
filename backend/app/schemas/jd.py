"""app/schemas/jd.py — Pydantic models for JD Analyzer API request/response
and structured output.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class LLMJobMetadata(BaseModel):
    """Metadata extracted from the job description."""
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_summary: Optional[str] = None
    employment_type: Optional[str] = None
    location: Optional[str] = None
    experience_required: Optional[str] = None
    responsibilities: List[str] = Field(default_factory=list)
    qualifications: List[str] = Field(default_factory=list)
    prompt_injection_detected: bool = False


class LLMSkill(BaseModel):
    """A single skill extracted from the job description."""
    skill_name: str
    canonical_skill_id: Optional[str] = None
    category_code: str = "OTHER"
    category_name: str = "Other"
    requirement_type: str = "unclear"      # "required" | "preferred" | "unclear"
    importance: str = "medium"             # "high" | "medium" | "low"
    target_proficiency: Optional[int] = None
    is_provisional: bool = False
    evidence: str = ""
    confidence: str = "medium"            # "high" | "medium" | "low"
    matched_topic_ids: List[str] = Field(default_factory=list)

    @field_validator("requirement_type")
    @classmethod
    def validate_requirement_type(cls, v: str) -> str:
        allowed = {"required", "preferred", "unclear"}
        return v if v in allowed else "unclear"

    @field_validator("importance")
    @classmethod
    def validate_importance(cls, v: str) -> str:
        allowed = {"high", "medium", "low"}
        return v if v in allowed else "medium"

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: str) -> str:
        allowed = {"high", "medium", "low"}
        return v if v in allowed else "medium"

    @field_validator("target_proficiency")
    @classmethod
    def validate_proficiency_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 10):
            return None
        return v


class LLMAnalysisResult(BaseModel):
    """Complete structured output from JD analysis."""
    metadata: LLMJobMetadata = Field(default_factory=LLMJobMetadata)
    skills: List[LLMSkill] = Field(default_factory=list)
    analysis_notes: Optional[str] = None


class RoadmapTopic(BaseModel):
    """A learning roadmap topic retrieved from Supabase."""
    topic_id: str
    topic_name: str
    skill_category: Optional[str] = None
    canonical_skill_id: Optional[str] = None
    extra: Optional[dict] = None


class SkillResult(BaseModel):
    """Enriched skill result returned in the API response."""
    skill_name: str
    canonical_skill_id: Optional[str] = None
    category_code: str
    category_name: str
    requirement_type: str
    importance: str
    target_proficiency: Optional[int] = None
    is_provisional: bool = False
    evidence: str
    confidence: str
    roadmap_topics: List[RoadmapTopic] = Field(default_factory=list)
    proficiency_source: str = "unavailable"
    company_required_level: Optional[int] = None
    company_proficiency_name: Optional[str] = None


class JobMetadataResponse(BaseModel):
    """Job metadata in the API response."""
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_summary: Optional[str] = None
    employment_type: Optional[str] = None
    location: Optional[str] = None
    experience_required: Optional[str] = None
    responsibilities: List[str] = Field(default_factory=list)
    qualifications: List[str] = Field(default_factory=list)
    prompt_injection_detected: bool = False


class JDAnalysisResponse(BaseModel):
    """Top-level API response for the /api/jd/analyze endpoint."""
    success: bool = True
    metadata: JobMetadataResponse = Field(default_factory=JobMetadataResponse)
    skills: List[SkillResult] = Field(default_factory=list)
    analysis_notes: Optional[str] = None
    database_enrichment_available: bool = False
    warnings: List[str] = Field(default_factory=list)

    # Top-level convenience properties so the response also matches frontend normalizeJd
    company: Optional[str] = None
    role: Optional[str] = None
    role_category: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    source_type: str = "jd"
    source_file: Optional[str] = None
    experience_requirements: Optional[str] = None
    education_requirements: Optional[str] = None


class HealthResponse(BaseModel):
    """Response for GET /health."""
    status: str = "ok"
    service: str = "jd-analyzer"
    groq_configured: bool = False
    supabase_configured: bool = False
