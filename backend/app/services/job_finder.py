"""Job Finder Service for RADIX / PARALLAX Talent Match.

Provides an explainable, deterministic multi-factor recommendation and ranking engine
matching candidate profiles against verified job descriptions.

Scoring breakdown:
- 50% Required Skills Overlap
- 20% Preferred Skills Overlap
- 15% Category & Role Alignment
- 15% Experience & Project Evidence
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.db.fixtures import CANDIDATE_FIXTURES, JD_FIXTURES, find_candidate_fixture
from app.db.jd_repository import jd_repository
from app.db.profiles import profile_repository
from app.schemas.career_copilot import (
    JobMatchBreakdown,
    JobRecommendation,
    JobRecommendationRequest,
    JobRecommendationResponse,
)

# Canonical synonym mapping for technical skills matching
SKILL_SYNONYMS: Dict[str, Set[str]] = {
    "python": {"python", "py", "python3"},
    "java": {"java", "core java", "j2ee"},
    "c++": {"c++", "cpp", "c/c++"},
    "c": {"c", "c/c++"},
    "data structures & algorithms": {"data structures & algorithms", "dsa", "data structures", "algorithms"},
    "machine learning": {"machine learning", "ml", "deep learning", "ai", "artificial intelligence"},
    "sql": {"sql", "mysql", "postgresql", "postgres", "rdbms", "database"},
    "system design": {"system design", "distributed systems", "scalable systems", "high level design", "low level design"},
    "object-oriented design": {"object-oriented design", "ood", "oop", "object oriented programming"},
    "operating systems": {"operating systems", "os", "linux", "unix", "concurrency"},
    "computer networks": {"computer networks", "networking", "tcp/ip", "http", "socket programming"},
    "cloud infrastructure": {"cloud infrastructure", "cloud", "aws", "azure", "gcp", "docker", "kubernetes"},
    "software engineering practices": {"software engineering practices", "swe", "git", "ci/cd", "unit testing", "agile"},
    "data visualization": {"data visualization", "power bi", "tableau", "matplotlib", "seaborn"},
    "communication": {"communication", "presentation", "stakeholder management", "teamwork"},
    "quantitative aptitude": {"quantitative aptitude", "statistics", "probability", "math", "analytical reasoning"},
    "programming": {"programming", "coding", "software development", "python", "java", "c++", "javascript", "typescript", "c#", "go"},
}


def _normalize(text: str) -> str:
    """Normalize skill string for case-insensitive matching."""
    clean = re.sub(r"[^\w\+\#]", " ", (text or "").lower())
    return " ".join(clean.split())


def _extract_skill_names(skills_data: Any) -> List[str]:
    """Extract clean skill names from varying list schemas."""
    names: List[str] = []
    if not isinstance(skills_data, list):
        return names

    for item in skills_data:
        if isinstance(item, str):
            names.append(item.strip())
        elif isinstance(item, dict):
            name = item.get("skill_name") or item.get("name") or item.get("skill")
            if name and isinstance(name, str):
                names.append(name.strip())
    return names


def _skill_matches(cand_skill: str, target_skill: str) -> bool:
    """Check if candidate skill matches target skill, including synonym mapping."""
    cand_norm = _normalize(cand_skill)
    target_norm = _normalize(target_skill)

    if not cand_norm or not target_norm:
        return False

    if cand_norm == target_norm or target_norm in cand_norm or cand_norm in target_norm:
        return True

    # Check synonym dictionary
    for canonical, syns in SKILL_SYNONYMS.items():
        in_cand = cand_norm in syns or any(s in cand_norm for s in syns)
        in_target = target_norm in syns or any(s in target_norm for s in syns)
        if in_cand and in_target:
            return True

    return False


def _evaluate_skills_overlap(
    candidate_skills: List[str], target_skills: List[str]
) -> Tuple[float, List[str], List[str]]:
    """Return match percentage (0-100), list of matching skills, and list of missing skills."""
    if not target_skills:
        return 100.0, [], []

    matched: List[str] = []
    missing: List[str] = []

    for target in target_skills:
        found = False
        for cand in candidate_skills:
            if _skill_matches(cand, target):
                matched.append(target)
                found = True
                break
        if not found:
            missing.append(target)

    pct = round((len(matched) / len(target_skills)) * 100.0, 1)
    return pct, matched, missing


def _extract_candidate_profile(request: JobRecommendationRequest) -> Dict[str, Any]:
    """Resolve candidate profile from DB repository, sample fixtures, or request payload."""
    if request.candidate_profile:
        return request.candidate_profile

    if request.profile_id:
        # Check DB repository
        profile = profile_repository.get_by_id(request.profile_id)
        if profile:
            return profile.model_dump()

        # Check sample fixtures
        fixture = find_candidate_fixture(request.profile_id)
        if fixture:
            return fixture

        # Search CANDIDATE_FIXTURES values by profile_id
        for fix in CANDIDATE_FIXTURES.values():
            if fix.get("profile_id") == request.profile_id:
                return fix

    # Fallback to first fixture if nothing supplied
    return CANDIDATE_FIXTURES.get("ananya-rao", {
        "name": "Candidate",
        "skills": ["Python", "Data Structures & Algorithms", "SQL"],
    })


def _extract_all_candidate_text(profile: Dict[str, Any]) -> str:
    """Concatenate project, internship, and education texts to detect applied experience."""
    chunks: List[str] = []

    for proj in profile.get("projects", []):
        if isinstance(proj, dict):
            chunks.append(proj.get("title", ""))
            chunks.append(proj.get("description", ""))
            chunks.extend(proj.get("tech_stack", []))
        elif isinstance(proj, str):
            chunks.append(proj)

    for intern in profile.get("internships", []):
        if isinstance(intern, dict):
            chunks.append(intern.get("company", ""))
            chunks.append(intern.get("role", ""))
            chunks.append(intern.get("description", ""))
        elif isinstance(intern, str):
            chunks.append(intern)

    for hack in profile.get("hackathons", []):
        if isinstance(hack, dict):
            chunks.append(hack.get("title", ""))
            chunks.append(hack.get("description", ""))

    for cert in profile.get("certifications", []):
        if isinstance(cert, dict):
            chunks.append(cert.get("name", ""))
            chunks.append(cert.get("issuing_organization", ""))
        elif isinstance(cert, str):
            chunks.append(cert)

    return " ".join(chunks).lower()


def recommend_jobs(request: JobRecommendationRequest) -> JobRecommendationResponse:
    """Evaluate and rank jobs for the specified candidate profile."""
    candidate = _extract_candidate_profile(request)
    candidate_name = candidate.get("name") or "Candidate"

    cand_skills = _extract_skill_names(candidate.get("skills", []))
    preferred_roles = [r.lower() for r in candidate.get("preferred_roles", []) if isinstance(r, str)]
    candidate_exp_text = _extract_all_candidate_text(candidate)

    # Gather all available JDs
    jds_by_id: Dict[str, Dict[str, Any]] = {}

    # Seed with standard fixtures
    for key, fixture in JD_FIXTURES.items():
        jid = fixture.get("jd_id") or key
        jds_by_id[jid] = fixture

    # Merge database repository JDs
    db_jds = jd_repository.list_all()
    for jd in db_jds:
        jid = jd.get("jd_id")
        if jid:
            jds_by_id[jid] = jd

    ranked_recommendations: List[JobRecommendation] = []

    for jd_id, jd in jds_by_id.items():
        role = jd.get("role") or "Software Professional"
        company = jd.get("company") or "Technology Partner"
        role_category = jd.get("role_category") or ""
        location = jd.get("location") or "Remote / Hybrid"
        employment_type = jd.get("employment_type") or "Full-Time"

        # Apply role filter if requested
        if request.role_filter:
            rf = request.role_filter.lower().strip()
            if rf not in role.lower() and rf not in role_category.lower() and rf not in company.lower():
                continue

        # Extract required and preferred skills
        raw_skills = jd.get("skills", [])
        required_skills: List[str] = []
        preferred_skills: List[str] = []

        if isinstance(raw_skills, list):
            for sk in raw_skills:
                if isinstance(sk, dict):
                    name = sk.get("skill_name") or sk.get("name") or sk.get("skill")
                    req = (sk.get("requirement") or sk.get("type") or "required").lower()
                    if name:
                        if "pref" in req or "bonus" in req or "optional" in req:
                            preferred_skills.append(name)
                        else:
                            required_skills.append(name)
                elif isinstance(sk, str):
                    required_skills.append(sk)

        # Fallback if no requirements tagged
        if not required_skills and preferred_skills:
            required_skills = preferred_skills
            preferred_skills = []
        elif not required_skills and not preferred_skills:
            required_skills = ["Programming", "Problem Solving"]

        # 1. Overlap evaluations
        req_pct, req_matched, req_missing = _evaluate_skills_overlap(cand_skills, required_skills)
        pref_pct, pref_matched, pref_missing = _evaluate_skills_overlap(cand_skills, preferred_skills)

        # 2. Category & Role Alignment (0 - 100)
        category_score = 50.0  # baseline
        role_lower = role.lower()
        if any(pref in role_lower for pref in preferred_roles):
            category_score += 35.0
        elif role_category and any(pref in role_category.lower() for pref in preferred_roles):
            category_score += 25.0

        # Check candidate skill overlap with role category
        if "data" in role_lower or "analyst" in role_lower or "scientist" in role_lower:
            if any(s in cand_skills for s in ["SQL", "Python", "Machine Learning", "Data Visualization"]):
                category_score += 15.0
        if "engineer" in role_lower or "swe" in role_lower or "developer" in role_lower:
            if any(s in cand_skills for s in ["C++", "Java", "Python", "Data Structures & Algorithms", "Git"]):
                category_score += 15.0

        category_relevance = min(100.0, round(category_score, 1))

        # 3. Experience & Project Relevance (0 - 100)
        exp_score = 40.0
        # Check if project/internship text contains keywords from JD
        jd_keywords = set([w.lower() for w in re.findall(r"\b[A-Za-z]{3,}\b", role)] + [s.lower() for s in required_skills])
        matches_in_exp = [w for w in jd_keywords if w in candidate_exp_text]
        exp_score += min(50.0, len(matches_in_exp) * 12.0)
        if len(candidate.get("internships", [])) > 0:
            exp_score += 10.0
        experience_relevance = min(100.0, round(exp_score, 1))

        # 4. Multi-factor Weighted Composite Score
        # 50% required skills, 20% preferred skills, 15% category alignment, 15% experience
        overall_score = round(
            (req_pct * 0.50) + (pref_pct * 0.20) + (category_relevance * 0.15) + (experience_relevance * 0.15),
            1,
        )

        if overall_score < request.min_score:
            continue

        # Match Tier classification
        if overall_score >= 75.0:
            match_tier = "Strong Match"
        elif overall_score >= 55.0:
            match_tier = "Good Match"
        elif overall_score >= 35.0:
            match_tier = "Moderate Match"
        else:
            match_tier = "Growth Opportunity"

        # Explainable rationale
        all_matched = req_matched + pref_matched
        if req_pct >= 80.0:
            rationale = (
                f"High technical alignment ({len(req_matched)}/{len(required_skills)} required skills matched). "
                f"Candidate exhibits strong foundational proficiency for {role} at {company}."
            )
        elif req_pct >= 50.0:
            rationale = (
                f"Solid core foundation with {len(req_matched)} matched required competencies. "
                f"Bridging {len(req_missing)} skill gaps will significantly increase candidate competitiveness."
            )
        else:
            rationale = (
                f"Emerging compatibility ({int(req_pct)}% required skills verified). "
                f"Key requirements such as {', '.join(req_missing[:2])} remain unverified in the current profile."
            )

        limitations = [
            "Score calculated from candidate profile evidence and parsed credentials.",
            "Requires live interview validation of architectural depth and practical delivery.",
        ]
        if req_missing:
            limitations.append(f"Gaps identified in required skills: {', '.join(req_missing[:3])}.")

        ranked_recommendations.append(
            JobRecommendation(
                jd_id=jd_id,
                company=company,
                role=role,
                role_category=role_category,
                location=location,
                employment_type=employment_type,
                overall_score=overall_score,
                match_tier=match_tier,
                breakdown=JobMatchBreakdown(
                    required_skills_match=req_pct,
                    preferred_skills_match=pref_pct,
                    category_relevance=category_relevance,
                    experience_relevance=experience_relevance,
                ),
                matching_skills=all_matched,
                missing_required_skills=req_missing,
                missing_preferred_skills=pref_missing,
                rationale=rationale,
                limitations=limitations,
            )
        )

    # Sort descending by overall score
    ranked_recommendations.sort(key=lambda x: x.overall_score, reverse=True)
    final_matches = ranked_recommendations[: request.limit]

    summary = (
        f"Evaluated {len(jds_by_id)} job roles for {candidate_name}. "
        f"Found {len(final_matches)} recommendations (highest match: "
        f"{final_matches[0].overall_score}% at {final_matches[0].company} for {final_matches[0].role})."
        if final_matches
        else f"Evaluated {len(jds_by_id)} job roles for {candidate_name}. No roles met the minimum score threshold."
    )

    return JobRecommendationResponse(
        candidate_name=candidate_name,
        total_jobs_evaluated=len(jds_by_id),
        matches=final_matches,
        evaluation_summary=summary,
    )
