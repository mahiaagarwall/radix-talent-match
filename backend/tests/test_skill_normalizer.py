"""Tests for skill normalization and alias resolution."""

from app.services.skill_normalizer import (
    canonical_skill_name,
    has_depth_qualifier,
    is_generic_competency,
    dedupe_skills,
    clean_name,
)


def test_canonical_skill_name_exact_and_case():
    assert canonical_skill_name("Python") == "python"
    assert canonical_skill_name("python") == "python"
    assert canonical_skill_name("  JAVA  ") == "java"


def test_canonical_skill_name_aliases():
    # COD aliases
    assert canonical_skill_name("Coding") == "programming"
    assert canonical_skill_name("Software Development") == "programming"
    assert canonical_skill_name("hands-on programming") == "programming"

    # DSA aliases
    assert canonical_skill_name("DSA") == "data structures and algorithms"
    assert canonical_skill_name("Data Structures") == "data structures and algorithms"
    assert canonical_skill_name("algorithms") == "data structures and algorithms"

    # OOD aliases
    assert canonical_skill_name("OOP") == "object-oriented design"
    assert canonical_skill_name("OOPS") == "object-oriented design"
    assert canonical_skill_name("Design Patterns") == "object-oriented design"
    assert canonical_skill_name("Solid Principles") == "object-oriented design"

    # SQL aliases
    assert canonical_skill_name("PostgreSQL") == "sql"
    assert canonical_skill_name("MySQL") == "sql"
    assert canonical_skill_name("SQL Queries") == "sql"

    # CLOUD aliases
    assert canonical_skill_name("AWS") == "cloud infrastructure"
    assert canonical_skill_name("Azure") == "cloud infrastructure"
    assert canonical_skill_name("Google Cloud") == "cloud infrastructure"

    # NETW & OS aliases
    assert canonical_skill_name("Computer Networks") == "networking"
    assert canonical_skill_name("OS") == "operating systems"
    assert canonical_skill_name("Linux Command Line") == "linux"
    assert canonical_skill_name("cpp") == "c++"


def test_whitespace_and_punctuation_normalization():
    assert canonical_skill_name("  C++  ") == "c++"
    assert canonical_skill_name("Data Structures & Algorithms") == "data structures and algorithms"
    assert canonical_skill_name("A/B Testing") == "a/b testing"
    assert canonical_skill_name("CI/CD") == "software engineering practices"


def test_depth_qualifiers_detection():
    assert has_depth_qualifier("Python (basic)") is True
    assert has_depth_qualifier("Fundamentals of DSA") is True
    assert has_depth_qualifier("Exposure to AWS") is True
    assert has_depth_qualifier("Beginner Java") is True
    assert has_depth_qualifier("Advanced Python") is False
    assert has_depth_qualifier("Python") is False


def test_clean_name_strips_qualifiers_and_noise():
    # clean_name strips "basic", "knowledge of", "strong", etc.
    assert clean_name("Basic Python") == "python"
    assert clean_name("Working knowledge of SQL") == "sql"
    assert clean_name("Strong C++") == "c++"


def test_generic_competencies():
    assert is_generic_competency("Programming") is True
    assert is_generic_competency("Coding") is True
    assert is_generic_competency("Communication") is True
    assert is_generic_competency("Quantitative Aptitude") is True
    assert is_generic_competency("Docker") is False


def test_dedupe_skills():
    skills = [
        {"skill_name": "Python", "confidence": "low", "evidence": "Coursework", "category_code": "COD"},
        {"skill_name": "python", "confidence": "high", "evidence": "Production backend", "category_code": "COD"},
        {"skill_name": "SQL (basic)", "confidence": "medium", "evidence": "Queries in lab", "category_code": "SQL"},
        {"skill_name": "PostgreSQL", "confidence": "high", "evidence": "Database tuning", "category_code": "SQL"},
    ]
    deduped = dedupe_skills(skills)
    assert len(deduped) == 2

    # Check python merged: confidence should be high, evidence combined
    py = next(s for s in deduped if canonical_skill_name(s["skill_name"]) == "python")
    assert py["confidence"] == "high"
    assert "Coursework" in py["evidence"]
    assert "Production backend" in py["evidence"]

    # Check SQL merged
    sql = next(s for s in deduped if canonical_skill_name(s["skill_name"]) == "sql")
    assert sql["confidence"] == "high"
