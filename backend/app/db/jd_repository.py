"""Database repository for Job Descriptions in RADIX Talent Match (Owner: Krishna Pandey / Shared).

Provides persistent storage for analyzed and saved JDs, with fallback to sample fixtures.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.db.supabase import get_supabase_client
from app.db.fixtures import find_jd_fixture, JD_FIXTURES

logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class JdRepository:
    """Manages job_descriptions table with live Supabase persistence and fixture fallbacks."""

    def __init__(self):
        self._memory_store: Dict[str, Dict[str, Any]] = {}
        # Pre-seed memory store with sample fixtures
        for key, jd in JD_FIXTURES.items():
            jid = jd.get("jd_id") or key
            if jid:
                self._memory_store[jid] = {
                    "jd_id": jid,
                    "company": jd.get("company", ""),
                    "role": jd.get("role", ""),
                    "role_category": jd.get("role_category", ""),
                    "location": jd.get("location", ""),
                    "employment_type": jd.get("employment_type", ""),
                    "source_type": "jd",
                    "source_file": jd.get("source_file"),
                    "source_kind": "sample-fixture",
                    "skills": jd.get("skills", []),
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                }

    def save(self, jd_data: Dict[str, Any]) -> Dict[str, Any]:
        now = now_iso()
        jd_id = jd_data.get("jd_id") or f"jd_{uuid.uuid4().hex[:12]}"
        created_at = jd_data.get("created_at") or now

        record = dict(jd_data)
        record["jd_id"] = jd_id
        record["created_at"] = created_at
        record["updated_at"] = now
        record["source_type"] = record.get("source_type") or "jd"

        self._memory_store[jd_id] = record

        client = get_supabase_client()
        if client:
            try:
                row = {
                    "jd_id": jd_id,
                    "company": record.get("company", ""),
                    "role": record.get("role", ""),
                    "role_category": record.get("role_category"),
                    "location": record.get("location"),
                    "employment_type": record.get("employment_type"),
                    "source_type": record["source_type"],
                    "source_file": record.get("source_file"),
                    "source_kind": record.get("source_kind", "upload"),
                    "experience_requirements": record.get("experience_requirements"),
                    "education_requirements": record.get("education_requirements"),
                    "raw_text": record.get("raw_text"),
                    "skills": record.get("skills", []),
                    "created_at": created_at,
                    "updated_at": now,
                }
                client.table("job_descriptions").upsert(row).execute()
            except Exception as exc:
                logger.warning("Could not persist JD to Supabase: %s", exc)

        return record

    def get_by_id(self, jd_id: str) -> Optional[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("job_descriptions").select("*").eq("jd_id", jd_id).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as exc:
                logger.debug("Supabase JD get_by_id failed: %s", exc)

        if jd_id in self._memory_store:
            return self._memory_store[jd_id]

        return find_jd_fixture(jd_id)

    def list_all(self) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("job_descriptions").select("*").order("updated_at", desc=True).execute()
                if res.data and len(res.data) > 0:
                    return res.data
            except Exception as exc:
                logger.debug("Supabase JD list_all failed: %s", exc)

        return sorted(
            list(self._memory_store.values()),
            key=lambda j: (j.get("updated_at") or "", j.get("created_at") or ""),
            reverse=True,
        )


jd_repository = JdRepository()
