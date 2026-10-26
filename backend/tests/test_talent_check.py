"""Comprehensive Unit and Integration Tests for Talent Check Module (Owner: Krishna Khanna).

Covers:
1. Requirements Loading & In-scope Companies (Google, Microsoft, Oracle).
2. Negative test: Never invent requirements if file is missing.
3. Candidate level estimation: item points, corroboration, depth-qualifier caps, missing evidence.
4. Readiness formula, status thresholds, priority gaps, strongest areas.
5. Dual-source profile resolution (Supabase + local fixtures).
6. ACCEPTANCE TEST: Compare two different candidate profiles against the same company
   and explain score differences and gaps across all 12 categories.
7. FastAPI API endpoints validation via TestClient.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.company_requirements import (
    load_company_skillsets,
    get_company_by_id_or_name,
    resolve_requirements_file_path,
    SCORED_RADIX_CATEGORIES,
)
from app.services.readiness_scorer import (
    estimate_category_level,
    calculate_candidate_levels,
    calculate_readiness,
    compare_candidates_readiness,
    status_for,
    ITEM_POINTS,
    BASIC_CAP,
    MAX_ESTIMATE,
)
from app.services.profile_loader import (
    get_candidate_profile,
    list_candidate_profiles,
)


@pytest.fixture
def client():
    return TestClient(app)


# -----------------------------------------------------------------------------
# 1. Company Requirements & In-Scope Companies Tests
# -----------------------------------------------------------------------------

def test_load_company_skillsets_official_file():
    """Verify that data/talent_check_company_skillsets.json loads cleanly without inventing data."""
    data = load_company_skillsets()
    assert "companies" in data
    assert len(data["companies"]) >= 3
    assert not data.get("synthetic", False)

    # Check that in-scope companies (Google, Microsoft, Oracle) exist
    google = get_company_by_id_or_name("Google", data)
    oracle = get_company_by_id_or_name("Oracle", data)
    microsoft = get_company_by_id_or_name("Microsoft", data)

    assert google["company_id"] == "4"
    assert "Google" in google["company_name"]
    assert oracle["company_id"] == "3"
    assert "Oracle" in oracle["company_name"]
    assert microsoft["company_id"] == "78"
    assert "Microsoft" in microsoft["company_name"]

    # Verify all 12 RADIX categories have numeric requirements between 0 and 10
    for comp in [google, oracle, microsoft]:
        reqs = comp["requirements"]
        for code in SCORED_RADIX_CATEGORIES:
            assert code in reqs, f"Category {code} missing in {comp['company_name']}"
            assert 0 <= reqs[code] <= 10, f"Level for {code} out of bounds in {comp['company_name']}"


def test_missing_requirements_file_never_invents_data():
    """Ensures a non-existent file raises FileNotFoundError instead of inventing requirements."""
    with pytest.raises(FileNotFoundError) as exc_info:
        load_company_skillsets("non_existent_folder/missing_file.json")
    assert "does not exist" in str(exc_info.value) or "not found" in str(exc_info.value)


# -----------------------------------------------------------------------------
# 2. Candidate Level Estimation & Scoring Rubric Tests
# -----------------------------------------------------------------------------

def test_estimate_category_level_rubric():
    # No skills -> level 0, high uncertainty
    zero = estimate_category_level([])
    assert zero["level"] == 0
    assert zero["uncertainty"] == "high"

    # Single high confidence skill -> 6 points
    one_high = estimate_category_level([{"skill_name": "Python", "confidence": "high"}])
    assert one_high["level"] == 6
    assert one_high["uncertainty"] == "medium"

    # Single medium confidence skill -> 5 points
    one_med = estimate_category_level([{"skill_name": "Python", "confidence": "medium"}])
    assert one_med["level"] == 5
    assert one_med["uncertainty"] == "medium"

    # Single low confidence skill -> 3 points, high uncertainty
    one_low = estimate_category_level([{"skill_name": "Python", "confidence": "low"}])
    assert one_low["level"] == 3
    assert one_low["uncertainty"] == "high"

    # Depth qualifier capped at 4
    basic_python = estimate_category_level([{"skill_name": "Python (basic)", "confidence": "high"}])
    assert basic_python["level"] == min(6, BASIC_CAP)

    # Corroborating items: high (6) + medium (5) + high (6) -> 6 + min(3, 2) = 8
    corroborated = estimate_category_level([
        {"skill_name": "C++", "confidence": "high"},
        {"skill_name": "Java", "confidence": "medium"},
        {"skill_name": "Python", "confidence": "high"},
    ])
    assert corroborated["level"] == 8
    assert corroborated["uncertainty"] == "low"  # >= 2 skills with a high confidence item

    # Max level capped at 9 (resume evidence alone cannot grant 10/10)
    many_skills = estimate_category_level([
        {"skill_name": "S1", "confidence": "high"},
        {"skill_name": "S2", "confidence": "high"},
        {"skill_name": "S3", "confidence": "high"},
        {"skill_name": "S4", "confidence": "high"},
        {"skill_name": "S5", "confidence": "high"},
    ])
    assert many_skills["level"] == MAX_ESTIMATE


def test_status_thresholds():
    assert status_for(required=None, estimated=5) == "not-assessed"
    assert status_for(required=0, estimated=5) == "not-required"
    assert status_for(required=7, estimated=0) == "no-evidence"
    assert status_for(required=6, estimated=6) == "meets"
    assert status_for(required=6, estimated=8) == "meets"
    assert status_for(required=7, estimated=6) == "close"  # gap = 1
    assert status_for(required=7, estimated=5) == "close"  # gap = 2
    assert status_for(required=7, estimated=4) == "gap"    # gap = 3
    assert status_for(required=9, estimated=3) == "gap"    # gap = 6


def test_readiness_score_formula_exactness():
    dummy_profile = {
        "profile_id": "test-p",
        "name": "Test Candidate",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "confidence": "high"},  # level 6
            {"skill_name": "SQL", "category_code": "SQL", "confidence": "high"},     # level 6
        ]
    }
    dummy_company = {
        "company_id": "test-c",
        "company_name": "Test Corp",
        "requirements": {
            "COD": 8,  # min(6, 8) = 6
            "SQL": 6,  # min(6, 6) = 6
            "DSA": 6,  # min(0, 6) = 0
            # total req = 8 + 6 + 6 = 20, covered = 6 + 6 + 0 = 12
            # readiness = round(100 * 12 / 20) = 60
        }
    }
    res = calculate_readiness(dummy_profile, dummy_company)
    assert res["readiness_score"] == 60
    assert len(res["skillset_gap"]) == 12


# -----------------------------------------------------------------------------
# 3. Dual-Source Profile Loader Tests
# -----------------------------------------------------------------------------

def test_profile_loader_dual_source():
    # 1. Fetch Ananya Rao (resolves from Supabase or local fixture)
    ananya = get_candidate_profile("Ananya Rao")
    assert ananya["name"] == "Ananya Rao"
    assert len(ananya["skills"]) >= 10

    # 2. Fetch Karthik Subramaniam
    karthik = get_candidate_profile("Karthik Subramaniam")
    assert karthik["name"] == "Karthik Subramaniam"
    assert any(s["skill_name"] == "SQL" for s in karthik["skills"])

    # 3. List candidates
    all_profiles = list_candidate_profiles()
    assert len(all_profiles) >= 4
    names = [p["name"] for p in all_profiles]
    assert "Ananya Rao" in names
    assert "Karthik Subramaniam" in names


# -----------------------------------------------------------------------------
# 4. ACCEPTANCE TEST: Compare two different candidate profiles against the same company
# -----------------------------------------------------------------------------

def test_acceptance_compare_two_profiles_explain_differences():
    """ACCEPTANCE CRITERIA:

    Compare two different candidate profiles against the same company and
    explain score differences and gaps across all 12 categories.
    """
    ananya = get_candidate_profile("Ananya Rao")
    karthik = get_candidate_profile("Karthik Subramaniam")
    google = get_company_by_id_or_name("Google")

    # Run comparisons
    comparison = compare_candidates_readiness(ananya, karthik, google)

    # 1. Company verification
    assert comparison["company_id"] == "4"
    assert "Google" in comparison["company_name"]

    # 2. Both candidates evaluated against same company
    cand_a = comparison["candidate_a"]
    cand_b = comparison["candidate_b"]
    assert cand_a["candidate_name"] == "Ananya Rao"
    assert cand_b["candidate_name"] == "Karthik Subramaniam"

    # 3. Score difference computed and non-zero (profiles have distinct specializations)
    assert cand_a["readiness_score"] != cand_b["readiness_score"]
    assert comparison["score_difference"] == cand_a["readiness_score"] - cand_b["readiness_score"]
    assert comparison["leader"] in ("candidate_a", "candidate_b")

    # 4. Detailed explanation of score differences exists and names key strengths and gaps
    explanation = comparison["overall_explanation"]
    assert "Ananya Rao" in explanation
    assert "Karthik Subramaniam" in explanation
    assert "readiness" in explanation.lower()
    assert "outperforms in" in explanation.lower()

    # 5. Exactly all 12 RADIX categories compared individually
    cat_comps = comparison["category_comparisons"]
    assert len(cat_comps) == 12
    compared_codes = [c["category_code"] for c in cat_comps]
    for code in SCORED_RADIX_CATEGORIES:
        assert code in compared_codes

    # 6. Verify distinct category strengths
    comp_by_code = {c["category_code"]: c for c in cat_comps}

    # Ananya (systems generalist) leads in COD, DSA, OS, OOD, NETW, SYSD
    assert comp_by_code["OS"]["leader"] == "candidate_a"
    assert comp_by_code["DSA"]["leader"] == "candidate_a"
    assert comp_by_code["OOD"]["leader"] == "candidate_a"

    # Karthik (data analyst) leads in SQL, AI, APTI
    assert comp_by_code["SQL"]["leader"] == "candidate_b"
    assert comp_by_code["AI"]["leader"] == "candidate_b"
    assert comp_by_code["APTI"]["leader"] == "candidate_b"

    # 7. Check explanation per category
    for c in cat_comps:
        assert len(c["explanation"]) > 10
        assert c["category_name"] in c["explanation"]
        assert f"required: {c['required_level']}/10" in c["explanation"].lower() or f"vs required {c['required_level']}/10" in c["explanation"].lower()


# -----------------------------------------------------------------------------
# 5. FastAPI Endpoints Integration Tests
# -----------------------------------------------------------------------------

def test_api_talent_check_endpoint(client):
    res = client.post("/api/talent-check", json={"profile_id": "Ananya Rao", "company_id": "Google"})
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "talent_check"
    assert data["candidate_name"] == "Ananya Rao"
    assert "Google" in data["company"]
    assert 0 <= data["readiness_score"] <= 100
    assert len(data["skillset_gap"]) == 12
    assert len(data["recommendations"]) > 0


def test_api_talent_check_compare_endpoint(client):
    res = client.post("/api/talent-check/compare", json={
        "profile_id_a": "Ananya Rao",
        "profile_id_b": "Karthik Subramaniam",
        "company_id": "Oracle"
    })
    assert res.status_code == 200
    data = res.json()
    assert "Oracle" in data["company_name"]
    assert data["candidate_a"]["candidate_name"] == "Ananya Rao"
    assert data["candidate_b"]["candidate_name"] == "Karthik Subramaniam"
    assert len(data["category_comparisons"]) == 12
    assert len(data["overall_explanation"]) > 50


def test_api_talent_check_companies_endpoints(client):
    # List companies
    res = client.get("/api/talent-check/companies")
    assert res.status_code == 200
    companies = res.json()
    assert len(companies) >= 3

    # Get single company (Oracle = 3)
    res_single = client.get("/api/talent-check/companies/3")
    assert res_single.status_code == 200
    oracle = res_single.json()
    assert oracle["company_id"] == "3"
    assert "Oracle" in oracle["company_name"]
    assert len(oracle["skillsets"]) == 12


def test_api_talent_check_candidates_endpoint(client):
    res = client.get("/api/talent-check/candidates")
    assert res.status_code == 200
    candidates = res.json()
    assert len(candidates) >= 4


def test_api_talent_check_not_found(client):
    # Invalid candidate
    res_p = client.post("/api/talent-check", json={"profile_id": "nonexistent-user-123", "company_id": "Google"})
    assert res_p.status_code == 404

    # Invalid company
    res_c = client.post("/api/talent-check", json={"profile_id": "Ananya Rao", "company_id": "nonexistent-company-999"})
    assert res_c.status_code == 404
