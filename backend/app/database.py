"""
app/database.py — Supabase client and data-access functions for JD Analyzer.

Responsibilities:
  - Initialise the Supabase client when credentials are available.
  - Retrieve canonical skills and categories from skill_set_master.
  - Retrieve proficiency level definitions from proficiency_levels.
  - Retrieve roadmap topics from skill_set_topics.
  - Handle unavailable configuration and database failures predictably.
  - Never fabricate database records.

Schema note
-----------
The data-access queries use the Supabase columns confirmed for this project:
  skill_set_master: skill_set_id, skill_set_name, short_name,
                    skill_set_description
  skill_set_topics: topic_id, skill_set_id, level_number, topics
  proficiency_levels: proficiency_level_id, proficiency_name,
                      proficiency_code, proficiency_description
  companies: company_id, name, short_name
  company_skill_levels: company_id, skill_set_id, required_level,
                        required_proficiency_level_id

The skill master table has no category columns; category labels are derived
locally from canonical skill names. Roadmap topics are linked by skill_set_id.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Client initialisation
# ═══════════════════════════════════════════════════════════════════════════════

def _get_supabase_client():
    """
    Return an initialised Supabase client or None if not configured.

    Imports supabase lazily so the module is importable without the package
    installed (tests mock this function).
    """
    settings = get_settings()
    if not settings.supabase_configured:
        logger.debug("Supabase not configured — skipping client initialisation.")
        return None

    try:
        from supabase import create_client  # type: ignore
        client = create_client(settings.supabase_url, settings.supabase_key)
        return client
    except ImportError:
        logger.warning("supabase-py is not installed; database features are disabled.")
        return None
    except Exception as exc:
        logger.error("Failed to create Supabase client: %s", exc)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Data-access helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _category_for_skill(name: str) -> Dict[str, str]:
    """Map known canonical names to the application's stable category codes.

    ``skill_set_master`` has no category columns, so these are deterministic
    display mappings—not values claimed to have come from Supabase. Keep the
    codes aligned with the JD-analysis prompt and avoid broad matches that
    classify unrelated skills as coding or data.
    """
    normalized = " ".join(
        str(name or "").casefold().replace("&", "and").replace("_", " ").split()
    )
    compact = normalized.replace("-", " ")
    rules = (
        (("aptitude", "problem solving", "problem-solving", "reasoning"), "APTI", "Aptitude & Problem Solving"),
        (("communication", "leadership", "teamwork", "interpersonal"), "COMM", "Communication"),
        (("data structures", "algorithms", " dsa "), "DSA", "Data Structures & Algorithms"),
        (("object oriented", "object-oriented", "ood"), "OOD", "Object-Oriented Design"),
        (("system design", "software architecture", "architecture"), "SYSD", "System Design & Architecture"),
        (("devops", "cloud", "ci/cd"), "CLOUD", "DevOps & Cloud"),
        (("computer networking", "network protocols", "networking", "tcp/ip"), "NETW", "Computer Networking"),
        (("operating system", "operating systems", "kernel"), "OS", "Operating Systems"),
        (("sql", "database", "query optimization", "schema design"), "SQL", "SQL & Database Design"),
        (("artificial intelligence", "machine learning", "ai native", "deep learning"), "AI", "AI & Machine Learning"),
        (("software engineering",), "SWE", "Software Engineering"),
        (("software development", "coding", "programming"), "COD", "Coding"),
        (("software testing", "quality assurance", "testing"), "TEST", "Software Testing & Quality"),
        (("security engineering", "application security", "secure software"), "SEC", "Security Engineering"),
        (("reliability engineering", "reliability", "fault tolerance"), "SRE", "Reliability Engineering"),
        (("api design", "api development"), "API", "API Design & Development"),
        (("agile software development", "agile"), "AGILE", "Agile Software Development"),
        (("performance engineering", "performance optimization"), "PERF", "Performance Engineering"),
        (("version control", "collaboration"), "COLLAB", "Version Control & Collaboration"),
        (("application support", "incident management", "troubleshooting", "production support", "log analysis", "ticketing", "sla management", "batch processing", "systems administration", "application monitoring", "technical documentation"), "SUPPORT", "Application Support & Operations"),
    )
    padded = f" {compact} "
    for needles, code, label in rules:
        if any(needle in padded for needle in needles):
            return {"category_code": code, "category_name": label}
    return {"category_code": "OTHER", "category_name": "Other"}


def get_canonical_skills() -> List[Dict[str, Any]]:
    """
    Retrieve all canonical skills from skill_set_master.

    Preserves the original Supabase fields and adds normalized aliases
    for compatibility with the application.
    """
    client = _get_supabase_client()
    if client is None:
        return []

    try:
        response = (
            client.table("skill_set_master")
            .select(
                "skill_set_id,skill_set_name,short_name,"
                "skill_set_description"
            )
            .execute()
        )

        records = response.data or []
        normalized_skills = []

        for record in records:
            normalized_skills.append({
                **record,
                "id": record.get("skill_set_id"),
                "skill_name": record.get("skill_set_name", ""),
                "short_name": record.get("short_name", ""),
                "description": record.get("skill_set_description", ""),
                # Categories are derived from the canonical skill name because
                # skill_set_master has no category columns. Keep this mapping
                # conservative and deterministic; unknown names remain OTHER.
                **_category_for_skill(
                    record.get("skill_set_name", "")
                    or record.get("short_name", "")
                ),
            })

        logger.info(
            "Loaded %d canonical skills from Supabase.",
            len(normalized_skills),
        )
        return normalized_skills

    except Exception:
        logger.exception("get_canonical_skills failed")
        return []





def get_company_skill_levels(company_name: str) -> List[Dict[str, Any]]:
    """Return baseline skill levels for a company, matching full or short name."""
    import re
    import unicodedata

    if not company_name or not company_name.strip():
        return []

    # Use the existing helper to obtain the configured Supabase client.
    try:
        supabase_client = _get_supabase_client()
    except Exception:
        logger.exception("Could not initialize Supabase client for company lookup.")
        return []

    if supabase_client is None:
        logger.warning(
            "Cannot load company baselines: Supabase client is unavailable."
        )
        return []

    def normalize(value: str) -> str:
        value = unicodedata.normalize("NFKC", value or "").casefold()

        # Remove parenthetical suffixes, e.g. "(Subsidiary of Alphabet Inc.)".
        value = re.sub(r"\([^)]*\)", " ", value)

        # Normalize punctuation, whitespace, and other separators.
        value = re.sub(r"[^a-z0-9]+", " ", value)
        return " ".join(value.split())

    try:
        requested = normalize(company_name)

        response = (
            supabase_client.table("companies")
            .select("company_id,name,short_name")
            .limit(500)
            .execute()
        )

        companies = response.data or []
        matched_company = None

        for company in companies:
            stored_name = normalize(company.get("name", ""))
            short_name = normalize(company.get("short_name", ""))

            if (
                requested == stored_name
                or requested == short_name
                or (
                    len(requested) >= 5
                    and stored_name.startswith(requested + " ")
                )
            ):
                matched_company = company
                break

        if not matched_company:
            logger.warning(
                "No company match found for %r among %d company records.",
                company_name,
                len(companies),
            )
            return []

        company_id = matched_company.get("company_id")

        if company_id is None:
            logger.warning(
                "Matched company %r has no company_id.",
                matched_company.get("name"),
            )
            return []

        response = (
            supabase_client.table("company_skill_levels")
            .select(
                "company_id,skill_set_id,required_level,"
                "required_proficiency_level_id"
            )
            .eq("company_id", company_id)
            .execute()
        )

        rows = response.data or []

        logger.info(
            "Loaded %d baseline skill levels for company %r (ID %s).",
            len(rows),
            matched_company.get("name"),
            company_id,
        )

        return rows

    except Exception:
        logger.exception("get_company_skill_levels failed")
        return []


def get_proficiency_levels() -> List[Dict[str, Any]]:
    """
    Retrieve proficiency level definitions from proficiency_levels.

    Returns an empty list if Supabase is not configured or the query fails.
    Returns the confirmed Supabase proficiency-level columns unchanged.
    """
    client = _get_supabase_client()
    if client is None:
        return []

    try:
        response = (
        client.table("proficiency_levels")
        .select("proficiency_level_id,proficiency_name,"
                "proficiency_code,proficiency_description")
        .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.error("get_proficiency_levels failed: %s", exc)
        return []



def get_roadmap_topics_for_skills(
    category_codes: Optional[List[str]] = None,
    canonical_skill_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Retrieve roadmap topics linked to canonical skill IDs."""
    client = _get_supabase_client()
    if client is None:
        return []

    if not canonical_skill_ids:
        logger.info(
            "Roadmap lookup skipped: no canonical skill IDs were provided."
        )
        return []

    try:
        skill_ids = list({
            int(skill_id)
            for skill_id in canonical_skill_ids
            if str(skill_id).isdigit()
        })
        if not skill_ids:
            return []

        response = (
            client.table("skill_set_topics")
            .select("topic_id,skill_set_id,level_number,topics")
            .in_("skill_set_id", skill_ids)
            .execute()
        )

        return [
            {
                **record,
                "id": record.get("topic_id"),
                "topic_name": record.get("topics", ""),
                "canonical_skill_id": str(record.get("skill_set_id")),
                "level_number": record.get("level_number"),
            }
            for record in (response.data or [])
        ]
    except Exception:
        logger.exception("get_roadmap_topics_for_skills failed")
        return []



def get_skill_category_map() -> Dict[str, Dict[str, str]]:
    """
    Return a dict mapping canonical skill IDs to their category information.

    Shape: { "skill_id": {"category_code": "...", "category_name": "...",
                          "skill_name": "..."} }

    Returns an empty dict when Supabase is not configured.
    """
    skills = get_canonical_skills()
    return {
        str(s["id"]): {
            "category_code": s.get("category_code", "OTHER"),
            "category_name": s.get("category_name", "Other"),
            "skill_name": s.get("skill_name", ""),
        }
        for s in skills
        if "id" in s
    }
