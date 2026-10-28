"""Data access and repository layer for Skill Matching.

Module Owner: Akshat Mehra (Skill Matching & Scrum Master)
Coordinates Supabase persistence and entity resolution for candidate profiles
and job descriptions. Guarantees that persistence failures are never hidden.
Uses consistent TEXT ID strategy (preserves true candidate and JD identifiers).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional, Any, List, Dict
from app.db.supabase import get_supabase_client, is_supabase_configured
from app.db.profiles import profile_repository
from app.db.jd_repository import jd_repository
from app.db.fixtures import find_candidate_fixture, find_jd_fixture
from app.schemas.skill_match import SkillMatchResponse

logger = logging.getLogger(__name__)


class SkillMatchRepository:
    """Repository handling Skill Matching persistence and entity resolution."""

    def __init__(self, supabase_client: Optional[Any] = None):
        self._client = supabase_client
        self._memory_results: Dict[str, Dict[str, Any]] = {}

    @property
    def client(self):
        if self._client is not None:
            return self._client
        return get_supabase_client()

    def get_profile(self, profile_id: str) -> Optional[dict]:
        """Fetch profile by stable ID. Checks ProfileRepository (Supabase/DB), then fixtures."""
        found = profile_repository.get_by_id(profile_id)
        if found:
            return found.model_dump()
        return find_candidate_fixture(profile_id)

    def get_jd(self, jd_id: str) -> Optional[dict]:
        """Fetch JD by stable ID. Checks JdRepository (Supabase/DB), then fixtures."""
        found = jd_repository.get_by_id(jd_id)
        if found:
            return found
        return find_jd_fixture(jd_id)

    def save_match_result(self, match_response: SkillMatchResponse) -> tuple[bool, Optional[str], Optional[str]]:
        """Persist SkillMatchResponse into Supabase table `skill_match_results`.
        
        Returns: (persisted: bool, match_id: Optional[str], error_message: Optional[str])
        """
        match_id = str(uuid.uuid4())
        result_id = getattr(match_response, "result_id", None) or match_id

        # Keep in memory cache with full fields
        result_record = {
            "result_id": result_id,
            "match_id": match_id,
            "type": "skill_match",
            "profile_id": str(match_response.profile_id),
            "candidate_name": getattr(match_response, "candidate_name", ""),
            "jd_id": str(match_response.jd_id),
            "company": getattr(match_response, "company", ""),
            "role": getattr(match_response, "role", ""),
            "match_score": match_response.match_score,
            "matched_skills": match_response.matched_skills,
            "partial_skills": match_response.partial_skills,
            "missing_skills": match_response.missing_skills,
            "skill_results": [s.model_dump() for s in getattr(match_response, "skill_results", [])],
            "counts": match_response.counts.model_dump() if getattr(match_response, "counts", None) else None,
            "summary": getattr(match_response, "summary", ""),
            "recommendations": [r.model_dump() for r in match_response.recommendations],
            "scoring": match_response.scoring.model_dump() if getattr(match_response, "scoring", None) else None,
            "scoring_version": match_response.scoring_version,
            "scoring_status": match_response.scoring_status,
            "created_at": match_response.created_at,
        }
        self._memory_results[match_id] = result_record
        if result_id and result_id != match_id:
            self._memory_results[result_id] = result_record

        client = self.client
        if client is None:
            return (
                False,
                None,
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
            )

        # Store profile_id and jd_id directly as TEXT
        record = {
            "match_id": match_id,
            "profile_id": str(match_response.profile_id),
            "jd_id": str(match_response.jd_id),
            "match_score": match_response.match_score,
            "matched_skills": match_response.matched_skills,
            "partial_skills": match_response.partial_skills,
            "missing_skills": match_response.missing_skills,
            "recommendations": [r.model_dump() for r in match_response.recommendations],
            "scoring_version": match_response.scoring_version,
            "scoring_status": match_response.scoring_status,
        }

        try:
            res = client.table("skill_match_results").insert(record).execute()
            if hasattr(res, "data") and res.data and len(res.data) > 0:
                inserted_id = res.data[0].get("match_id", match_id)
                return True, str(inserted_id), None
            return True, match_id, None
        except Exception as exc:
            logger.warning("Supabase insert to skill_match_results failed: %s", exc)
            return False, None, f"Database insert failed: {str(exc)}"

    def record_memory_alias(self, alias_id: str, match_response: SkillMatchResponse) -> None:
        """Cache match response under an alias ID (e.g. sm_ephemeral_...)."""
        record = {
            "result_id": alias_id,
            "match_id": getattr(match_response, "match_id", None) or alias_id,
            "type": "skill_match",
            "profile_id": str(match_response.profile_id),
            "candidate_name": getattr(match_response, "candidate_name", ""),
            "jd_id": str(match_response.jd_id),
            "company": getattr(match_response, "company", ""),
            "role": getattr(match_response, "role", ""),
            "match_score": match_response.match_score,
            "matched_skills": match_response.matched_skills,
            "partial_skills": match_response.partial_skills,
            "missing_skills": match_response.missing_skills,
            "skill_results": [s.model_dump() for s in getattr(match_response, "skill_results", [])],
            "counts": match_response.counts.model_dump() if getattr(match_response, "counts", None) else None,
            "summary": getattr(match_response, "summary", ""),
            "recommendations": [r.model_dump() for r in match_response.recommendations],
            "scoring": match_response.scoring.model_dump() if getattr(match_response, "scoring", None) else None,
            "scoring_version": match_response.scoring_version,
            "scoring_status": match_response.scoring_status,
            "created_at": match_response.created_at,
        }
        self._memory_results[alias_id] = record

    def get_match_result(self, match_id: str) -> Optional[dict]:
        """Retrieve a saved match result by ID."""
        if match_id in self._memory_results:
            return self._memory_results[match_id]

        client = self.client
        if client:
            try:
                res = client.table("skill_match_results").select("*").eq("match_id", match_id).execute()
                if res.data and len(res.data) > 0:
                    row = dict(res.data[0])
                    row["result_id"] = row.get("result_id") or row.get("match_id")
                    row["type"] = "skill_match"
                    return row
            except Exception as exc:
                logger.debug("Supabase get_match_result failed: %s", exc)

        return self._memory_results.get(match_id)

    def list_match_results(self, limit: int = 20) -> List[dict]:
        """List recently persisted match results."""
        client = self.client
        if client:
            try:
                res = (
                    client.table("skill_match_results")
                    .select("*")
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    results = []
                    for row in res.data:
                        r = dict(row)
                        r["result_id"] = r.get("result_id") or r.get("match_id")
                        r["type"] = "skill_match"
                        results.append(r)
                    return results
            except Exception as exc:
                logger.debug("Supabase list_match_results failed: %s", exc)

        seen = set()
        unique = []
        for v in self._memory_results.values():
            rid = v.get("result_id") or v.get("match_id")
            if rid and rid not in seen:
                seen.add(rid)
                unique.append(v)
        return unique[:limit]


repository = SkillMatchRepository()
