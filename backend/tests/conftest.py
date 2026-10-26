import io
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

DATA = BACKEND.parent / "data" / "resumes"
CANDIDATES = ["Ananya Rao", "Karthik Subramaniam", "Priya Menon", "Rohan Verma"]


@pytest.fixture(autouse=True)
def offline_env(monkeypatch):
    """Unit tests never call Gemini or Supabase unless a test opts in."""
    if os.getenv("RUN_LIVE_TESTS") != "1":
        monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("SAVE_PARSED_RESUMES", "false")


def sample_bytes(candidate: str, kind: str) -> bytes:
    return (DATA / kind / f"{candidate}.{kind}").read_bytes()


def make_pdf(text_pages=None, encrypt=False) -> bytes:
    """Build a small PDF. text_pages=None -> a blank page with no text layer."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    if encrypt:
        writer.encrypt("secret")
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def make_docx(paragraphs) -> bytes:
    import docx

    document = docx.Document()
    for p in paragraphs:
        document.add_paragraph(p)
    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()
