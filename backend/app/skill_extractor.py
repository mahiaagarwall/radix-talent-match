
"""
app/skill_extractor.py — LLM integration for JD Analyzer.

Responsibilities:
 1. Import JD_ANALYSIS_SYSTEM_PROMPT from prompts/jd_analysis_prompt.py.
 2. Send it through app.llm_router (Groq → OpenRouter → Gemini failover).
 3. Build the system + human messages.
 4. Supply extracted JD text and reference data through a human-message template.
 5. Parse and validate the LLM's JSON response into LLMAnalysisResult.
 6. Handle malformed responses, timeouts, rate limits, and provider errors.

Never hardcode the system prompt.
Never expose API credentials in logs or responses.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from prompts.jd_analysis_prompt import JD_ANALYSIS_SYSTEM_PROMPT
from app.config import Settings, get_settings
from app.llm_router import LLMRequest, LLMResult, LLMRoutingError, generate
from app.schemas import LLMAnalysisResult, LLMJobMetadata, LLMSkill

logger = logging.getLogger(__name__)


class ExtractionError(Exception):
    """Raised when skill extraction fails in a non-recoverable way."""

    def __init__(self, message: str, user_message: Optional[str] = None):
        super().__init__(message)
        self.user_message = user_message or message



class _RoutedChain:
    """Sends the JD prompt through app.llm_router (Groq → OpenRouter → Gemini).

    invoke() returns the raw text of the first provider whose response passes
    _parse_llm_response, so a malformed answer from one provider is replaced by
    the next provider's instead of failing the whole analysis.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.last_result: Optional[LLMResult] = None

    def invoke(self, inputs: Dict[str, str]) -> str:
        self.last_result = generate(
            LLMRequest(system=JD_ANALYSIS_SYSTEM_PROMPT, user=inputs["human_input"], max_tokens=8192),
            parse=_parse_llm_response,
            parse_errors=(ExtractionError,),
            settings=self.settings,
        )
        return self.last_result.text


def _build_chain():
    """Build the LLM pipeline for the configured provider chain."""
    settings = get_settings()
    settings.require_llm()
    return _RoutedChain(settings)


def _routing_user_message(exc: LLMRoutingError) -> str:
    categories = set(exc.categories)
    if categories and categories <= {"rate_limited", "billing"}:
        return "The AI service has reached its usage limit on every configured provider. Please wait and try again."
    if categories and categories <= {"timeout", "budget_exhausted"}:
        return "The AI service did not respond in time. Please try again."
    if categories & {"auth_failed", "permission_denied", "invalid_model"}:
        return (
            "No AI provider could complete the analysis. Check the API keys and model names "
            "(GROQ_*, OPENROUTER_*, GEMINI_*) in backend/.env. Details: " + str(exc)
        )
    return "No AI provider could complete the analysis. Please try again. Details: " + str(exc)


def _build_human_message(
    jd_text: str,
    reference_data: Dict[str, Any],
) -> str:
    """Build the human-turn message containing the JD text and reference data."""
    ref_json = json.dumps(reference_data, indent=2)
    return (
        f"REFERENCE DATA:\n{ref_json}\n\n"
        f"JOB DESCRIPTION:\n{jd_text}\n\n"
        "Analyse the job description above and return the structured JSON output "
        "as specified in the system instructions."
    )


