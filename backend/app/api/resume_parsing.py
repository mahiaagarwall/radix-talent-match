"""Resume Parsing endpoint (Owner: Mahi Aggarwal).

POST /api/resumes/parse   multipart/form-data with one field: file (PDF or DOCX)

Flow: validate file → extract text → parse (LLM via Groq → OpenRouter → Gemini failover if any provider key is set, else rules) → (optionally) save to Supabase → return JSON.
Errors come back as {"detail": "<message for the user>", "code": "<reason>"}.
"""

import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, File, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.schemas.resume_parsing import ParsedResumeResponse
from app.services.llm_resume_parser import LlmParseError, llm_enabled, parse_with_llm
from app.services.resume_parser import collect_warnings, parse_resume_lines
from app.services.resume_store import ResumeStoreError, persistence_enabled, save_parsed_resume
from app.services.resume_text_extractor import ResumeFileError, extract_text_lines, max_upload_bytes, validate_upload

router = APIRouter(tags=["Resume Parsing"])
logger = logging.getLogger(__name__)


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": message, "code": code})


def process_resume(filename: str, content_type: str, data: bytes) -> dict:
    """Runs the whole pipeline for one file. Kept separate from the route so it is easy to test."""
    kind = validate_upload(filename, content_type, data)
    lines = extract_text_lines(data, kind)

    # LLM first (handles any layout); the rule-based parser is the fallback.
    parser_mode, llm_note = "rules", None
    parsed = None
    if llm_enabled():
        try:
            parsed = parse_with_llm(lines)
            parser_mode = "llm"
        except LlmParseError as exc:
            logger.warning("LLM resume parsing failed, using rules: %s", exc)
            llm_note = f"{exc} The rule-based parser was used instead."
    if parsed is None:
        parsed = parse_resume_lines(lines, kind)
    elif not parsed["skills"]:
        # Keep the LLM's structure but fall back to rule-based skills if it found none.
        parsed["skills"] = parse_resume_lines(lines, kind)["skills"]

    warnings = collect_warnings(parsed)
    if llm_note:
        warnings.insert(0, llm_note)

    resume_reference = None
    if not persistence_enabled():
        persistence = {"status": "disabled", "message": "Saving parsed resumes is turned off (SAVE_PARSED_RESUMES)."}
    elif not parsed["name"]:
        persistence = {"status": "skipped", "message": "Not saved: the database requires a candidate name."}
    else:
        try:
            saved = save_parsed_resume(parsed, hashlib.sha256(data).hexdigest(), filename, parser_mode)
            resume_reference = saved["resume_id"]
            persistence = (
                {"status": "saved", "message": "Saved to Supabase (parsed_resumes)."}
                if saved["created"]
                else {"status": "updated", "message": "This file was uploaded before; its saved record was updated."}
            )
        except ResumeStoreError as exc:
            # Log the reason type only: the cause may contain row data or connection strings.
            logger.warning("Resume save failed: %s", type(exc.__cause__).__name__)
            persistence = {"status": "failed", "message": f"{exc} The parsed data below was not saved."}

    return {
        **parsed,
        "source_file": filename,
        "resume_reference": resume_reference,
        "parser_mode": parser_mode,
        "warnings": warnings,
        "persistence": persistence,
    }


@router.post(
    "/resumes/parse",
    response_model=ParsedResumeResponse,
    summary="Parse an uploaded PDF or DOCX resume",
    responses={
        400: {"description": "No file uploaded"},
        413: {"description": "File too large"},
        415: {"description": "Unsupported file type"},
        422: {"description": "Empty, damaged, encrypted or scanned (image-only) file"},
    },
)
async def parse_resume(file: Optional[UploadFile] = File(None)):
    if file is None or not file.filename:
        return _error(400, "missing", "No file was uploaded. Send a PDF or DOCX resume in the 'file' field.")

    # Read at most limit + 1 bytes, so a huge upload is rejected without loading all of it.
    data = await file.read(max_upload_bytes() + 1)
    await file.close()

    try:
        # Parsing and the database call are blocking work; running them in a worker
        # thread keeps the server responsive to other requests meanwhile.
        return await run_in_threadpool(process_resume, file.filename, file.content_type or "", data)
    except ResumeFileError as exc:
        return _error(exc.status_code, exc.code, exc.message)
    except Exception as exc:
        logger.error("Resume parsing failed unexpectedly: %s", type(exc).__name__)
        return _error(500, "parse_failed", "The resume could not be parsed because of an unexpected server error.")
