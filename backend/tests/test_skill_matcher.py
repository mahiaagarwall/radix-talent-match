"""Unit tests for the Skill Matching algorithm.

Covers exact, case, alias, partial, missing, duplicates, weights, confidence,
boundaries, rounding, empty requirements, and 3 hand-calculated test cases.
"""

import pytest
from app.services.skill_matcher import match_skills
from app.schemas.skill_match import ScoringWeights


def test_exact_skill_match():
    profile = {
        "profile_id": "test_p",
        "name": "Jane Dev",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "evidence": "Built REST API"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "Python Developer",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required", "evidence": "Must know Python"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 100.0
    assert res.scoring_status == "completed"
    assert res.counts.matched == 1
    assert res.counts.partial == 0
    assert res.counts.missing == 0
    assert "Python" in res.matched_skills
    assert res.skill_results[0].match_value == 1.0


def test_case_insensitive_and_whitespace_match():
    profile = {
        "profile_id": "test_p",
        "name": "Jane Dev",
        "skills": [
            {"skill_name": "  pYtHoN  ", "category_code": "COD", "confidence": "high", "evidence": "Scripts"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "Developer",
        "skills": [
            {"skill_name": "PYTHON", "category_code": "COD", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 100.0
    assert res.counts.matched == 1


def test_approved_aliases_match():
    profile = {
        "profile_id": "test_p",
        "name": "Jane Dev",
        "skills": [
            {"skill_name": "PostgreSQL", "category_code": "SQL", "confidence": "high", "evidence": "DB admin"},
            {"skill_name": "OOP", "category_code": "OOD", "confidence": "high", "evidence": "Class architecture"},
            {"skill_name": "DSA", "category_code": "DSA", "confidence": "high", "evidence": "LeetCode"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "Backend Engineer",
        "skills": [
            {"skill_name": "SQL", "category_code": "SQL", "confidence": "high", "requirement": "required"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Data Structures and Algorithms", "category_code": "DSA", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 100.0
    assert res.counts.matched == 3


def test_depth_qualifier_yields_partial():
    profile = {
        "profile_id": "test_p",
        "name": "Junior Dev",
        "skills": [
            {"skill_name": "Python (basic)", "category_code": "COD", "confidence": "high", "evidence": "1 course"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "Backend Engineer",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 50.0
    assert res.counts.matched == 0
    assert res.counts.partial == 1
    assert "Python" in res.partial_skills
    assert "basic-level" in res.skill_results[0].reason


def test_low_confidence_yields_partial():
    profile = {
        "profile_id": "test_p",
        "name": "Candidate",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "low", "evidence": "Indirect mention"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "Dev",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 50.0
    assert res.counts.partial == 1
    assert "uncertain" in res.skill_results[0].reason


def test_broad_competency_rule():
    profile = {
        "profile_id": "test_p",
        "name": "Candidate",
        "skills": [
            {"skill_name": "C++", "category_code": "COD", "confidence": "high", "evidence": "Systems code"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Google",
        "role": "SWE",
        "skills": [
            {"skill_name": "Programming", "category_code": "COD", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 100.0
    assert res.counts.matched == 1
    assert "Coding evidence" in res.skill_results[0].reason


def test_related_category_skill_yields_partial():
    profile = {
        "profile_id": "test_p",
        "name": "Candidate",
        "skills": [
            # Candidate has Docker (SWE category)
            {"skill_name": "Unit Testing", "category_code": "SWE", "confidence": "high", "evidence": "pytest"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "DevOps",
        "skills": [
            # JD wants CI/CD (which maps to software engineering practices) or another SWE skill
            {"skill_name": "Incident Management", "category_code": "SWE", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 50.0
    assert res.counts.partial == 1
    assert "related Software Engineering skills" in res.skill_results[0].reason


def test_missing_skill():
    profile = {
        "profile_id": "test_p",
        "name": "Candidate",
        "skills": [
            {"skill_name": "Java", "category_code": "COD", "confidence": "high"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme Corp",
        "role": "Cloud Architect",
        "skills": [
            {"skill_name": "AWS", "category_code": "CLOUD", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 0.0
    assert res.counts.missing == 1
    assert "AWS" in res.missing_skills


def test_duplicate_skills_deduplication():
    profile = {
        "profile_id": "test_p",
        "name": "Candidate",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "low", "evidence": "Class project"},
            {"skill_name": "python", "category_code": "COD", "confidence": "high", "evidence": "Production backend"},
        ],
    }
    jd = {
        "jd_id": "test_jd",
        "company": "Acme",
        "role": "Dev",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    # Both sides deduplicated, so only 1 requirement evaluated
    assert len(res.skill_results) == 1
    assert res.match_score == 100.0


def test_empty_candidate_skills():
    profile = {"profile_id": "empty_p", "name": "No Skills", "skills": []}
    jd = {
        "jd_id": "test_jd",
        "company": "Acme",
        "role": "Dev",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required"},
            {"skill_name": "SQL", "category_code": "SQL", "confidence": "high", "requirement": "required"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.match_score == 0.0
    assert res.counts.missing == 2
    assert res.scoring_status == "completed"


def test_empty_jd_requirements_yields_not_scored():
    profile = {
        "profile_id": "p1",
        "name": "Jane",
        "skills": [{"skill_name": "Python", "category_code": "COD", "confidence": "high"}],
    }
    jd = {"jd_id": "jd1", "company": "Acme", "role": "Empty JD", "skills": []}
    res = match_skills(profile, jd)
    assert res.match_score is None
    assert res.scoring_status == "not_scored"
    assert "no extracted skills" in res.summary.lower()


def test_deterministic_results():
    profile = {
        "profile_id": "p1",
        "name": "Candidate",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "evidence": "Backend"},
            {"skill_name": "Docker", "category_code": "SWE", "confidence": "medium", "evidence": "Containers"},
        ],
    }
    jd = {
        "jd_id": "jd1",
        "company": "Acme",
        "role": "Dev",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Kubernetes", "category_code": "CLOUD", "confidence": "medium", "requirement": "preferred"},
        ],
    }
    res1 = match_skills(profile, jd)
    res2 = match_skills(profile, jd)
    assert res1.match_score == res2.match_score
    assert res1.counts.matched == res2.counts.matched
    assert res1.counts.partial == res2.counts.partial
    assert res1.counts.missing == res2.counts.missing


# ==============================================================================
# THREE HAND-CALCULATED SCORING EXAMPLES
# ==============================================================================


def test_hand_calculated_example_1_ananya_vs_google_swe():
    """
    Example 1: Ananya Rao vs Google SWE
    Weights: 6 required (w=1.0) + 1 preferred (w=0.5) -> Total weight = 6.5
    Results:
      1. DSA: matched (m=1.0) -> earned 1.0
      2. Programming: matched (m=1.0 via C++ in COD) -> earned 1.0
      3. OOD: matched (m=1.0) -> earned 1.0
      4. OS: matched (m=1.0) -> earned 1.0
      5. System Design: matched (m=1.0) -> earned 1.0
      6. SWE Practices: matched (m=1.0) -> earned 1.0
      7. Communication: partial (m=0.5, low confidence on candidate) -> earned 0.5 * 0.5 = 0.25
    Total Earned: 6.25
    Expected Score: round(100 * 6.25 / 6.5, 2) = round(96.1538..., 2) = 96.15
    """
    profile = {
        "profile_id": "ananya",
        "name": "Ananya Rao",
        "skills": [
            {"skill_name": "C++", "category_code": "COD", "confidence": "high", "evidence": "Scheduler"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "confidence": "high", "evidence": "350+ CP problems"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "confidence": "high", "evidence": "Parking lot design"},
            {"skill_name": "Operating Systems", "category_code": "OS", "confidence": "high", "evidence": "OS process simulation"},
            {"skill_name": "System Design", "category_code": "SYSD", "confidence": "medium", "evidence": "URL shortener"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "confidence": "medium", "evidence": "Shipped rate limiter"},
            {"skill_name": "Communication", "category_code": "COMM", "confidence": "low", "evidence": "Mentors juniors"},
        ],
    }
    jd = {
        "jd_id": "google-swe",
        "company": "Google LLC",
        "role": "Software Engineer (SWE)",
        "skills": [
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "confidence": "high", "requirement": "required"},
            {"skill_name": "Programming", "category_code": "COD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Operating Systems", "category_code": "OS", "confidence": "high", "requirement": "required"},
            {"skill_name": "System Design", "category_code": "SYSD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "confidence": "medium", "requirement": "required"},
            {"skill_name": "Communication", "category_code": "COMM", "confidence": "medium", "requirement": "preferred"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.counts.matched == 6
    assert res.counts.partial == 1
    assert res.counts.missing == 0
    assert res.match_score == 96.15


def test_hand_calculated_example_2_rohan_vs_google_swe():
    """
    Example 2: Rohan Verma vs Google SWE
    Weights: 6 required (w=1.0) + 1 preferred (w=0.5) -> Total weight = 6.5
    Results:
      1. DSA: missing (m=0.0) -> earned 0.0
      2. Programming: partial (m=0.5, candidate has 'Python (basic)' with low confidence) -> earned 1.0 * 0.5 = 0.5
      3. OOD: missing (m=0.0) -> earned 0.0
      4. OS: missing (m=0.0) -> earned 0.0
      5. System Design: missing (m=0.0) -> earned 0.0
      6. SWE Practices: missing (m=0.0) -> earned 0.0
      7. Communication: matched (m=1.0, medium confidence) -> earned 0.5 * 1.0 = 0.5
    Total Earned: 1.0
    Expected Score: round(100 * 1.0 / 6.5, 2) = round(15.3846..., 2) = 15.38
    """
    profile = {
        "profile_id": "rohan",
        "name": "Rohan Verma",
        "skills": [
            {"skill_name": "Python (basic)", "category_code": "COD", "confidence": "low", "evidence": "Intro Python"},
            {"skill_name": "Communication", "category_code": "COMM", "confidence": "medium", "evidence": "Class representative"},
        ],
    }
    jd = {
        "jd_id": "google-swe",
        "company": "Google LLC",
        "role": "Software Engineer (SWE)",
        "skills": [
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "confidence": "high", "requirement": "required"},
            {"skill_name": "Programming", "category_code": "COD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Operating Systems", "category_code": "OS", "confidence": "high", "requirement": "required"},
            {"skill_name": "System Design", "category_code": "SYSD", "confidence": "high", "requirement": "required"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "confidence": "medium", "requirement": "required"},
            {"skill_name": "Communication", "category_code": "COMM", "confidence": "medium", "requirement": "preferred"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.counts.matched == 1
    assert res.counts.partial == 1
    assert res.counts.missing == 5
    assert res.match_score == 15.38


def test_hand_calculated_example_3_mixed_aliases_and_related_category():
    """
    Example 3: Mixed Weights, Aliases & Related Category Match
    Requirements:
      1. 'OOP' (OOD, req, w=1.0) -> Candidate has 'Design Patterns' (OOD, high) -> alias match -> m=1.0, earned=1.0
      2. 'PostgreSQL' (SQL, req, w=1.0) -> Candidate has 'MySQL' (SQL, high) -> alias match -> m=1.0, earned=1.0
      3. 'Azure' (CLOUD, pref, w=0.5) -> Candidate has no CLOUD -> missing -> m=0.0, earned=0.0
      4. 'Incident Management' (SWE, pref, w=0.5) -> Candidate has 'Unit Testing' (SWE, med) -> related cat -> m=0.5, earned=0.25
    Total weight = 1.0 + 1.0 + 0.5 + 0.5 = 3.0
    Total earned = 1.0 + 1.0 + 0.0 + 0.25 = 2.25
    Expected Score: round(100 * 2.25 / 3.0, 2) = 75.0
    """
    profile = {
        "profile_id": "dev_x",
        "name": "Dev X",
        "skills": [
            {"skill_name": "Design Patterns", "category_code": "OOD", "confidence": "high", "evidence": "Factory pattern"},
            {"skill_name": "MySQL", "category_code": "SQL", "confidence": "high", "evidence": "Complex joins"},
            {"skill_name": "Unit Testing", "category_code": "SWE", "confidence": "medium", "evidence": "Test suites"},
        ],
    }
    jd = {
        "jd_id": "jd_custom",
        "company": "Tech Innovations",
        "role": "Systems Developer",
        "skills": [
            {"skill_name": "OOP", "category_code": "OOD", "confidence": "high", "requirement": "required"},
            {"skill_name": "PostgreSQL", "category_code": "SQL", "confidence": "high", "requirement": "required"},
            {"skill_name": "Azure", "category_code": "CLOUD", "confidence": "medium", "requirement": "preferred"},
            {"skill_name": "Incident Management", "category_code": "SWE", "confidence": "medium", "requirement": "preferred"},
        ],
    }
    res = match_skills(profile, jd)
    assert res.counts.matched == 2
    assert res.counts.partial == 1
    assert res.counts.missing == 1
    assert res.match_score == 75.0
