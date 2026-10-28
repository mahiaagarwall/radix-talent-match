"""Database repository for candidate profiles in RADIX Talent Match (Owner: Aashish Kumar).

Supports Supabase PostgREST, direct PostgreSQL connections, and graceful in-memory storage
when the external database is unconfigured (for isolated unit tests and offline testing).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.db.supabase import get_supabase_client, get_db_connection, is_supabase_configured
from app.schemas.contracts import Profile, Skill, ResumeReference

logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProfileRepository:
    """Manages candidate_profiles table with live DB persistence and test/offline fallback."""

    def __init__(self):
        # In-memory store for fallback / isolated test runs
        self._memory_store: Dict[str, Profile] = {}

    def _save_to_supabase(self, profile: Profile) -> bool:
        client = get_supabase_client()
        if not client:
            return False

        try:
            dump = profile.model_dump()
            row = {
                "profile_id": dump["profile_id"],
                "name": dump["name"],
                "email": dump.get("email"),
                "education": dump.get("education", []),
                "skills": dump.get("skills", []),
                "projects": dump.get("projects", []),
                "internships": dump.get("internships", []),
                "hackathons": dump.get("hackathons", []),
                "certifications": dump.get("certifications", []),
                "preferred_roles": dump.get("preferred_roles", []),
                "resume_reference": dump.get("resume_reference"),
                "created_at": dump.get("created_at") or now_iso(),
                "updated_at": dump.get("updated_at") or now_iso(),
            }
            client.table("candidate_profiles").upsert(row).execute()

            # Also sync normalized profile_skills if present
            skills = dump.get("skills", [])
            if skills:
                try:
                    client.table("profile_skills").delete().eq("profile_id", profile.profile_id).execute()
                    skill_rows = [
                        {
                            "profile_id": profile.profile_id,
                            "skill_name": s.get("skill_name"),
                            "category_code": s.get("category_code"),
                            "evidence": s.get("evidence", ""),
                            "confidence": s.get("confidence", "medium"),
                        }
                        for s in skills if s.get("skill_name")
                    ]
                    if skill_rows:
                        client.table("profile_skills").insert(skill_rows).execute()
                except Exception as exc:
                    logger.debug("Non-fatal: could not write to profile_skills: %s", exc)

            return True
        except Exception as exc:
            logger.warning("Could not persist profile to Supabase: %s", exc)
            return False

    def create(self, profile: Profile) -> Profile:
        now = now_iso()
        profile_id = profile.profile_id or f"prf_{uuid.uuid4().hex[:12]}"
        created_at = profile.created_at or now
        updated_at = now

        profile_data = profile.model_dump()
        profile_data["profile_id"] = profile_id
        profile_data["created_at"] = created_at
        profile_data["updated_at"] = updated_at

        saved = Profile(**profile_data)
        self._memory_store[profile_id] = saved

        self._save_to_supabase(saved)
        return saved

    def get_by_id(self, profile_id: str) -> Optional[Profile]:
        # 1. Try Supabase first if configured
        client = get_supabase_client()
        if client:
            try:
                res = client.table("candidate_profiles").select("*").eq("profile_id", profile_id).execute()
                if res.data and len(res.data) > 0:
                    row = res.data[0]
                    # Ensure json fields are dicts/lists
                    for field in ["education", "skills", "projects", "internships", "hackathons", "certifications", "preferred_roles"]:
                        if isinstance(row.get(field), str):
                            try:
                                row[field] = json.loads(row[field])
                            except Exception:
                                row[field] = []
                    return Profile(**row)
            except Exception as exc:
                logger.debug("Supabase get_by_id failed, trying fallback: %s", exc)

        # 2. Check in-memory store
        if profile_id in self._memory_store:
            return self._memory_store[profile_id]

        return None

    def list_all(self) -> List[Profile]:
        # 1. Try Supabase first if configured
        client = get_supabase_client()
        if client:
            try:
                res = client.table("candidate_profiles").select("*").order("updated_at", desc=True).execute()
                if res.data:
                    results = []
                    for row in res.data:
                        for field in ["education", "skills", "projects", "internships", "hackathons", "certifications", "preferred_roles"]:
                            if isinstance(row.get(field), str):
                                try:
                                    row[field] = json.loads(row[field])
                                except Exception:
                                    row[field] = []
                        results.append(Profile(**row))
                    return results
            except Exception as exc:
                logger.debug("Supabase list_all failed, using memory store: %s", exc)

        # 2. Return from in-memory store
        return sorted(
            list(self._memory_store.values()),
            key=lambda p: (p.updated_at or "", p.created_at or ""),
            reverse=True,
        )

    def update(self, profile_id: str, updates: Dict[str, Any]) -> Optional[Profile]:
        existing = self.get_by_id(profile_id)
        if not existing:
            return None

        data = existing.model_dump()
        for k, v in updates.items():
            if v is not None and k != "profile_id":
                data[k] = v

        data["updated_at"] = now_iso()
        updated = Profile(**data)
        self._memory_store[profile_id] = updated

        self._save_to_supabase(updated)
        return updated

    def delete(self, profile_id: str) -> bool:
        found = False
        if profile_id in self._memory_store:
            del self._memory_store[profile_id]
            found = True

        client = get_supabase_client()
        if client:
            try:
                res = client.table("candidate_profiles").delete().eq("profile_id", profile_id).execute()
                if res.data and len(res.data) > 0:
                    found = True
            except Exception:
                pass

        return found


profile_repository = ProfileRepository()
