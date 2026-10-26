"""Known skills: canonical name, RADIX category, aliases and evidence patterns.

Used by both extraction modes to:
  * assign exactly one valid category to each skill,
  * recognise the same skill written differently ("Computer Networks" = networking),
  * decide whether a skill is *demonstrated* in projects / internships / hackathons /
    achievements (needed for the confidence rule in docs/scoring-rules.md).

Normalisation mirrors frontend/src/utils/skillNormalizer.js so both sides agree.
Add skills here — nothing else needs to change.
"""

import re
from dataclasses import dataclass, field

CATEGORY_CODES = {"COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"}

DEPTH_QUALIFIER = re.compile(r"\b(basic|basics|fundamentals?|foundational|exposure|beginner|introductory)\b", re.I)


@dataclass(frozen=True)
class CatalogSkill:
    name: str  # display name used when the skill is found only in experience text
    category: str
    aliases: tuple = ()
    # Regexes that show the skill being USED in experience text (case-insensitive).
    evidence: tuple = ()
    # "low" for skills whose experience signal is only indirect (e.g. mentoring → communication).
    indirect_evidence: tuple = field(default=())


CATALOG = [
    CatalogSkill("C++", "COD", ("cpp",), (r"c\+\+",)),
    CatalogSkill("Python", "COD", (), (r"\bpython\b", r"\bpandas\b")),
    CatalogSkill("Java", "COD", (), (r"\bjava\b",)),
    CatalogSkill("JavaScript", "COD", ("js", "typescript"), (r"\bjavascript\b", r"\btypescript\b")),
    CatalogSkill(
        "Data Structures & Algorithms", "DSA",
        ("dsa", "data structures", "algorithms", "data structures and algorithms"),
        (r"\bdsa\b", r"competitive programming", r"data structures?", r"problems solved", r"solved \d+\+? problems"),
    ),
    CatalogSkill(
        "Object-Oriented Design", "OOD",
        ("ood", "oop", "oops", "object oriented design", "object-oriented programming", "design patterns"),
        (r"\boop\b", r"object[- ]oriented", r"design patterns?"),
    ),
    CatalogSkill(
        "System Design", "SYSD", ("distributed systems", "systems design", "scalable systems"),
        (r"system[- ]design", r"distributed", r"horizontally[- ]scalable", r"pub-sub", r"architecture diagrams?"),
    ),
    CatalogSkill(
        "Operating Systems", "OS", ("os", "operating system"),
        (r"operating systems?", r"os-level", r"process scheduling", r"multithread", r"virtual memory"),
    ),
    CatalogSkill("Linux", "OS", ("unix",), (r"\blinux\b",)),
    CatalogSkill(
        "Networking", "NETW", ("computer networks", "computer networking", "networks", "networking fundamentals"),
        (r"\bnetwork(ing|s)?\b", r"\btcp\b", r"\bhttp\b", r"\bcisco\b"),
    ),
    CatalogSkill("SQL", "SQL", ("mysql", "postgresql", "sql queries"), (r"\bsql\b", r"\bmysql\b", r"\bpostgres")),
    CatalogSkill(
        "Database Schema Design", "SQL", ("schema design", "data modeling", "data modelling", "database design"),
        (r"\bschema\b",),
    ),
    CatalogSkill(
        "Machine Learning", "AI", ("ml", "scikit-learn", "sklearn", "predictive modeling"),
        (r"machine learning", r"regression", r"classification", r"recommendation engine", r"collaborative filtering",
         r"scikit-learn", r"precision/recall"),
    ),
    CatalogSkill("Anomaly Detection", "OTHER", (), (r"anomaly detection",)),
    CatalogSkill("Statistics", "APTI", ("statistical analysis",), (r"\bstatistic",)),
    CatalogSkill("A/B Testing", "APTI", ("ab testing", "experimentation"), (r"a/b test",)),
    CatalogSkill("Cloud Infrastructure", "CLOUD", ("cloud", "azure", "aws", "gcp"), (r"\baws\b", r"\bazure\b", r"\bgcp\b", r"\bcloud\b")),
    CatalogSkill("Docker", "CLOUD", ("containers",), (r"\bdocker\b",)),
    CatalogSkill("Git", "SWE", ("github", "version control"), (r"\bgit\b", r"merged prs?")),
    CatalogSkill(
        "Software Engineering Practices", "SWE",
        ("software engineering", "testing", "unit testing", "code review", "ci/cd", "sdlc", "agile"),
        (r"tests? and ci", r"\bci/cd\b", r"unit test", r"code review", r"in production", r"shipped a feature"),
    ),
    CatalogSkill(
        "Data Visualization", "OTHER", ("power bi", "powerbi", "dashboards", "tableau", "data visualisation"),
        (r"dashboards?", r"visuali[sz]ation", r"power bi"),
    ),
    CatalogSkill("Excel", "OTHER", ("ms excel", "microsoft excel"), (r"\bexcel\b",)),
    CatalogSkill("Data Analysis", "OTHER", ("data analytics",), (r"analysis write-up", r"data analytics")),
    CatalogSkill("Technical Troubleshooting", "OTHER", ("troubleshooting", "it support"), (r"troubleshoot", r"helpdesk", r"resolving simulated tickets")),
    CatalogSkill("Ticketing Tools", "OTHER", ("ticketing", "ticketing systems", "incident tools"), (r"ticket",)),
    CatalogSkill("Open-source Contribution", "OTHER", ("open source", "open-source"), (r"open-source", r"open source", r"merged prs?")),
    CatalogSkill(
        "Communication", "COMM", ("communication skills", "presentation skills"),
        (r"present(ed|ing)? (results|findings)", r"non-technical audience", r"blog", r"write-up", r"documented"),
        indirect_evidence=(r"mentor", r"coordinat", r"escalation"),
    ),
]

_BY_CANONICAL = {}
for entry in CATALOG:
    _BY_CANONICAL[entry.name.lower()] = entry
    for alias in entry.aliases:
        _BY_CANONICAL[alias.lower()] = entry


def clean_name(raw: str) -> str:
    """Lower-case core of a skill name: no parentheses, depth words or filler."""
    text = re.sub(r"\([^)]*\)", " ", str(raw or "").lower())
    text = DEPTH_QUALIFIER.sub(" ", text)
    text = re.sub(r"\b(ms|strong|solid|practical|knowledge of|experience with|exposure to|to)\b", " ", text)
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9+#/\- ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def lookup(raw_name: str):
    """Return the CatalogSkill for a name, or None if unknown."""
    cleaned = clean_name(raw_name)
    if cleaned in _BY_CANONICAL:
        return _BY_CANONICAL[cleaned]
    # "data structures and algorithms" etc.
    return _BY_CANONICAL.get(cleaned.replace(" and ", " & "))


def canonical(raw_name: str) -> str:
    entry = lookup(raw_name)
    return entry.name.lower() if entry else clean_name(raw_name)


def category_for(raw_name: str, suggested: str | None = None) -> str:
    """Known skills always get their catalog category; otherwise a valid suggestion, else OTHER."""
    entry = lookup(raw_name)
    if entry:
        return entry.category
    return suggested if suggested in CATEGORY_CODES else "OTHER"


def evidence_patterns(raw_name: str) -> tuple[list[str], list[str]]:
    """(direct, indirect) regexes that show this skill being used."""
    entry = lookup(raw_name)
    if entry:
        return list(entry.evidence), list(entry.indirect_evidence)
    core = clean_name(raw_name)
    return ([rf"\b{re.escape(core)}\b"] if len(core) >= 3 else []), []
