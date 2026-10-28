"""Tests for Profile Builder endpoints and database integration."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.contracts import Profile, Skill, ResumeReference
from app.db.profiles import profile_repository

client = TestClient(app)


def sample_profile_payload():
    return {
        "name": "Ananya Rao",
        "email": "ananya.rao@example.com",
        "education": [
            {
                "degree": "B.Tech",
                "field": "Computer Science and Engineering",
                "institution": "National Institute of Technology",
                "graduation_year": "2026",
                "grade": "CGPA 8.6 / 10",
            }
        ],
        "skills": [
            {
                "skill_name": "Python",
                "category_code": "COD",
                "evidence": "Built backend services in Python",
                "confidence": "high",
            },
            {
                "skill_name": "PostgreSQL",
                "category_code": "SQL",
                "evidence": "Designed schema and queries",
                "confidence": "medium",
            },
        ],
        "projects": [
            {
                "title": "Talent Match Engine",
                "description": "Multi-category matching platform",
            }
        ],
        "internships": [
            {
                "role": "Software Engineering Intern",
                "organization": "Acme Tech",
                "description": "Implemented microservice APIs",
            }
        ],
        "hackathons": [
            {
                "name": "Smart India Hackathon",
                "result": "Finalist",
                "description": "Built candidate scoring pipeline",
            }
        ],
        "certifications": [
            {
                "name": "AWS Certified Cloud Practitioner",
                "issuer": "Amazon Web Services",
            }
        ],
        "preferred_roles": ["Backend Engineer", "Software Engineer"],
        "resume_reference": {
            "file_name": "Ananya Rao.pdf",
            "file_type": "pdf",
            "file_size": 113995,
            "storage_path": "data/resumes/pdf/Ananya Rao.pdf",
            "source": "upload",
        },
    }


def test_create_valid_profile_and_stable_id():
    payload = sample_profile_payload()
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["profile_id"] is not None
    assert data["profile_id"].startswith("prf_")
    assert data["name"] == "Ananya Rao"
    assert data["email"] == "ananya.rao@example.com"
    assert len(data["skills"]) == 2
    assert len(data["education"]) == 1
    assert len(data["projects"]) == 1
    assert len(data["internships"]) == 1
    assert len(data["hackathons"]) == 1
    assert len(data["certifications"]) == 1
    assert data["preferred_roles"] == ["Backend Engineer", "Software Engineer"]
    assert data["resume_reference"]["file_name"] == "Ananya Rao.pdf"
    assert "created_at" in data
    assert "updated_at" in data


def test_reject_invalid_profile():
    # 1. Missing name
    response = client.post("/api/profiles", json={"name": ""})
    assert response.status_code == 422

    # 2. Invalid email format
    payload = sample_profile_payload()
    payload["email"] = "invalid-email"
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 422

    # 3. Invalid skill category code
    payload = sample_profile_payload()
    payload["skills"] = [
        {
            "skill_name": "Python",
            "category_code": "INVALID_CODE",
            "confidence": "high",
        }
    ]
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 422

    # 4. Empty skill name
    payload = sample_profile_payload()
    payload["skills"] = [
        {
            "skill_name": "  ",
            "category_code": "COD",
            "confidence": "high",
        }
    ]
    response = client.post("/api/profiles", json=payload)
    assert response.status_code == 422


def test_get_profile_by_id():
    payload = sample_profile_payload()
    create_res = client.post("/api/profiles", json=payload)
    assert create_res.status_code == 201
    profile_id = create_res.json()["profile_id"]

    get_res = client.get(f"/api/profiles/{profile_id}")
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["profile_id"] == profile_id
    assert retrieved["name"] == payload["name"]
    assert retrieved["education"][0]["degree"] == "B.Tech"
    assert retrieved["skills"][0]["skill_name"] == "Python"


def test_get_nonexistent_profile_returns_404():
    response = client.get("/api/profiles/prf_nonexistent_999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_profile_field_preserves_id_and_unrelated_fields():
    payload = sample_profile_payload()
    create_res = client.post("/api/profiles", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    profile_id = created["profile_id"]

    # Update only the name and preferred_roles
    patch_payload = {
        "name": "Ananya R.",
        "preferred_roles": ["Full Stack Engineer"],
    }
    patch_res = client.patch(f"/api/profiles/{profile_id}", json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()

    # ID must NOT have changed
    assert updated["profile_id"] == profile_id
    assert updated["name"] == "Ananya R."
    assert updated["preferred_roles"] == ["Full Stack Engineer"]

    # Unrelated fields must be preserved
    assert updated["email"] == created["email"]
    assert updated["education"] == created["education"]
    assert updated["projects"] == created["projects"]
    assert updated["internships"] == created["internships"]
    assert updated["hackathons"] == created["hackathons"]
    assert updated["certifications"] == created["certifications"]
    assert len(updated["skills"]) == len(created["skills"])
    assert updated["resume_reference"] == created["resume_reference"]
    assert updated["created_at"] == created["created_at"]


def test_update_nonexistent_profile_returns_404():
    response = client.patch("/api/profiles/prf_nonexistent_8888", json={"name": "Ghost"})
    assert response.status_code == 404


def test_list_profiles():
    # Create two profiles
    p1 = sample_profile_payload()
    p1["name"] = "Candidate One"
    client.post("/api/profiles", json=p1)

    p2 = sample_profile_payload()
    p2["name"] = "Candidate Two"
    client.post("/api/profiles", json=p2)

    res = client.get("/api/profiles")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert len(items) >= 2
    names = [p["name"] for p in items]
    assert "Candidate One" in names
    assert "Candidate Two" in names


def test_delete_profile():
    payload = sample_profile_payload()
    payload["name"] = "Temporary Candidate"
    res = client.post("/api/profiles", json=payload)
    pid = res.json()["profile_id"]

    del_res = client.delete(f"/api/profiles/{pid}")
    assert del_res.status_code == 200

    # Getting after deletion must return 404
    get_res = client.get(f"/api/profiles/{pid}")
    assert get_res.status_code == 404
