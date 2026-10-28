"""Tests for Resume Parsing (Owner: Mahi Aggarwal).

Covers:
1. File validation and text extraction (PDF, DOCX, corrupted, encrypted, scanned, empty, too large).
2. Parsing: name, email, education, skills (category, evidence, confidence), optional sections.
3. POST /api/resumes/parse: success, schema compliance, error codes, no leaked internals.
4. Supabase persistence: success, re-upload, failure, disabled, skipped — with a fake
   database connection, so these tests never touch the real database.

Every resume used here is synthetic (tests/resume_samples.py).
"""

import pytest
from fastapi.testclient import TestClient

import app.api.resume_parsing as resume_api
import app.services.llm_resume_parser as llm
import app.services.resume_store as resume_store
from app.config import get_settings
from app.main import app
from app.schemas.resume_parsing import ParsedResumeResponse
from app.services.resume_parser import group_items, parse_resume_lines
from app.services.resume_text_extractor import ResumeFileError, extract_text_lines, validate_upload
from tests.resume_samples import DOCX_TYPE, FAKE_RESUME_LINES, PDF_TYPE, make_docx, make_encrypted_pdf, make_pdf

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_real_database(monkeypatch):
    """backend/.env may enable saving; tests must never write to the shared database."""
    monkeypatch.setenv("SAVE_PARSED_RESUMES", "false")
    # No LLM keys here: conftest.isolated_llm clears them, so parsing is rule-based unless a test opts in.

    def refuse():
        raise AssertionError("tests must not open a real database connection")

    monkeypatch.setattr(resume_store, "get_db_connection", refuse)


def skill(parsed, name):
    return next(s for s in parsed["skills"] if s["skill_name"] == name)


def upload(name, data, content_type):
    return client.post("/api/resumes/parse", files={"file": (name, data, content_type)})


# ---------------------------------------------------------------------------
# 1. Validation and extraction
# ---------------------------------------------------------------------------


class TestExtraction:
    def test_pdf_text_is_extracted(self):
        lines = extract_text_lines(make_pdf(FAKE_RESUME_LINES), "pdf")
        assert lines[0] == "Jordan Lee"
        assert "Technical Skills" in lines

    def test_docx_text_is_extracted_with_bullets_marked(self):
        lines = extract_text_lines(make_docx(FAKE_RESUME_LINES), "docx")
        assert lines[0] == "Jordan Lee"
        assert any(line.startswith("• Built a chat server") for line in lines)

    @pytest.mark.parametrize(
        "filename, content_type, data, code",
        [
            ("resume.txt", "text/plain", b"hello", "unsupported"),
            ("resume.doc", "application/msword", b"\xd0\xcf\x11\xe0", "unsupported"),
            ("resume.pdf", "image/png", make_pdf(["A"]), "unsupported"),
            ("resume.pdf", PDF_TYPE, b"", "unreadable"),
            ("resume.pdf", PDF_TYPE, b"this is not a pdf", "unreadable"),
            ("resume.docx", DOCX_TYPE, b"not a zip file", "unreadable"),
            ("", PDF_TYPE, b"%PDF", "missing"),
        ],
        ids=["txt", "legacy-doc", "wrong-mime", "empty", "renamed-pdf", "renamed-docx", "no-name"],
    )
    def test_validation_rejects_bad_uploads(self, filename, content_type, data, code):
        with pytest.raises(ResumeFileError) as err:
            validate_upload(filename, content_type, data)
        assert err.value.code == code

    def test_octet_stream_mime_type_is_accepted(self):
        # Windows browsers often send this for PDFs; the signature check decides.
        assert validate_upload("cv.pdf", "application/octet-stream", make_pdf(["A"])) == "pdf"

    def test_size_limit(self, monkeypatch):
        monkeypatch.setenv("MAX_UPLOAD_MB", "0.0001")  # about 100 bytes
        with pytest.raises(ResumeFileError) as err:
            validate_upload("cv.pdf", PDF_TYPE, make_pdf(FAKE_RESUME_LINES))
        assert err.value.code == "too_large"
        assert err.value.status_code == 413

    def test_corrupted_pdf(self):
        with pytest.raises(ResumeFileError) as err:
            extract_text_lines(b"%PDF-1.4\n garbage without objects", "pdf")
        assert err.value.code in ("unreadable", "ocr_required")

    def test_corrupted_docx(self):
        with pytest.raises(ResumeFileError) as err:
            extract_text_lines(b"PK\x03\x04 broken zip", "docx")
        assert err.value.code == "unreadable"

    def test_scanned_pdf_without_text_asks_for_ocr(self):
        with pytest.raises(ResumeFileError) as err:
            extract_text_lines(make_pdf([]), "pdf")
        assert err.value.code == "ocr_required"
        assert "OCR" in err.value.message

    def test_password_protected_pdf(self):
        with pytest.raises(ResumeFileError) as err:
            extract_text_lines(make_encrypted_pdf(), "pdf")
        assert err.value.code == "encrypted"

    def test_empty_docx(self):
        with pytest.raises(ResumeFileError) as err:
            extract_text_lines(make_docx([]), "docx")
        assert err.value.code == "empty"


