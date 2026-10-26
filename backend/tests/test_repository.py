"""Database writes with a fake psycopg2 connection (no Supabase needed)."""

import pytest

from app.db.resume_repository import ResumeStorageError, get_parsed_resume, save_parsed_resume

PARSED = {
    "source_file": "a.pdf",
    "name": "Ananya Rao",
    "email": None,
    "headline": "",
    "education": [],
    "skills": [
        {"skill_name": "C++", "category_code": "COD", "evidence": "x", "confidence": "high"},
        {"skill_name": "Git", "category_code": "SWE", "evidence": "y", "confidence": "medium"},
    ],
    "projects": [], "internships": [], "hackathons": [], "certifications": [], "achievements": [], "preferred_roles": [],
}


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        if self.conn.fail_on and self.conn.fail_on in sql:
            raise RuntimeError("simulated database failure")
        self.conn.statements.append((sql.strip().split()[0].lower(), sql, params))

    def fetchone(self):
        return self.conn.row


class FakeConn:
    def __init__(self, fail_on=None, row=("11111111-1111-1111-1111-111111111111", True)):
        self.fail_on, self.row = fail_on, row
        self.statements, self.committed, self.rolled_back, self.closed = [], False, False, False

    def cursor(self):
        return FakeCursor(self)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *a):  # mirrors psycopg2: commit or rollback
        if exc_type:
            self.rolled_back = True
        else:
            self.committed = True
        return False

    def close(self):
        self.closed = True


def test_saves_resume_and_skills_in_one_transaction():
    conn = FakeConn()
    result = save_parsed_resume(PARSED, b"file-bytes", "rules", connect=lambda: conn)
    assert result == {"resume_id": "11111111-1111-1111-1111-111111111111", "created": True}
    kinds = [k for k, _, _ in conn.statements]
    assert kinds == ["insert", "delete", "insert", "insert"]  # upsert resume, clear old skills, 2 skills
    skill_rows = [p for k, sql, p in conn.statements if "resume_skills" in sql and k == "insert"]
    assert all(p[0] == result["resume_id"] for p in skill_rows)  # foreign key = this resume
    assert conn.committed and not conn.rolled_back and conn.closed


def test_failed_skill_insert_rolls_back_everything():
    conn = FakeConn(fail_on="insert into public.resume_skills")
    with pytest.raises(ResumeStorageError):
        save_parsed_resume(PARSED, b"file-bytes", "rules", connect=lambda: conn)
    assert conn.rolled_back and not conn.committed and conn.closed


def test_repeat_upload_uses_same_file_hash_and_upsert():
    first, second = FakeConn(), FakeConn(row=("11111111-1111-1111-1111-111111111111", False))
    save_parsed_resume(PARSED, b"same-bytes", "rules", connect=lambda: first)
    out = save_parsed_resume(PARSED, b"same-bytes", "rules", connect=lambda: second)
    assert first.statements[0][2][1] == second.statements[0][2][1]  # identical sha256
    assert "on conflict (file_sha256) do update" in second.statements[0][1]
    assert out["created"] is False


def test_connection_failure_is_reported():
    def boom():
        raise RuntimeError("no network")

    with pytest.raises(ResumeStorageError):
        save_parsed_resume(PARSED, b"x", "rules", connect=boom)


def test_get_parsed_resume_adds_reference():
    conn = FakeConn(row=("abc", {"name": "Ananya Rao", "resume_reference": None}))
    assert get_parsed_resume("abc", connect=lambda: conn)["resume_reference"] == "abc"
    assert get_parsed_resume("missing", connect=lambda: FakeConn(row=None)) is None
