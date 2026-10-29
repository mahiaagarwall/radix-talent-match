"""Result store for Talent Check runs.

POST /api/talent-check computes a result on demand; this store keeps each run so
GET /api/results (Dashboard, Results page) and GET /api/results/{id} can return it.
Records live in process memory, like the Skill Matching fallback cache: there is
no talent_check_results table yet, so results do not survive a server restart.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class TalentCheckResultRepository:
    def __init__(self) -> None:
        self._results: Dict[str, Dict[str, Any]] = {}

    def save(self, result: Dict[str, Any]) -> Dict[str, Any]:
        record = {**result, "type": "talent_check", "status": result.get("status") or "completed"}
        self._results[record["result_id"]] = record
        return record

    def get(self, result_id: str) -> Optional[Dict[str, Any]]:
        return self._results.get(result_id)

    def list(self, limit: int = 50) -> List[Dict[str, Any]]:
        items = sorted(self._results.values(), key=lambda r: str(r.get("created_at") or ""), reverse=True)
        return items[:limit]

    def clear(self) -> None:
        self._results.clear()


repository = TalentCheckResultRepository()