# ---------------------------------------------------------------------------
# 2. Parsing
# ---------------------------------------------------------------------------


class TestParsing:
    @pytest.fixture
    def parsed(self):
        return parse_resume_lines(FAKE_RESUME_LINES, "docx")

    def test_name_email_and_headline(self, parsed):
        assert parsed["name"] == "Jordan Lee"
        assert parsed["email"] == "jordan.lee@example.com"
        # The contact line (email / phone) is never used as the headline.
        assert parsed["headline"] == "Backend-focused graduate who enjoys building reliable services"

    def test_education(self, parsed):
        assert parsed["education"] == [
            {
                "degree": "B.Tech",
                "field": "Computer Science",
                "institution": "Example Institute of Technology",
                "graduation_year": "2025",
                "grade": "CGPA 8.4 / 10",
            }
        ]

    def test_listed_and_demonstrated_skill_is_high_confidence(self, parsed):
        python = skill(parsed, "Python")
        assert python["category_code"] == "COD"
        assert python["confidence"] == "high"
        assert "Inventory API" in python["evidence"]  # evidence is quoted from the resume

    def test_listed_only_skill_is_medium(self, parsed):
        docker = skill(parsed, "Docker")
        assert (docker["category_code"], docker["confidence"], docker["evidence"]) == ("CLOUD", "medium", "Listed under Technical Skills")

    def test_depth_qualifier_is_kept_and_caps_confidence(self, parsed):
        # "SQL (basic)" is demonstrated by the PostgreSQL project, but the resume says basic.
        sql = skill(parsed, "SQL (basic)")
        assert sql["category_code"] == "SQL"
        assert sql["confidence"] == "medium"
        assert skill(parsed, "Linux (basics)")["category_code"] == "OS"

    def test_skill_found_only_in_projects_is_medium(self, parsed):
        os_skill = skill(parsed, "Operating Systems")
        assert os_skill["confidence"] == "medium"
        assert "multithreading" in os_skill["evidence"]

    def test_indirect_signal_is_low(self, parsed):
        comm = skill(parsed, "Communication")
        assert comm["confidence"] == "low"
        assert "Mentored" in comm["evidence"]

    def test_unknown_listed_skill_goes_to_other(self, parsed):
        assert skill(parsed, "Figma")["category_code"] == "OTHER"

    def test_no_skills_invented_from_roles_or_headline(self):
        parsed = parse_resume_lines(
            ["Sam Park", "Aspiring Machine Learning engineer", "Preferred Roles", "Data Scientist, Cloud Engineer"]
        )
        assert parsed["skills"] == []
        assert parsed["preferred_roles"] == ["Data Scientist", "Cloud Engineer"]

    def test_every_skill_has_evidence_and_valid_codes(self, parsed):
        for s in parsed["skills"]:
            assert s["evidence"]
            assert s["confidence"] in ("high", "medium", "low")

    def test_duplicates_are_merged(self):
        parsed = parse_resume_lines(["Sam Park", "Skills", "SQL, MySQL, Python, python"])
        names = [s["skill_name"] for s in parsed["skills"]]
        assert names == ["SQL", "Python"]

    def test_sections_and_activities(self, parsed):
        assert parsed["projects"][0] == {"title": "Inventory API", "description": "built a REST API in Python with a PostgreSQL database and unit testing"}
        assert parsed["internships"] == [{"role": "Software intern", "organization": "Example Corp", "description": "added CI/CD checks to the deployment pipeline"}]
        assert parsed["hackathons"] == [{"name": "Example City Hackathon", "result": "Winner", "description": "built a delivery route planner"}]
        assert parsed["certifications"] == [{"name": "AWS Cloud Practitioner", "issuer": "AWS"}]
        assert parsed["achievements"] == ["Mentored first-year students in a weekly coding club"]

    def test_combined_heading_is_classified_per_item(self):
        parsed = parse_resume_lines(
            ["Sam Park", "Hackathons / Internships", "- Runner-up, Example Datathon", "- Data intern at Example Labs - built dashboards"]
        )
        assert parsed["hackathons"][0]["result"] == "Runner-up"
        assert parsed["internships"][0]["organization"] == "Example Labs"

    def test_missing_sections_are_empty_not_invented(self):
        parsed = parse_resume_lines(["Sam Park", "Skills", "Python"])
        for key in ("education", "projects", "internships", "hackathons", "certifications", "achievements", "preferred_roles"):
            assert parsed[key] == []
        assert parsed["email"] is None

    def test_negative_entries_are_ignored(self):
        parsed = parse_resume_lines(["Sam Park", "Certifications", "None listed", "Achievements", "N/A"])
        assert parsed["certifications"] == []
        assert parsed["achievements"] == []

    def test_pdf_wrapped_lines_are_joined(self):
        lines = [
            "• Built a distributed URL-shortening service with a Redis-backed cache and a",
            "horizontally-",
            "scalable API layer",
            "• Second project",
        ]
        assert group_items(lines, pdf_wrapping=True) == [
            "Built a distributed URL-shortening service with a Redis-backed cache and a horizontally-scalable API layer",
            "Second project",
        ]

    def test_pdf_and_docx_give_the_same_result(self):
        pdf = parse_resume_lines(extract_text_lines(make_pdf(FAKE_RESUME_LINES), "pdf"), "pdf")
        docx_ = parse_resume_lines(extract_text_lines(make_docx(FAKE_RESUME_LINES), "docx"), "docx")
        assert pdf == docx_


