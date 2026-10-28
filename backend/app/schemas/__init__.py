"""Unified Pydantic schemas package for RADIX Talent Match."""

from app.schemas.contracts import (
    CategoryCode,
    Confidence,
    Skill,
    ResumeReference,
    Profile,
    ProfileUpdate,
    JobDescription,
    TalentCheckRequest,
    SkillMatchRequest,
)

from app.schemas.resume_parsing import (
    ResumeSkill,
    EducationEntry,
    ProjectEntry,
    InternshipEntry,
    HackathonEntry,
    CertificationEntry,
    PersistenceStatus,
    ParsedResumeResponse,
)

from app.schemas.talent_check import (
    TalentCheckStatus,
    UncertaintyLevel,
    SkillEvidenceItem,
    SkillsetGapItem,
    RecommendationItem,
    RequirementsSource,
    ScoringMetadata,
    TalentCheckResult,
    CategoryComparisonItem,
    CandidateBrief,
    TalentCheckComparisonRequest,
    TalentCheckComparisonResult,
    CompanyInfo,
)

from app.schemas.skill_match import (
    SkillMatchItem,
    MissingSkillItem,
    MatchRecommendation,
    SkillMatchResponse,
)

from app.schemas.jd import (
    LLMJobMetadata,
    LLMSkill,
    LLMAnalysisResult,
    RoadmapTopic,
    SkillResult,
    JobMetadataResponse,
    JDAnalysisResponse,
    HealthResponse,
)
