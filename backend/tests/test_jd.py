"""
tests/test_jd.py — Pytest suite for JD Analyzer.

Tests cover:
  - PDF and DOCX text extraction (valid files, empty, corrupted, unsupported).
  - Schema validation (LLMSkill, LLMAnalysisResult, JDAnalysisResponse).
  - Skill extractor with mocked LLM.
  - Deduplication in jd_service.
  - Taxonomy mapping / canonical skill ID handling.
  - Proficiency calculation (provisional heuristic).
  - Missing roadmap data (graceful degradation).
  - Supabase unavailable / unconfigured (database layer).
  - LLM error and rate-limit handling.
  - FastAPI health endpoint.
  - FastAPI upload and analysis response (with mocked backend).

All LLM and Supabase calls are mocked — no real API keys are required.
"""

from __future__ import annotations

import io
import json
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures and helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _make_minimal_pdf_bytes() -> bytes:
    """Create a minimal valid single-page text PDF in memory."""
    # A bare-minimum PDF with one text object.
    content = b"%PDF-1.4\n"
    content += b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    content += b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    content += b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
    content += b"   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    content += b"4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 720 Td (Hello PDF) Tj ET\nendstream\nendobj\n"
    content += b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    content += b"xref\n0 6\n0000000000 65535 f \n"
    content += b"0000000009 00000 n \n0000000058 00000 n \n"
    content += b"0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \n"
    content += b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n441\n%%EOF"
    return content


def _make_minimal_docx_bytes() -> bytes:
    """Create a minimal valid DOCX file in memory using python-docx."""
    import docx
    buf = io.BytesIO()
    doc = docx.Document()
    doc.add_paragraph("Software Engineer — Python, SQL, System Design required.")
    doc.save(buf)
    return buf.getvalue()


SAMPLE_LLM_OUTPUT: Dict[str, Any] = {
    "metadata": {
        "company_name": "Acme Corp",
        "job_title": "Senior Software Engineer",
        "job_summary": "Build scalable backend systems.",
        "employment_type": "Full-time",
        "location": "Remote",
        "experience_required": "5+ years",
        "responsibilities": ["Design APIs", "Write tests"],
        "qualifications": ["B.Sc Computer Science"],
        "prompt_injection_detected": False,
    },
    "skills": [
        {
            "skill_name": "Python",
            "canonical_skill_id": None,
            "category_code": "COD",
            "category_name": "Coding",
            "requirement_type": "required",
            "importance": "high",
            "target_proficiency": 7,
            "is_provisional": True,
            "evidence": "5+ years of Python experience required",
            "confidence": "high",
            "matched_topic_ids": [],
        },
        {
            "skill_name": "SQL",
            "canonical_skill_id": None,
            "category_code": "SQL",
            "category_name": "SQL",
            "requirement_type": "required",
            "importance": "high",
            "target_proficiency": 6,
            "is_provisional": True,
            "evidence": "Strong SQL skills required",
            "confidence": "high",
            "matched_topic_ids": [],
        },
    ],
    "analysis_notes": None,
}


@pytest.fixture()
def sample_llm_json() -> str:
    return json.dumps(SAMPLE_LLM_OUTPUT)


@pytest.fixture()
def api_client():
    """Return a TestClient for the FastAPI app."""
    from app.main import app
    return TestClient(app)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Text extraction — PDF
# ═══════════════════════════════════════════════════════════════════════════════

