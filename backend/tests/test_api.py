"""POST /api/resumes/parse and GET /api/resumes/{id} through FastAPI's TestClient."""

import pytest
from fastapi.testclient import TestClient

import app.db.resume_repository as repo
from app.main import app
from app.services import llm_service
from app.services.llm_service import LLMError
from conftest import sample_bytes

client = TestClient(app)
CONTRACT_KEYS = {
    "source_type", "source_file", "name", "email", "headline", "education", "skills", "projects",
    "internships", "hackathons", "certifications", "achievements", "preferred_roles", "resume_reference",
}


def upload(name, data, content_type="application/pdf"):
    return client.post("/api/resumes/parse", files={"file": (name, data, content_type)})


def test_parse_pdf_returns_contract_json():
    res = upload("Ananya Rao.pdf", sample_bytes("Ananya Rao", "pdf"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == CONTRACT_KEYS
    assert body["source_type"] == "resume" and body["source_file"] == "Ananya Rao.pdf"
    assert body["resume_reference"] is None  # persistence disabled in tests
    assert all(set(s) == {"skill_name", "category_code", "evidence", "confidence"} for s in body["skills"])


def test_parse_docx():
    data = sample_bytes("Priya Menon", "docx")
    res = upload("Priya Menon.docx", data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    assert res.status_code == 200 and res.json()["name"] == "Priya Menon"


@pytest.mark.parametrize(
    "name,data,fragment",
    [
        ("cv.txt", b"hello", "not a PDF or DOCX"),
        ("cv.pdf", b"", "empty"),
        ("cv.pdf", b"garbage", "not a valid PDF"),
    ],
)
def test_bad_files_get_400(name, data, fragment):
    res = upload(name, data)
    assert res.status_code == 400
    assert fragment in res.json()["detail"]


def test_saves_when_persistence_enabled(monkeypatch):
    monkeypatch.setenv("SAVE_PARSED_RESUMES", "true")
    saved = {}

    def fake_save(parsed, file_bytes, mode, source_tag="upload"):
        saved.update(parsed=parsed, mode=mode)
        return {"resume_id": "abc-123", "created": True}

    monkeypatch.setattr(repo, "save_parsed_resume", fake_save)
    res = upload("Rohan Verma.pdf", sample_bytes("Rohan Verma", "pdf"))
    assert res.status_code == 200
    assert res.json()["resume_reference"] == "abc-123"
    assert saved["mode"] == "rules" and saved["parsed"]["name"] == "Rohan Verma"


def test_database_failure_is_not_reported_as_success(monkeypatch):
    monkeypatch.setenv("SAVE_PARSED_RESUMES", "true")

    def failing_save(*a, **k):
        raise repo.ResumeStorageError("relation parsed_resumes does not exist")

    monkeypatch.setattr(repo, "save_parsed_resume", failing_save)
    res = upload("Ananya Rao.pdf", sample_bytes("Ananya Rao", "pdf"))
    assert res.status_code == 503
    assert "NOT saved" in res.json()["detail"]


def test_llm_failure_returns_502(monkeypatch):
    monkeypatch.setattr(llm_service, "is_configured", lambda: True)

    def broken(prompt):
        raise LLMError("Gemini returned HTTP 429")

    monkeypatch.setattr(llm_service, "generate_json", broken)
    res = upload("Ananya Rao.pdf", sample_bytes("Ananya Rao", "pdf"))
    assert res.status_code == 502


def test_get_resume_found_and_missing(monkeypatch):
    monkeypatch.setattr(repo, "get_parsed_resume", lambda rid: {"name": "Ananya Rao", "resume_reference": rid} if rid == "abc" else None)
    assert client.get("/api/resumes/abc").json()["resume_reference"] == "abc"
    assert client.get("/api/resumes/nope").status_code == 404