# ---------------------------------------------------------------------------
# 3. API endpoint
# ---------------------------------------------------------------------------


class TestEndpoint:
    @pytest.mark.parametrize(
        "filename, data, content_type",
        [
            ("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE),
            ("Jordan Lee.docx", make_docx(FAKE_RESUME_LINES), DOCX_TYPE),
        ],
        ids=["pdf", "docx"],  # short ids: Windows limits the env var pytest builds from them
    )
    def test_valid_upload_returns_contract_shape(self, filename, data, content_type):
        res = upload(filename, data, content_type)
        assert res.status_code == 200
        body = res.json()
        ParsedResumeResponse(**body)  # raises if the shape breaks the contract
        for key in ("name", "email", "education", "skills", "projects", "internships", "hackathons",
                    "certifications", "achievements", "preferred_roles", "source_file", "resume_reference"):
            assert key in body
        assert body["source_file"] == filename
        assert body["name"] == "Jordan Lee"
        assert body["persistence"]["status"] == "disabled"
        assert body["resume_reference"] is None

    def test_missing_file(self):
        res = client.post("/api/resumes/parse")
        assert res.status_code == 400
        assert res.json()["code"] == "missing"

    def test_unsupported_extension(self):
        res = upload("resume.txt", b"plain text", "text/plain")
        assert res.status_code == 415
        assert res.json() == {"detail": '"resume.txt" is not a supported file. Upload a PDF or DOCX document.', "code": "unsupported"}

    def test_corrupted_docx(self):
        res = upload("resume.docx", b"PK\x03\x04 broken", DOCX_TYPE)
        assert res.status_code == 422
        assert res.json()["code"] == "unreadable"

    def test_text_free_pdf(self):
        res = upload("scan.pdf", make_pdf([]), PDF_TYPE)
        assert res.status_code == 422
        assert res.json()["code"] == "ocr_required"

    def test_unexpected_error_does_not_leak_details(self, monkeypatch):
        def boom(*_args, **_kwargs):
            raise RuntimeError("internal secret: password=hunter2")

        monkeypatch.setattr(resume_api, "parse_resume_lines", boom)
        res = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE)
        assert res.status_code == 500
        assert res.json()["code"] == "parse_failed"
        assert "hunter2" not in res.text


