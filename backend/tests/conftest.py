import os
import sys
from pathlib import Path

import httpx
import pytest

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

LLM_ENV_VARS = (
    "LLM_PROVIDER", "LLM_FALLBACK_ENABLED", "LLM_PROVIDER_ORDER",
    "GROQ_API_KEY", "GROQ_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL",
    "LLM_TIMEOUT_SECONDS", "LLM_TOTAL_TIMEOUT_SECONDS", "LLM_MAX_RETRIES", "LLM_RETRY_MAX_WAIT_SECONDS",
    "CORS_ALLOW_ORIGINS",
)


@pytest.fixture(autouse=True)
def isolated_llm(monkeypatch):
    """Tests start with no LLM keys (backend/.env is ignored) and can never reach a real provider."""
    from app import llm_router
    from app.config import get_settings

    for name in LLM_ENV_VARS:
        monkeypatch.delenv(name, raising=False)

    def refuse(request):
        raise AssertionError(f"tests must not call a real LLM provider ({request.url.host})")

    monkeypatch.setattr(llm_router, "_transport", httpx.MockTransport(refuse))
    monkeypatch.setattr(llm_router, "_sleep", lambda seconds: None)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
