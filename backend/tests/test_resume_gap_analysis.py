"""Resume Coach gap analysis: POST /api/career-copilot/resume-coach/gap-analysis.

The LLM is always an httpx.MockTransport (see conftest.py); no real provider is called.
Resumes and job descriptions here are synthetic.
"""

import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from app import llm_router
from app.config import get_settings
from app.main import app
from app.schemas.career_copilot import GapRequirement
from app.services.resume_gap_analysis import compute_alignment
from tests.resume_samples import DOCX_TYPE, PDF_TYPE, make_docx, make_pdf

URL = "/api/career-copilot/resume-coach/gap-analysis"
MARKER = "Zyxquorp"  # unique word: proves the resume reached the LLM and never reaches the logs

RESUME_LINES = [
    "Asha Verma",
    "B.Tech Computer Science, 2025",
    "Skills: Python, SQL, Git",
    "Projects",
    f"- Worked on a {MARKER} inventory API in Python with a PostgreSQL database",
    "- Wrote SQL reports for 3 store managers",
    "Internship: Data intern at Acme Retail, cleaned sales data with pandas",
]
RESUME = "\n".join(RESUME_LINES)

JD = (
    "Junior Backend Engineer at Example Corp. Requirements: proficiency in Python is required. "
    "Must have experience with SQL databases. Experience with Docker is required. "
    "Nice to have: familiarity with Kubernetes. Bachelor's degree in Computer Science or related field. "
    "You will design REST APIs, write unit tests, and collaborate with product teams on new features every sprint."
)


def llm_payload(**overrides):
    payload = {
        "summary": "Good Python and SQL evidence; container tooling is not shown.",
        "requirements": [
            {
                "requirement": "Python", "kind": "technical_skill", "importance": "mandatory",
                "jd_evidence": "proficiency in Python is required", "classification": "matched",
                "resume_evidence": ["inventory API in Python"], "resume_section": "Projects",
                "missing_information": "", "gap_type": "none", "next_step": "Keep it prominent.",
            },
            {
                "requirement": "SQL databases", "kind": "technical_skill", "importance": "mandatory",
                "jd_evidence": "Must have experience with SQL databases", "classification": "partial",
                "resume_evidence": ["Wrote SQL reports for 3 store managers"], "resume_section": "Projects",
                "missing_information": "Schema design or query optimisation", "gap_type": "presentation_gap",
                "next_step": "Describe the PostgreSQL schema you designed.",
            },
            {
                "requirement": "Docker", "kind": "tool", "importance": "mandatory",
                "jd_evidence": "Experience with Docker is required", "classification": "missing",
                "resume_evidence": [], "missing_information": "Any containerised project",
                "gap_type": "skill_gap", "next_step": "Containerise the inventory API.",
            },
            {
                "requirement": "Kubernetes", "kind": "tool", "importance": "preferred",
                "jd_evidence": "Nice to have: familiarity with Kubernetes", "classification": "missing",
                "resume_evidence": [], "missing_information": "", "gap_type": "skill_gap", "next_step": "Optional.",
            },
        ],
        "bullet_improvements": [
            {
                "original_text": "Wrote SQL reports for 3 store managers",
                "problem": "Vague about the SQL involved.",
                "recommendation": "Name the queries and the database.",
                "improved_example": "Built SQL reports for 3 store managers.",
                "alignment": "Shows SQL for a backend role.",
                "follow_up_question": "Which joins or aggregations did the reports use?",
            }
        ],
        "action_plan": [
            {"priority": 3, "action": "Optionally learn Kubernetes basics.", "requirement": "Kubernetes"},
            {"priority": 1, "action": "Build and describe a Dockerised project.", "requirement": "Docker"},
        ],
        "follow_up_questions": ["Did the inventory API have automated tests?"],
    }
    payload.update(overrides)
    return payload


def groq_reply(content):
    text = content if isinstance(content, str) else json.dumps(content)
    return httpx.Response(200, json={"choices": [{"message": {"content": text}, "finish_reason": "stop"}]})