# ---------------------------------------------------------------------------
# 4. Persistence
# ---------------------------------------------------------------------------


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        if self.conn.fail_on and self.conn.fail_on in sql:
            raise RuntimeError("relation does not exist (with private details)")
        self.conn.executed.append((" ".join(sql.split()), params))

    def fetchone(self):
        return ("11111111-2222-3333-4444-555555555555", self.conn.created)


class FakeConnection:
    def __init__(self, created=True, fail_on=None):
        self.created = created
        self.fail_on = fail_on
        self.executed = []
        self.committed = self.rolled_back = self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        if exc_type:
            self.rolled_back = True
        else:
            self.committed = True
        return False

    def cursor(self):
        return FakeCursor(self)

    def close(self):
        self.closed = True


class TestPersistence:
    @pytest.fixture
    def enable_saving(self, monkeypatch):
        monkeypatch.setenv("SAVE_PARSED_RESUMES", "true")

    def use(self, monkeypatch, conn):
        monkeypatch.setattr(resume_store, "get_db_connection", lambda: conn)
        return conn

    def test_saved_resume_returns_resume_reference(self, monkeypatch, enable_saving):
        conn = self.use(monkeypatch, FakeConnection(created=True))
        body = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE).json()
        assert body["persistence"]["status"] == "saved"
        assert body["resume_reference"] == "11111111-2222-3333-4444-555555555555"
        assert conn.committed and conn.closed

        statements = [sql for sql, _ in conn.executed]
        assert statements[0].startswith("INSERT INTO parsed_resumes")
        assert "ON CONFLICT (file_sha256)" in statements[0]
        assert statements[1].startswith("DELETE FROM resume_skills")
        skill_rows = [params for sql, params in conn.executed if sql.startswith("INSERT INTO resume_skills")]
        assert len(skill_rows) == len(body["skills"])
        assert ("Python", "COD") == skill_rows[0][1:3]

    def test_reupload_reports_updated(self, monkeypatch, enable_saving):
        self.use(monkeypatch, FakeConnection(created=False))
        body = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE).json()
        assert body["persistence"]["status"] == "updated"

    def test_database_failure_is_reported_not_hidden(self, monkeypatch, enable_saving):
        conn = self.use(monkeypatch, FakeConnection(fail_on="INSERT INTO resume_skills"))
        res = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE)
        body = res.json()
        assert res.status_code == 200  # the parse itself worked
        assert body["persistence"]["status"] == "failed"
        assert body["resume_reference"] is None  # no false success
        assert "private details" not in res.text
        assert conn.rolled_back and not conn.committed and conn.closed

    def test_connection_failure_is_reported(self, monkeypatch, enable_saving):
        def offline():
            raise RuntimeError("could not connect to server at db.example")

        monkeypatch.setattr(resume_store, "get_db_connection", offline)
        body = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE).json()
        assert body["persistence"]["status"] == "failed"
        assert "db.example" not in body["persistence"]["message"]

    def test_resume_without_name_is_not_saved(self, monkeypatch, enable_saving):
        conn = self.use(monkeypatch, FakeConnection())
        body = upload("cv.pdf", make_pdf(["Skills", "Python, SQL"]), PDF_TYPE).json()
        assert body["persistence"]["status"] == "skipped"
        assert conn.executed == []
        assert any("name" in w for w in body["warnings"])


