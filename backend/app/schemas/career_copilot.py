"""Career Copilot Pydantic Schemas for RADIX / PARALLAX Talent Match.

Defines request and response models for:
1. Job Finder (deterministic multi-factor job recommendation & ranking)
2. Resume Coach (safe, anti-fabrication resume bullet enhancement)
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
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


# ── Resume Coach: resume vs. one job description (gap analysis) ─────────────

Classification = Literal["matched", "partial", "missing", "unverified"]
Importance = Literal["mandatory", "preferred"]
RequirementKind = Literal[
    "technical_skill", "tool", "education", "experience", "certification",
    "responsibility", "domain", "soft_skill", "other",
]
GapType = Literal["none", "skill_gap", "presentation_gap", "information_gap"]


class LLMGapRequirement(BaseModel):
    """One job requirement as returned by the LLM (validated before use)."""
    requirement: str = Field(..., min_length=1)
    kind: RequirementKind = "other"
    importance: Importance
    jd_evidence: str = ""
    classification: Classification
    resume_evidence: List[str] = Field(default_factory=list)
    resume_section: Optional[str] = None
    missing_information: str = ""
    gap_type: GapType = "none"
    next_step: str = ""


class LLMBulletImprovement(BaseModel):
    original_text: str = Field(..., min_length=1)
    problem: str
    recommendation: str
    improved_example: str
    alignment: str = ""
    follow_up_question: Optional[str] = None


class LLMActionItem(BaseModel):
    priority: Literal[1, 2, 3]
    action: str = Field(..., min_length=1)
    requirement: Optional[str] = None


class LLMGapAnalysis(BaseModel):
    summary: str = ""
    requirements: List[LLMGapRequirement] = Field(..., min_length=1)
    bullet_improvements: List[LLMBulletImprovement] = Field(default_factory=list)
    action_plan: List[LLMActionItem] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)


class GapRequirement(LLMGapRequirement):
    jd_evidence_verified: bool = False
    note: Optional[str] = None


class GapCounts(BaseModel):
    matched: int = 0
    partial: int = 0
    missing: int = 0
    unverified: int = 0
    mandatory: int = 0
    preferred: int = 0


class GapAlignment(BaseModel):
    score: Optional[int] = Field(None, description="0-100 resume-to-job alignment; null when the data cannot support one")
    method: str
    explanation: str


class GapSourceInfo(BaseModel):
    kind: str
    label: Optional[str] = None
    characters: int


class GapSafeguards(BaseModel):
    evidence_quotes_removed: int = 0
    requirements_downgraded: int = 0
    requirements_dropped: int = 0
    suggestions_removed: int = 0
    notes: List[str] = Field(default_factory=list)


class ResumeGapAnalysisResponse(BaseModel):
    resume: GapSourceInfo
    job: GapSourceInfo
    summary: str
    requirements: List[GapRequirement]
    counts: GapCounts
    alignment: GapAlignment
    bullet_improvements: List[LLMBulletImprovement] = Field(default_factory=list)
    action_plan: List[LLMActionItem] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    safeguards: GapSafeguards
    model_used: str
    disclaimer: str
