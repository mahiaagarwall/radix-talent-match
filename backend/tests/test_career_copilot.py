"""Tests for Career Copilot (Job Finder & Resume Coach)."""

import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.career_copilot import JobRecommendationRequest, ResumeCoachRequest
from app.services.job_finder import recommend_jobs
from app.services.resume_coach import _rule_based_enhance, improve_resume_bullet


@pytest.fixture
def client():
    return TestClient(app)


# ── Job Finder Unit Tests ───────────────────────────────────────────────────

def test_job_finder_with_sample_fixture():
    req = JobRecommendationRequest(profile_id="prf_sample_ananya", limit=5)
    resp = recommend_jobs(req)

    assert resp.candidate_name == "Ananya Rao"
    assert resp.total_jobs_evaluated >= 4
    assert len(resp.matches) > 0

    top_match = resp.matches[0]
    assert top_match.overall_score > 0
    assert top_match.overall_score <= 100
    assert top_match.match_tier in ["Strong Match", "Good Match", "Moderate Match", "Growth Opportunity"]
    assert top_match.breakdown.required_skills_match >= 0
    assert len(top_match.rationale) > 10
    assert len(top_match.limitations) > 0


def test_job_finder_role_filter():
    req = JobRecommendationRequest(
        profile_id="prf_sample_karthik",
        role_filter="Data Scientist",
        limit=5,
    )
    resp = recommend_jobs(req)
    assert len(resp.matches) >= 1
    assert any("Data Scientist" in m.role for m in resp.matches)


def test_job_finder_custom_profile():
    custom_profile = {
        "name": "Jane Doe",
        "skills": ["Python", "SQL", "Machine Learning"],
        "preferred_roles": ["Data Analyst", "Data Scientist"],
        "projects": [
            {
                "title": "Customer Segmentation",
                "description": "Clustered users using K-Means and SQL pipelines",
                "tech_stack": ["Python", "SQL", "Scikit-Learn"],
            }
        ],
    }
    req = JobRecommendationRequest(candidate_profile=custom_profile, limit=3)
    resp = recommend_jobs(req)

    assert resp.candidate_name == "Jane Doe"
    assert len(resp.matches) > 0
    assert "Python" in resp.matches[0].matching_skills or "SQL" in resp.matches[0].matching_skills


# ── Resume Coach Unit Tests ─────────────────────────────────────────────────

def test_resume_coach_rule_based_passive_openers():
    bullet = "worked on implementing authentication service in order to improve security"
    resp = _rule_based_enhance(bullet)

    assert resp.rule_based_fallback is True
    # Should replace "worked on" with "Engineered"
    assert resp.improved_bullet.startswith("Engineered")
    # Should eliminate filler "in order to"
    assert "in order to" not in resp.improved_bullet
    # Guaranteed anti-fabrication
    assert any("invent" in claim.lower() for claim in resp.unsupported_claims_avoided)
    assert len(resp.follow_up_questions) > 0


def test_resume_coach_anti_fabrication_preservation():
    bullet = "Responsible for writing unit tests for payment APIs"
    resp = _rule_based_enhance(bullet)

    # Should not inject fake numbers like "boosted coverage by 90%" or "saved $20,000"
    for forbidden in ["%", "$", "reduced by", "saved", "increased by"]:
        assert forbidden not in resp.improved_bullet

    assert resp.improved_bullet.startswith("Executed")
    assert "payment APIs" in resp.improved_bullet


def test_resume_coach_service_fallback():
    req = ResumeCoachRequest(
        bullet="helped with setting up Docker containers and CI/CD pipelines",
        role_context="DevOps Engineer",
    )
    resp = improve_resume_bullet(req)
    assert resp.rule_based_fallback is True
    assert "Contributed to" in resp.improved_bullet or "Docker" in resp.improved_bullet
    assert len(resp.strengths_identified) > 0
    assert len(resp.improvements_made) > 0


# ── Career Copilot API Endpoint Tests ───────────────────────────────────────

def test_api_recommend_jobs(client):
    payload = {
        "profile_id": "prf_sample_ananya",
        "limit": 5,
    }
    response = client.post("/api/career-copilot/jobs/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "candidate_name" in data
    assert "matches" in data
    assert len(data["matches"]) > 0
    assert "overall_score" in data["matches"][0]


def test_api_available_jobs(client):
    response = client.get("/api/career-copilot/jobs/available")
    assert response.status_code == 200
    jobs = response.json()
    assert isinstance(jobs, list)
    assert len(jobs) >= 4
    assert any("company" in j for j in jobs)


def test_api_resume_coach_improve(client):
    payload = {
        "bullet": "was responsible for database optimization and query indexing",
        "role_context": "Database Engineer",
    }
    response = client.post("/api/career-copilot/resume-coach/improve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "improved_bullet" in data
    assert "strengths_identified" in data
    assert "improvements_made" in data
    assert "unsupported_claims_avoided" in data
    assert "follow_up_questions" in data
    assert "Spearheaded" in data["improved_bullet"]
