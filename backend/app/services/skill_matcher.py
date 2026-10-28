"""Deterministic evidence-aware skill matching engine for RADIX Talent Match.

Pure business logic module: independent of FastAPI routes and database layers.
Implements the 4-tier classification and weighted scoring formula.
"""

from typing import Optional, Any
from app.schemas.skill_match import (
    SkillResultItem,
    MatchCounts,
    Recommendation,
    ScoringDetails,
    ScoringWeights,
    SkillMatchResponse,
    Skill,
)
from app.services.skill_normalizer import (
    canonical_skill_name,
    has_depth_qualifier,
    is_generic_competency,
    dedupe_skills,
    get_category_name,
    GENERIC_COMPETENCIES,
    VALID_CATEGORIES,
)

SUPPORTED_CONFIDENCE = {"high", "medium"}


def _evidence_of(skill: dict) -> Skill:
    """Helper to convert dict or model to Skill schema."""
    cat = skill.get("category_code") or "OTHER"
    if cat not in VALID_CATEGORIES:
        cat = "OTHER"
    conf = skill.get("confidence") or "low"
    if conf not in ("high", "medium", "low"):
        conf = "low"
    return Skill(
        skill_name=skill.get("skill_name", ""),
        category_code=cat,
        evidence=skill.get("evidence", ""),
        confidence=conf,
        requirement=skill.get("requirement"),
    )


def classify_skill(jd_skill: dict, candidate_skills: list[dict]) -> tuple[str, list[Skill], str]:
    """
    Classify a JD requirement against candidate skills using the 4-tier rule hierarchy.
    Returns: (status, candidate_evidence_items, reason)
    """
    jd_name = jd_skill.get("skill_name", "")
    jd_cat = jd_skill.get("category_code", "OTHER")
    canonical = canonical_skill_name(jd_name)
    jd_is_basic = has_depth_qualifier(jd_name)

    # Rule 1 — Named skill present (after canonical alias normalization)
    named = [s for s in candidate_skills if canonical_skill_name(s.get("skill_name")) == canonical]
    if named:
        strong = [s for s in named if s.get("confidence") in SUPPORTED_CONFIDENCE]
        full_depth = [s for s in strong if jd_is_basic or not has_depth_qualifier(s.get("skill_name"))]
        if full_depth:
            return (
                "matched",
                [_evidence_of(s) for s in full_depth],
                f'Candidate lists "{full_depth[0].get("skill_name")}" with {full_depth[0].get("confidence")}-confidence evidence.',
            )
        if strong:
            return (
                "partial",
                [_evidence_of(s) for s in strong],
                f'Candidate\'s profile qualifies "{strong[0].get("skill_name")}" as basic-level, while the JD does not specify basic-level only.',
            )
        return (
            "partial",
            [_evidence_of(s) for s in named],
            f'"{named[0].get("skill_name")}" appears only with low-confidence evidence, so it is treated as uncertain.',
        )

    # Rule 2 — Broad competency satisfied by any skill in its RADIX category
    generic_category = GENERIC_COMPETENCIES.get(canonical)
    if generic_category:
        in_category = [s for s in candidate_skills if s.get("category_code") == generic_category]
        strong = [s for s in in_category if s.get("confidence") in SUPPORTED_CONFIDENCE]
        if strong:
            names = ", ".join(s.get("skill_name", "") for s in strong)
            return (
                "matched",
                [_evidence_of(s) for s in strong],
                f"Broad competency satisfied by {get_category_name(generic_category)} evidence: {names}.",
            )
        if in_category:
            return (
                "partial",
                [_evidence_of(s) for s in in_category],
                f"Only low-confidence {get_category_name(generic_category)} evidence was found.",
            )

    # Rule 3 — Related evidence in the same RADIX category (OTHER is too broad to count)
    if jd_cat != "OTHER":
        related = [s for s in candidate_skills if s.get("category_code") == jd_cat]
        if related:
            names = ", ".join(s.get("skill_name", "") for s in related)
            return (
                "partial",
                [_evidence_of(s) for s in related],
                f'No direct evidence of "{jd_name}", but related {get_category_name(jd_cat)} skills were found: {names}.',
            )

    # Rule 4 — Missing
    cat_msg = (
        f'No evidence of "{jd_name}" in the profile.'
        if jd_cat == "OTHER"
        else f'No evidence of "{jd_name}" or related {get_category_name(jd_cat)} skills in the profile.'
    )
    return (
        "missing",
        [],
        cat_msg,
    )


def match_value_for(status: str, partial_value: float = 0.5) -> float:
    if status == "matched":
        return 1.0
    if status == "partial":
        return partial_value
    return 0.0


def weight_for(requirement: str, weights: ScoringWeights) -> float:
    return weights.preferred if requirement == "preferred" else weights.required


def build_recommendations(skill_results: list[SkillResultItem]) -> list[Recommendation]:
    """Generate prioritized actionable recommendations based on actual skill gaps."""
    recs: list[Recommendation] = []
    missing = [r for r in skill_results if r.status == "missing"]
    missing.sort(key=lambda r: r.weight, reverse=True)
    partial = [r for r in skill_results if r.status == "partial"]
    partial.sort(key=lambda r: r.weight, reverse=True)

    for r in missing[:4]:
        prio = "medium" if r.requirement == "preferred" else "high"
        recs.append(
            Recommendation(
                skill_name=r.skill_name,
                priority=prio,
                text=f'Build demonstrable evidence of {r.skill_name} ({get_category_name(r.category_code)}). The JD asks for: "{r.jd_evidence}".',
            )
        )

    for r in partial[:3]:
        recs.append(
            Recommendation(
                skill_name=r.skill_name,
                priority="medium",
                text=f"Strengthen {r.skill_name}: {r.reason} Add a project, internship outcome, or certification demonstrating it directly.",
            )
        )

    return recs


