"""Readiness Scorer Engine for Talent Check (Owner: Krishna Khanna).

Implements the standardized RADIX rubric agreed in docs/scoring-rules.md:
- Candidate levels are estimates (0-9 scale) inferred from resume/profile evidence.
- Company required levels come strictly from data/talent_check_company_skillsets.json.
- Extraction confidence feeds uncertainty; depth-qualified skills are capped.
- Readiness = round( 100 * sum(min(estimated, required)) / sum(required) ).
- Supports 12-category comparison with explainable gap analysis for acceptance testing.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union

from app.services.company_requirements import (
    SCORED_RADIX_CATEGORIES,
    RADIX_CATEGORY_NAMES,
)

READINESS_METHOD = "demo-readiness-v1"
READINESS_FORMULA = "100 × Σ min(estimated, required) / Σ required"

ITEM_POINTS = {
    "high": 6,
    "medium": 5,
    "low": 3,
}
BASIC_CAP = 4
MAX_ESTIMATE = 9  # A resume alone never yields the top 10/10 of the scale

DEPTH_QUALIFIER_REGEX = re.compile(
    r"\b(basic|basics|fundamentals?|foundational|exposure|beginner|introductory|intro)\b",
    re.IGNORECASE,
)

RECOMMENDATION_HINTS: Dict[str, str] = {
    "COD": "ship a small, well-tested project in your strongest language and link the repository",
    "DSA": "build a visible problem-solving record (e.g. a competitive programming profile) and note complexity analysis in projects",
    "OOD": "design and document a project around clear classes, interfaces and design patterns",
    "APTI": "practise timed quantitative and logical-reasoning sets; resumes rarely evidence this, so assessment scores help",
    "COMM": "add evidence such as presentations, technical writing, mentoring or client-facing work",
    "AI": "complete an applied ML project with a stated evaluation metric (precision/recall, RMSE)",
    "CLOUD": "deploy a project to a cloud provider and describe the services used",
    "SQL": "add a project with non-trivial SQL: joins, aggregation, indexing or schema design",
    "SWE": "show engineering practice: tests, code review, CI pipelines, version control on team projects",
    "SYSD": "write up the architecture of a scalable service you built, including trade-offs",
    "NETW": "add coursework or a project touching TCP/IP, HTTP or client-server design",
    "OS": "build or document work involving processes, threads, scheduling or memory management",
}


def has_depth_qualifier(skill_name: str) -> bool:
    """Detects whether a skill name has a beginner/basic qualifier."""
    return bool(DEPTH_QUALIFIER_REGEX.search(skill_name or ""))


def _extract_skills_from_profile(profile: Any) -> List[Dict[str, Any]]:
    """Normalizes profile skills from dict or Pydantic object."""
    raw_skills = []
    if isinstance(profile, dict):
        raw_skills = profile.get("skills") or []
    elif hasattr(profile, "skills"):
        raw_skills = getattr(profile, "skills") or []

    normalized = []
    for s in raw_skills:
        if isinstance(s, dict):
            normalized.append({
                "skill_name": str(s.get("skill_name") or ""),
                "category_code": str(s.get("category_code") or "").upper(),
                "evidence": str(s.get("evidence") or ""),
                "confidence": str(s.get("confidence") or "medium").lower(),
            })
        elif hasattr(s, "skill_name"):
            normalized.append({
                "skill_name": str(getattr(s, "skill_name") or ""),
                "category_code": str(getattr(s, "category_code") or "").upper(),
                "evidence": str(getattr(s, "evidence") or ""),
                "confidence": str(getattr(s, "confidence") or "medium").lower(),
            })
    return normalized


def estimate_category_level(skills: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Estimates the candidate level (0-9) and uncertainty for a single category."""
    if not skills:
        return {"level": 0, "uncertainty": "high"}

    points = []
    for s in skills:
        conf = s.get("confidence", "low").lower()
        p = ITEM_POINTS.get(conf, ITEM_POINTS["low"])
        if has_depth_qualifier(s.get("skill_name", "")):
            p = min(p, BASIC_CAP)
        points.append(p)

    points.sort(reverse=True)
    best_item = points[0]
    corroborating = sum(1 for p in points[1:] if p >= 5)
    level = min(MAX_ESTIMATE, best_item + min(3, corroborating))

    confidences = [s.get("confidence", "low").lower() for s in skills]
    if "high" in confidences and len(skills) >= 2:
        uncertainty = "low"
    elif "high" in confidences or "medium" in confidences:
        uncertainty = "medium"
    else:
        uncertainty = "high"

    return {"level": level, "uncertainty": uncertainty}


