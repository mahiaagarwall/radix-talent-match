"""Skill taxonomy for resume parsing (Owner: Mahi Aggarwal).

Maps skill names and their aliases to a canonical skill and one RADIX category
code (COD DSA OOD APTI COMM AI CLOUD SQL SWE SYSD NETW OS OTHER). Aliases follow
frontend/src/utils/skillNormalizer.js, so the backend and Skill Matching agree
on what counts as the same skill (e.g. MySQL → SQL, Computer Networks → networking).

Each alias is used in two ways:
- "listed": an exact match for an item in the resume's Skills section.
- "prose": a whole-word match inside project / internship / achievement text.
  Short or ambiguous aliases ("c", "r", "go", "os", "ai", "networks") are
  list-only because they would match unrelated words in sentences.

To add a skill: append a TaxonomySkill below. Nothing else needs to change.
"""

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

DEPTH_QUALIFIER_RE = re.compile(
    r"\b(basic|basics|fundamentals?|foundational|exposure|beginner|introductory|intro)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class TaxonomySkill:
    name: str  # display name used when a skill is found only in prose
    category: str
    aliases: Tuple[str, ...] = ()  # usable both in a skills list and in prose
    list_only: Tuple[str, ...] = ()  # usable only as an exact skills-list item


def _s(name: str, category: str, aliases=(), list_only=()) -> TaxonomySkill:
    return TaxonomySkill(name, category, tuple(aliases), tuple(list_only))


TAXONOMY: List[TaxonomySkill] = [
    # --- COD: programming languages ---
    _s("Python", "COD", ["python"]),
    _s("Java", "COD", ["java"]),
    _s("C++", "COD", ["c++", "cpp"]),
    _s("C", "COD", list_only=["c"]),
    _s("C#", "COD", ["c#", "csharp"]),
    _s("JavaScript", "COD", ["javascript"], list_only=["js"]),
    _s("TypeScript", "COD", ["typescript"], list_only=["ts"]),
    _s("Go", "COD", ["golang"], list_only=["go"]),
    _s("Rust", "COD", ["rust"]),
    _s("Kotlin", "COD", ["kotlin"]),
    _s("Swift", "COD", list_only=["swift"]),
    _s("R", "COD", list_only=["r"]),
    _s("Scala", "COD", ["scala"]),
    _s("Ruby", "COD", list_only=["ruby"]),
    _s("PHP", "COD", ["php"]),
    _s("MATLAB", "COD", ["matlab"]),
    _s("Programming", "COD", list_only=["programming", "coding", "programming fundamentals"]),
    # --- DSA ---
    _s(
        "Data Structures & Algorithms",
        "DSA",
        ["data structures and algorithms", "data structures & algorithms", "competitive programming"],
        # "scheduling algorithms" or "data structures used" in a sentence is not DSA evidence
        list_only=["dsa", "data structures", "algorithms"],
    ),
    # --- OOD ---
    _s(
        "Object-Oriented Design",
        "OOD",
        ["object-oriented design", "object oriented design", "object-oriented programming", "object oriented programming", "design patterns", "solid principles"],
        list_only=["oop", "oops", "ood"],
    ),
    # --- APTI ---
    _s("Statistics", "APTI", ["statistics", "statistical analysis", "probability"]),
    _s("A/B Testing", "APTI", ["a/b testing", "a/b test", "ab testing", "experiment design"]),
    _s("Quantitative Aptitude", "APTI", ["quantitative aptitude", "logical reasoning", "quantitative reasoning", "analytical reasoning"], list_only=["aptitude"]),
    # --- COMM ---
    _s(
        "Communication",
        "COMM",
        ["communication", "communication skills", "presentation skills", "public speaking", "technical writing", "stakeholder communication"],
    ),
    # --- AI ---
    _s(
        "Machine Learning",
        "AI",
        ["machine learning", "scikit-learn", "sklearn", "logistic regression", "linear regression", "collaborative filtering", "predictive modeling", "predictive modelling", "random forest"],
        list_only=["ml"],
    ),
    _s("Deep Learning", "AI", ["deep learning", "neural networks", "neural network"]),
    _s("TensorFlow", "AI", ["tensorflow", "keras"]),
    _s("PyTorch", "AI", ["pytorch"]),
    _s("Natural Language Processing", "AI", ["natural language processing"], list_only=["nlp"]),
    _s("Computer Vision", "AI", ["computer vision", "opencv"]),
    _s("Generative AI", "AI", ["generative ai", "large language models"], list_only=["llm", "llms", "genai"]),
    _s("Artificial Intelligence", "AI", ["artificial intelligence"], list_only=["ai"]),
    # --- CLOUD ---
    _s("AWS", "CLOUD", ["aws", "amazon web services"]),
    _s("Azure", "CLOUD", ["azure", "microsoft azure"]),
    _s("Google Cloud", "CLOUD", ["gcp", "google cloud", "google cloud platform"]),
    _s("Docker", "CLOUD", ["docker"]),
    _s("Kubernetes", "CLOUD", ["kubernetes", "k8s"]),
    _s("Cloud Computing", "CLOUD", ["cloud computing", "cloud infrastructure"], list_only=["cloud"]),
    # --- SQL (databases) ---
    _s("SQL", "SQL", ["sql", "mysql", "postgresql", "postgres", "sql queries", "structured query language", "pl/sql"]),
    _s("MongoDB", "SQL", ["mongodb"]),
    _s("SQLite", "SQL", ["sqlite"]),
    _s(
        "Database Schema Design",
        "SQL",
        ["database schema design", "schema design", "normalized schema", "database design", "data modeling", "data modelling"],
        list_only=["dbms", "databases", "database"],
    ),
    # --- SWE ---
    _s("Git", "SWE", ["git", "github", "gitlab", "version control"]),
    _s(
        "Software Engineering Practices",
        "SWE",
        ["software engineering practices", "software engineering", "sdlc", "agile", "scrum", "code review", "unit testing", "integration testing", "test automation", "ci/cd", "continuous integration", "tests and ci"],
    ),
    _s("REST APIs", "SWE", ["rest api", "rest apis", "restful"], list_only=["rest"]),
    # --- SYSD ---
    _s(
        "System Design",
        "SYSD",
        ["system design", "systems design", "system-design", "distributed systems", "distributed", "scalable systems", "horizontally-scalable", "horizontally scalable", "pub-sub", "microservices", "load balancing", "caching"],
    ),
    _s("Redis", "SYSD", ["redis"]),
    # --- NETW ---
    _s(
        "Computer Networks",
        "NETW",
        ["computer networks", "computer networking", "networking", "tcp/ip", "network protocols", "ccna"],
        list_only=["networks", "cn"],
    ),
    # --- OS ---
    _s(
        "Operating Systems",
        "OS",
        ["operating systems", "operating system", "os-level", "process scheduling", "multithreading", "multithreaded", "concurrency"],
        list_only=["os"],
    ),
    _s("Linux", "OS", ["linux", "unix", "shell scripting", "bash"]),
    # --- OTHER: tools that do not belong to a scored RADIX category ---
    _s("Power BI", "OTHER", ["power bi"]),
    _s("Tableau", "OTHER", ["tableau"]),
    _s("Excel", "OTHER", ["excel", "ms excel", "microsoft excel"]),
    _s("Data Visualization", "OTHER", ["data visualization", "data visualisation", "dashboards", "dashboard"]),
    _s("Pandas", "OTHER", ["pandas"]),
    _s("NumPy", "OTHER", ["numpy"]),
    _s("Ticketing Tools", "OTHER", ["ticketing tools", "ticketing systems", "ticketing", "jira", "servicenow"]),
    _s("Technical Troubleshooting", "OTHER", ["troubleshooting", "technical troubleshooting", "application support"]),
    _s("HTML", "OTHER", ["html", "html5"]),
    _s("CSS", "OTHER", ["css", "css3", "tailwind"]),
    _s("React", "OTHER", ["react", "react.js", "reactjs"]),
    _s("Node.js", "OTHER", ["node.js", "nodejs"]),
    _s("Django", "OTHER", ["django"]),
    _s("Flask", "OTHER", ["flask"]),
    _s("FastAPI", "OTHER", ["fastapi"]),
    _s("Spring Boot", "OTHER", ["spring boot", "spring"]),
]


def clean_skill_text(raw: str) -> str:
    """Lowercase, drop parentheticals and depth words, normalise punctuation."""
    text = str(raw or "").lower()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = DEPTH_QUALIFIER_RE.sub(" ", text)
    text = re.sub(r"\b(exposure to|knowledge of|working knowledge of|experience with|familiar with|proficient in)\b", " ", text)
    text = re.sub(r"[^a-z0-9+#/.&\- ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .-")
    return text


# alias text → TaxonomySkill, for exact skills-list lookups
_LIST_LOOKUP: Dict[str, TaxonomySkill] = {}
# (compiled whole-word pattern, TaxonomySkill), for scanning sentences
_PROSE_PATTERNS: List[Tuple[re.Pattern, TaxonomySkill]] = []

for _skill in TAXONOMY:
    _LIST_LOOKUP.setdefault(clean_skill_text(_skill.name), _skill)
    for _alias in _skill.aliases + _skill.list_only:
        _LIST_LOOKUP.setdefault(_alias, _skill)
    for _alias in _skill.aliases:
        # (?<![\w+#]) / (?![\w+#]) is a "whole word" check that also works for c++ and c#
        _PROSE_PATTERNS.append((re.compile(rf"(?<![\w+#]){re.escape(_alias)}(?![\w+#])", re.IGNORECASE), _skill))

# Longest aliases first, so "machine learning" wins over shorter overlaps.
_PROSE_PATTERNS.sort(key=lambda p: len(p[0].pattern), reverse=True)


def lookup_listed_skill(raw: str) -> Optional[TaxonomySkill]:
    """Finds the taxonomy entry for one item from a Skills section, if known."""
    return _LIST_LOOKUP.get(clean_skill_text(raw))


def find_skills_in_text(text: str) -> List[TaxonomySkill]:
    """Returns every taxonomy skill mentioned (as a whole word) in a sentence."""
    found: List[TaxonomySkill] = []
    for pattern, skill in _PROSE_PATTERNS:
        if skill not in found and pattern.search(text or ""):
            found.append(skill)
    return found


def has_depth_qualifier(raw: str) -> bool:
    return bool(DEPTH_QUALIFIER_RE.search(raw or ""))
