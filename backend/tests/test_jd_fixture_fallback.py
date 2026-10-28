"""The labelled sample-fixture fallback must never turn an unrelated JD into a "successful" analysis.

conftest.py clears every LLM key, so extraction always fails here and the fallback path is exercised.
"""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.db.fixtures import find_jd_fixture
from app.main import app
from tests.resume_samples import PDF_TYPE, make_pdf

client = TestClient(app)


def no_db():
    return (
        patch("app.jd_service.db.get_canonical_skills", return_value=[]),
        patch("app.jd_service.db.get_proficiency_levels", return_value=[]),
    )


def test_empty_identifier_matches_no_fixture():
    assert find_jd_fixture("") is None
    assert find_jd_fixture("   ") is None
    assert find_jd_fixture("jd_sample_google_swe")["company"].startswith("Google")
    assert find_jd_fixture("google-swe") is not None


def test_pasted_text_without_llm_returns_503_not_a_sample_analysis():
    a, b = no_db()
    with a, b:
        res = client.post("/api/jd/analyze", json={"text": "We are hiring a backend engineer with Python, SQL and Docker."})
    assert res.status_code == 503
    body = res.json()
    assert "Google" not in res.text
    assert "GROQ_API_KEY" in body["detail"]


def test_unrelated_upload_without_llm_returns_503():
    a, b = no_db()
    with a, b:
        res = client.post("/api/jd/analyze", files={"file": ("Acme Corp - Backend.pdf", make_pdf(["Acme Corp", "Backend engineer", "Python and SQL"]), PDF_TYPE)})
    assert res.status_code == 503


def test_known_sample_upload_without_llm_uses_its_labelled_fixture():
    a, b = no_db()
    with a, b:
        res = client.post(
            "/api/jd/analyze",
            files={"file": ("Google LLC - Software Engineer.pdf", make_pdf(["Google LLC", "Software Engineer", "Data structures"]), PDF_TYPE)},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["company"].startswith("Google")
    assert "sample fixture" in body["analysis_notes"]