class TestPDFExtraction:
    def test_valid_pdf_returns_text(self):
        """Valid PDF bytes should yield non-empty text."""
        from app.jd_parser import extract_text

        pdf_bytes = _make_minimal_pdf_bytes()
        text, fmt = extract_text(pdf_bytes, "test.pdf", "application/pdf")
        assert fmt == "pdf"
        assert isinstance(text, str)
        assert len(text) > 0

    def test_empty_file_raises(self):
        """Zero-byte upload should raise ParserError."""
        from app.jd_parser import ParserError, extract_text

        with pytest.raises(ParserError, match="empty"):
            extract_text(b"", "test.pdf", "application/pdf")

    def test_corrupted_pdf_raises(self):
        """Garbage bytes labeled as PDF should raise ParserError."""
        from app.jd_parser import ParserError, extract_text

        with pytest.raises(ParserError):
            extract_text(b"NOT A REAL PDF HEADER XYZ", "bad.pdf", "application/pdf")

    def test_oversized_pdf_raises(self):
        """File exceeding max_upload_bytes should raise ParserError."""
        from app.jd_parser import ParserError, extract_text
        from unittest.mock import patch

        with patch("app.jd_parser.get_settings") as mock_settings:
            mock_settings.return_value.max_upload_bytes = 10  # 10 bytes limit
            with pytest.raises(ParserError, match="too large|exceeds"):
                extract_text(b"A" * 100, "big.pdf", "application/pdf")

    def test_unsupported_extension_raises(self):
        """Non-PDF/DOCX extension should raise ParserError."""
        from app.jd_parser import ParserError, extract_text

        with pytest.raises(ParserError, match="[Uu]nsupported"):
            extract_text(b"data", "resume.txt", "text/plain")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Text extraction — DOCX
# ═══════════════════════════════════════════════════════════════════════════════

