"""app/llm_router.py — Single entry point for every LLM call, with provider failover.

Providers are tried in the order given by Settings.llm_provider_chain
(default: Groq → OpenRouter → Gemini). Each provider uses its own API key and
model from app/config.py. All calls go over plain HTTPS with httpx, so there is
exactly one retry layer (this module) and no SDK retries stacked on top of it.

Failure policy per provider:
- rate limits (429), 5xx/overload, timeouts and connection errors are transient:
  retried up to LLM_MAX_RETRIES times (honouring a short Retry-After), then the
  next provider is tried;
- auth (401), permission (403), billing (402), unknown model and rejected
  requests (400) are not retried; the next provider is tried at once;
- a response that is empty or fails the caller's validation moves to the next
  provider without retrying the same one;
- a provider without an API key is skipped;
- every operation stops after LLM_TOTAL_TIMEOUT_SECONDS.

Anything else (a bug in our code) is not caught here and propagates unchanged.
Error messages and logs never contain API keys, headers, prompts or responses.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple, Type
from urllib.parse import quote

import httpx

from app.config import LLM_KEY_ENV, Settings, get_settings

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

TRANSIENT = {"rate_limited", "unavailable", "overloaded", "timeout", "connection"}

# Tests replace this with httpx.MockTransport so no real request is ever sent.
_transport: Optional[httpx.BaseTransport] = None
_sleep = time.sleep
_clock = time.monotonic


@dataclass
class LLMRequest:
    system: str
    user: str
    max_tokens: int = 8192
    # Gemini-style (OpenAPI subset) schema. When set, the provider is asked for JSON output.
    json_schema: Optional[Dict[str, Any]] = None


@dataclass
class LLMAttempt:
    provider: str
    model: str
    category: str  # "ok", "not_configured", "budget_exhausted", or a failure category
    status_code: Optional[int] = None
    detail: str = ""
    duration_s: float = 0.0


@dataclass
class LLMResult:
    text: str
    value: Any
    provider: str
    model: str
    fallback_used: bool
    attempts: List[LLMAttempt] = field(default_factory=list)
    duration_s: float = 0.0


class LLMProviderError(Exception):
    """One failed call to one provider. The message is already sanitized."""

    def __init__(self, category: str, detail: str, status_code: Optional[int] = None, retry_after: Optional[float] = None):
        super().__init__(detail)
        self.category = category
        self.status_code = status_code
        self.retry_after = retry_after


class LLMRoutingError(Exception):
    """Every eligible provider failed (or none was configured). Safe to show and log."""

    def __init__(self, message: str, attempts: List[LLMAttempt]):
        super().__init__(message)
        self.attempts = attempts

    @property
    def categories(self) -> List[str]:
        return [a.category for a in self.attempts if a.category not in ("ok", "not_configured")]


class LLMNotConfiguredError(LLMRoutingError, ValueError):
    """No provider in the chain has an API key, or the LLM settings are invalid."""


# ── Sanitizing ──────────────────────────────────────────────────────────────

_KEY_PATTERNS = re.compile(r"(gsk_[A-Za-z0-9]{8,}|sk-or-[A-Za-z0-9-]{8,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+\S+)")


def _sanitize(text: str, secrets: Tuple[str, ...] = (), limit: int = 200) -> str:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    for secret in secrets:
        if secret:
            text = text.replace(secret, "[redacted]")
    return _KEY_PATTERNS.sub("[redacted]", text)[:limit]


def _all_keys(settings: Settings) -> Tuple[str, ...]:
    return tuple(k for k in (settings.llm_api_key(p) for p in LLM_KEY_ENV) if k)


# ── HTTP ────────────────────────────────────────────────────────────────────

def _post(url: str, headers: Dict[str, str], body: Dict[str, Any], timeout: float) -> httpx.Response:
    with httpx.Client(transport=_transport, timeout=timeout) as client:
        return client.post(url, headers=headers, json=body)


def _retry_after(response: httpx.Response) -> Optional[float]:
    try:
        return max(0.0, float(response.headers.get("retry-after", "")))
    except ValueError:
        return None  # HTTP-date form is not worth parsing for a few-second wait


def _error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text
    if isinstance(data, list) and data:
        data = data[0]
    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict):
        return str(err.get("message") or err.get("code") or "")
    return str(err or "")


def _classify(status: int, message: str) -> str:
    lowered = message.lower()
    if status == 429:
        return "rate_limited"
    if status == 401:
        return "auth_failed"
    if status == 402:
        return "billing"
    if status == 403:
        return "permission_denied"
    if status == 404:
        return "invalid_model"
    if status in (400, 422):
        model_words = ("not a valid model", "model_not_found", "does not exist", "decommissioned", "not found", "no endpoints found")
        if "model" in lowered and any(w in lowered for w in model_words):
            return "invalid_model"
        if "api key" in lowered or "api_key" in lowered:
            return "auth_failed"
        return "bad_request"
    if status in (503, 529) and "overload" in lowered:
        return "overloaded"
    if status == 408 or status == 504:
        return "timeout"
    if status >= 500:
        return "unavailable"
    return "unexpected_status"


def _send(url: str, headers: Dict[str, str], body: Dict[str, Any], timeout: float, secrets: Tuple[str, ...]) -> Dict[str, Any]:
    try:
        response = _post(url, headers, body, timeout)
    except httpx.TimeoutException as exc:
        raise LLMProviderError("timeout", f"No response within {timeout:.0f}s.") from exc
    except httpx.TransportError as exc:
        raise LLMProviderError("connection", f"Could not connect ({type(exc).__name__}).") from exc

    if response.status_code != 200:
        message = _error_message(response)
        raise LLMProviderError(
            _classify(response.status_code, message),
            f"HTTP {response.status_code}: {_sanitize(message, secrets)}",
            status_code=response.status_code,
            retry_after=_retry_after(response),
        )
    try:
        data = response.json()
    except ValueError as exc:
        raise LLMProviderError("malformed_response", "Response body was not JSON.", 200) from exc
    if not isinstance(data, dict):
        raise LLMProviderError("malformed_response", "Response body was not a JSON object.", 200)
    return data


# ── Provider adapters ───────────────────────────────────────────────────────

def _openai_compatible(url: str, extra_headers: Dict[str, str]):
    """Groq and OpenRouter both expose the OpenAI chat-completions format."""

    def call(request: LLMRequest, model: str, key: str, timeout: float, secrets: Tuple[str, ...]) -> str:
        system = request.system
        body: Dict[str, Any] = {"model": model, "temperature": 0, "max_tokens": request.max_tokens}
        if request.json_schema is not None:
            # json_object mode is widely supported; the schema itself travels in the prompt.
            body["response_format"] = {"type": "json_object"}
            system += "\n\nReturn only a JSON object that matches this schema:\n" + json.dumps(request.json_schema)
        body["messages"] = [{"role": "system", "content": system}, {"role": "user", "content": request.user}]

        data = _send(url, {"Authorization": f"Bearer {key}", **extra_headers}, body, timeout, secrets)
        if data.get("error") and not data.get("choices"):
            # OpenRouter can report upstream failures inside a 200 response.
            err = data["error"] if isinstance(data["error"], dict) else {"message": data["error"]}
            code = err.get("code") if isinstance(err.get("code"), int) else 502
            message = str(err.get("message") or "")
            raise LLMProviderError(_classify(code, message), f"Upstream error {code}: {_sanitize(message, secrets)}", code)
        try:
            choice = data["choices"][0]
            text = choice["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("malformed_response", "Response had no message content.", 200) from exc
        if not isinstance(text, str) or not text.strip():
            reason = choice.get("finish_reason") if isinstance(choice, dict) else None
            raise LLMProviderError("empty_response", f"Model returned no text (finish_reason={reason}).", 200)
        return text

    return call


def _gemini(request: LLMRequest, model: str, key: str, timeout: float, secrets: Tuple[str, ...]) -> str:
    generation: Dict[str, Any] = {"temperature": 0, "maxOutputTokens": request.max_tokens}
    if request.json_schema is not None:
        generation["responseMimeType"] = "application/json"
        generation["responseSchema"] = request.json_schema
    if model.startswith("gemini-3"):
        # Gemini 3 models "think" before answering by default, which can take over a
        # minute. Extraction does not need deep reasoning, so keep it low and fast.
        generation["thinkingConfig"] = {"thinkingLevel": "low"}
    body = {
        "systemInstruction": {"parts": [{"text": request.system}]},
        "contents": [{"role": "user", "parts": [{"text": request.user}]}],
        "generationConfig": generation,
    }
    data = _send(GEMINI_URL.format(model=quote(model, safe="")), {"x-goog-api-key": key}, body, timeout, secrets)
    try:
        candidate = data["candidates"][0]
    except (KeyError, IndexError, TypeError) as exc:
        reason = (data.get("promptFeedback") or {}).get("blockReason")
        category = "blocked" if reason else "malformed_response"
        raise LLMProviderError(category, f"No candidates returned (blockReason={reason}).", 200) from exc
    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
    if not text.strip():
        reason = candidate.get("finishReason")
        category = "blocked" if reason in ("SAFETY", "RECITATION", "PROHIBITED_CONTENT") else "empty_response"
        raise LLMProviderError(category, f"Model returned no text (finishReason={reason}).", 200)
    return text


PROVIDERS: Dict[str, Callable[..., str]] = {
    "groq": _openai_compatible(GROQ_URL, {}),
    "openrouter": _openai_compatible(OPENROUTER_URL, {"X-Title": "RADIX Talent Match"}),
    "gemini": _gemini,
}


# ── Router ──────────────────────────────────────────────────────────────────

def generate(
    request: LLMRequest,
    *,
    parse: Optional[Callable[[str], Any]] = None,
    parse_errors: Tuple[Type[BaseException], ...] = (),
    settings: Optional[Settings] = None,
) -> LLMResult:
    """Runs one LLM operation with failover and returns the first valid result.

    parse validates a provider's text. If it raises one of parse_errors, that
    response is treated as unusable and the next provider is tried.
    Raises LLMNotConfiguredError or LLMRoutingError; never returns a fake result.
    """
    settings = settings or get_settings()
    try:
        settings.require_llm()
    except ValueError as exc:
        raise LLMNotConfiguredError(str(exc), []) from exc

    secrets = _all_keys(settings)
    started = _clock()
    deadline = started + settings.llm_total_timeout_seconds
    attempts: List[LLMAttempt] = []
    sent_any = False

    for provider in settings.llm_provider_chain:
        model = settings.llm_model(provider)
        key = settings.llm_api_key(provider)
        if not key:
            attempts.append(LLMAttempt(provider, model, "not_configured", detail=f"{LLM_KEY_ENV[provider]} is not set."))
            continue

        for attempt_no in range(settings.llm_max_retries + 1):
            remaining = deadline - _clock()
            if remaining < 1:
                attempts.append(LLMAttempt(provider, model, "budget_exhausted", detail="Overall LLM time budget used up."))
                break
            timeout = min(settings.llm_timeout_seconds, remaining)
            t0 = _clock()
            sent_any = True
            try:
                text = PROVIDERS[provider](request, model, key, timeout, secrets)
                value = parse(text) if parse else text
            except LLMProviderError as exc:
                attempts.append(LLMAttempt(provider, model, exc.category, exc.status_code, str(exc), _clock() - t0))
                logger.warning("LLM %s (%s) failed: %s [%s]", provider, model, exc.category, str(exc))
                if exc.category not in TRANSIENT or attempt_no == settings.llm_max_retries:
                    break
                wait = exc.retry_after if exc.retry_after is not None else float(2 ** attempt_no)
                if wait > settings.llm_retry_max_wait_seconds or _clock() + wait >= deadline - 1:
                    break  # waiting that long would stall the request; try the next provider
                _sleep(wait)
                continue
            except parse_errors as exc:
                detail = _sanitize(str(exc), secrets)
                attempts.append(LLMAttempt(provider, model, "invalid_output", 200, detail, _clock() - t0))
                logger.warning("LLM %s (%s) returned unusable output: %s", provider, model, detail)
                break

            attempts.append(LLMAttempt(provider, model, "ok", 200, "", _clock() - t0))
            result = LLMResult(
                text=text,
                value=value,
                provider=provider,
                model=model,
                fallback_used=provider != settings.llm_provider_chain[0],
                attempts=attempts,
                duration_s=_clock() - started,
            )
            logger.info(
                "LLM call served by provider=%s model=%s fallback=%s attempts=%d duration=%.2fs",
                provider, model, result.fallback_used, sum(a.category != "not_configured" for a in attempts), result.duration_s,
            )
            return result

    summary = "; ".join(f"{a.provider} ({a.model}): {a.category}" + (f" — {a.detail}" if a.detail else "") for a in attempts)
    if not sent_any:
        raise LLMRoutingError(f"No LLM request could be sent. {summary}", attempts)
    raise LLMRoutingError(f"All LLM providers failed. {summary}", attempts)
