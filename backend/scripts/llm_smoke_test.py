"""Optional live check of ONE LLM provider. Sends one tiny real request.

This uses your API quota, so it is never run by pytest. Run it yourself:

    cd backend
    .\\.venv\\Scripts\\python.exe scripts\\llm_smoke_test.py groq
    .\\.venv\\Scripts\\python.exe scripts\\llm_smoke_test.py openrouter
    .\\.venv\\Scripts\\python.exe scripts\\llm_smoke_test.py gemini

It prints the provider, model, outcome and failure category. It never prints keys.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("groq", "openrouter", "gemini"):
        print("usage: llm_smoke_test.py groq|openrouter|gemini")
        return 2
    provider = sys.argv[1]
    # Pin the chain to the chosen provider before settings are loaded.
    os.environ["LLM_PROVIDER"] = provider
    os.environ["LLM_FALLBACK_ENABLED"] = "false"
    os.environ["LLM_MAX_RETRIES"] = "0"

    from app.config import get_settings
    from app.llm_router import LLMRequest, LLMRoutingError, generate

    settings = get_settings()
    model = settings.llm_model(provider)
    print(f"provider={provider} model={model} api_key_configured={bool(settings.llm_api_key(provider))}")
    try:
        result = generate(LLMRequest(system="You are a health check.", user="Reply with the single word OK.", max_tokens=256))
    except LLMRoutingError as exc:
        print(f"FAILED: {exc}")
        return 1
    print(f"OK: served by {result.provider} ({result.model}) in {result.duration_s:.2f}s; reply={result.text.strip()[:40]!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