def calculate_candidate_levels(profile: Union[Dict[str, Any], Any]) -> Dict[str, Dict[str, Any]]:
    """Calculates estimated levels across all 12 RADIX categories for a candidate profile."""
    all_skills = _extract_skills_from_profile(profile)
    by_category: Dict[str, List[Dict[str, Any]]] = {code: [] for code in SCORED_RADIX_CATEGORIES}

    for s in all_skills:
        code = s["category_code"]
        if code in by_category:
            by_category[code].append(s)

    results: Dict[str, Dict[str, Any]] = {}
    for code in SCORED_RADIX_CATEGORIES:
        skills = by_category[code]
        est = estimate_category_level(skills)
        results[code] = {
            "level": est["level"],
            "uncertainty": est["uncertainty"],
            "evidence": skills,
        }
    return results


def status_for(required: Optional[int], estimated: int) -> str:
    """Computes status according to standard thresholds."""
    if required is None:
        return "not-assessed"
    if required == 0:
        return "not-required"
    if estimated == 0:
        return "no-evidence"
    gap = required - estimated
    if gap <= 0:
        return "meets"
    if gap <= 2:
        return "close"
    return "gap"


def calculate_readiness(
    profile: Union[Dict[str, Any], Any],
    company: Dict[str, Any],
    requirements_source: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Calculates readiness score, 12-skillset gap analysis, strongest areas,

    priority gaps, and actionable recommendations.
    """
    if not profile:
        raise ValueError("Candidate profile must be provided.")
    if not company:
        raise ValueError("Company requirements must be provided.")

    levels_by_cat = calculate_candidate_levels(profile)
    company_requirements = company.get("requirements") or company.get("skillsets") or {}

    skillset_gap: List[Dict[str, Any]] = []
    for code in SCORED_RADIX_CATEGORIES:
        cat_data = levels_by_cat[code]
        level = cat_data["level"]
        uncertainty = cat_data["uncertainty"]
        evidence = cat_data["evidence"]

        required = company_requirements.get(code)
        if required is not None:
            required = int(required)

        status = status_for(required, level)
        gap_size = max(0, required - level) if required is not None else None
        is_gap = required is not None and required > 0 and level < required

        skillset_gap.append({
            "category_code": code,
            "required_level": required,
            "candidate_level": level,
            "candidate_level_is_estimate": True,
            "gap": is_gap,
            "gap_size": gap_size,
            "status": status,
            "uncertainty": uncertainty,
            "evidence": [
                {
                    "skill_name": e["skill_name"],
                    "evidence": e["evidence"],
                    "confidence": e["confidence"],
                }
                for e in evidence
            ],
        })

    # Filter assessed categories (required is not None and required > 0)
    assessed = [r for r in skillset_gap if r["required_level"] is not None and r["required_level"] > 0]
    required_total = sum(r["required_level"] for r in assessed)
    covered = sum(min(r["candidate_level"], r["required_level"]) for r in assessed)
    readiness_score = round((100 * covered) / required_total) if required_total > 0 else 0

    # Strongest areas: top 3 by (estimated - required) desc, then candidate_level desc
    strongest_candidates = [r for r in assessed if r["candidate_level"] > 0]
    strongest_candidates.sort(
        key=lambda r: (r["candidate_level"] - r["required_level"], r["candidate_level"]),
        reverse=True,
    )
    strongest = [r["category_code"] for r in strongest_candidates[:3]]

    # Priority gaps: top 4 by gap_size desc, then required_level desc
    gap_candidates = [r for r in assessed if r["gap"]]
    gap_candidates.sort(
        key=lambda r: (r["gap_size"] or 0, r["required_level"] or 0),
        reverse=True,
    )
    priority_gaps = [r["category_code"] for r in gap_candidates[:4]]

    # Recommendations for priority gaps
    gap_map = {r["category_code"]: r for r in skillset_gap}
    recommendations: List[Dict[str, str]] = []
    for code in priority_gaps:
        row = gap_map[code]
        cat_name = RADIX_CATEGORY_NAMES.get(code, code)
        hint = RECOMMENDATION_HINTS.get(code, "add focused project work or certifications")
        rec_text = f"{cat_name} — estimated {row['candidate_level']}/10 vs. required {row['required_level']}/10: {hint}."
        recommendations.append({
            "category_code": code,
            "text": rec_text,
        })

    meets_count = sum(1 for r in assessed if r["status"] == "meets")
    comp_name = company.get("company_name") or company.get("name") or "Company"
    cand_name = (
        profile.get("candidate_name")
        or profile.get("name")
        if isinstance(profile, dict)
        else getattr(profile, "name", "Candidate")
    )

    gap_names = [RADIX_CATEGORY_NAMES.get(c, c) for c in priority_gaps]
    gap_str = f"; largest gaps: {', '.join(gap_names)}" if gap_names else "; meets or exceeds all assessed requirements"
    summary = (
        f"Estimated readiness {readiness_score}/100 for {comp_name}. "
        f"The candidate meets or exceeds {meets_count} of {len(assessed)} assessed skillsets{gap_str}. "
        "Levels are inferred from resume evidence and should be confirmed by assessment."
    )

    prof_id = (
        profile.get("profile_id") or profile.get("resume_id") or "profile-1"
        if isinstance(profile, dict)
        else getattr(profile, "profile_id", "profile-1")
    )
    company_id = str(company.get("company_id") or "1")

    now_iso = datetime.now(timezone.utc).isoformat()
    result_id = f"tc-{uuid.uuid4().hex[:12]}"

    req_source = requirements_source or {
        "file": company.get("source") or "data/talent_check_company_skillsets.json",
        "synthetic": bool(company.get("synthetic", False)),
    }

    return {
        "result_id": result_id,
        "type": "talent_check",
        "profile_id": str(prof_id),
        "candidate_name": str(cand_name),
        "company_id": str(company_id),
        "company": str(comp_name),
        "readiness_score": readiness_score,
        "skillset_gap": skillset_gap,
        "strongest": strongest,
        "priority_gaps": priority_gaps,
        "recommendations": recommendations,
        "summary": summary,
        "requirements_source": req_source,
        "scoring": {
            "method": READINESS_METHOD,
            "formula": READINESS_FORMULA,
            "status": "standardized-radix-rubric",
        },
        "created_at": now_iso,
    }


def compare_candidates_readiness(
    profile_a: Union[Dict[str, Any], Any],
    profile_b: Union[Dict[str, Any], Any],
    company: Dict[str, Any],
) -> Dict[str, Any]:
    """Compares two candidates against the same company and explains score differences

    and category gaps across all 12 RADIX categories (fulfills acceptance test requirement).
    """
    res_a = calculate_readiness(profile_a, company)
    res_b = calculate_readiness(profile_b, company)

    name_a = res_a["candidate_name"]
    name_b = res_b["candidate_name"]
    score_a = res_a["readiness_score"]
    score_b = res_b["readiness_score"]
    score_diff = score_a - score_b

    if score_diff > 0:
        overall_leader = "candidate_a"
    elif score_diff < 0:
        overall_leader = "candidate_b"
    else:
        overall_leader = "tie"

    gap_a_map = {r["category_code"]: r for r in res_a["skillset_gap"]}
    gap_b_map = {r["category_code"]: r for r in res_b["skillset_gap"]}

    category_comparisons: List[Dict[str, Any]] = []
    a_leads = []
    b_leads = []
    ties = []

    for code in SCORED_RADIX_CATEGORIES:
        row_a = gap_a_map[code]
        row_b = gap_b_map[code]
        cat_name = RADIX_CATEGORY_NAMES.get(code, code)
        req = row_a["required_level"]

        lev_a = row_a["candidate_level"]
        lev_b = row_b["candidate_level"]
        diff = lev_a - lev_b

        if diff > 0:
            cat_leader = "candidate_a"
            a_leads.append(cat_name)
            explanation = (
                f"{name_a} leads in {cat_name} (level {lev_a}/10 vs {name_b}'s {lev_b}/10; "
                f"required: {req}/10). {name_a} shows stronger verified evidence ({len(row_a['evidence'])} items)."
            )
        elif diff < 0:
            cat_leader = "candidate_b"
            b_leads.append(cat_name)
            explanation = (
                f"{name_b} leads in {cat_name} (level {lev_b}/10 vs {name_a}'s {lev_a}/10; "
                f"required: {req}/10). {name_b} shows stronger verified evidence ({len(row_b['evidence'])} items)."
            )
        else:
            cat_leader = "tie"
            ties.append(cat_name)
            if lev_a == 0:
                explanation = f"Neither candidate has documented evidence in {cat_name} (level 0/10 vs required {req}/10)."
            else:
                explanation = f"Both candidates have equal estimated level {lev_a}/10 in {cat_name} (required: {req}/10)."

        category_comparisons.append({
            "category_code": code,
            "category_name": cat_name,
            "required_level": req,
            "candidate_a_level": lev_a,
            "candidate_b_level": lev_b,
            "candidate_a_status": row_a["status"],
            "candidate_b_status": row_b["status"],
            "difference": diff,
            "leader": cat_leader,
            "explanation": explanation,
        })

    comp_name = company.get("company_name") or company.get("name") or "the company"
    if score_diff > 0:
        lead_summary = f"{name_a} leads with {score_a}/100 readiness vs {name_b}'s {score_b}/100 (+{score_diff} pts higher)."
    elif score_diff < 0:
        lead_summary = f"{name_b} leads with {score_b}/100 readiness vs {name_a}'s {score_a}/100 (+{abs(score_diff)} pts higher)."
    else:
        lead_summary = f"Both candidates have identical readiness scores of {score_a}/100 for {comp_name}."

    strengths_a = ", ".join([RADIX_CATEGORY_NAMES.get(c, c) for c in res_a["strongest"]]) or "None"
    strengths_b = ", ".join([RADIX_CATEGORY_NAMES.get(c, c) for c in res_b["strongest"]]) or "None"
    gaps_a = ", ".join([RADIX_CATEGORY_NAMES.get(c, c) for c in res_a["priority_gaps"]]) or "None"
    gaps_b = ", ".join([RADIX_CATEGORY_NAMES.get(c, c) for c in res_b["priority_gaps"]]) or "None"

    overall_explanation = (
        f"{lead_summary} When evaluated against {comp_name}'s expectations across all 12 RADIX categories: "
        f"{name_a} is strongest in [{strengths_a}] with major gaps in [{gaps_a}]. "
        f"{name_b} is strongest in [{strengths_b}] with major gaps in [{gaps_b}]. "
        f"{name_a} outperforms in {len(a_leads)} skillsets, {name_b} outperforms in {len(b_leads)} skillsets, "
        f"and they tie in {len(ties)} skillsets."
    )

    return {
        "company_id": str(company.get("company_id") or ""),
        "company_name": comp_name,
        "candidate_a": {
            "profile_id": res_a["profile_id"],
            "candidate_name": name_a,
            "readiness_score": score_a,
            "strongest": res_a["strongest"],
            "priority_gaps": res_a["priority_gaps"],
        },
        "candidate_b": {
            "profile_id": res_b["profile_id"],
            "candidate_name": name_b,
            "readiness_score": score_b,
            "strongest": res_b["strongest"],
            "priority_gaps": res_b["priority_gaps"],
        },
        "score_difference": score_diff,
        "leader": overall_leader,
        "overall_explanation": overall_explanation,
        "category_comparisons": category_comparisons,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