def build_summary(
    match_score: Optional[float],
    counts: MatchCounts,
    skill_results: list[SkillResultItem],
    scoring_status: str,
) -> str:
    """Build clear human-readable narrative summary."""
    if scoring_status == "not_scored" or match_score is None:
        return "Not scored: the job description contains no valid requirements to compare against."

    total = len(skill_results)
    top_missing = [
        r.skill_name for r in skill_results if r.status == "missing" and r.requirement != "preferred"
    ][:3]

    matched_verb = "is" if counts.matched == 1 else "are"
    partial_phrase = f"{counts.partial} {'is' if counts.partial == 1 else 'are'} partial"
    missing_phrase = f"{counts.missing} {'is' if counts.missing == 1 else 'are'} missing"

    text = (
        f"{match_score}/100: {counts.matched} of {total} JD skills {matched_verb} supported by profile evidence, "
        f"{partial_phrase} and {missing_phrase}."
    )
    if top_missing:
        text += f" Largest gaps: {', '.join(top_missing)}."
    elif counts.missing == 0 and counts.partial == 0:
        text += " Every listed requirement has supporting evidence."

    return text


def match_skills(
    profile_data: dict[str, Any],
    jd_data: dict[str, Any],
    scoring_weights: Optional[ScoringWeights] = None,
    partial_value: float = 0.5,
) -> SkillMatchResponse:
    """
    Deterministic skill matching comparing candidate profile and analyzed JD.
    Handles duplicate skills, validates weights, and avoids division by zero.
    """
    weights = scoring_weights or ScoringWeights()

    profile_id = str(profile_data.get("profile_id") or "")
    candidate_name = str(profile_data.get("name") or "Unnamed Candidate")
    jd_id = str(jd_data.get("jd_id") or "")
    company = str(jd_data.get("company") or "Unknown Company")
    role = str(jd_data.get("role") or "Unknown Role")
    jd_source_file = jd_data.get("source_file")

    raw_candidate_skills = profile_data.get("skills") or []
    raw_jd_skills = jd_data.get("skills") or []

    # Deduplicate candidate skills and JD requirements to avoid double counting
    candidate_skills = dedupe_skills(raw_candidate_skills)
    jd_skills = dedupe_skills(raw_jd_skills)

    scoring_details = ScoringDetails(
        method="demo-weighted-v1",
        formula="100 × Σ(weight × match_value) / Σ(weight)",
        version="v1",
        partial_value=partial_value,
        weights=weights,
        status="provisional — pending team agreement",
    )

    # Handle empty JD requirements or zero weight
    if not jd_skills:
        empty_counts = MatchCounts(matched=0, partial=0, missing=0)
        return SkillMatchResponse(
            profile_id=profile_id,
            candidate_name=candidate_name,
            jd_id=jd_id,
            jd_source_file=jd_source_file,
            company=company,
            role=role,
            match_score=None,
            scoring_status="not_scored",
            scoring_version="v1",
            matched_skills=[],
            partial_skills=[],
            missing_skills=[],
            skill_results=[],
            counts=empty_counts,
            summary="Not scored: the job description contains no extracted skills to match against.",
            recommendations=[],
            scoring=scoring_details,
            persisted=False,
        )

    skill_results: list[SkillResultItem] = []
    total_weight = 0.0
    earned_weight = 0.0

    for jd_s in jd_skills:
        req = "preferred" if jd_s.get("requirement") == "preferred" else "required"
        weight = weight_for(req, weights)
        status, evidence_list, reason = classify_skill(jd_s, candidate_skills)
        m_val = match_value_for(status, partial_value)

        total_weight += weight
        earned_weight += weight * m_val

        cat = jd_s.get("category_code") or "OTHER"
        if cat not in VALID_CATEGORIES:
            cat = "OTHER"

        skill_results.append(
            SkillResultItem(
                skill_name=jd_s.get("skill_name", ""),
                category_code=cat,
                requirement=req,
                weight=weight,
                status=status,
                match_value=m_val,
                jd_evidence=jd_s.get("evidence", ""),
                jd_confidence=jd_s.get("confidence"),
                candidate_evidence=evidence_list,
                reason=reason,
            )
        )

    matched_names = [r.skill_name for r in skill_results if r.status == "matched"]
    partial_names = [r.skill_name for r in skill_results if r.status == "partial"]
    missing_names = [r.skill_name for r in skill_results if r.status == "missing"]

    counts = MatchCounts(
        matched=len(matched_names),
        partial=len(partial_names),
        missing=len(missing_names),
    )

    if total_weight > 0:
        raw_score = (100.0 * earned_weight) / total_weight
        match_score = round(raw_score, 2)
        scoring_status = "completed"
    else:
        match_score = None
        scoring_status = "not_scored"

    recommendations = build_recommendations(skill_results)
    summary = build_summary(match_score, counts, skill_results, scoring_status)

    return SkillMatchResponse(
        profile_id=profile_id,
        candidate_name=candidate_name,
        jd_id=jd_id,
        jd_source_file=jd_source_file,
        company=company,
        role=role,
        match_score=match_score,
        scoring_status=scoring_status,
        scoring_version="v1",
        matched_skills=matched_names,
        partial_skills=partial_names,
        missing_skills=missing_names,
        skill_results=skill_results,
        counts=counts,
        summary=summary,
        recommendations=recommendations,
        scoring=scoring_details,
        persisted=False,
    )