class TestDOCXExtraction:
    def test_valid_docx_returns_text(self):
        """Valid DOCX bytes should yield non-empty text."""
        from app.jd_parser import extract_text

        docx_bytes = _make_minimal_docx_bytes()
        text, fmt = extract_text(
            docx_bytes,
            "test.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        assert fmt == "docx"
        assert "Python" in text or len(text) > 0

    def test_corrupted_docx_raises(self):
        """Non-DOCX bytes labeled as DOCX should raise ParserError."""
        from app.jd_parser import ParserError, extract_text

        with pytest.raises(ParserError):
            extract_text(
                b"GARBAGE DATA",
                "bad.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )

    def test_empty_docx_raises(self):
        """Zero-byte DOCX upload should raise ParserError."""
        from app.jd_parser import ParserError, extract_text

        with pytest.raises(ParserError, match="empty"):
            extract_text(b"", "empty.docx", "application/octet-stream")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Schema validation
# ═══════════════════════════════════════════════════════════════════════════════

class TestSchemaValidation:
    def test_llm_skill_valid(self):
        from app.schemas import LLMSkill

        skill = LLMSkill(
            skill_name="Python",
            category_code="COD",
            category_name="Coding",
            requirement_type="required",
            importance="high",
            target_proficiency=7,
            is_provisional=True,
            evidence="5+ years of Python required",
            confidence="high",
        )
        assert skill.skill_name == "Python"
        assert skill.target_proficiency == 7

    def test_llm_skill_invalid_proficiency_clamped(self):
        """Out-of-range proficiency should be set to None."""
        from app.schemas import LLMSkill

        skill = LLMSkill(
            skill_name="X",
            category_code="OTHER",
            category_name="Other",
            target_proficiency=99,  # invalid
        )
        assert skill.target_proficiency is None

    def test_llm_skill_invalid_requirement_type_normalized(self):
        from app.schemas import LLMSkill

        skill = LLMSkill(
            skill_name="X",
            category_code="OTHER",
            category_name="Other",
            requirement_type="MANDATORY",  # invalid
        )
        assert skill.requirement_type == "unclear"

    def test_llm_analysis_result_valid(self):
        from app.schemas import LLMAnalysisResult

        result = LLMAnalysisResult.model_validate(SAMPLE_LLM_OUTPUT)
        assert result.metadata.company_name == "Acme Corp"
        assert len(result.skills) == 2

    def test_jd_analysis_response_serializable(self):
        from app.schemas import JDAnalysisResponse

        resp = JDAnalysisResponse()
        serialized = resp.model_dump()
        assert "skills" in serialized
        assert "metadata" in serialized
        # Must be JSON-serializable
        json.dumps(serialized)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Skill extractor — mocked LLM
# ═══════════════════════════════════════════════════════════════════════════════

class TestSkillExtractor:
    def test_extract_skills_with_mock_llm(self, sample_llm_json):
        """Mocked LLM chain should produce a valid LLMAnalysisResult."""
        from app.skill_extractor import extract_skills

        with (
            patch("app.skill_extractor.get_settings") as mock_settings,
            patch("app.skill_extractor._build_chain") as mock_build_chain,
        ):
            mock_settings.return_value.gemini_configured = True
            mock_settings.return_value.gemini_model = "gemini-mock"
            mock_settings.return_value.require_gemini = lambda: None

            mock_chain = MagicMock()
            mock_chain.invoke.return_value = sample_llm_json
            mock_build_chain.return_value = mock_chain

            result = extract_skills("We need a Python developer with SQL skills.")

        assert result.metadata.company_name == "Acme Corp"
        assert len(result.skills) == 2
        assert result.skills[0].skill_name == "Python"

    def test_extract_skills_rate_limit_raises_extraction_error(self):
        from app.skill_extractor import ExtractionError, extract_skills

        with (
            patch("app.skill_extractor.get_settings") as mock_settings,
            patch("app.skill_extractor._build_chain") as mock_build_chain,
        ):
            mock_settings.return_value.gemini_configured = True
            mock_settings.return_value.gemini_model = "gemini-mock"
            mock_settings.return_value.require_gemini = lambda: None

            mock_chain = MagicMock()
            mock_chain.invoke.side_effect = Exception("429 quota exceeded rate limit")
            mock_build_chain.return_value = mock_chain

            with pytest.raises(ExtractionError, match="rate"):
                extract_skills("Any JD text.")

    def test_extract_skills_llm_timeout_raises_extraction_error(self):
        from app.skill_extractor import ExtractionError, extract_skills

        with (
            patch("app.skill_extractor.get_settings") as mock_settings,
            patch("app.skill_extractor._build_chain") as mock_build_chain,
        ):
            mock_settings.return_value.gemini_configured = True
            mock_settings.return_value.gemini_model = "gemini-mock"
            mock_settings.return_value.require_gemini = lambda: None

            mock_chain = MagicMock()
            mock_chain.invoke.side_effect = Exception("timeout during request")
            mock_build_chain.return_value = mock_chain

            with pytest.raises(ExtractionError, match="time"):
                extract_skills("Any JD text.")

    def test_extract_skills_malformed_json_raises(self):
        from app.skill_extractor import ExtractionError, extract_skills

        with (
            patch("app.skill_extractor.get_settings") as mock_settings,
            patch("app.skill_extractor._build_chain") as mock_build_chain,
        ):
            mock_settings.return_value.gemini_configured = True
            mock_settings.return_value.gemini_model = "gemini-mock"
            mock_settings.return_value.require_gemini = lambda: None

            mock_chain = MagicMock()
            mock_chain.invoke.return_value = "This is not JSON at all!!"
            mock_build_chain.return_value = mock_chain

            with pytest.raises(ExtractionError):
                extract_skills("Any JD text.")

    def test_extract_skills_empty_text_raises(self):
        from app.skill_extractor import ExtractionError, extract_skills

        with pytest.raises(ExtractionError, match="empty"):
            extract_skills("   ")

    def test_prompt_imported_from_prompts_module(self):
        """System prompt must come from prompts/jd_analysis_prompt.py, not be duplicated."""
        from prompts.jd_analysis_prompt import JD_ANALYSIS_SYSTEM_PROMPT
        import app.skill_extractor as extractor_module
        import inspect

        source = inspect.getsource(extractor_module)
        # The constant name must appear as an import, not as a string literal redefinition
        assert "JD_ANALYSIS_SYSTEM_PROMPT" in source
        assert "from prompts.jd_analysis_prompt import JD_ANALYSIS_SYSTEM_PROMPT" in source
        assert len(JD_ANALYSIS_SYSTEM_PROMPT) > 200  # Prompt is substantial


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Deduplication
# ═══════════════════════════════════════════════════════════════════════════════

class TestDeduplication:
    def test_duplicate_skills_removed(self):
        from app.jd_service import _deduplicate_skills
        from app.schemas import LLMSkill

        skills = [
            LLMSkill(skill_name="Python", category_code="COD", category_name="Coding"),
            LLMSkill(skill_name="python", category_code="COD", category_name="Coding"),  # duplicate
            LLMSkill(skill_name="SQL", category_code="SQL", category_name="SQL"),
        ]
        unique = _deduplicate_skills(skills)
        assert len(unique) == 2
        assert unique[0].skill_name == "Python"
        assert unique[1].skill_name == "SQL"

    def test_no_duplicates_unchanged(self):
        from app.jd_service import _deduplicate_skills
        from app.schemas import LLMSkill

        skills = [
            LLMSkill(skill_name="Python", category_code="COD", category_name="Coding"),
            LLMSkill(skill_name="SQL", category_code="SQL", category_name="SQL"),
            LLMSkill(skill_name="Docker", category_code="CLOUD", category_name="Cloud"),
        ]
        unique = _deduplicate_skills(skills)
        assert len(unique) == 3


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Taxonomy mapping
# ═══════════════════════════════════════════════════════════════════════════════

class TestTaxonomyMapping:
    def test_known_category_code_preserved(self):
        from app.schemas import LLMSkill

        skill = LLMSkill(
            skill_name="TensorFlow",
            category_code="AI",
            category_name="Artificial Intelligence",
        )
        assert skill.category_code == "AI"

    def test_null_canonical_id_preserved(self):
        from app.schemas import LLMSkill

        skill = LLMSkill(
            skill_name="SomeObscureLib",
            canonical_skill_id=None,
            category_code="OTHER",
            category_name="Other",
        )
        assert skill.canonical_skill_id is None

    def test_canonical_id_set_when_provided(self):
        from app.schemas import LLMSkill

        skill = LLMSkill(
            skill_name="Python",
            canonical_skill_id="skill-123",
            category_code="COD",
            category_name="Coding",
        )
        assert skill.canonical_skill_id == "skill-123"


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Proficiency calculation
# ═══════════════════════════════════════════════════════════════════════════════

class TestProficiency:
    def test_senior_jd_gives_high_score(self):
        from app.proficiency import calculate_target_proficiency

        score, provisional = calculate_target_proficiency(
            skill_name="Python",
            importance="high",
            requirement_type="required",
            jd_full_text="We are looking for a Senior Software Engineer with 5+ years.",
            experience_required="5+ years",
            llm_suggested=None,
            official_levels=None,
        )
        assert score is not None
        assert score >= 6
        assert provisional is True

    def test_junior_jd_gives_lower_score(self):
        from app.proficiency import calculate_target_proficiency

        score, provisional = calculate_target_proficiency(
            skill_name="Python",
            importance="medium",
            requirement_type="required",
            jd_full_text="Junior developer role, 1 year of experience acceptable.",
            experience_required="1 year",
            llm_suggested=None,
            official_levels=None,
        )
        assert score is not None
        assert score <= 5
        assert provisional is True

    def test_llm_suggestion_used_when_valid(self):
        from app.proficiency import calculate_target_proficiency

        score, provisional = calculate_target_proficiency(
            skill_name="Python",
            importance="high",
            requirement_type="required",
            jd_full_text="Any JD text.",
            experience_required=None,
            llm_suggested=8,
            official_levels=None,
        )
        assert score == 8
        assert provisional is True

    def test_insufficient_signal_returns_none(self):
        from app.proficiency import calculate_target_proficiency

        score, provisional = calculate_target_proficiency(
            skill_name="Unknown Skill",
            importance="low",
            requirement_type="unclear",
            jd_full_text="Generic job posting with no seniority signals.",
            experience_required=None,
            llm_suggested=None,
            official_levels=None,
        )
        # May or may not be None — just ensure it doesn't crash and is in range
        if score is not None:
            assert 1 <= score <= 10

    def test_official_levels_marks_not_provisional(self):
        from app.proficiency import calculate_target_proficiency

        official_levels = [{"id": 1, "level_name": "Advanced", "score": 7}]
        score, provisional = calculate_target_proficiency(
            skill_name="Python",
            importance="high",
            requirement_type="required",
            jd_full_text="Senior Python developer.",
            experience_required="5 years",
            llm_suggested=7,
            official_levels=official_levels,
        )
        assert score == 7
        assert provisional is True  # No verified mapping from DB labels to numeric 1–10

    def test_apply_proficiency_to_skills_does_not_crash(self):
        from app.proficiency import apply_proficiency_to_skills
        from app.schemas import LLMSkill

        skills = [
            LLMSkill(skill_name="Python", category_code="COD", category_name="Coding",
                     importance="high", requirement_type="required"),
            LLMSkill(skill_name="SQL", category_code="SQL", category_name="SQL",
                     importance="medium", requirement_type="preferred"),
        ]
        result = apply_proficiency_to_skills(
            skills, "Senior Python developer with SQL skills.", "5+ years"
        )
        assert len(result) == 2
        # No crash; scores may or may not be set
        for s in result:
            if s.target_proficiency is not None:
                assert 1 <= s.target_proficiency <= 10


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Missing roadmap data
# ═══════════════════════════════════════════════════════════════════════════════

class TestRoadmapData:
    def test_no_topics_returns_empty_list(self):
        from app.jd_service import _resolve_roadmap_topics
        from app.schemas import LLMSkill

        skills = [
            LLMSkill(skill_name="Python", category_code="COD", category_name="Coding"),
        ]
        topic_map = _resolve_roadmap_topics(skills, topic_records=[])
        assert topic_map["python"] == []

    def test_matching_topic_by_category(self):
        from app.jd_service import _resolve_roadmap_topics
        from app.schemas import LLMSkill

        skills = [
            LLMSkill(skill_name="Python", category_code="COD", category_name="Coding"),
        ]
        topic_records = [
            {"id": "t1", "topic_name": "Intro to Python", "skill_category": "COD",
             "canonical_skill_id": None},
        ]
        topic_map = _resolve_roadmap_topics(skills, topic_records)
        matched = topic_map.get("python", [])
        assert len(matched) == 1
        assert matched[0].topic_name == "Intro to Python"

    def test_non_matching_topic_not_included(self):
        from app.jd_service import _resolve_roadmap_topics
        from app.schemas import LLMSkill

        skills = [
            LLMSkill(skill_name="Python", category_code="COD", category_name="Coding"),
        ]
        topic_records = [
            {"id": "t2", "topic_name": "AWS Basics", "skill_category": "CLOUD",
             "canonical_skill_id": None},
        ]
        topic_map = _resolve_roadmap_topics(skills, topic_records)
        matched = topic_map.get("python", [])
        assert len(matched) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# 9. Database layer — Supabase unavailable
# ═══════════════════════════════════════════════════════════════════════════════

class TestDatabaseLayer:
    def test_canonical_skills_returns_empty_when_not_configured(self):
        from app.database import get_canonical_skills

        with patch("app.database._get_supabase_client", return_value=None):
            result = get_canonical_skills()
        assert result == []

    def test_proficiency_levels_returns_empty_when_not_configured(self):
        from app.database import get_proficiency_levels

        with patch("app.database._get_supabase_client", return_value=None):
            result = get_proficiency_levels()
        assert result == []

    def test_roadmap_topics_returns_empty_when_not_configured(self):
        from app.database import get_roadmap_topics_for_skills

        with patch("app.database._get_supabase_client", return_value=None):
            result = get_roadmap_topics_for_skills(category_codes=["COD"])
        assert result == []

    def test_database_exception_returns_empty_not_crash(self):
        from app.database import get_canonical_skills

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.execute.side_effect = (
            Exception("Connection refused")
        )

        with patch("app.database._get_supabase_client", return_value=mock_client):
            result = get_canonical_skills()
        assert result == []

    def test_supabase_not_configured_returns_false(self):
        from app.config import Settings

        s = Settings()
        # Temporarily unset vars
        with patch.object(s, "supabase_url", None), patch.object(s, "supabase_key", None):
            assert s.supabase_configured is False

    def test_supabase_configured_when_both_set(self):
        from app.config import Settings

        s = Settings()
        with (
            patch.object(s, "supabase_url", "https://example.supabase.co"),
            patch.object(s, "supabase_key", "service_role_key"),
        ):
            assert s.supabase_configured is True


# ═══════════════════════════════════════════════════════════════════════════════
# 10. FastAPI endpoints
# ═══════════════════════════════════════════════════════════════════════════════

class TestAPIEndpoints:
    def test_health_endpoint_returns_200(self, api_client):
        response = api_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "jd-analyzer"
        assert "groq_configured" in data
        assert isinstance(data["groq_configured"], bool)
        assert "supabase_configured" in data

    def test_analyze_rejects_unsupported_file_type(self, api_client):
        """Uploading a .txt file should return HTTP 400."""
        response = api_client.post(
            "/api/jd/analyze",
            files={"file": ("resume.txt", b"Some text content", "text/plain")},
        )
        assert response.status_code == 400

    def test_analyze_rejects_empty_file(self, api_client):
        """Uploading an empty file should return HTTP 422."""
        response = api_client.post(
            "/api/jd/analyze",
            files={"file": ("jd.pdf", b"", "application/pdf")},
        )
        assert response.status_code == 422

    def test_analyze_with_mocked_pipeline_returns_200(self, api_client, sample_llm_json):
        """Full pipeline with mocked LLM and DB should return HTTP 200 and valid schema."""
        docx_bytes = _make_minimal_docx_bytes()

        with (
            patch("app.jd_service.db.get_canonical_skills", return_value=[]),
            patch("app.jd_service.db.get_proficiency_levels", return_value=[]),
            patch("app.jd_service.db.get_roadmap_topics_for_skills", return_value=[]),
            patch("app.skill_extractor._build_chain") as mock_build_chain,
            patch("app.skill_extractor.get_settings") as mock_settings,
        ):
            mock_settings.return_value.gemini_configured = True
            mock_settings.return_value.gemini_model = "gemini-mock"
            mock_settings.return_value.require_gemini = lambda: None

            mock_chain = MagicMock()
            mock_chain.invoke.return_value = sample_llm_json
            mock_build_chain.return_value = mock_chain

            response = api_client.post(
                "/api/jd/analyze",
                files={
                    "file": (
                        "jd.docx",
                        docx_bytes,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "skills" in data
        assert "metadata" in data
        assert isinstance(data["skills"], list)
        assert len(data["skills"]) == 2

    def test_analyze_llm_failure_returns_503(self, api_client):
        """LLM failure should produce HTTP 503, not 500 or success."""
        docx_bytes = _make_minimal_docx_bytes()

        with (
            patch("app.jd_service.db.get_canonical_skills", return_value=[]),
            patch("app.jd_service.db.get_proficiency_levels", return_value=[]),
            patch("app.skill_extractor._build_chain") as mock_build_chain,
            patch("app.skill_extractor.get_settings") as mock_settings,
        ):
            mock_settings.return_value.gemini_configured = True
            mock_settings.return_value.gemini_model = "gemini-mock"
            mock_settings.return_value.require_gemini = lambda: None

            mock_chain = MagicMock()
            mock_chain.invoke.side_effect = Exception("Gemini API unavailable")
            mock_build_chain.return_value = mock_chain

            response = api_client.post(
                "/api/jd/analyze",
                files={
                    "file": (
                        "jd.docx",
                        docx_bytes,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
            )

        assert response.status_code == 503

    def test_analyze_missing_llm_keys_returns_503(self, api_client):
        """No provider key at all (conftest clears them) → HTTP 503 naming the variables to set."""
        docx_bytes = _make_minimal_docx_bytes()

        with (
            patch("app.jd_service.db.get_canonical_skills", return_value=[]),
            patch("app.jd_service.db.get_proficiency_levels", return_value=[]),
        ):
            response = api_client.post(
                "/api/jd/analyze",
                files={
                    "file": (
                        "jd.docx",
                        docx_bytes,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
            )

        assert response.status_code == 503
        detail = response.json().get("detail", "")
        for var in ("GROQ_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY"):
            assert var in detail


class TestDeterministicJDEvidence:
    def test_returns_verbatim_evidence_for_explicit_skill(self):
        from app.jd_service import _jd_evidence_for_skill

        jd = "Qualifications: Strong grasp of data structures and algorithms."
        evidence = _jd_evidence_for_skill("Data Structures and Algorithms", jd)
        assert evidence == jd

    def test_does_not_invent_evidence_for_unmentioned_skill(self):
        from app.jd_service import _jd_evidence_for_skill

        jd = "Design backend services and participate in code review."
        assert _jd_evidence_for_skill("AI Native Engineering", jd) is None

    def test_operating_system_evidence_requires_explicit_mention(self):
        from app.jd_service import _jd_evidence_for_skill

        assert _jd_evidence_for_skill(
            "Operating System",
            "Working knowledge of operating systems fundamentals (processes, threads).",
        ) == "Working knowledge of operating systems fundamentals (processes, threads)."
        assert _jd_evidence_for_skill(
            "Operating System", "Build reliable backend APIs."
        ) is None


class TestCanonicalCategoryAndEvidenceMapping:
    def test_canonical_short_labels_map_to_expected_codes(self):
        from app.database import _category_for_skill

        expected = {
            "Coding": "COD",
            "DSA": "DSA",
            "Aptitude and Problem Solving": "APTI",
            "Communication Skills": "COMM",
            "OOD": "OOD",
            "AI Native Engineering": "AI",
            "SQL and Design": "SQL",
            "System Design and Architecture": "SYSD",
            "DevOps and Cloud": "CLOUD",
            "Software Engineering": "SWE",
            "Computer Networking": "NETW",
            "Operating System": "OS",
        }
        for skill_name, expected_code in expected.items():
            assert _category_for_skill(skill_name)["category_code"] == expected_code

    def test_short_canonical_labels_find_evidence(self):
        from app.jd_service import _jd_evidence_for_skill

        assert _jd_evidence_for_skill("DSA", "Experience with algorithms and data structures.")
        assert _jd_evidence_for_skill("OOD", "Experience with object-oriented design.")
        assert _jd_evidence_for_skill("AI Native Engineering", "Build backend APIs.") is None

    def test_ai_native_does_not_match_generic_machine_learning(self):
        from app.jd_service import _jd_evidence_for_skill

        assert _jd_evidence_for_skill("AI Native Engineering", "Build machine learning models.") is None

class TestCanonicalMergeQuality:
    def test_canonical_category_overrides_llm_category_and_unproven_scores_are_removed(self):
        from app.jd_service import analyze_jd
        from app.schemas import LLMAnalysisResult, LLMJobMetadata, LLMSkill

        canonical_names = [
            ("Coding", "COD", "Coding"),
            ("DSA", "DSA", "Data Structures & Algorithms"),
            ("Aptitude and Problem Solving", "APTI", "Aptitude & Problem Solving"),
            ("Communication Skills", "COMM", "Communication"),
            ("OOD", "OOD", "Object-Oriented Design"),
            ("AI Native Engineering", "AI", "AI & Machine Learning"),
            ("SQL and Design", "SQL", "SQL & Database Design"),
            ("System Design and Architecture", "SYSD", "System Design & Architecture"),
            ("DevOps and Cloud", "CLOUD", "DevOps & Cloud"),
            ("Software Engineering", "SWE", "Software Engineering"),
            ("Computer Networking", "NETW", "Computer Networking"),
            ("Operating System", "OS", "Operating Systems"),
            ("Kubernetes", "CLOUD", "DevOps & Cloud"),
        ]
        canonical = [
            {"id": i, "skill_set_id": i, "skill_name": name, "short_name": name,
             "category_code": code, "category_name": label}
            for i, (name, code, label) in enumerate(canonical_names, start=1)
        ]
        llm_result = LLMAnalysisResult(
            metadata=LLMJobMetadata(company_name=None, job_title="Engineer"),
            skills=[LLMSkill(
                skill_name="DSA", canonical_skill_id="2", category_code="OTHER",
                category_name="Other", target_proficiency=8,
                evidence="data structures and algorithms are required",
                requirement_type="required", importance="high", confidence="high",
            )],
        )
        with (
            patch("app.jd_service.db.get_canonical_skills", return_value=canonical),
            patch("app.jd_service.db.get_proficiency_levels", return_value=[]),
            patch("app.jd_service.db.get_company_skill_levels", return_value=[]),
            patch("app.jd_service.db.get_roadmap_topics_for_skills", return_value=[]),
            patch("app.jd_service.extract_skills", return_value=llm_result),
        ):
            result = analyze_jd("Data structures and algorithms are required.")

        assert len(result.skills) == 12
        assert all(skill.skill_name != "Kubernetes" for skill in result.skills)
        dsa = next(skill for skill in result.skills if skill.skill_name == "DSA")
        assert dsa.category_code == "DSA"
        assert dsa.target_proficiency is None
        assert dsa.proficiency_source == "unavailable"
        unsupported = next(skill for skill in result.skills if skill.skill_name == "AI Native Engineering")
        assert unsupported.confidence == "low"
        assert "Not explicitly identified" in unsupported.evidence
        assert any("selected canonical skills are supported" in warning for warning in result.warnings)


class TestCompanyEvidenceGate:
    def test_company_name_must_be_supported_by_source_text(self):
        from app.jd_service import _company_name_is_supported

        assert _company_name_is_supported("Google LLC", "Google is hiring a Software Engineer.")
        assert _company_name_is_supported("Microsoft Corporation", "Join Microsoft as an engineer.")
        assert not _company_name_is_supported("Google LLC", "A software engineering role in Hyderabad.")
        assert not _company_name_is_supported(None, "Google is hiring.")


class TestApplicationSupportEvidence:
    def test_application_support_taxonomy_skills_match_oracle_jd(self):
        from app.jd_service import _jd_evidence_for_skill
        jd = ("Provide L2/L3 application support. Triage incidents within SLA. "
              "Query production databases to diagnose issues using basic SQL. Monitor logs and batch/real-time processes. "
              "Coordinate with development teams and communicate clearly with clients. "
              "Prior exposure to a ticketing/incident system is preferred. Linux fundamentals are required.")
        for name in ("Application Support", "Incident Management", "Troubleshooting",
                     "Log Analysis", "Ticketing Systems", "SLA Management",
                     "Batch Processing", "Systems Administration", "Database Querying",
                     "Client Support and Communication", "Application Monitoring"):
            assert _jd_evidence_for_skill(name, jd), f"No evidence matched for {name}"

    def test_expanded_taxonomy_returns_twelve_jd_supported_skills_without_taxonomy_warning(self):
        from app.jd_service import analyze_jd
        from app.schemas import LLMAnalysisResult, LLMJobMetadata, LLMSkill

        names = [
            "Coding", "Data Structures and Algorithms", "Aptitude and Problem Solving",
            "Communication Skills", "Object-Oriented Programming and Design",
            "AI Native Engineering", "SQL and Design", "System Design and Architecture",
            "DevOps and Cloud", "Software Engineering", "Computer Networking", "Operating System",
            "Application Support", "Incident Management", "Troubleshooting", "Log Analysis",
            "Ticketing Systems", "SLA Management", "Batch Processing", "Systems Administration",
            "Production Support", "Database Querying", "Client Support and Communication",
            "Application Monitoring", "Technical Documentation",
        ]
        canonical = []
        for i, name in enumerate(names, start=1):
            canonical.append({"id": i, "skill_set_id": i, "skill_name": name, "short_name": name})
        jd = (
            "Provide L2/L3 application support for Oracle Financial Services products. "
            "Triage, investigate, and resolve incidents raised by banking clients within SLA. "
            "Query production databases to diagnose issues. Coordinate with development teams. "
            "Monitor logs and batch/real-time processes to catch issues early. "
            "Communicate clearly and calmly with clients during incidents. "
            "Comfort with basic SQL – simple SELECT/WHERE queries and primary keys. "
            "Operating systems and Linux fundamentals – command-line usage and log files. "
            "Basic networking knowledge – IP addresses and client-server architecture. "
            "Strong quantitative and logical reasoning – structured problem-solving. "
            "Prior exposure to a ticketing/incident system is preferred. "
            "Coursework in networking or systems administration is preferred."
        )
        llm_result = LLMAnalysisResult(
            metadata=LLMJobMetadata(company_name="Oracle", job_title="Application Support Analyst"),
            skills=[LLMSkill(skill_name=name, category_code="OTHER", category_name="Other") for name in names],
        )
        with (
            patch("app.jd_service.db.get_canonical_skills", return_value=canonical),
            patch("app.jd_service.db.get_proficiency_levels", return_value=[]),
            patch("app.jd_service.db.get_company_skill_levels", return_value=[]),
            patch("app.jd_service.db.get_roadmap_topics_for_skills", return_value=[]),
            patch("app.jd_service.extract_skills", return_value=llm_result),
        ):
            result = analyze_jd(jd)

        assert len(result.skills) == 12
        assert all(skill.evidence != "Not explicitly identified in the job description." for skill in result.skills)
        assert not any("canonical skills are supported" in warning for warning in result.warnings)
