"""Isolated unit tests for Profile Builder without external database dependencies."""

from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.api.profiles import profile_repository
from app.schemas.contracts import Profile, Skill, ResumeReference

client = TestClient(app)


def test_isolated_profile_validation_rejects_empty_name():
    res = client.post("/api/profiles", json={"name": "   "})
    assert res.status_code == 422
    errors = res.json()["detail"]
    assert any("Candidate name cannot be empty" in str(e) for e in errors)


def test_isolated_profile_validation_rejects_invalid_email():
    res = client.post(
        "/api/profiles",
        json={"name": "Valid Name", "email": "not-an-email"},
    )
    assert res.status_code == 422
    errors = res.json()["detail"]
    assert any("Enter a valid email address" in str(e) for e in errors)


def test_isolated_profile_validation_rejects_invalid_category_code():
    res = client.post(
        "/api/profiles",
        json={
            "name": "Valid Name",
            "skills": [
                {"skill_name": "Python", "category_code": "INVALID", "confidence": "high"}
            ],
        },
    )
    assert res.status_code == 422


def test_isolated_profile_validation_rejects_invalid_confidence():
    res = client.post(
        "/api/profiles",
        json={
            "name": "Valid Name",
            "skills": [
                {"skill_name": "Python", "category_code": "COD", "confidence": "expert"}
            ],
        },
    )
    assert res.status_code == 422


def test_isolated_mocked_repository_get_profile(monkeypatch):
    mock_profile = Profile(
        profile_id="prf_mocked_123",
        name="Mocked Candidate",
        email="mocked@example.com",
        skills=[Skill(skill_name="Go", category_code="COD", confidence="high")],
    )
    monkeypatch.setattr(profile_repository, "get_by_id", lambda pid: mock_profile if pid == "prf_mocked_123" else None)

    res = client.get("/api/profiles/prf_mocked_123")
    assert res.status_code == 200
    assert res.json()["name"] == "Mocked Candidate"

    res_404 = client.get("/api/profiles/prf_unknown")
    assert res_404.status_code == 404


def test_isolated_mocked_repository_database_error(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("Connection lost to Postgres")

    monkeypatch.setattr(profile_repository, "list_all", boom)

    res = client.get("/api/profiles")
    assert res.status_code == 500
    assert "Database error" in res.json()["detail"]
