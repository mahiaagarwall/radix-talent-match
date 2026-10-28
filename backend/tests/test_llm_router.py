"""Tests for LLM configuration and provider failover (app/config.py, app/llm_router.py).

All HTTP traffic goes to an httpx.MockTransport: these are MOCKED integration
tests. They check the real URLs, headers, bodies, retry counts and fallback order
our code produces, but they do not prove that a provider, model or quota works.
For that, run scripts/llm_smoke_test.py by hand.
"""

import json
import logging
from pathlib import Path

import httpx
import pytest

from app import config, llm_router
from app.config import Settings, get_settings
from app.llm_router import LLMNotConfiguredError, LLMRequest, LLMRoutingError, generate

GROQ_KEY = "gsk_testGroqKey1234567890"
OR_KEY = "sk-or-v1-testOpenRouterKey123456"
GEMINI_KEY = "AIzaTestGeminiKey_0123456789abcdef"

OK_JSON = '{"answer": 42}'


def openai_ok(text=OK_JSON):
    return httpx.Response(200, json={"choices": [{"message": {"content": text}, "finish_reason": "stop"}]})


def gemini_ok(text=OK_JSON):
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]})


def provider_of(request: httpx.Request) -> str:
    host = request.url.host
    return {"api.groq.com": "groq", "openrouter.ai": "openrouter", "generativelanguage.googleapis.com": "gemini"}[host]


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", GROQ_KEY)
    monkeypatch.setenv("OPENROUTER_API_KEY", OR_KEY)
    monkeypatch.setenv("GEMINI_API_KEY", GEMINI_KEY)
    get_settings.cache_clear()


@pytest.fixture
def server(monkeypatch):
    """Fake providers. Set server.responses[provider] to a list of responses/exceptions (consumed in order)."""

    class Server:
        def __init__(self):
            self.requests = []
            self.responses = {"groq": [], "openrouter": [], "gemini": []}

        def handle(self, request):
            name = provider_of(request)
            self.requests.append((name, request))
            queue = self.responses[name]
            item = queue.pop(0) if len(queue) > 1 else (queue[0] if queue else None)
            if item is None:
                raise AssertionError(f"unexpected call to {name}")
            if isinstance(item, Exception):
                raise item
            return item

        def calls(self):
            return [name for name, _ in self.requests]

    srv = Server()
    monkeypatch.setattr(llm_router, "_transport", httpx.MockTransport(srv.handle))
    return srv


def run(**kwargs):
    return generate(LLMRequest(system="sys", user="user text", max_tokens=100), **kwargs)


# ── 1-3. Configuration ──────────────────────────────────────────────────────

