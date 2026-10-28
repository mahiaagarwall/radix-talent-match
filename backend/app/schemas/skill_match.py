"""Pydantic schemas for the Skill Matching module.

Follows the agreed shared contract in docs/api-contract.md.
"""

from typing import Literal, Optional
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field, field_validator

CategoryCode = Literal[
    "COD", "DSA", "OOD", "APTI", "COMM", "AI",
    "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"
]
Confidence = Literal["high", "medium", "low"]
MatchStatus = Literal["matched", "partial", "missing"]
RequirementType = Literal["required", "preferred"]
ScoringStatus = Literal["completed", "not_scored"]


class Skill(BaseModel):
    skill_name: str = Field(..., min_length=1)
    category_code: CategoryCode
    evidence: str = ""
    confidence: Confidence
    requirement: Optional[RequirementType] = None


class SkillResultItem(BaseModel):
    skill_name: str
    category_code: CategoryCode
    requirement: RequirementType = "required"
    weight: float = Field(..., ge=0)
    status: MatchStatus
    match_value: float = Field(..., ge=0, le=1)
    jd_evidence: str = ""
    jd_confidence: Optional[Confidence] = None
    candidate_evidence: list[Skill] = []
    reason: str


class MatchCounts(BaseModel):
    matched: int = Field(default=0, ge=0)
    partial: int = Field(default=0, ge=0)
    missing: int = Field(default=0, ge=0)


class Recommendation(BaseModel):
    skill_name: str
    priority: Literal["high", "medium", "low"]
    text: str


# Backward compatibility aliases
SkillMatchItem = SkillResultItem
MissingSkillItem = SkillResultItem
MatchRecommendation = Recommendation


class ScoringWeights(BaseModel):
    required: float = 1.0
    preferred: float = 0.5


class ScoringDetails(BaseModel):
    method: str = "demo-weighted-v1"
    formula: str = "100 × Σ(weight × match_value) / Σ(weight)"
    version: str = "v1"
    partial_value: float = 0.5
    weights: ScoringWeights = Field(default_factory=ScoringWeights)
    status: str = "provisional — pending team agreement"


class SkillMatchRequest(BaseModel):
    profile_id: str = Field(..., min_length=1, description="Stable candidate profile ID")
    jd_id: str = Field(..., min_length=1, description="Stable job description ID")
    # Optional override payloads for standalone API testing / direct inputs
    profile_data: Optional[dict] = None
    jd_data: Optional[dict] = None


class SkillMatchResponse(BaseModel):
    # Supabase match_id (UUID string if persisted)
    match_id: Optional[str] = None
    # result_id alias for frontend backwards compatibility
    result_id: Optional[str] = None
    type: Literal["skill_match"] = "skill_match"
    profile_id: str
    candidate_name: str
    jd_id: str
    jd_source_file: Optional[str] = None
    company: str
    role: str
    match_score: Optional[float] = Field(None, ge=0, le=100)
    scoring_status: ScoringStatus = "completed"
    scoring_version: str = "v1"
    matched_skills: list[str] = []
    partial_skills: list[str] = []
    missing_skills: list[str] = []
    skill_results: list[SkillResultItem] = []
    counts: MatchCounts
    summary: str
    recommendations: list[Recommendation] = []
    scoring: ScoringDetails
    persisted: bool = False
    persistence_error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
