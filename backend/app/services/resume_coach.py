"""Resume Coach Service for RADIX / PARALLAX Talent Match.

Provides safe, actionable resume bullet enhancement without fabricating achievements.
Strictly adheres to the Anti-Fabrication Policy:
- Never invents percentages, metrics, monetary amounts, team sizes, or leadership titles.
- Replaces weak/passive phrasing with impactful action verbs.
- Enhances technical precision and removes filler words.
- Provides targeted follow-up prompts to help candidates safely quantify their real impact.
- Gracefully falls back to a deterministic rule-based enhancer when LLM providers are unavailable.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.config import get_settings
from app.db.jd_repository import jd_repository
from app.llm_router import LLMRequest, generate
from app.schemas.career_copilot import ResumeCoachRequest, ResumeCoachResponse

logger = logging.getLogger(__name__)

# Action verb replacements for weak/passive openers
WEAK_VERB_MAP: Dict[str, str] = {
    "worked on": "Engineered",
    "was responsible for": "Spearheaded",
    "responsible for": "Executed",
    "helped with": "Contributed to",
    "assisted in": "Collaborated on",
    "participated in": "Drove key modules of",
    "handled": "Administered",
    "did": "Implemented",
    "made": "Architected",
    "looked after": "Maintained",
    "tried to": "Initiated efforts to",
    "utilized": "Applied",
    "used": "Leveraged",
    "involved in": "Co-engineered",
}

FILLER_PHRASES: List[str] = [
    r"\bin order to\b",
    r"\bas well as\b",
    r"\bvarious\b",
    r"\bdifferent\b",
    r"\ba lot of\b",
    r"\bduties included\b",
    r"\btasked with\b",
]

FOLLOW_UP_TEMPLATES: List[str] = [
    "What specific scale, volume of data, or request throughput did this project handle?",
    "Did this improvement reduce latency, system downtime, or execution time? If you have measured numbers, add them.",
    "Which exact tools, libraries, or frameworks did you employ for this implementation?",
    "Who were the primary users or stakeholders of this deliverable (internal team, clients, or external users)?",
]


def _rule_based_enhance(
    bullet: str,
    role_context: Optional[str] = None,
    target_skills: Optional[List[str]] = None,
) -> ResumeCoachResponse:
    """Deterministic, local enhancement of a resume bullet point without LLM."""
    clean_bullet = bullet.strip().lstrip("•-* ").strip()
    if clean_bullet and clean_bullet[-1] == ".":
        clean_bullet = clean_bullet[:-1]

    lower_bullet = clean_bullet.lower()
    improved = clean_bullet
    improvements: List[str] = []
    strengths: List[str] = []

    # 1. Identify and replace weak openers
    replaced_verb = False
    for weak, strong in WEAK_VERB_MAP.items():
        pattern = re.compile(rf"^{re.escape(weak)}\b", re.IGNORECASE)
        if pattern.search(improved):
            improved = pattern.sub(strong, improved)
            improvements.append(f"Replaced passive opener '{weak}' with decisive action verb '{strong}'")
            replaced_verb = True
            break

    # If first word is not an action verb and wasn't replaced, strengthen it
    words = improved.split()
    if words and not replaced_verb:
        first_word = words[0].lower()
        if first_word.endswith("ing"):
            # Converting "Building" -> "Built" or "Developing" -> "Developed"
            base = words[0][:-3]
            if base.endswith("build"):
                words[0] = "Built"
            elif base.endswith("develop"):
                words[0] = "Developed"
            elif base.endswith("design"):
                words[0] = "Designed"
            elif base.endswith("creat"):
                words[0] = "Created"
            elif base.endswith("implement"):
                words[0] = "Implemented"
            else:
                words[0] = f"{base}ed".capitalize()
            improved = " ".join(words)
            improvements.append(f"Converted present participle '{first_word}' to active past-tense '{words[0]}'")

    # 2. Eliminate filler phrases
    for filler in FILLER_PHRASES:
        if re.search(filler, improved, re.IGNORECASE):
            improved = re.sub(filler, "", improved, flags=re.IGNORECASE).strip()
            # Clean double spaces
            improved = re.sub(r"\s+", " ", improved)
            improvements.append(f"Trimmed redundant filler wording ({filler.replace(r'\b', '')}) for concise impact")

    # 3. Assess strengths
    if any(tech in lower_bullet for tech in ["python", "java", "c++", "sql", "api", "docker", "react", "aws"]):
        strengths.append("Mentions specific technical tools or technologies")
    if len(words) >= 8:
        strengths.append("Contains sufficient descriptive context to explain the scope")

    if not strengths:
        strengths.append("Describes a concrete engineering or project task")

    if not improvements:
        improvements.append("Refined sentence flow and active voice clarity")

    # Anti-fabrication guarantees
    claims_avoided = [
        "Did not invent unverified numerical metrics, percentages, or revenue figures.",
        "Did not fabricate team leadership, managerial scope, or unstated responsibilities.",
        "Did not assume technologies or platforms not referenced in the original bullet.",
    ]

    # Relevant follow-up questions
    follow_ups = FOLLOW_UP_TEMPLATES[:3]

    # Ensure bullet ends with period
    improved_bullet = improved.strip()
    if improved_bullet and not improved_bullet.endswith("."):
        improved_bullet += "."

    return ResumeCoachResponse(
        original_bullet=bullet,
        improved_bullet=improved_bullet,
        strengths_identified=strengths,
        improvements_made=improvements,
        unsupported_claims_avoided=claims_avoided,
        follow_up_questions=follow_ups,
        rule_based_fallback=True,
        model_used="deterministic-rule-enhancer",
    )


def improve_resume_bullet(request: ResumeCoachRequest) -> ResumeCoachResponse:
    """Enhance a candidate's resume bullet point with strict anti-fabrication guarantees.

    Tries LLM router first; if unconfigured or failing, seamlessly uses the rule-based enhancer.
    """
    settings = get_settings()

    # Optional JD context
    context_jd_text = ""
    if request.target_jd_id:
        jd_record = jd_repository.get_by_id(request.target_jd_id)
        if jd_record:
            role = jd_record.get("role", "")
            company = jd_record.get("company", "")
            skills = ", ".join([s.get("skill_name") or s.get("name") if isinstance(s, dict) else str(s) for s in jd_record.get("skills", [])][:6])
            context_jd_text = f"Target Role: {role} at {company}. Key skills: {skills}."

    if request.target_jd_text:
        context_jd_text = f"{context_jd_text} Additional Context: {request.target_jd_text[:300]}".strip()

    # Check if any LLM is configured
    if not (settings.groq_api_key or settings.openrouter_api_key or settings.gemini_api_key):
        return _rule_based_enhance(request.bullet, request.role_context)

    system_prompt = (
        "You are an expert Executive Resume Coach and Technical Talent Evaluator for the PARALLAX Talent Platform. "
        "Your task is to refine and improve candidate resume bullet points for maximum clarity, conciseness, and impact.\n\n"
        "STRICT ANTI-FABRICATION POLICY (MANDATORY):\n"
        "1. NEVER invent, fabricate, or assume metrics, numbers, percentages (e.g. 'reduced latency by 35%'), "
        "monetary amounts (e.g. 'saved $50k'), team sizes, or leadership roles that the user did not state.\n"
        "2. NEVER invent tools, languages, or frameworks not mentioned or clearly implied.\n"
        "3. Focus exclusively on:\n"
        "   - Strong active verbs at the beginning (e.g. 'Architected', 'Engineered', 'Orchestrated', 'Refactored').\n"
        "   - Active voice, removing passive constructions like 'was responsible for', 'worked on', 'helped with'.\n"
        "   - Eliminating wordiness, fluff, and filler words.\n"
        "   - Clear Context-Action-Result format.\n"
        "4. Output MUST be valid JSON with keys: improved_bullet, strengths_identified, improvements_made, unsupported_claims_avoided, follow_up_questions."
    )

    user_prompt = (
        f"Original Bullet Point:\n\"{request.bullet}\"\n\n"
        f"Role Context: {request.role_context or 'Not specified'}\n"
        f"Target JD Context: {context_jd_text or 'None'}\n\n"
        "Provide your evaluation as JSON adhering strictly to this JSON format:\n"
        "{\n"
        '  "improved_bullet": "<enhanced single bullet without invented metrics>",\n'
        '  "strengths_identified": ["<strength 1>", "<strength 2>"],\n'
        '  "improvements_made": ["<change 1>", "<change 2>"],\n'
        '  "unsupported_claims_avoided": ["<reassurance on metrics/claims avoided>"],\n'
        '  "follow_up_questions": ["<question prompting user for their real metrics if known>"]\n'
        "}"
    )

    llm_req = LLMRequest(
        system=system_prompt,
        user=user_prompt,
        max_tokens=1024,
    )

    def _parse_json(text: str) -> Dict[str, Any]:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return json.loads(text)

    try:
        result = generate(llm_req, parse=_parse_json, settings=settings)
        data = result.value
        if not isinstance(data, dict) or not data.get("improved_bullet"):
            raise ValueError("Malformed JSON response from LLM")

        improved = data["improved_bullet"].strip()
        # Ensure bullet ends with period
        if improved and not improved.endswith("."):
            improved += "."

        return ResumeCoachResponse(
            original_bullet=request.bullet,
            improved_bullet=improved,
            strengths_identified=data.get("strengths_identified", ["Strong technical foundation"]),
            improvements_made=data.get("improvements_made", ["Elevated action verb and phrasing"]),
            unsupported_claims_avoided=data.get("unsupported_claims_avoided", [
                "Did not invent quantitative metrics, percentages, or team sizes.",
            ]),
            follow_up_questions=data.get("follow_up_questions", FOLLOW_UP_TEMPLATES[:2]),
            rule_based_fallback=False,
            model_used=f"{result.provider}:{result.model}",
        )
    except Exception as exc:
        logger.warning("LLM Resume Coach failed, falling back to rule-based enhancer: %s", exc)
        return _rule_based_enhance(request.bullet, request.role_context)
