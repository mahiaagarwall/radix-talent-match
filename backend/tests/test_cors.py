"""CORS: explicit trusted origins, no wildcard, no credentials."""

from fastapi.testclient import TestClient

from app.config import DEFAULT_CORS_ORIGINS, Settings
from app.main import app

client = TestClient(app)


def preflight(origin: str):
    return client.options(
        "/api/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    )


def test_local_vite_origin_is_allowed_without_credentials():
    res = preflight("http://localhost:5173")
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in res.headers


def test_unknown_origin_is_not_allowed():
    res = preflight("https://evil.example.com")
    assert res.headers.get("access-control-allow-origin") is None
    simple = client.get("/api/health", headers={"Origin": "https://evil.example.com"})
    assert simple.headers.get("access-control-allow-origin") is None


def test_env_origins_replace_defaults_and_wildcard_is_ignored(monkeypatch):
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://app.example.com/, *")
    assert Settings().cors_allow_origins == ["https://app.example.com"]
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "*")
    assert Settings().cors_allow_origins == list(DEFAULT_CORS_ORIGINS)
