"""Saves parsed resumes to Supabase Postgres (Owner: Mahi Aggarwal).

Uses the existing tables (no migration needed):
- parsed_resumes   one row per uploaded file; UNIQUE (file_sha256)
- resume_skills    one row per skill; FK resume_id → parsed_resumes ON DELETE CASCADE,
                   UNIQUE (resume_id, lower(skill_name))

Uploading the same file again updates its existing row instead of creating a
duplicate, so the returned resume_id stays the same for that file. Talent Check
already reads these tables (app/services/profile_loader.py), so a saved resume
can be assessed with POST /api/talent-check using profile_id = resume_id.

Only the parsed fields are stored. The uploaded file itself is not kept.
Saving is controlled by SAVE_PARSED_RESUMES in backend/.env (true/false).
"""

import json
import os
from typing import Any, Dict

from app.db import get_db_connection

PARSED_FIELDS = ("education", "projects", "internships", "hackathons", "certifications", "achievements", "preferred_roles")


class ResumeStoreError(Exception):
    """The database save failed. The message is safe to show (no SQL or credentials)."""


def persistence_enabled() -> bool:
    return os.getenv("SAVE_PARSED_RESUMES", "false").strip().lower() in ("1", "true", "yes", "on")


def save_parsed_resume(parsed: Dict[str, Any], file_sha256: str, source_file: str, parser_mode: str) -> Dict[str, Any]:
    """Inserts or updates the resume and replaces its skills in one transaction.

    Returns {"resume_id": "<uuid>", "created": bool}. Raises ResumeStoreError on failure.
    """
    try:
        conn = get_db_connection()
    except Exception as exc:
        raise ResumeStoreError("Could not connect to the database.") from exc

    try:
        with conn:  # commits on success, rolls back if anything inside fails
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO parsed_resumes (
                        source_file, file_sha256, candidate_name, email, headline,
                        education, projects, internships, hackathons, certifications,
                        achievements, preferred_roles, parsed_json, parser_mode, source_tag
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'upload')
                    ON CONFLICT (file_sha256) DO UPDATE SET
                        source_file = EXCLUDED.source_file,
                        candidate_name = EXCLUDED.candidate_name,
                        email = EXCLUDED.email,
                        headline = EXCLUDED.headline,
                        education = EXCLUDED.education,
                        projects = EXCLUDED.projects,
                        internships = EXCLUDED.internships,
                        hackathons = EXCLUDED.hackathons,
                        certifications = EXCLUDED.certifications,
                        achievements = EXCLUDED.achievements,
                        preferred_roles = EXCLUDED.preferred_roles,
                        parsed_json = EXCLUDED.parsed_json,
                        parser_mode = EXCLUDED.parser_mode,
                        updated_at = now()
                    RETURNING resume_id, (xmax = 0) AS created;
                    """,
                    (
                        source_file,
                        file_sha256,
                        parsed["name"],
                        parsed.get("email"),
                        parsed.get("headline") or "",
                        *[json.dumps(parsed.get(f) or []) for f in PARSED_FIELDS],
                        json.dumps(parsed),
                        parser_mode,
                    ),
                )
                resume_id, created = cur.fetchone()

                # Replace the skills so a re-upload never leaves stale ones behind.
                cur.execute("DELETE FROM resume_skills WHERE resume_id = %s;", (resume_id,))
                for skill in parsed.get("skills") or []:
                    cur.execute(
                        """
                        INSERT INTO resume_skills (resume_id, skill_name, category_code, evidence, confidence)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (resume_id, lower(skill_name)) DO NOTHING;
                        """,
                        (resume_id, skill["skill_name"], skill["category_code"], skill.get("evidence") or "", skill["confidence"]),
                    )
        return {"resume_id": str(resume_id), "created": bool(created)}
    except Exception as exc:
        # Deliberately vague: database errors can contain connection details or row data.
        raise ResumeStoreError("The database rejected the parsed resume.") from exc
    finally:
        conn.close()