def _clean_llm_response(raw: str) -> str:
    """Strip markdown fences and leading/trailing whitespace from LLM output."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()




def _parse_llm_response(raw: str) -> LLMAnalysisResult:
    """
    Parse and validate the LLM's raw JSON string into LLMAnalysisResult.

    Normalizes common Groq response variations before validation.
    Raises ExtractionError for malformed or unusable responses.
    """
    cleaned = _clean_llm_response(raw)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        # Recover a JSON object if the model adds surrounding text.
        # This pattern handles a basic outermost JSON object, but is
        # not a full JSON parser for arbitrarily nested braces.
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)

        if not match:
            raise ExtractionError(
                f"LLM returned invalid JSON: {exc}",
                user_message=(
                    "The AI model returned a response that could not "
                    "be parsed. Please try again."
                ),
            ) from exc

        try:
            data = json.loads(match.group())
        except json.JSONDecodeError as parse_exc:
            raise ExtractionError(
                f"LLM returned invalid JSON: {parse_exc}",
                user_message=(
                    "The AI model returned a response that could not "
                    "be parsed. Please try again."
                ),
            ) from parse_exc

    if not isinstance(data, dict):
        raise ExtractionError(
            "LLM response must be a JSON object.",
            user_message=(
                "The AI model returned an unexpected response. "
                "Please try again."
            ),
        )

    metadata_data = data.get("metadata") or {}
    skills_data = data.get("skills") or []

    if not isinstance(metadata_data, dict):
        metadata_data = {}
    else:
        metadata_data = dict(metadata_data)

    if not isinstance(skills_data, list):
        skills_data = []

    # Normalize qualifications into a list of strings.
    qualifications = metadata_data.get("qualifications", [])

    if isinstance(qualifications, dict):
        normalized_qualifications = []

        for label in ("required", "preferred"):
            items = qualifications.get(label, [])

            if isinstance(items, list):
                normalized_qualifications.extend(
                    f"{label.title()}: {item.strip()}"
                    for item in items
                    if isinstance(item, str) and item.strip()
                )

        metadata_data["qualifications"] = normalized_qualifications

    elif isinstance(qualifications, list):
        metadata_data["qualifications"] = [
            item.strip()
            for item in qualifications
            if isinstance(item, str) and item.strip()
        ]

    elif qualifications is None:
        metadata_data["qualifications"] = []

    else:
        metadata_data["qualifications"] = []

    # Normalize each skill independently.
    normalized_skills: List[Dict[str, Any]] = []

    for item in skills_data:
        if not isinstance(item, dict):
            continue

        skill = dict(item)

        # Some model responses represent proficiency as an object.
        proficiency = skill.get("target_proficiency")

        if isinstance(proficiency, dict):
            level_id = proficiency.get("level_id")

            skill["proficiency_evidence"] = (
                proficiency.get("evidence")
                or skill.get("proficiency_evidence")
            )

            try:
                skill["target_proficiency"] = (
                    int(level_id) if level_id is not None else None
                )
            except (TypeError, ValueError):
                skill["target_proficiency"] = None

        skill_id = skill.get("canonical_skill_id")

        if skill_id is not None:
            skill["canonical_skill_id"] = str(skill_id)

        # Normalize category fields BEFORE appending the skill.
        for field in ("category_code", "category_name"):
            value = skill.get(field)
            skill[field] = value.strip() if isinstance(value, str) else ""

        # IMPORTANT: append exactly once, outside the field loop.
        normalized_skills.append(skill)

    data["metadata"] = metadata_data
    data["skills"] = normalized_skills

    try:
        return LLMAnalysisResult.model_validate(data)

    except Exception as exc:
        logger.warning(
            "LLM response failed schema validation: %s",
            exc,
        )

        # Attempt partial recovery: keep independently valid skills
        # and valid metadata.
        try:
            validated_skills: List[LLMSkill] = []

            for skill in normalized_skills:
                try:
                    validated_skills.append(
                        LLMSkill.model_validate(skill)
                    )
                except Exception as skill_exc:
                    logger.warning(
                        "Skipping invalid skill record %r: %s",
                        skill.get("skill_name", "<unknown>"),
                        skill_exc,
                    )

            metadata = LLMJobMetadata.model_validate(metadata_data)

            return LLMAnalysisResult(
                metadata=metadata,
                skills=validated_skills,
                analysis_notes=data.get("analysis_notes"),
            )

        except Exception as inner_exc:
            raise ExtractionError(
                f"LLM response validation failed: {exc} / {inner_exc}",
                user_message=(
                    "The AI model's response did not match the expected "
                    "format. Please try again."
                ),
            ) from inner_exc



def extract_skills(
    jd_text: str,
    reference_data: Optional[Dict[str, Any]] = None,
) -> LLMAnalysisResult:
    """
    Extract structured skill data from a job description using the configured LLM chain.

    Args:
        jd_text: Plain text of the job description.
        reference_data: Optional canonical skills, proficiency levels,
            and roadmap topics from the database.

    Returns:
        A validated LLMAnalysisResult.

    Raises:
        ExtractionError: If configuration, invocation, or parsing fails.
    """
    if not jd_text or not jd_text.strip():
        raise ExtractionError(
            "JD text is empty.",
            user_message=(
                "The job description text is empty. "
                "Cannot perform analysis."
            ),
        )

    human_input = _build_human_message(
        jd_text,
        reference_data or {},
    )

    try:
        chain = _build_chain()
    except ExtractionError:
        raise
    except ValueError as exc:
        # Configuration errors name environment variables only, never their values.
        logger.error("LLM is not configured: %s", exc)
        raise ExtractionError(
            f"LLM is not configured: {exc}",
            user_message=str(exc),
        ) from exc

    logger.info(
        "Invoking JD analysis model (%d characters).",
        len(jd_text),
    )

    try:
        raw_response = chain.invoke({"human_input": human_input})
    except LLMRoutingError as exc:
        logger.error("JD analysis failed on every LLM provider: %s", exc)
        raise ExtractionError(
            f"LLM invocation failed: {exc}",
            user_message=_routing_user_message(exc),
        ) from exc
    except Exception as exc:
        error_text = str(exc).lower()

        if any(
            term in error_text
            for term in ("rate", "quota", "429", "rate_limit")
        ):
            logger.warning("LLM rate limit or quota error.")
            raise ExtractionError(
                f"LLM rate limit / quota exceeded: {exc}",
                user_message=(
                    "The AI service has reached its usage limit. "
                    "Please wait and try again."
                ),
            ) from exc

        if "timeout" in error_text or "timed out" in error_text:
            logger.warning("LLM request timed out.")
            raise ExtractionError(
                f"LLM request timed out: {exc}",
                user_message=(
                    "The AI service did not respond in time. "
                    "Please try again."
                ),
            ) from exc

        logger.error(
            "LLM invocation failed: %s",
            type(exc).__name__,
        )
        raise ExtractionError(
            f"LLM invocation failed: {exc}",
            user_message=(
                "The AI model encountered an error. "
                "Check your configuration and try again."
            ),
        ) from exc

    if not isinstance(raw_response, str):
        raise ExtractionError(
            "LLM returned a non-string response.",
            user_message=(
                "The AI model returned an unexpected response. "
                "Please try again."
            ),
        )

    return _parse_llm_response(raw_response)
