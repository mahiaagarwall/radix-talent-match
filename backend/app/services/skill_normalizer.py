"""Deterministic skill normalization utility for RADIX Talent Match.

Normalizes case, whitespace, punctuation, depth qualifiers, and approved
alias groupings. Guarantees deterministic, explainable comparisons.
Ported from and aligned with frontend/src/utils/skillNormalizer.js.
"""

import re
from typing import Optional

VALID_CATEGORIES = {
    "COD", "DSA", "OOD", "APTI", "COMM", "AI",
    "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"
}

CATEGORY_NAMES = {
    "COD": "Coding",
    "DSA": "Data Structures & Algorithms",
    "OOD": "Object-Oriented Design",
    "APTI": "Aptitude",
    "COMM": "Communication",
    "AI": "Artificial Intelligence",
    "CLOUD": "Cloud",
    "SQL": "SQL",
    "SWE": "Software Engineering",
    "SYSD": "System Design",
    "NETW": "Networking",
    "OS": "Operating Systems",
    "OTHER": "Other",
}

DEPTH_QUALIFIER = re.compile(
    r"\b(basic|basics|fundamentals?|foundational|exposure|beginner|introductory|intro)\b",
    re.IGNORECASE,
)

NOISE_WORDS = re.compile(
    r"\b(strong|practical|working knowledge of|knowledge of|experience with)\b|\bsolid\b(?!\s*principles)",
    re.IGNORECASE,
)

ALIAS_GROUPS = {
    "programming": ["coding", "programming fundamentals", "hands-on programming", "software development"],
    "data structures and algorithms": ["dsa", "data structures", "algorithms", "data structures algorithms"],
    "object-oriented design": [
        "ood",
        "oop",
        "oops",
        "object oriented design",
        "object-oriented programming",
        "object oriented programming",
        "design patterns",
        "solid principles",
    ],
    "quantitative aptitude": ["aptitude", "quantitative reasoning", "logical reasoning", "analytical reasoning"],
    "communication": [
        "communication skills",
        "stakeholder communication",
        "written communication",
        "verbal communication",
        "presentation skills",
    ],
    "machine learning": ["ml", "scikit-learn", "sklearn", "predictive modeling", "predictive modelling"],
    "cloud infrastructure": ["cloud", "cloud computing", "azure", "aws", "gcp", "google cloud"],
    "sql": ["mysql", "postgresql", "sql queries", "structured query language"],
    "database schema design": ["schema design", "data modeling", "data modelling", "database design"],
    "software engineering practices": [
        "software engineering",
        "software engineering fundamentals",
        "testing",
        "unit testing",
        "code review",
        "ci/cd",
        "sdlc",
        "agile",
    ],
    "system design": ["distributed systems", "scalable systems", "systems design"],
    "networking": ["computer networks", "computer networking", "networks", "networking concepts"],
    "operating systems": ["os", "operating system"],
    "linux": ["linux command line", "unix"],
    "data visualization": ["power bi", "tableau", "dashboards", "bi tools", "data visualisation"],
    "a/b testing": ["ab testing", "experimentation", "experiment design"],
    "technical troubleshooting": ["troubleshooting", "incident management", "application support"],
    "ticketing / incident tools": ["ticketing tools", "ticketing", "incident tools", "ticketing systems"],
    "c++": ["cpp"],
    "open-source contribution": ["open source", "open-source", "open source contributions"],
}

ALIAS_LOOKUP: dict[str, str] = {}
for canonical, aliases in ALIAS_GROUPS.items():
    ALIAS_LOOKUP[canonical] = canonical
    for a in aliases:
        ALIAS_LOOKUP[a] = canonical

# Canonical names that describe a broad category competency
GENERIC_COMPETENCIES = {
    "programming": "COD",
    "communication": "COMM",
    "quantitative aptitude": "APTI",
}

CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1}


def get_category_name(code: str) -> str:
    """Return human-readable category name."""
    return CATEGORY_NAMES.get(code, code)


def clean_name(raw: Optional[str]) -> str:
    """Lowercase, strip parentheticals, depth qualifiers, noise phrases, and extra punctuation."""
    if not raw:
        return ""
    text = str(raw).lower()
    text = re.sub(r"\([^)]*\)", " ", text)  # remove parenthetical e.g. "SQL (basic)"
    text = DEPTH_QUALIFIER.sub(" ", text)
    text = NOISE_WORDS.sub(" ", text)
    text = text.replace("&", " and ")
    # Retain alphanumeric, +, #, /, -, and space
    text = re.sub(r"[^a-z0-9+#/\- ]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def canonical_skill_name(raw: Optional[str]) -> str:
    """Map cleaned skill name to canonical name via approved alias table."""
    cleaned = clean_name(raw)
    return ALIAS_LOOKUP.get(cleaned, cleaned)


def has_depth_qualifier(raw: Optional[str]) -> bool:
    """Check if skill string explicitly contains depth qualifiers (e.g. basic, beginner)."""
    return bool(DEPTH_QUALIFIER.search(str(raw or "")))


def is_generic_competency(raw: Optional[str]) -> bool:
    """Check if skill name maps to a broad category competency."""
    return canonical_skill_name(raw) in GENERIC_COMPETENCIES


def dedupe_skills(skills: list[dict]) -> list[dict]:
    """
    Deduplicate skills by canonical name.
    Preserves highest confidence and merges evidence strings without repeating phrases.
    """
    out: list[dict] = []
    index_map: dict[str, int] = {}

    for s in skills or []:
        name = s.get("skill_name") or ""
        key = canonical_skill_name(name)
        if not key:
            continue

        if key not in index_map:
            index_map[key] = len(out)
            out.append(dict(s))
            continue

        existing = out[index_map[key]]
        curr_conf = s.get("confidence", "low")
        exist_conf = existing.get("confidence", "low")
        if CONFIDENCE_RANK.get(curr_conf, 0) > CONFIDENCE_RANK.get(exist_conf, 0):
            existing["confidence"] = curr_conf

        new_ev = s.get("evidence", "")
        if new_ev and new_ev not in existing.get("evidence", ""):
            if existing.get("evidence"):
                existing["evidence"] = f"{existing['evidence']}; {new_ev}"
            else:
                existing["evidence"] = new_ev

        if s.get("requirement") == "required":
            existing["requirement"] = "required"

    return out