# ---------------------------------------------------------------------------
# 5. Hackathons under Achievements (rules) and the LLM path (Gemini mocked)
# ---------------------------------------------------------------------------


def test_hackathon_listed_under_accomplishments_is_a_hackathon():
    parsed = parse_resume_lines(
        ["Sam Park", "Accomplishments", "Winner, Example Hackathon 2024", "Dean's list for academic excellence"]
    )
    assert parsed["hackathons"] == [{"name": "Example Hackathon 2024", "result": "Winner", "description": ""}]
    assert parsed["achievements"] == ["Dean's list for academic excellence"]


LLM_OUTPUT = {
    "name": "Jordan Lee",
    "email": "jordan.lee@example.com",
    "headline": "Backend-focused graduate",
    "education": [
        {"degree": "B.Tech", "field": "Computer Science", "institution": "Example Institute of Technology", "graduation_year": "2025", "grade": "CGPA 8.4 / 10"},
        {"degree": "PhD", "field": "Physics", "institution": "Invented University", "graduation_year": "2030", "grade": ""},
    ],
    "skills": [
        {"skill_name": "Python", "category_code": "COD", "evidence": "built a REST API in Python", "confidence": "high"},
        {"skill_name": "Rust", "category_code": "COD", "evidence": "wrote a compiler in Rust", "confidence": "high"},
        {"skill_name": "Docker", "category_code": "BOGUS", "evidence": "invented quote", "confidence": "high"},
        {"skill_name": "python", "category_code": "COD", "evidence": "Python", "confidence": "low"},
    ],
    "projects": [{"title": "Inventory API", "description": "built a REST API in Python"}],
    "internships": [],
    "hackathons": [{"name": "Example City Hackathon", "result": "Winner", "description": ""}],
    "certifications": [{"name": "AWS Cloud Practitioner", "issuer": "AWS"}],
    "achievements": ["Mentored first-year students in a weekly coding club"],
    "preferred_roles": ["Backend Engineer"],
}


class TestLlm:
    @pytest.fixture
    def gemini(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")
        get_settings.cache_clear()
        calls = []

        def fake(text):
            calls.append(text)
            return dict(LLM_OUTPUT)

        monkeypatch.setattr(llm, "_call_llm", fake)
        return calls

    def test_llm_output_is_used_and_validated_against_the_resume(self, gemini):
        body = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE).json()
        ParsedResumeResponse(**body)
        assert body["parser_mode"] == "llm"
        assert "<resume>" not in gemini[0] and "Jordan Lee" in gemini[0]
        # Invented education (not in the resume) is dropped.
        assert [e["institution"] for e in body["education"]] == ["Example Institute of Technology"]
        skills = {s["skill_name"]: s for s in body["skills"]}
        assert "Rust" not in skills  # not in the resume at all
        assert skills["Docker"]["category_code"] == "OTHER"  # invalid code repaired
        assert skills["Docker"]["evidence"] == "Mentioned in resume"  # fake quote replaced
        assert skills["Docker"]["confidence"] == "medium"
        assert len([s for s in body["skills"] if s["skill_name"].lower() == "python"]) == 1  # deduplicated
        assert body["hackathons"][0]["result"] == "Winner"

    def test_email_not_in_resume_is_dropped(self, monkeypatch):
        out = llm.validate_llm_output({**LLM_OUTPUT, "email": "someone.else@example.com"}, " ".join(FAKE_RESUME_LINES))
        assert out["email"] is None

    def test_llm_failure_falls_back_to_rules(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")
        get_settings.cache_clear()

        def broken(_text):
            raise llm.LlmParseError("The LLM service returned HTTP 503.")

        monkeypatch.setattr(llm, "_call_llm", broken)
        body = upload("Jordan Lee.pdf", make_pdf(FAKE_RESUME_LINES), PDF_TYPE).json()
        assert body["parser_mode"] == "rules"
        assert body["name"] == "Jordan Lee"
        assert "rule-based parser was used" in body["warnings"][0]
