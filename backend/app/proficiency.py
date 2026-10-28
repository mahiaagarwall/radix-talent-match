"""
app/proficiency.py — Target-proficiency calculation for JD Analyzer.

Target proficiency represents the capability the JOB requires for each skill,
not the candidate's current level.

Official RADIX proficiency definitions have not been confirmed for this
standalone build.  When an official scale is configured via Supabase
(proficiency_levels table), this module will use it.

In the absence of official definitions, a PROVISIONAL 1–10 scale is used.
All provisional results are clearly marked with is_provisional = True.

The provisional mapping is:
  1–2  : Awareness / Beginner
  3–4  : Foundational (junior)
  5–6  : Proficient (mid-level)
  7–8  : Advanced (senior / architect)
  9–10 : Expert / Principal

This module is intentionally isolated so it can be replaced when RADIX
publishes an official scoring method.
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ─── Provisional seniority keywords ────────────────────────────────────────────
# Maps regex patterns (lower-cased) → (min_score, max_score) on 1–10 scale.
_SENIORITY_PATTERNS: List[tuple[re.Pattern, int, int]] = [
    (re.compile(r"\bprincipal\b|\bstaff\b|\bfellow\b|\bvp\b"), 9, 10),
    (re.compile(r"\blead\b|\barchitect\b|\bhead of\b"), 8, 9),
    (re.compile(r"\bsenior\b|\bsr\.?\b"), 7, 8),
    (re.compile(r"\bmid[\s\-]?level\b|\bintermediate\b"), 5, 6),
    (re.compile(r"\bjunior\b|\bjr\.?\b|\bentry[\s\-]?level\b|\bassociate\b"), 3, 4),
    (re.compile(r"\bintern\b|\btrainee\b|\bfresher\b"), 1, 2),
]

# ─── Experience → approximate proficiency ──────────────────────────────────────
# These are heuristics ONLY and marked provisional.
_EXPERIENCE_BRACKETS: List[tuple[int, int, int]] = [
    # (min_years_inclusive, max_years_exclusive, score)
    (0, 1, 2),
    (1, 3, 4),
    (3, 5, 6),
    (5, 8, 7),
    (8, 12, 8),
    (12, 9999, 9),
]


def _score_from_seniority(jd_text: str) -> Optional[int]:
    """Extract a provisional proficiency midpoint from seniority keywords."""
    lower = jd_text.lower()
    for pattern, low, high in _SENIORITY_PATTERNS:
        if pattern.search(lower):
            return (low + high) // 2
    return None


def _score_from_experience(experience_str: Optional[str]) -> Optional[int]:
    """
    Parse an experience string like '3–5 years' or '2+ years' and map to score.
    Returns None when the string cannot be parsed.
    """
    if not experience_str:
        return None

    # Extract all integers from the string
    numbers = [int(m) for m in re.findall(r"\d+", experience_str)]
    if not numbers:
        return None

    # Use the midpoint when a range is given, otherwise the single value.
    years = sum(numbers) / len(numbers)

    for min_y, max_y, score in _EXPERIENCE_BRACKETS:
        if min_y <= years < max_y:
            return score

    return None


def calculate_target_proficiency(
    skill_name: str,
    importance: str,
    requirement_type: str,
    jd_full_text: str,
    experience_required: Optional[str],
    llm_suggested: Optional[int],
    official_levels: Optional[List[Dict]] = None,
) -> tuple[Optional[int], bool]:
    """
    Determine the target proficiency for a skill.

    Returns (score, is_provisional) where:
      - score         : int 1–10 or None if it cannot be determined.
      - is_provisional: True when official definitions are not in use.

    Priority order:
      1. If official_levels are supplied from Supabase, delegate to those.
         (Placeholder — replace when official method is confirmed.)
      2. Use the LLM's suggestion when it falls within 1–10 and is_provisional
         can be inferred.
      3. Apply provisional heuristic from seniority / experience signals.
      4. Return None when no justifiable estimate exists.
    """

    # 1. Official proficiency definitions from Supabase.
    # The database labels are not a verified mapping to the application's
    # numeric 1–10 scale. Therefore, merely having rows in this table must not
    # turn an LLM guess into an "official" score. Company-specific numeric
    # required_level values are applied separately in jd_service.py.
    if official_levels:
        if llm_suggested is not None and 1 <= llm_suggested <= 10:
            logger.debug(
                "Using provisional LLM-suggested proficiency %d for '%s'; "
                "official labels have no verified numeric mapping.",
                llm_suggested,
                skill_name,
            )
            return llm_suggested, True
        return None, False

    # 2. LLM suggestion (already validated by schema as 1–10 or None)
    if llm_suggested is not None and 1 <= llm_suggested <= 10:
        return llm_suggested, True  # LLM estimate is provisional

    # 3. Provisional heuristic
    score = _score_from_seniority(jd_full_text)
    if score is None:
        score = _score_from_experience(experience_required)

    if score is None:
        # No justifiable estimate available
        return None, False

    # Adjust for importance and requirement type
    if importance == "high" and requirement_type == "required":
        score = min(score + 1, 10)
    elif importance == "low" or requirement_type == "preferred":
        score = max(score - 1, 1)

    return score, True


def apply_proficiency_to_skills(
    skills: list,
    jd_full_text: str,
    experience_required: Optional[str],
    official_levels: Optional[List[Dict]] = None,
) -> list:
    """
    Apply target proficiency calculation to a list of LLMSkill objects.

    Mutates each skill's target_proficiency and is_provisional fields in place
    and returns the list.
    """
    for skill in skills:
        current_score = skill.target_proficiency
        current_provisional = skill.is_provisional

        # If the LLM already provided a score, validate it; otherwise calculate.
        score, is_provisional = calculate_target_proficiency(
            skill_name=skill.skill_name,
            importance=skill.importance,
            requirement_type=skill.requirement_type,
            jd_full_text=jd_full_text,
            experience_required=experience_required,
            llm_suggested=current_score,
            official_levels=official_levels,
        )

        skill.target_proficiency = score
        skill.is_provisional = is_provisional

    return skills
