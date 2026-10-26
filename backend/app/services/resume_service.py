"""Resume Parsing use-case: upload -> text -> parsed JSON -> database -> response.

HTTP mapping (see docs/api-contract.md §3):
    400  bad file (empty, wrong type, corrupt, encrypted, no text, too large)
    422  file readable but no usable resume content (e.g. no name found)
    502  LLM failure (only when GEMINI_API_KEY is set)
    503  parsed fine but the database save failed — never reported as success

Set SAVE_PARSED_RESUMES=false in backend/.env to skip the database (e.g. before
the SQL migration has been run). The response then has resume_reference = null.
"""

import os

from fastapi import HTTPException

from app.services.document_reader import DocumentError, read_document
from app.services.llm_service import LLMError
from app.services.resume_extractor import ExtractionError, extract_resume

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def persistence_enabled() -> bool:
    return os.getenv("SAVE_PARSED_RESUMES", "true").strip().lower() not in ("0", "false", "no", "off")


def parse_upload(filename: str, file_bytes: bytes) -> dict:
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f'"{filename}" is larger than 10 MB.')
    try:
        text = read_document(filename, file_bytes)
    except DocumentError as err:
        raise HTTPException(400, err.message) from err
    try:
        parsed, mode = extract_resume(text, source_file=filename)
    except LLMError as err:
        raise HTTPException(502, f"Resume extraction service failed: {err}") from err
    except ExtractionError as err:
        raise HTTPException(422, str(err)) from err

    if persistence_enabled():
        from app.db.resume_repository import ResumeStorageError, save_parsed_resume

        try:
            saved = save_parsed_resume(parsed, file_bytes, mode)
        except ResumeStorageError as err:
            raise HTTPException(
                503,
                f"The resume was parsed but NOT saved to the database. {err} "
                "Check that backend/sql/001_resume_tables.sql has been run in Supabase.",
            ) from err
        parsed["resume_reference"] = saved["resume_id"]
    return parsed


def load_resume(resume_id: str) -> dict:
    from app.db.resume_repository import ResumeStorageError, get_parsed_resume

    try:
        found = get_parsed_resume(resume_id)
    except ResumeStorageError as err:
        raise HTTPException(503, str(err)) from err
    if not found:
        raise HTTPException(404, f"Resume {resume_id} was not found.")
    return found
