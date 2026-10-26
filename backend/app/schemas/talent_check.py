"""Pydantic schemas for the Talent Check module (Owner: Krishna Khanna).

Follows docs/api-contract.md §7 and supports candidate evaluation and comparison.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.contracts import CategoryCode, Confidence, Skill


TalentCheckStatus = Literal["meets", "close", "gap", "no-evidence", "not-assessed", "not-required"]
UncertaintyLevel = Literal["low", "medium", "high"]


class SkillEvidenceItem(BaseModel):
    skill_name: str
    evidence: str = ""
    confidence: Confidence = "medium"


class SkillsetGapItem(BaseModel):
    category_code: CategoryCode
    required_level: Optional[int] = None
    candidate_level: int
    candidate_level_is_estimate: bool = True
    gap: bool
    gap_size: Optional[int] = None
    status: TalentCheckStatus
    uncertainty: UncertaintyLevel
    evidence: List[SkillEvidenceItem] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    category_code: CategoryCode
    text: str


class RequirementsSource(BaseModel):
    file: Optional[str] = None
    synthetic: bool = False


class ScoringMetadata(BaseModel):
    method: str = "demo-readiness-v1"
    formula: str = "100 × Σ min(estimated, required) / Σ required"
    status: str = "standardized-radix-rubric"


class TalentCheckRequest(BaseModel):
    profile_id: str
    company_id: str


class TalentCheckResult(BaseModel):
    result_id: str
    type: Literal["talent_check"] = "talent_check"
    profile_id: str
    candidate_name: str
    company_id: str
    company: str
    readiness_score: int
    skillset_gap: List[SkillsetGapItem]
    strongest: List[CategoryCode] = Field(default_factory=list)
    priority_gaps: List[CategoryCode] = Field(default_factory=list)
    recommendations: List[RecommendationItem] = Field(default_factory=list)
    summary: str
    requirements_source: RequirementsSource
    scoring: ScoringMetadata = Field(default_factory=ScoringMetadata)
    created_at: str


class CategoryComparisonItem(BaseModel):
    category_code: CategoryCode
    category_name: str
    required_level: Optional[int] = None
    candidate_a_level: int
    candidate_b_level: int
    candidate_a_status: TalentCheckStatus
    candidate_b_status: TalentCheckStatus
    difference: int  # candidate_a_level - candidate_b_level
    leader: Literal["candidate_a", "candidate_b", "tie"]
    explanation: str


class CandidateBrief(BaseModel):
    profile_id: str
    candidate_name: str
    readiness_score: int
    strongest: List[CategoryCode]
    priority_gaps: List[CategoryCode]


class TalentCheckComparisonRequest(BaseModel):
    profile_id_a: str
    profile_id_b: str
    company_id: str


class TalentCheckComparisonResult(BaseModel):
    company_id: str
    company_name: str
    candidate_a: CandidateBrief
    candidate_b: CandidateBrief
    score_difference: int  # candidate_a - candidate_b
    leader: Literal["candidate_a", "candidate_b", "tie"]
    overall_explanation: str
    category_comparisons: List[CategoryComparisonItem]
    created_at: str


class CompanyInfo(BaseModel):
    company_id: str
    company_name: str
    short_name: Optional[str] = None
    category: Optional[str] = None
    skillsets: Dict[str, int]
    missing_categories: List[str] = Field(default_factory=list)
    synthetic: bool = False
