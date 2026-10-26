"""Google Gemini wrapper (REST API, free tier).

Configuration (backend/.env — never commit it):
    GEMINI_API_KEY=...            # from https://aistudio.google.com/apikey
    GEMINI_MODEL=gemini-3.8-flash # optional (gemini-2.0-flash has been retired by Google)
    LLM_TIMEOUT_SECONDS=60        # optional

If GEMINI_API_KEY is not set, `is_configured()` is False and the resume
extractor uses its rule-based mode instead — nothing is sent anywhere.
"""

import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")  # backend/.env; existing env vars win

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class LLMError(Exception):
    """The LLM could not be reached or returned something unusable."""


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


def generate_json(prompt: str) -> dict:
    """Send a prompt, demand a JSON reply, return it parsed. Raises LLMError."""
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise LLMError("GEMINI_API_KEY is not set.")
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    try:
        response = httpx.post(
            API_URL.format(model=model_name()),
            headers={"x-goog-api-key": key, "Content-Type": "application/json"},
            json=body,
            timeout=timeout,
        )
    except httpx.HTTPError as err:
        raise LLMError(f"Could not reach Gemini: {err.__class__.__name__}") from err
    if response.status_code != 200:
        # Never echo the key; Gemini error bodies don't contain it.
        raise LLMError(f"Gemini returned HTTP {response.status_code}: {response.text[:300]}")
    try:
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, TypeError, ValueError) as err:
        raise LLMError("Gemini returned a response that is not valid JSON.") from err
