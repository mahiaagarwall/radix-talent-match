"""app/config.py — Unified configuration loader for RADIX Talent Match.

Reads settings from environment variables and .env files.
Never hardcodes credentials or secrets.

Settings are cached by get_settings(). After changing environment variables
at runtime, call get_settings.cache_clear() or restart the server.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Dict, List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

# Safe optional load_dotenv so the application can start even if python-dotenv is not installed
try:
    from dotenv import load_dotenv

    # Load .env from backend/ or workspace root
    backend_env = Path(__file__).resolve().parent.parent / ".env"
    root_env = Path(__file__).resolve().parent.parent.parent / ".env"

    if backend_env.exists():
        load_dotenv(dotenv_path=backend_env)
    elif root_env.exists():
        load_dotenv(dotenv_path=root_env)
    else:
        load_dotenv()
except ImportError:
    pass


SUPPORTED_LLM_PROVIDERS: Tuple[str, ...] = ("groq", "openrouter", "gemini")

# Local Vite dev (5173) and preview (4173) servers.
DEFAULT_CORS_ORIGINS: Tuple[str, ...] = (
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
)

DEFAULT_LLM_PROVIDER_ORDER = "groq,openrouter,gemini"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120B"
DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free"
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"

# Environment variable holding each provider's API key / model.
LLM_KEY_ENV: Dict[str, str] = {
    "groq": "GROQ_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "gemini": "GEMINI_API_KEY",
}
LLM_MODEL_ENV: Dict[str, str] = {
    "groq": "GROQ_MODEL",
    "openrouter": "OPENROUTER_MODEL",
    "gemini": "GEMINI_MODEL",
}


def _env_str(name: str, default: str = "") -> str:
    """Returns the stripped variable, or the default when it is unset or blank."""
    return (os.environ.get(name) or "").strip() or default


def _env_secret(name: str) -> Optional[str]:
    return (os.environ.get(name) or "").strip() or None


def _env_bool(name: str, default: bool, errors: List[str]) -> bool:
    raw = (os.environ.get(name) or "").strip().lower()
    if not raw:
        return default
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    errors.append(f"{name} must be true or false (got '{raw}').")
    return default


def _env_number(name: str, default: float, minimum: float, maximum: float, errors: List[str]) -> float:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        errors.append(f"{name} must be a number (got '{raw}').")
        return default
    if not minimum <= value <= maximum:
        errors.append(f"{name} must be between {minimum:g} and {maximum:g} (got {value:g}).")
        return default
    return value


class Settings:
    """Central configuration object for the unified application."""

    def __init__(self) -> None:
        # Problems with LLM settings. They do not stop the app from starting;
        # require_llm() raises them and the health endpoints report them.
        errors: List[str] = []

        # ── LLM routing ─────────────────────────────────────────────────────
        self.llm_provider: str = _env_str("LLM_PROVIDER", "groq").lower()
        if self.llm_provider not in SUPPORTED_LLM_PROVIDERS:
            errors.append(
                f"Unsupported LLM_PROVIDER '{self.llm_provider}'. "
                f"Choose one of: {', '.join(SUPPORTED_LLM_PROVIDERS)}."
            )

        order: List[str] = []
        for name in _env_str("LLM_PROVIDER_ORDER", DEFAULT_LLM_PROVIDER_ORDER).lower().split(","):
            name = name.strip()
            if not name or name in order:
                continue
            if name not in SUPPORTED_LLM_PROVIDERS:
                errors.append(
                    f"Unsupported provider '{name}' in LLM_PROVIDER_ORDER. "
                    f"Choose from: {', '.join(SUPPORTED_LLM_PROVIDERS)}."
                )
                continue
            order.append(name)
        self.llm_provider_order: Tuple[str, ...] = tuple(order)
        self.llm_fallback_enabled: bool = _env_bool("LLM_FALLBACK_ENABLED", True, errors)

        # Per-attempt timeout, overall budget for one operation across all
        # providers, extra attempts per provider for transient errors, and the
        # longest wait honoured before a retry (longer Retry-After → next provider).
        self.llm_timeout_seconds: float = _env_number("LLM_TIMEOUT_SECONDS", 45.0, 1, 600, errors)
        self.llm_total_timeout_seconds: float = _env_number("LLM_TOTAL_TIMEOUT_SECONDS", 120.0, 1, 1800, errors)
        self.llm_max_retries: int = int(_env_number("LLM_MAX_RETRIES", 1, 0, 3, errors))
        self.llm_retry_max_wait_seconds: float = _env_number("LLM_RETRY_MAX_WAIT_SECONDS", 5.0, 0, 60, errors)

        # ── Groq ────────────────────────────────────────────────────────────
        self.groq_api_key: Optional[str] = _env_secret("GROQ_API_KEY")
        self.groq_model: str = _env_str("GROQ_MODEL", DEFAULT_GROQ_MODEL)

        # ── OpenRouter ──────────────────────────────────────────────────────
        self.openrouter_api_key: Optional[str] = _env_secret("OPENROUTER_API_KEY")
        self.openrouter_model: str = _env_str("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL)

        # ── Gemini ──────────────────────────────────────────────────────────
        self.gemini_api_key: Optional[str] = _env_secret("GEMINI_API_KEY")
        self.gemini_model: str = _env_str("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)

        self.llm_config_errors: List[str] = errors

        # ── Supabase ────────────────────────────────────────────────────────
        self.supabase_url: Optional[str] = os.environ.get("SUPABASE_URL")
        self.supabase_key: Optional[str] = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
        )
        self.database_url: Optional[str] = os.environ.get("DATABASE_URL")
        self.database_url_direct: Optional[str] = os.environ.get("DATABASE_URL_DIRECT")

        # ── Upload limits ───────────────────────────────────────────────────
        default_upload = 10 * 1024 * 1024
        upload_errors: List[str] = []
        self.max_upload_bytes: int = int(_env_number("MAX_UPLOAD_BYTES", default_upload, 1, 1024 ** 3, upload_errors))
        for message in upload_errors:
            logger.warning("%s Using the default of %d bytes.", message, default_upload)

        # ── CORS ────────────────────────────────────────────────────────────
        # Browser origins allowed to call the API. "*" is ignored: list real origins.
        origins = [o.strip().rstrip("/") for o in _env_str("CORS_ALLOW_ORIGINS").split(",")]
        self.cors_allow_origins: List[str] = [o for o in origins if o and o != "*"] or list(DEFAULT_CORS_ORIGINS)

        # ── Application ─────────────────────────────────────────────────────
        self.app_env: str = os.environ.get("APP_ENV", "development")
        self.log_level: str = os.environ.get("LOG_LEVEL", "INFO")
        self.save_parsed_resumes: bool = os.environ.get("SAVE_PARSED_RESUMES", "false").strip().lower() in ("1", "true", "yes", "on")

    # ── LLM helpers ─────────────────────────────────────────────────────────

    @property
    def llm_provider_chain(self) -> Tuple[str, ...]:
        """Providers to try, in order. LLM_PROVIDER always goes first; the rest
        follow LLM_PROVIDER_ORDER. With failover disabled only LLM_PROVIDER is used."""
        if self.llm_provider not in SUPPORTED_LLM_PROVIDERS:
            return ()
        if not self.llm_fallback_enabled:
            return (self.llm_provider,)
        return (self.llm_provider,) + tuple(p for p in self.llm_provider_order if p != self.llm_provider)

    def llm_api_key(self, provider: str) -> Optional[str]:
        return getattr(self, f"{provider}_api_key", None)

    def llm_model(self, provider: str) -> str:
        return getattr(self, f"{provider}_model")

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def openrouter_configured(self) -> bool:
        return bool(self.openrouter_api_key)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def llm_configured(self) -> bool:
        """True when the settings are valid and at least one provider in the chain has a key.
        This says nothing about whether the provider, model, or quota actually work."""
        return not self.llm_config_errors and any(self.llm_api_key(p) for p in self.llm_provider_chain)

    def require_llm(self) -> None:
        if self.llm_config_errors:
            raise ValueError("Invalid LLM configuration: " + " ".join(self.llm_config_errors))
        if not any(self.llm_api_key(p) for p in self.llm_provider_chain):
            needed = " or ".join(LLM_KEY_ENV[p] for p in self.llm_provider_chain)
            raise ValueError(f"No LLM provider is configured. Set {needed} in backend/.env.")

    def require_gemini(self) -> None:
        if not self.gemini_configured:
            raise ValueError("GEMINI_API_KEY is not set. Add it to your backend/.env file.")

    def llm_status(self) -> Dict[str, object]:
        """Configuration readiness for health checks. Never includes key values."""
        return {
            "configured": self.llm_configured,
            "primary_provider": self.llm_provider,
            "failover_enabled": self.llm_fallback_enabled,
            "provider_chain": list(self.llm_provider_chain),
            "providers": {
                p: {"model": self.llm_model(p), "api_key_configured": bool(self.llm_api_key(p))}
                for p in SUPPORTED_LLM_PROVIDERS
            },
            "config_errors": list(self.llm_config_errors),
            # A configured key does not prove the model exists or that quota is available.
            "connectivity": "not_checked",
        }

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    def require_supabase(self) -> None:
        if not self.supabase_configured:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must both be set to use database-backed features.")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