@pytest.fixture
def llm(monkeypatch):
    """A configured Groq provider whose replies tests control. Records each request body."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_testGroqKey1234567890")
    get_settings.cache_clear()

    class Fake:
        def __init__(self):
            self.bodies = []
            self.reply = groq_reply(llm_payload())

        def handle(self, request):
            self.bodies.append(json.loads(request.content))
            return self.reply

        def user_message(self):
            return self.bodies[-1]["messages"][1]["content"]

    fake = Fake()
    monkeypatch.setattr(llm_router, "_transport", httpx.MockTransport(fake.handle))
    return fake


@pytest.fixture
def client():
    return TestClient(app)


def post(client, *, files=None, **form):
    return client.post(URL, data={k: v for k, v in form.items() if v is not None}, files=files)


# ── Inputs reach the LLM ────────────────────────────────────────────────────

def test_pasted_resume_and_job_are_both_sent_and_classified(client, llm):
    res = post(client, resume_text=RESUME, jd_text=JD)
    assert res.status_code == 200, res.text
    body = res.json()

    user = llm.user_message()
    assert "<resume>" in user and MARKER in user
    assert "<job_description>" in user and "Example Corp" in user
    assert body["resume"]["kind"] == "text" and body["job"]["kind"] == "pasted"

    by_name = {r["requirement"]: r for r in body["requirements"]}
    assert by_name["Python"]["classification"] == "matched"
    assert by_name["SQL databases"]["classification"] == "partial"
    assert by_name["Docker"]["classification"] == "missing"
    assert by_name["Kubernetes"]["importance"] == "preferred"
    assert all(r["jd_evidence_verified"] for r in body["requirements"])
    assert body["counts"] == {"matched": 1, "partial": 1, "missing": 2, "unverified": 0, "mandatory": 3, "preferred": 1}
    # (2×1 + 2×0.5 + 2×0 + 1×0) / 7 = 3/7
    assert body["alignment"]["score"] == 43
    assert [a["priority"] for a in body["action_plan"]] == [1, 3]
    assert body["model_used"].startswith("groq:")
    assert "not a probability of being hired" in body["disclaimer"]


@pytest.mark.parametrize(
    "filename,content_type,data",
    [
        ("resume.pdf", PDF_TYPE, make_pdf(RESUME_LINES)),
        ("resume.docx", DOCX_TYPE, make_docx(RESUME_LINES)),
        ("resume.txt", "text/plain", RESUME.encode("utf-8")),
    ],
)
def test_uploaded_resume_text_reaches_the_llm(client, llm, filename, content_type, data):
    res = post(client, files={"resume_file": (filename, data, content_type)}, jd_text=JD)
    assert res.status_code == 200, res.text
    assert res.json()["resume"]["kind"] == filename.rsplit(".", 1)[1]
    assert MARKER in llm.user_message()


def test_stored_job_description_is_resolved_from_its_record(client, llm):
    os_req = {
        "requirement": "Operating Systems", "kind": "technical_skill", "importance": "mandatory",
        "jd_evidence": "Concurrency, multithreading, and OS internals", "classification": "missing",
        "resume_evidence": [], "missing_information": "", "gap_type": "skill_gap", "next_step": "",
    }
    llm.reply = groq_reply(llm_payload(requirements=[os_req]))
    res = post(client, resume_text=RESUME, jd_id="jd_sample_google_swe")
    assert res.status_code == 200, res.text
    assert res.json()["job"]["kind"] == "stored"
    assert [r["requirement"] for r in res.json()["requirements"]] == ["Operating Systems"]
    user = llm.user_message()
    assert "Google LLC" in user and "Concurrency, multithreading, and OS internals" in user
    assert "Example Corp" not in user


# ── Input validation ────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "form,files,status,code",
    [
        ({"jd_text": JD}, None, 400, "missing_resume"),
        ({"resume_text": RESUME}, None, 400, "missing_job"),
        ({"resume_text": RESUME, "jd_text": JD}, {"resume_file": ("r.txt", RESUME.encode(), "text/plain")}, 400, "ambiguous_resume"),
        ({"resume_text": RESUME, "jd_text": JD, "jd_id": "jd_sample_google_swe"}, None, 400, "ambiguous_job"),
        ({"resume_text": RESUME, "jd_id": "jd_does_not_exist"}, None, 404, "job_not_found"),
        ({"resume_text": RESUME, "jd_text": "Python developer wanted."}, None, 422, "job_too_short"),
        ({"resume_text": "Python", "jd_text": JD}, None, 422, "too_short"),
        ({"jd_text": JD}, {"resume_file": ("photo.png", b"\x89PNG....", "image/png")}, 415, "unsupported"),
        ({"jd_text": JD}, {"resume_file": ("broken.pdf", b"not a pdf at all", PDF_TYPE)}, 422, "unreadable"),
        ({"jd_text": JD}, {"resume_file": ("binary.txt", b"\x00\x01\x02binary", "text/plain")}, 422, "unreadable"),
        ({"jd_text": JD}, {"resume_file": ("latin.txt", "Résumé".encode("latin-1") * 50, "text/plain")}, 422, "unreadable"),
    ],
)
def test_invalid_inputs_are_rejected_before_any_llm_call(client, llm, form, files, status, code):
    res = post(client, files=files, **form)
    assert res.status_code == status, res.text
    assert res.json()["code"] == code
    assert llm.bodies == []


def test_resume_over_the_size_bound_is_rejected(client, llm):
    res = post(client, resume_text="Python developer. " * 2000, jd_text=JD)
    assert res.status_code == 413
    assert llm.bodies == []


# ── Factual safeguards ──────────────────────────────────────────────────────

def test_fabricated_evidence_is_removed_and_downgraded(client, llm):
    payload = llm_payload()
    payload["requirements"][2] = {
        **payload["requirements"][2],
        "classification": "matched",
        "resume_evidence": ["Deployed services with Docker and Kubernetes"],  # not in the resume
    }
    llm.reply = groq_reply(payload)
    body = post(client, resume_text=RESUME, jd_text=JD).json()

    docker = next(r for r in body["requirements"] if r["requirement"] == "Docker")
    assert docker["classification"] == "unverified"
    assert docker["resume_evidence"] == []
    assert docker["note"]
    assert body["safeguards"]["evidence_quotes_removed"] == 1
    assert body["safeguards"]["requirements_downgraded"] == 1


def test_requirements_not_in_the_job_description_are_dropped(client, llm):
    payload = llm_payload()
    payload["requirements"].append({
        "requirement": "Rust", "kind": "technical_skill", "importance": "mandatory",
        "jd_evidence": "Expert Rust programming", "classification": "missing",
        "resume_evidence": [], "missing_information": "", "gap_type": "skill_gap", "next_step": "",
    })
    llm.reply = groq_reply(payload)
    body = post(client, resume_text=RESUME, jd_text=JD).json()
    assert "Rust" not in [r["requirement"] for r in body["requirements"]]
    assert body["safeguards"]["requirements_dropped"] == 1


def test_rewrites_that_invent_figures_or_text_are_removed(client, llm):
    payload = llm_payload()
    payload["bullet_improvements"] += [
        {   # invents a percentage
            "original_text": "cleaned sales data with pandas", "problem": "p", "recommendation": "r",
            "improved_example": "Cleaned sales data with pandas, cutting errors by 40%.", "alignment": "a",
        },
        {   # quotes text that is not in the resume
            "original_text": "Led a team of engineers", "problem": "p", "recommendation": "r",
            "improved_example": "Led engineers.", "alignment": "a",
        },
    ]
    llm.reply = groq_reply(payload)
    body = post(client, resume_text=RESUME, jd_text=JD).json()
    assert [s["original_text"] for s in body["bullet_improvements"]] == ["Wrote SQL reports for 3 store managers"]
    assert body["safeguards"]["suggestions_removed"] == 2


def test_resume_text_is_not_logged(client, llm, caplog):
    llm.reply = groq_reply("not json")
    with caplog.at_level(logging.DEBUG):
        post(client, resume_text=RESUME, jd_text=JD)
        post(client, resume_text=RESUME, jd_text=JD.replace("Example Corp", "Example Corp."))
    assert MARKER not in caplog.text
    assert "Example Corp" not in caplog.text


# ── LLM failures never produce a fabricated analysis ────────────────────────

@pytest.mark.parametrize(
    "reply",
    [
        groq_reply("this is not JSON"),
        groq_reply({"summary": "missing the requirements list"}),
        groq_reply(llm_payload(requirements=[{"requirement": "Python", "classification": "great"}])),
        httpx.Response(429, json={"error": {"message": "rate limited"}}),
        httpx.Response(500, json={"error": {"message": "boom"}}),
    ],
)
def test_malformed_output_and_provider_errors_return_an_error(client, llm, reply):
    llm.reply = reply
    res = post(client, resume_text=RESUME, jd_text=JD)
    assert res.status_code == 502
    assert res.json()["code"] == "llm_failed"
    assert "requirements" not in res.json()


def test_no_llm_configured_returns_503(client):
    res = post(client, resume_text=RESUME, jd_text=JD)  # conftest removes every provider key
    assert res.status_code == 503
    assert res.json()["code"] == "llm_not_configured"


def test_all_requirements_unverifiable_is_an_error_not_an_empty_report(client, llm):
    payload = llm_payload()
    for r in payload["requirements"]:
        r["jd_evidence"] = "something the JD never says"
        r["requirement"] = "Haskell"
    llm.reply = groq_reply(payload)
    res = post(client, resume_text=RESUME, jd_text=JD)
    assert res.status_code == 422
    assert res.json()["code"] == "no_requirements"


# ── Scoring ─────────────────────────────────────────────────────────────────

def _req(importance, classification):
    return GapRequirement(requirement="x", importance=importance, classification=classification, jd_evidence="x")


def test_alignment_needs_enough_requirements_and_a_mandatory_one():
    assert compute_alignment([_req("mandatory", "matched"), _req("preferred", "matched")]).score is None
    assert compute_alignment([_req("preferred", "matched")] * 4).score is None


def test_alignment_weights_and_unverified_lower_bound():
    result = compute_alignment([
        _req("mandatory", "matched"), _req("mandatory", "unverified"), _req("preferred", "partial"),
    ])
    assert result.score == round(100 * 2.5 / 5)
    assert "lower bound" in result.explanation
