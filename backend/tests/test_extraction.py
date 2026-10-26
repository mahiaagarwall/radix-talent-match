"""Rule-mode extraction checked against the sample pack.

Expected values come from the supplied resumes and the hand-annotated answer key
in frontend/src/data/fixtures/resumes.js.
"""

import pytest

from app.services.document_reader import read_document
from app.services.resume_extractor import ExtractionError, extract_resume
from app.services.resume_sections import parse_sections
from conftest import CANDIDATES, make_docx, sample_bytes

VALID_CODES = {"COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"}

EXPECTED = {
    "Ananya Rao": {
        "grade": "CGPA 8.6 / 10",
        "roles": ["Software Engineer", "Backend Engineer"],
        "skills": {"C++": ("COD", "high"), "Python": ("COD", "medium"), "Data Structures & Algorithms": ("DSA", "high"),
                   "Computer Networks": ("NETW", "medium"), "Object-Oriented Design": ("OOD", "high"),
                   "System Design": ("SYSD", "medium")},
        "certifications": 0, "internships": 1, "hackathons": 1, "projects": 3,
    },
    "Karthik Subramaniam": {
        "grade": "CGPA 8.2 / 10",
        "roles": ["Data Analyst", "Data Scientist"],
        "skills": {"SQL": ("SQL", "high"), "Java (basic)": ("COD", "medium"), "Statistics": ("APTI", "medium"),
                   "A/B testing (basics)": ("APTI", "high"), "Database Schema Design": ("SQL", "medium")},
        "certifications": 1, "internships": 1, "hackathons": 1, "projects": 3,
    },
    "Priya Menon": {
        "grade": "CGPA 7.4 / 10",
        "roles": ["Application Support Analyst", "Associate Software Engineer"],
        "skills": {"SQL (basic)": ("SQL", "high"), "Java": ("COD", "high"), "Linux (basics)": ("OS", "medium"),
                   "Networking (fundamentals)": ("NETW", "medium"), "Technical Troubleshooting": ("OTHER", "medium")},
        "certifications": 1, "internships": 1, "hackathons": 1, "projects": 2,
    },
    "Rohan Verma": {
        "grade": "CGPA 9.1 / 10",
        "roles": ["Software Engineer", "Data Scientist", "Backend Engineer"],
        "skills": {"System Design": ("SYSD", "high"), "Machine Learning (basic)": ("AI", "high"), "Docker": ("CLOUD", "medium"),
                   "Software Engineering Practices": ("SWE", "medium"), "Open-source Contribution": ("OTHER", "medium")},
        "certifications": 0, "internships": 1, "hackathons": 1, "projects": 3,
    },
}


def parse(candidate, kind="pdf"):
    data = sample_bytes(candidate, kind)
    return extract_resume(read_document(f"{candidate}.{kind}", data), f"{candidate}.{kind}")


@pytest.mark.parametrize("candidate", CANDIDATES)
def test_sample_matches_answer_key(candidate):
    parsed, mode = parse(candidate)
    exp = EXPECTED[candidate]
    assert mode == "rules"
    assert parsed["name"] == candidate
    assert parsed["email"] is None  # no sample resume has an email — never invented
    assert parsed["source_file"] == f"{candidate}.pdf"
    assert parsed["headline"] == parse(candidate, "docx")[0]["headline"]  # wrapped PDF headline re-joined in full
    assert parsed["education"][0]["grade"] == exp["grade"]
    assert parsed["education"][0]["graduation_year"] == "2026"
    assert parsed["preferred_roles"] == exp["roles"]
    for key in ("certifications", "internships", "hackathons", "projects"):
        assert len(parsed[key]) == exp[key], key
    by_name = {s["skill_name"]: s for s in parsed["skills"]}
    for name, (category, confidence) in exp["skills"].items():
        assert name in by_name, f"missing {name}"
        assert by_name[name]["category_code"] == category
        assert by_name[name]["confidence"] == confidence


@pytest.mark.parametrize("candidate", CANDIDATES)
def test_pdf_and_docx_agree(candidate):
    pdf, _ = parse(candidate, "pdf")
    docx, _ = parse(candidate, "docx")
    strip = lambda p: [(s["skill_name"], s["category_code"], s["confidence"]) for s in p["skills"]]
    assert strip(pdf) == strip(docx)


@pytest.mark.parametrize("candidate", CANDIDATES)
def test_every_skill_is_contract_valid_and_evidenced(candidate):
    parsed, _ = parse(candidate)
    text = read_document(f"{candidate}.pdf", sample_bytes(candidate, "pdf")).lower()
    names = [s["skill_name"].lower() for s in parsed["skills"]]
    assert len(names) == len(set(names)), "duplicate skills"
    for s in parsed["skills"]:
        assert s["category_code"] in VALID_CODES
        assert s["confidence"] in {"high", "medium", "low"}
        if s["evidence"] != "Listed under Technical Skills":
            assert s["evidence"].rstrip("…")[:40].lower() in " ".join(text.split()), s


def test_different_resumes_give_different_results():
    a, _ = parse("Ananya Rao")
    k, _ = parse("Karthik Subramaniam")
    assert {s["skill_name"] for s in a["skills"]} != {s["skill_name"] for s in k["skills"]}
    assert "System Design" in {s["skill_name"] for s in a["skills"]}
    assert "System Design" not in {s["skill_name"] for s in k["skills"]}


def test_missing_sections_and_email_found_in_text():
    text = "Jane Doe\njane.doe@example.org\nTechnical Skills\nPython, SQL\n"
    parsed, _ = extract_resume(text, "jane.pdf")
    assert parsed["email"] == "jane.doe@example.org"
    assert parsed["projects"] == [] and parsed["education"] == [] and parsed["internships"] == []
    assert {s["skill_name"]: s["confidence"] for s in parsed["skills"]} == {"Python": "medium", "SQL": "medium"}


def test_no_false_keyword_matches():
    text = "Sam Lee\nTechnical Skills\nJavaScript\nProjects\n• Built a JavaScript dashboard for a cosmos fan club\n"
    names = {s["skill_name"] for s in extract_resume(text, "s.pdf")[0]["skills"]}
    assert "Java" not in names  # "JavaScript" must not imply Java
    assert "Operating Systems" not in names  # "cosmos" must not match "os"


def test_resume_without_a_name_is_rejected():
    with pytest.raises(ExtractionError):
        extract_resume("technical skills\npython, sql, lots of text here for length", "x.pdf")


def test_page_banner_is_not_taken_as_name():
    sec = parse_sections("Company Banner · Test Data\nPage 1\nAsha Kumar\nHeadline here\n")
    assert sec["name"] == "Asha Kumar"


def test_docx_list_items_become_projects():
    data = make_docx(["Ravi Shah", "Projects", "Built a chat app using Java"])
    parsed, _ = extract_resume(read_document("r.docx", data), "r.docx")
    assert parsed["projects"][0]["description"] == "Built a chat app using Java"
