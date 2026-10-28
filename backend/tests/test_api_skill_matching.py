"""API tests for the Skill Matching endpoints."""

from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.skill_match_repository import repository

client = TestClient(app)


def test_health_check_includes_skill_matching():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "skill_matching" in data["modules_implemented"]


def test_valid_skill_match_request():
    req = {
        "profile_id": "prf_sample_ananya",
        "jd_id": "jd_sample_google_swe",
    }
    res = client.post("/api/skill-match", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "skill_match"
    assert data["profile_id"] == "prf_sample_ananya"
    assert data["jd_id"] == "jd_sample_google_swe"
    assert data["candidate_name"] == "Ananya Rao"
    assert data["company"] == "Google LLC"
    assert data["role"] == "Software Engineer (SWE)"
    assert data["match_score"] == 96.15
    assert data["scoring_status"] == "completed"
    assert len(data["matched_skills"]) > 0
    assert len(data["skill_results"]) > 0
    assert "counts" in data
    assert "recommendations" in data
    assert "summary" in data
    assert "scoring" in data
    # When Supabase credentials are not set, persisted must be False, never fake True
    assert data["persisted"] is False
    assert data["persistence_error"] is not None


def test_unknown_profile_id_returns_404():
    req = {
        "profile_id": "unknown_nonexistent_profile_id",
        "jd_id": "jd_sample_google_swe",
    }
    res = client.post("/api/skill-match", json=req)
    assert res.status_code == 404
    assert "Candidate profile 'unknown_nonexistent_profile_id' was not found" in res.json()["detail"]


def test_unknown_jd_id_returns_404():
    req = {
        "profile_id": "prf_sample_ananya",
        "jd_id": "unknown_nonexistent_jd_id",
    }
    res = client.post("/api/skill-match", json=req)
    assert res.status_code == 404
    assert "Job description 'unknown_nonexistent_jd_id' was not found" in res.json()["detail"]


def test_invalid_request_body_returns_422():
    # Missing required jd_id
    res = client.post("/api/skill-match", json={"profile_id": "prf_sample_ananya"})
    assert res.status_code == 422


def test_empty_requirements_returns_not_scored():
    # Pass inline JD with no skills
    req = {
        "profile_id": "prf_sample_ananya",
        "jd_id": "empty_jd",
        "jd_data": {
            "jd_id": "empty_jd",
            "company": "EmptyCo",
            "role": "EmptyRole",
            "skills": [],
        },
    }
    res = client.post("/api/skill-match", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["scoring_status"] == "not_scored"
    assert data["match_score"] is None
    assert "no extracted skills" in data["summary"].lower()


def test_persistence_success_with_mocked_supabase():
    mock_client = MagicMock()

    def mock_table(table_name):
        mock_t = MagicMock()
        if table_name == "skill_match_results":
            mock_t.insert.return_value.execute.return_value = MagicMock(
                data=[{"match_id": "11111111-2222-3333-4444-555555555555"}]
            )
        else:
            mock_t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        return mock_t

    mock_client.table.side_effect = mock_table

    original_client = repository._client
    try:
        repository._client = mock_client
        req = {
            "profile_id": "prf_sample_ananya",
            "jd_id": "jd_sample_google_swe",
        }
        res = client.post("/api/skill-match", json=req)
        assert res.status_code == 200
        data = res.json()
        assert data["persisted"] is True
        assert data["match_id"] == "11111111-2222-3333-4444-555555555555"
        assert data["result_id"] == "11111111-2222-3333-4444-555555555555"
        assert data["persistence_error"] is None
    finally:
        repository._client = original_client


def test_persistence_failure_handled_gracefully():
    mock_client = MagicMock()

    def mock_table(table_name):
        mock_t = MagicMock()
        if table_name == "skill_match_results":
            mock_t.insert.side_effect = Exception("Supabase connection timeout")
        else:
            mock_t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        return mock_t

    mock_client.table.side_effect = mock_table

    original_client = repository._client
    try:
        repository._client = mock_client
        req = {
            "profile_id": "prf_sample_ananya",
            "jd_id": "jd_sample_google_swe",
        }
        res = client.post("/api/skill-match", json=req)
        # Should not crash the API endpoint; returns 200 with persisted=False and error
        assert res.status_code == 200
        data = res.json()
        assert data["persisted"] is False
        assert data["match_id"] is None
        assert "Supabase connection timeout" in data["persistence_error"]
    finally:
        repository._client = original_client
