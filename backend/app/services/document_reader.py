"""Read plain text out of PDF and DOCX files.

This module knows nothing about resumes, the API or the LLM — it only turns
file bytes into text, or raises DocumentError with a clear, user-facing message.
Both readers emit bullet items as lines starting with "• " so later steps can
treat PDF and DOCX output the same way.
"""

import io
import zipfile

MIN_TEXT_CHARS = 30  # less than this means there is no usable text layer
BULLET = "• "


class DocumentError(Exception):
    """A file that cannot be read. `code` is one of:
    empty, unsupported, corrupt, encrypted, no_text."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def file_kind(filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return "pdf"
    if name.endswith(".docx"):
        return "docx"
    if name.endswith(".doc"):
        raise DocumentError("unsupported", "Legacy .doc files are not supported. Save the file as .docx or PDF.")
    raise DocumentError("unsupported", f'"{filename}" is not a PDF or DOCX file.')


def _require_text(text: str, filename: str) -> str:
    if len(text.strip()) < MIN_TEXT_CHARS:
        raise DocumentError(
            "no_text",
            f'"{filename}" has no extractable text. It may be a scanned image; OCR is not supported.',
        )
    return text


def read_pdf(file_bytes: bytes, filename: str = "document.pdf") -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    if not file_bytes.startswith(b"%PDF"):
        raise DocumentError("corrupt", f'"{filename}" is not a valid PDF file.')
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            raise DocumentError("encrypted", f'"{filename}" is password-protected. Upload an unlocked copy.')
        pages = [page.extract_text() or "" for page in reader.pages]
    except DocumentError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError, OSError) as err:
        raise DocumentError("corrupt", f'"{filename}" could not be read as a PDF ({err.__class__.__name__}).') from err

    # pypdf marks bullets as "•" already; normalise spacing so every bullet is "• ".
    lines = []
    for raw in "\n".join(pages).splitlines():
        line = raw.strip()
        if line.startswith("•"):
            line = BULLET + line.lstrip("• ").strip()
        lines.append(line)
    return _require_text("\n".join(lines), filename)


def read_docx(file_bytes: bytes, filename: str = "document.docx") -> str:
    import docx

    if not zipfile.is_zipfile(io.BytesIO(file_bytes)):
        raise DocumentError("corrupt", f'"{filename}" is not a valid Word document.')
    try:
        document = docx.Document(io.BytesIO(file_bytes))
    except Exception as err:  # python-docx raises several unrelated exception types
        raise DocumentError("corrupt", f'"{filename}" could not be opened as a Word document.') from err

    lines = []
    for para in document.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        p_pr = para._p.pPr
        is_list_item = p_pr is not None and p_pr.numPr is not None
        lines.append(BULLET + text if is_list_item else text)
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                lines.append(" | ".join(dict.fromkeys(cells)))  # merged cells repeat text
    return _require_text("\n".join(lines), filename)


def read_document(filename: str, file_bytes: bytes) -> str:
    """Validate and read a PDF/DOCX upload. Returns plain text."""
    kind = file_kind(filename)
    if not file_bytes:
        raise DocumentError("empty", f'"{filename}" is empty.')
    return read_pdf(file_bytes, filename) if kind == "pdf" else read_docx(file_bytes, filename)