class TestConfig:
    def test_defaults(self):
        s = Settings()
        assert s.llm_provider == "groq"
        assert s.llm_fallback_enabled is True
        assert s.llm_provider_chain == ("groq", "openrouter", "gemini")
        assert s.groq_model == "openai/gpt-oss-120B"
        assert s.openrouter_model == "nvidia/nemotron-3.5-super-vl:free"
        assert s.gemini_model == "gemini-3.5-flash"
        assert s.llm_configured is False
        assert s.llm_config_errors == []

    def test_env_overrides(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gemini")
        monkeypatch.setenv("LLM_PROVIDER_ORDER", "openrouter,groq")
        monkeypatch.setenv("GROQ_MODEL", "g-model")
        monkeypatch.setenv("OPENROUTER_MODEL", "o-model")
        monkeypatch.setenv("GEMINI_MODEL", "m-model")
        monkeypatch.setenv("OPENROUTER_API_KEY", OR_KEY)
        s = Settings()
        assert s.llm_provider_chain == ("gemini", "openrouter", "groq")
        assert (s.groq_model, s.openrouter_model, s.gemini_model) == ("g-model", "o-model", "m-model")
        assert s.llm_configured is True

    def test_blank_model_uses_default_never_none(self, monkeypatch):
        monkeypatch.setenv("GROQ_MODEL", "   ")
        assert Settings().groq_model == "openai/gpt-oss-120B"

    def test_failover_disabled_chain_is_primary_only(self, monkeypatch):
        monkeypatch.setenv("LLM_FALLBACK_ENABLED", "false")
        assert Settings().llm_provider_chain == ("groq",)

    @pytest.mark.parametrize("var,value", [
        ("LLM_PROVIDER", "openai"),
        ("LLM_PROVIDER_ORDER", "groq,bogus"),
        ("LLM_FALLBACK_ENABLED", "maybe"),
        ("LLM_MAX_RETRIES", "lots"),
        ("LLM_TIMEOUT_SECONDS", "-5"),
    ])
    def test_invalid_values_are_reported_not_accepted(self, monkeypatch, var, value):
        monkeypatch.setenv("GROQ_API_KEY", GROQ_KEY)
        monkeypatch.setenv(var, value)
        s = Settings()  # import/startup must not crash
        assert s.llm_config_errors and var in s.llm_config_errors[0]
        assert s.llm_configured is False
        with pytest.raises(ValueError, match=var):
            s.require_llm()

    def test_bad_upload_limit_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("MAX_UPLOAD_BYTES", "ten megabytes")
        assert Settings().max_upload_bytes == 10 * 1024 * 1024

    def test_require_llm_names_every_variable_but_no_values(self):
        with pytest.raises(ValueError) as exc:
            Settings().require_llm()
        assert all(v in str(exc.value) for v in ("GROQ_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY"))

    def test_cache_clear_picks_up_env_changes(self, monkeypatch):
        assert get_settings().groq_configured is False
        monkeypatch.setenv("GROQ_API_KEY", GROQ_KEY)
        assert get_settings().groq_configured is False  # cached
        get_settings.cache_clear()
        assert get_settings().groq_configured is True

    def test_dotenv_location_is_backend_then_root(self):
        backend_dir = Path(config.__file__).resolve().parent.parent
        assert config.backend_env == backend_dir / ".env"
        assert config.root_env == backend_dir.parent / ".env"

    def test_health_reports_status_without_keys(self, keys):
        from fastapi.testclient import TestClient
        from app.main import app

        for path in ("/health", "/api/health"):
            body = TestClient(app).get(path)
            text = body.text
            llm = body.json()["llm"]
            assert llm["provider_chain"] == ["groq", "openrouter", "gemini"]
            assert llm["providers"]["openrouter"] == {"model": "nvidia/nemotron-3.5-super-vl:free", "api_key_configured": True}
            assert llm["connectivity"] == "not_checked"
            for key in (GROQ_KEY, OR_KEY, GEMINI_KEY):
                assert key not in text


# ── 4-6. Each provider gets its own key, model, URL and format ──────────────

class TestProviderRequests:
    def test_groq_request(self, keys, server):
        server.responses["groq"] = [openai_ok()]
        result = run()
        _, req = server.requests[0]
        body = json.loads(req.content)
        assert str(req.url) == "https://api.groq.com/openai/v1/chat/completions"
        assert req.headers["authorization"] == f"Bearer {GROQ_KEY}"
        assert body["model"] == "openai/gpt-oss-120B"
        assert body["messages"] == [{"role": "system", "content": "sys"}, {"role": "user", "content": "user text"}]
        assert (result.provider, result.model, result.fallback_used, result.text) == ("groq", "openai/gpt-oss-120B", False, OK_JSON)

    def test_openrouter_request(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openrouter")
        get_settings.cache_clear()
        server.responses["openrouter"] = [openai_ok()]
        run()
        _, req = server.requests[0]
        assert str(req.url) == "https://openrouter.ai/api/v1/chat/completions"
        assert req.headers["authorization"] == f"Bearer {OR_KEY}"
        assert json.loads(req.content)["model"] == "nvidia/nemotron-3.5-super-vl:free"

    def test_gemini_request(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gemini")
        get_settings.cache_clear()
        server.responses["gemini"] = [gemini_ok()]
        result = run()
        _, req = server.requests[0]
        body = json.loads(req.content)
        assert str(req.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
        assert req.headers["x-goog-api-key"] == GEMINI_KEY
        assert "authorization" not in req.headers
        assert body["systemInstruction"]["parts"][0]["text"] == "sys"
        assert body["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "low"}
        assert result.text == OK_JSON

    def test_json_schema_is_sent_in_each_providers_format(self, keys, server, monkeypatch):
        schema = {"type": "OBJECT", "properties": {"answer": {"type": "STRING"}}}
        server.responses["groq"] = [openai_ok()]
        generate(LLMRequest(system="sys", user="u", json_schema=schema))
        body = json.loads(server.requests[0][1].content)
        assert body["response_format"] == {"type": "json_object"}
        assert json.dumps(schema) in body["messages"][0]["content"]

        monkeypatch.setenv("LLM_PROVIDER", "gemini")
        get_settings.cache_clear()
        server.responses["gemini"] = [gemini_ok()]
        generate(LLMRequest(system="sys", user="u", json_schema=schema))
        gen = json.loads(server.requests[1][1].content)["generationConfig"]
        assert gen["responseMimeType"] == "application/json" and gen["responseSchema"] == schema

    def test_gemini_thought_parts_are_ignored(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gemini")
        get_settings.cache_clear()
        server.responses["gemini"] = [httpx.Response(200, json={"candidates": [{"content": {"parts": [
            {"text": "thinking...", "thought": True}, {"text": OK_JSON}]}}]})]
        assert run().text == OK_JSON


# ── 7-16. Failover policy ───────────────────────────────────────────────────

class TestFailover:
    def test_groq_rate_limit_falls_over_to_openrouter_and_stops(self, keys, server):
        server.responses["groq"] = [httpx.Response(429, json={"error": {"message": "Rate limit reached"}}, headers={"retry-after": "30"})]
        server.responses["openrouter"] = [openai_ok()]
        result = run()
        # Retry-After 30s exceeds the 5s cap → no retry on Groq; Gemini is never called.
        assert server.calls() == ["groq", "openrouter"]
        assert result.provider == "openrouter" and result.fallback_used is True
        assert [a.category for a in result.attempts] == ["rate_limited", "ok"]

    def test_openrouter_failure_falls_over_to_gemini(self, keys, server):
        server.responses["groq"] = [httpx.Response(503, text="Service Unavailable")]
        server.responses["openrouter"] = [httpx.Response(502, json={"error": {"message": "upstream"}})]
        server.responses["gemini"] = [gemini_ok()]
        result = run()
        assert server.calls() == ["groq", "groq", "openrouter", "openrouter", "gemini"]  # 1 retry each for 5xx
        assert result.provider == "gemini"

    def test_short_retry_after_is_honoured_once(self, keys, server, monkeypatch):
        waits = []
        monkeypatch.setattr(llm_router, "_sleep", waits.append)
        server.responses["groq"] = [httpx.Response(429, headers={"retry-after": "2"}), openai_ok()]
        result = run()
        assert waits == [2.0]
        assert server.calls() == ["groq", "groq"] and result.provider == "groq" and result.fallback_used is False

    def test_all_providers_fail_with_honest_sanitized_error(self, keys, server):
        server.responses["groq"] = [httpx.Response(401, json={"error": {"message": f"Invalid API Key {GROQ_KEY}"}})]
        server.responses["openrouter"] = [httpx.Response(402, json={"error": {"message": "Insufficient credits"}})]
        server.responses["gemini"] = [httpx.Response(403, json=[{"error": {"message": f"key {GEMINI_KEY} denied"}}])]
        with pytest.raises(LLMRoutingError) as exc:
            run()
        message = str(exc.value)
        assert message.startswith("All LLM providers failed.")
        assert exc.value.categories == ["auth_failed", "billing", "permission_denied"]
        assert "openai/gpt-oss-120B" in message and "gemini-3.5-flash" in message
        for key in (GROQ_KEY, OR_KEY, GEMINI_KEY):
            assert key not in message
        assert server.calls() == ["groq", "openrouter", "gemini"]  # permanent errors: no retries

    def test_missing_key_is_skipped(self, server, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", GEMINI_KEY)
        get_settings.cache_clear()
        server.responses["gemini"] = [gemini_ok()]
        result = run()
        assert server.calls() == ["gemini"]
        assert [a.category for a in result.attempts] == ["not_configured", "not_configured", "ok"]
        assert "GROQ_API_KEY is not set" in result.attempts[0].detail
        assert result.fallback_used is True

    def test_no_keys_raises_not_configured_without_any_request(self, server):
        with pytest.raises(LLMNotConfiguredError):
            run()
        assert server.calls() == []

    def test_failover_disabled_never_calls_secondaries(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_FALLBACK_ENABLED", "false")
        get_settings.cache_clear()
        server.responses["groq"] = [httpx.Response(500)]
        with pytest.raises(LLMRoutingError):
            run()
        assert set(server.calls()) == {"groq"}

    def test_auth_error_is_not_retried(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_FALLBACK_ENABLED", "false")
        monkeypatch.setenv("LLM_MAX_RETRIES", "3")
        get_settings.cache_clear()
        server.responses["groq"] = [httpx.Response(401, json={"error": {"message": "Invalid API Key"}})]
        with pytest.raises(LLMRoutingError):
            run()
        assert server.calls() == ["groq"]

    def test_transient_retries_are_bounded(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_FALLBACK_ENABLED", "false")
        monkeypatch.setenv("LLM_MAX_RETRIES", "2")
        get_settings.cache_clear()
        server.responses["groq"] = [httpx.ConnectError("refused")]
        with pytest.raises(LLMRoutingError) as exc:
            run()
        assert server.calls() == ["groq"] * 3
        assert exc.value.categories == ["connection"] * 3

    @pytest.mark.parametrize("response", [
        httpx.Response(404, json={"error": {"message": "The model `x` does not exist", "code": "model_not_found"}}),
        httpx.Response(400, json={"error": {"message": "x is not a valid model ID"}}),
    ])
    def test_invalid_model_reported_accurately(self, keys, server, response):
        server.responses["groq"] = [response]
        server.responses["openrouter"] = [openai_ok()]
        result = run()
        assert result.attempts[0].category == "invalid_model"
        assert server.calls() == ["groq", "openrouter"]

    def test_timeouts_use_bounded_per_attempt_timeout(self, keys, server, monkeypatch):
        monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "7")
        get_settings.cache_clear()
        server.responses["groq"] = [httpx.ReadTimeout("slow")]
        server.responses["openrouter"] = [openai_ok()]
        result = run()
        timeouts = [req.extensions["timeout"]["read"] for _, req in server.requests]
        assert all(t <= 7 for t in timeouts)
        assert [a.category for a in result.attempts] == ["timeout", "timeout", "ok"]

    def test_total_budget_stops_further_attempts(self, keys, server, monkeypatch):
        now = [0.0]
        monkeypatch.setattr(llm_router, "_clock", lambda: now[0])
        monkeypatch.setenv("LLM_TOTAL_TIMEOUT_SECONDS", "10")
        get_settings.cache_clear()

        def slow_fail(request):
            now[0] += 9.5  # each attempt burns most of the budget
            raise httpx.ReadTimeout("slow")

        monkeypatch.setattr(llm_router, "_transport", httpx.MockTransport(slow_fail))
        with pytest.raises(LLMRoutingError) as exc:
            run()
        # Groq's retry is skipped (its backoff would overrun the budget); the others are never sent.
        outcome = [(a.provider, a.category) for a in exc.value.attempts]
        assert outcome == [("groq", "timeout"), ("openrouter", "budget_exhausted"), ("gemini", "budget_exhausted")]

    def test_openrouter_error_inside_200_is_a_failure(self, keys, server):
        server.responses["groq"] = [httpx.Response(500)]
        server.responses["openrouter"] = [httpx.Response(200, json={"error": {"code": 429, "message": "free tier limit"}})]
        server.responses["gemini"] = [gemini_ok()]
        result = run()
        assert "rate_limited" in [a.category for a in result.attempts if a.provider == "openrouter"]
        assert result.provider == "gemini"

    def test_empty_content_moves_to_next_provider(self, keys, server):
        server.responses["groq"] = [httpx.Response(200, json={"choices": [{"message": {"content": ""}, "finish_reason": "length"}]})]
        server.responses["openrouter"] = [openai_ok()]
        result = run()
        assert result.attempts[0].category == "empty_response"
        assert server.calls() == ["groq", "openrouter"]

    def test_programming_errors_are_not_masked(self, keys, server):
        server.responses["groq"] = [openai_ok()]

        def buggy_parse(text):
            raise KeyError("bug in our code")

        with pytest.raises(KeyError):
            run(parse=buggy_parse, parse_errors=(ValueError,))
        assert server.calls() == ["groq"]


# ── 17-19. Structured output and callers ────────────────────────────────────

SAMPLE_JD_OUTPUT = {
    "metadata": {"company_name": "Acme", "job_title": "Engineer"},
    "skills": [{
        "skill_name": "Python", "canonical_skill_id": None, "category_code": "COD", "category_name": "Coding",
        "requirement_type": "required", "importance": "high", "evidence": "Python", "confidence": "high",
    }],
}


class TestCallers:
    def test_jd_extraction_replaces_malformed_output_with_next_provider(self, keys, server):
        from app.skill_extractor import extract_skills

        server.responses["groq"] = [openai_ok("Sorry, I cannot help with that.")]
        server.responses["openrouter"] = [openai_ok(json.dumps(SAMPLE_JD_OUTPUT))]
        result = extract_skills("We need a Python engineer.")
        assert result.skills[0].skill_name == "Python"
        assert server.calls() == ["groq", "openrouter"]
        # The JD system prompt is sent unchanged.
        from prompts.jd_analysis_prompt import JD_ANALYSIS_SYSTEM_PROMPT
        assert json.loads(server.requests[0][1].content)["messages"][0]["content"] == JD_ANALYSIS_SYSTEM_PROMPT

    def test_jd_extraction_all_fail_raises_extraction_error(self, keys, server):
        from app.skill_extractor import ExtractionError, extract_skills

        for name in ("groq", "openrouter", "gemini"):
            server.responses[name] = [httpx.Response(429, headers={"retry-after": "60"})]
        with pytest.raises(ExtractionError) as exc:
            extract_skills("We need a Python engineer.")
        assert "usage limit" in exc.value.user_message

    def test_jd_extraction_without_keys_raises_config_error(self, server):
        from app.skill_extractor import ExtractionError, extract_skills

        with pytest.raises(ExtractionError) as exc:
            extract_skills("We need a Python engineer.")
        assert "GROQ_API_KEY" in exc.value.user_message
        assert server.calls() == []

    def test_resume_parser_uses_router_and_keeps_validation(self, keys, server):
        from app.services import llm_resume_parser as llm

        server.responses["groq"] = [httpx.Response(503)]
        server.responses["openrouter"] = [openai_ok(json.dumps({
            "name": "Jordan Lee", "email": "fake@example.com", "skills": [
                {"skill_name": "Rust", "category_code": "COD", "evidence": "invented", "confidence": "high"}],
        }))]
        out = llm.parse_with_llm(["Jordan Lee", "jordan.lee@example.com", "Skills: Python"])
        assert out["name"] == "Jordan Lee"
        assert out["email"] is None  # not in the resume
        assert out["skills"] == []  # invented skill dropped
        body = json.loads(server.requests[-1][1].content)
        assert body["response_format"] == {"type": "json_object"}

    def test_resume_parser_failure_is_llm_parse_error(self, keys, server):
        from app.services import llm_resume_parser as llm

        for name in ("groq", "openrouter", "gemini"):
            server.responses[name] = [httpx.Response(401)]
        with pytest.raises(llm.LlmParseError):
            llm.parse_with_llm(["Jordan Lee"])

    def test_keys_never_appear_in_logs(self, keys, server, caplog):
        server.responses["groq"] = [httpx.Response(401, json={"error": {"message": f"bad key {GROQ_KEY}"}})]
        server.responses["openrouter"] = [httpx.Response(500, text=f"Authorization: Bearer {OR_KEY}")]
        server.responses["gemini"] = [gemini_ok()]
        with caplog.at_level(logging.DEBUG):
            run()
        for key in (GROQ_KEY, OR_KEY, GEMINI_KEY):
            assert key not in caplog.text
        assert "user text" not in caplog.text  # prompt content is not logged
