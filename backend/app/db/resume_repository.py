"""Save and load parsed resumes (tables from backend/sql/001_resume_tables.sql).

Reuses the team's connection helper `get_db_connection()` from app.db.supabase.
Every save is ONE transaction: the resume row and all its skills are written
together, or nothing is written.
"""

import hashlib
import json

from app.db.supabase import get_db_connection

SECTION_COLUMNS = ("education", "projects", "internships", "hackathons", "certifications", "achievements", "preferred_roles")


class ResumeStorageError(Exception):
    """The parsed resume could not be saved or loaded."""


def file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


UPSERT_RESUME = f"""
    insert into public.parsed_resumes
        (source_file, file_sha256, candidate_name, email, headline, {", ".join(SECTION_COLUMNS)},
         parsed_json, parser_mode, source_tag)
    values (%s, %s, %s, %s, %s, {", ".join(["%s::jsonb"] * len(SECTION_COLUMNS))}, %s::jsonb, %s, %s)
    on conflict (file_sha256) do update set
        source_file = excluded.source_file,
        candidate_name = excluded.candidate_name,
        email = excluded.email,
        headline = excluded.headline,
        {", ".join(f"{c} = excluded.{c}" for c in SECTION_COLUMNS)},
        parsed_json = excluded.parsed_json,
        parser_mode = excluded.parser_mode,
        updated_at = now()
    returning resume_id::text, (xmax = 0) as inserted
"""

INSERT_SKILL = """
    insert into public.resume_skills (resume_id, skill_name, category_code, evidence, confidence)
    values (%s, %s, %s, %s, %s)
"""


def save_parsed_resume(parsed: dict, file_bytes: bytes, parser_mode: str, source_tag: str = "upload", connect=get_db_connection) -> dict:
    """Insert or update (same file hash) one resume and replace its skills atomically.

    Returns {"resume_id": str, "created": bool}. Re-uploading the same file updates
    that same row only; other candidates are never touched.
    """
    conn = None
    try:
        conn = connect()
        with conn:  # psycopg2: commit on success, rollback on any exception
            with conn.cursor() as cur:
                cur.execute(
                    UPSERT_RESUME,
                    (
                        parsed.get("source_file") or "unknown",
                        file_hash(file_bytes),
                        parsed["name"],
                        parsed.get("email"),
                        parsed.get("headline", ""),
                        *[json.dumps(parsed.get(c, [])) for c in SECTION_COLUMNS],
                        json.dumps({**parsed, "resume_reference": None}),
                        parser_mode,
                        source_tag,
                    ),
                )
                resume_id, inserted = cur.fetchone()
                cur.execute("delete from public.resume_skills where resume_id = %s", (resume_id,))
                for s in parsed.get("skills", []):
                    cur.execute(INSERT_SKILL, (resume_id, s["skill_name"], s["category_code"], s["evidence"], s["confidence"]))
        return {"resume_id": resume_id, "created": bool(inserted)}
    except Exception as err:
        raise ResumeStorageError(f"Could not save the parsed resume: {err.__class__.__name__}: {str(err)[:200]}") from err
    finally:
        if conn is not None:
            conn.close()


def get_parsed_resume(resume_id: str, connect=get_db_connection):
    """Return the stored contract JSON (with resume_reference), or None if not found."""
    conn = None
    try:
        conn = connect()
        with conn.cursor() as cur:
            cur.execute(
                "select resume_id::text, parsed_json from public.parsed_resumes where resume_id::text = %s",
                (resume_id,),
            )
            row = cur.fetchone()
    except Exception as err:
        raise ResumeStorageError(f"Could not load resume {resume_id}: {err.__class__.__name__}") from err
    finally:
        if conn is not None:
            conn.close()
    if not row:
        return None
    rid, parsed = row
    parsed = parsed if isinstance(parsed, dict) else json.loads(parsed)
    return {**parsed, "resume_reference": rid}
