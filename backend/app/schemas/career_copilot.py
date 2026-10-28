"""Career Copilot Pydantic Schemas for RADIX / PARALLAX Talent Match.

Defines request and response models for:
1. Job Finder (deterministic multi-factor job recommendation & ranking)
2. Resume Coach (safe, anti-fabrication resume bullet enhancement)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class JobMatchBreakdown(BaseModel):
    required_skills_match: float = Field(0.0, description="Percentage of required skills matched (0-100)")
    preferred_skills_match: float = Field(0.0, description="Percentage of preferred skills matched (0-100)")
    category_relevance: float = Field(0.0, description="Alignment between candidate background and job category (0-100)")
    experience_relevance: float = Field(0.0, description="Alignment of experience and project evidence (0-100)")


class JobRecommendation(BaseModel):
    jd_id: str
    company: str
    role: str
    role_category: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    overall_score: float = Field(..., description="Weighted composite match score (0-100)")
    match_tier: str = Field(..., description="E.g. Strong Match, Good Match, Moderate Match, Potential Fit")
    breakdown: JobMatchBreakdown
    matching_skills: List[str] = Field(default_factory=list)
    missing_required_skills: List[str] = Field(default_factory=list)
    missing_preferred_skills: List[str] = Field(default_factory=list)
    rationale: str
    limitations: List[str] = Field(default_factory=list)


class JobRecommendationRequest(BaseModel):
    profile_id: Optional[str] = None
    candidate_profile: Optional[Dict[str, Any]] = None
    role_filter: Optional[str] = None
    min_score: float = 0.0
    limit: int = 15


class JobRecommendationResponse(BaseModel):
    candidate_name: str
    total_jobs_evaluated: int
    matches: List[JobRecommendation]
    evaluation_summary: str


class ResumeCoachRequest(BaseModel):
    bullet: str = Field(..., min_length=3, description="Raw resume bullet point to critique and refine")
    role_context: Optional[str] = Field(None, description="Current or target job title context")
    target_jd_id: Optional[str] = Field(None, description="Optional JD ID to align skills with")
    target_jd_text: Optional[str] = Field(None, description="Optional raw JD or skills context")


class ResumeCoachResponse(BaseModel):
    original_bullet: str
    improved_bullet: str
    strengths_identified: List[str] = Field(default_factory=list)
    improvements_made: List[str] = Field(default_factory=list)
    unsupported_claims_avoided: List[str] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    rule_based_fallback: bool = False
    model_used: Optional[str] = None
