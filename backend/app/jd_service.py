"""
app/jd_service.py — Analysis orchestration for JD Analyzer.

Coordinates: database layer → skill extractor → proficiency → enrichment.
Returns a validated JDAnalysisResponse ready for the FastAPI endpoint.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from app import database as db
from app.proficiency import apply_proficiency_to_skills
from app.schemas import (
    JDAnalysisResponse,
    JobMetadataResponse,
    LLMSkill,
    RoadmapTopic,
    SkillResult,
)
from app.skill_extractor import ExtractionError, extract_skills

logger = logging.getLogger(__name__)


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _deduplicate_skills(skills: List[LLMSkill]) -> List[LLMSkill]:
    """
    Remove duplicate skills, keeping the first occurrence.

    Two skills are considered duplicates when their lower-cased names match.
    """
    seen: set[str] = set()
    unique: List[LLMSkill] = []
    for skill in skills:
        key = skill.skill_name.strip().lower()
        if key not in seen:
            seen.add(key)
            unique.append(skill)
        else:
            logger.debug("Deduplicated skill: '%s'", skill.skill_name)
    return unique


def _build_reference_data(
    canonical_skills: List[Dict[str, Any]],
    proficiency_levels: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build the reference_data dict passed to the LLM."""
    return {
        "canonical_skills": canonical_skills,
        "proficiency_levels": proficiency_levels,
        # roadmap_topics are added post-extraction after skills are known
        "roadmap_topics": [],
    }


def _resolve_roadmap_topics(
    skills: List[LLMSkill],
    topic_records: List[Dict[str, Any]],
) -> Dict[str, List[RoadmapTopic]]:
    """
    Map each skill to its relevant roadmap topics.

    Returns a dict: { skill_name_lower → [RoadmapTopic, ...] }
    """
    skill_to_topics: Dict[str, List[RoadmapTopic]] = {}

    for skill in skills:
        matched: List[RoadmapTopic] = []
        for record in topic_records:
            topic_category = (record.get("skill_category") or "").upper()
            topic_skill_id = str(record.get("canonical_skill_id") or "")
            skill_category = skill.category_code.upper()
            skill_id = str(skill.canonical_skill_id or "")

            if (
                (topic_category and topic_category == skill_category)
                or (skill_id and topic_skill_id and topic_skill_id == skill_id)
            ):
                try:
                    topic = RoadmapTopic(
                        topic_id=str(record.get("id", "")),
                        topic_name=str(record.get("topic_name", "Unknown Topic")),
                        skill_category=(
                            record.get("skill_category") or skill.category_code
                        ),
                        canonical_skill_id=record.get("canonical_skill_id") or skill_id,
                        extra={
                            k: v
                            for k, v in record.items()
                            if k not in {"id", "topic_name", "skill_category", "canonical_skill_id"}
                        },
                    )
                    matched.append(topic)
                except Exception as exc:
                    logger.warning("Failed to build RoadmapTopic from record: %s — %s", record, exc)

        skill_to_topics[skill.skill_name.strip().lower()] = matched

    return skill_to_topics



def _jd_evidence_for_skill(skill_name: str, jd_text: str) -> Optional[str]:
    """Return a verbatim sentence that directly supports a canonical skill.

    Canonical records in the current database use both full names and short
    labels (for example DSA and OOD), so resolve those labels explicitly.
    Related concepts are not treated as synonyms unless the JD itself names
    the skill or a close, unambiguous phrase.
    """
    name = " ".join(
        (skill_name or "").casefold().replace("&", "and").replace("-", " ").split()
    )
    aliases = {
        "coding": (r"\bcoding\b", r"\bprogramming\b", r"\bwrite code\b", r"\bsoftware development\b"),
        "dsa": (r"\bdata structures?\b", r"\balgorithms?\b", r"\bDSA\b"),
        "data structures and algorithms": (r"\bdata structures?\b", r"\balgorithms?\b", r"\bDSA\b"),
        "aptitude and problem solving": (r"\baptitude\b", r"\bproblem[- ]solving\b", r"\banalytical reasoning\b", r"\bquantitative reasoning\b", r"\bcomplexity analysis\b", r"\balgorithmic reasoning\b", r"\bdata structures and algorithms fundamentals\b"),
        "communication skills": (r"\bcommunication\b", r"\bpresent findings\b", r"\bwritten and verbal\b"),
        "ood": (r"\bOOD\b", r"\bobject[- ]oriented (?:programming|design)\b", r"\bOOP\b"),
        "object oriented programming and design": (r"\bOOD\b", r"\bobject[- ]oriented (?:programming|design)\b", r"\bOOP\b"),
        "ai native engineering": (r"\bAI[- ]native engineering\b", r"\bAI[- ]native development\b", r"\bAI[- ]assisted engineering\b"),
        "sql and design": (r"\bSQL\b", r"\bquery optimization\b", r"\bschema design\b"),
        "system design and architecture": (r"\bsystem design\b", r"\bsoftware architecture\b", r"\bdesign scalable systems\b", r"\bdesign at the system level\b", r"\bfault[- ]toleran\w*\b", r"\bscalability\b"),
        "devops and cloud": (r"\bDevOps\b", r"\bcloud (?:infrastructure|platform|services?)\b", r"\bCI/CD\b", r"\bAzure\b", r"\bAWS\b", r"\bGoogle Cloud\b"),
        "software engineering": (r"\bsoftware engineering\b", r"\bsoftware development\b", r"\bsoftware lifecycle\b"),
        "computer networking": (r"\bcomputer networking\b", r"\bnetwork protocols?\b", r"\bTCP/IP\b", r"\bnetworking\b", r"\bREST APIs?\b", r"\brequest lifecycle\b", r"\btimeouts?\b"),
        "operating system": (r"\boperating systems?\b", r"\bkernel\b", r"\bprocess scheduling\b", r"\bLinux fundamentals\b", r"\bcommand[- ]line\b"),
        "software testing and quality assurance": (r"\btesting strategy\b", r"\bsoftware testing\b", r"\btest(?:ing|s)?\b", r"\bquality assurance\b"),
        "security engineering": (r"\bsecurity\b", r"\bsecure software\b", r"\bthreat model\b"),
        "reliability engineering": (r"\breliability\b", r"\breliable\b", r"\bfault[- ]toleran\w*\b", r"\bavailability\b"),
        "api design and development": (r"\bREST APIs?\b", r"\bAPI design\b", r"\brequest lifecycle\b"),
        "agile software development": (r"\bAgile\b", r"\bsprint planning\b", r"\bAgile ceremonies\b"),
        "performance engineering": (r"\bperformance\b", r"\bperformant code\b", r"\bperformance optimization\b"),
        "version control and collaboration": (r"\bshared codebase\b", r"\bversion control\b", r"\bGit\b", r"\bcode review\b", r"\bcollaborat\w* across teams\b"),
        "application support": (r"\bapplication support\b", r"\bL[23]\b.{0,30}support\b", r"\bsupport Oracle .* products\b"),
        "incident management": (r"\bincident triage\b", r"\bincidents?\b", r"\bincident system\b"),
        "troubleshooting": (r"\btroubleshoot(?:ing)?\b", r"\bdiagnos(?:e|is|ing)\b", r"\binvestigate\b", r"\bresolve incidents?\b"),
        "log analysis": (r"\blog files?\b", r"\bmonitor logs\b", r"\blog analysis\b"),
        "ticketing systems": (r"\bticketing\b", r"\bticketing/incident system\b"),
        "sla management": (r"\bSLA\b", r"\bwithin SLA\b", r"\bservice[- ]level agreement\b"),
        "batch processing": (r"\bbatch processing\b", r"\bbatch and real[- ]time\b", r"\bbatch/real[- ]time\b"),
        "systems administration": (r"\bsystems administration\b", r"\bsystems administrator\b", r"\bLinux fundamentals\b"),
        "production support": (r"\bproduction support\b", r"\bproduction databases?\b", r"\bproduction\b.{0,30}support\b"),
        "database querying": (r"\bSQL\b", r"\bSELECT/WHERE\b", r"\bprimary keys?\b", r"\bquery production databases?\b"),
        "client support and communication": (r"\bclient communication\b", r"\bcommunicate\b.{0,50}clients?\b", r"\bclient support\b", r"\bnon[- ]technical clients?\b"),
        "application monitoring": (r"\bmonitor logs\b", r"\bmonitoring\b", r"\bcatch issues early\b"),
        "technical documentation": (r"\bdocument incidents?\b", r"\bdocumentation\b", r"\bdocument technical issues\b"),
    }
    patterns = aliases.get(name, (re.escape(skill_name),))
    sentences = re.split(r"(?<=[.!?])\s+|\n+", jd_text or "")
    for sentence in sentences:
        clean = " ".join(sentence.split()).strip()
        if clean and any(re.search(pattern, clean, re.IGNORECASE) for pattern in patterns):
            return clean[:500]
    return None


def _company_name_is_supported(company_name: Optional[str], jd_text: str) -> bool:
    """Require a distinctive company-name token to appear in the source JD.

    This avoids applying a company baseline merely because the model guessed
    an employer. Legal suffixes and generic corporate words are ignored.
    """
    if not company_name or not jd_text:
        return False
    ignored = {
        "the", "inc", "incorporated", "llc", "ltd", "limited", "corp",
        "corporation", "company", "co", "plc", "gmbh", "group", "subsidiary",
        "of", "and", "holdings", "technologies", "technology",
    }
    name_tokens = set(re.findall(r"[a-z0-9]+", company_name.casefold())) - ignored
    jd_tokens = set(re.findall(r"[a-z0-9]+", jd_text.casefold()))
    return bool(name_tokens & jd_tokens)


def _build_skill_result(
    skill: LLMSkill,
    topics: List[RoadmapTopic],
) -> SkillResult:
    """Convert an LLMSkill + roadmap topics into a SkillResult for the response."""
    return SkillResult(
        skill_name=skill.skill_name,
        canonical_skill_id=skill.canonical_skill_id,
        category_code=skill.category_code,
        category_name=skill.category_name,
        requirement_type=skill.requirement_type,
        importance=skill.importance,
        target_proficiency=skill.target_proficiency,
        is_provisional=skill.is_provisional,
        evidence=skill.evidence,
        confidence=skill.confidence,
        roadmap_topics=topics,
    )


# ─── Main orchestration function ───────────────────────────────────────────────



def analyze_jd(jd_text: str) -> JDAnalysisResponse:
    """Analyze a JD and merge its evidence with company-specific baselines."""
    warnings: List[str] = []
    canonical_skills: List[Dict[str, Any]] = []
    proficiency_levels: List[Dict[str, Any]] = []
    company_levels: List[Dict[str, Any]] = []
    db_available = False

    def norm(value: Any) -> str:
        return " ".join(str(value or "").casefold().split())

    # Step 1: Load Supabase reference data.
    try:
        canonical_skills = db.get_canonical_skills()
        proficiency_levels = db.get_proficiency_levels()
        db_available = bool(canonical_skills or proficiency_levels)
    except Exception as exc:
        logger.warning("Could not load reference data: %s", exc)
        warnings.append("Supabase reference data could not be loaded.")

    # Extract once. This result is used by both the fallback and merge paths.
    llm_result = extract_skills(
        jd_text,
        _build_reference_data(canonical_skills, proficiency_levels),
    )
    meta = llm_result.metadata
    extracted = _deduplicate_skills(llm_result.skills)

    # The public contract targets exactly 12 canonical skills. When Supabase
    # contains more than 12, rank by direct JD evidence first and then by an
    # explicit LLM-to-canonical match. If fewer than 12 are role-supported,
    # remaining slots are necessarily taxonomy fallbacks and are flagged below.
    if len(canonical_skills) > 12:
        extracted_ids = {str(skill.canonical_skill_id) for skill in extracted if skill.canonical_skill_id}
        extracted_names = {norm(skill.skill_name) for skill in extracted}
        ranked = []
        for index, canonical in enumerate(canonical_skills):
            canonical_id = canonical.get("id", canonical.get("skill_set_id"))
            aliases = [canonical.get(field) for field in ("skill_name", "skill_set_name", "short_name")]
            has_llm_match = (
                (canonical_id is not None and str(canonical_id) in extracted_ids)
                or any(alias and norm(alias) in extracted_names for alias in aliases)
            )
            evidence = _jd_evidence_for_skill(
                str(canonical.get("skill_name") or canonical.get("skill_set_name") or canonical.get("short_name") or ""),
                jd_text,
            )
            # Direct, deterministic JD evidence outranks a model-suggested match.
            # A model match alone is not evidence that a skill belongs in the result.
            score = (10 if evidence else 0) + (1 if has_llm_match else 0)
            ranked.append((score, index, canonical))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        supported = [item for item in ranked if item[0] >= 10]
        # Prefer 12 evidence-supported canonical skills. Only fall back to
        # weaker taxonomy matches when the database has fewer than 12 supported
        # records; those rows are marked unclear/low confidence below.
        selected = supported[:12]
        if len(selected) < 12:
            selected_ids = {id(item[2]) for item in selected}
            selected.extend(
                item for item in ranked
                if id(item[2]) not in selected_ids
            )
        canonical_skills = [item[2] for item in selected[:12]]
    elif len(canonical_skills) < 12:
        warnings.append(
            f"Supabase contains only {len(canonical_skills)} canonical skills; "
            "the 12-skill output target cannot be met without adding canonical records."
        )

    # Without the canonical taxonomy, preserve the LLM's extracted skills.
    if not canonical_skills:
        warnings.append(
            "Canonical skill taxonomy is unavailable; a complete 12-skill "
            "result cannot be guaranteed."
        )
        extracted = apply_proficiency_to_skills(
            extracted,
            jd_full_text=jd_text,
            experience_required=meta.experience_required,
            official_levels=proficiency_levels if proficiency_levels else None,
        )

        topic_records: List[Dict[str, Any]] = []
        if db_available and extracted:
            try:
                topic_records = db.get_roadmap_topics_for_skills(
                    category_codes=[
                        skill.category_code for skill in extracted
                        if skill.category_code
                    ],
                    canonical_skill_ids=[
                        skill.canonical_skill_id for skill in extracted
                        if skill.canonical_skill_id
                    ] or None,
                )
            except Exception as exc:
                logger.warning("Roadmap topic retrieval failed: %s", exc)

        topic_map = _resolve_roadmap_topics(extracted, topic_records)
        skill_results = [
            _build_skill_result(
                skill,
                topic_map.get(norm(skill.skill_name), []),
            ).model_copy(
                update={
                    "proficiency_source": (
                        "job_description"
                        if skill.target_proficiency is not None
                        and bool(re.search(
                            r"\b(expert|advanced|proficient|beginner|foundational|\d+\+?\s+years?|senior|junior|staff|principal)\b",
                            jd_text,
                            re.IGNORECASE,
                        ))
                        else "unavailable"
                    )
                }
            )
            for skill in extracted
        ]

        return JDAnalysisResponse(
            success=True,
            metadata=JobMetadataResponse(
                company_name=meta.company_name,
                job_title=meta.job_title,
                job_summary=meta.job_summary,
                employment_type=meta.employment_type,
                location=meta.location,
                experience_required=meta.experience_required,
                responsibilities=meta.responsibilities,
                qualifications=meta.qualifications,
                prompt_injection_detected=meta.prompt_injection_detected,
            ),
            skills=skill_results,
            analysis_notes=llm_result.analysis_notes,
            database_enrichment_available=db_available,
            warnings=warnings,
        )

    # Step 2: Build canonical lookup maps.
    canonical_by_id: Dict[str, Dict[str, Any]] = {}
    canonical_by_name: Dict[str, Dict[str, Any]] = {}

    for item in canonical_skills:
        raw_id = item.get("id", item.get("skill_set_id"))
        if raw_id is not None:
            canonical_by_id[str(raw_id)] = item

        for field in ("skill_name", "skill_set_name", "short_name"):
            key = norm(item.get(field))
            if key:
                canonical_by_name[key] = item

    # Step 3: Apply the existing proficiency logic to JD-extracted skills.
    extracted = apply_proficiency_to_skills(
        extracted,
        jd_full_text=jd_text,
        experience_required=meta.experience_required,
        official_levels=proficiency_levels if proficiency_levels else None,
    )

    extracted_by_id: Dict[str, LLMSkill] = {}
    extracted_by_name: Dict[str, LLMSkill] = {}

    for skill in extracted:
        canonical = None
        if skill.canonical_skill_id:
            canonical = canonical_by_id.get(str(skill.canonical_skill_id))
        if canonical is None:
            canonical = canonical_by_name.get(norm(skill.skill_name))

        if canonical:
            raw_id = canonical.get("id", canonical.get("skill_set_id"))
            if raw_id is not None:
                extracted_by_id[str(raw_id)] = skill

        extracted_by_name[norm(skill.skill_name)] = skill

    # Step 4: Look up a baseline only when the employer name is supported by
    # source text; a model-generated company guess must not select a baseline.
    company_name_supported = _company_name_is_supported(meta.company_name, jd_text)
    if company_name_supported:
        try:
            company_levels = db.get_company_skill_levels(meta.company_name)
        except Exception as exc:
            logger.warning("Company baseline lookup failed: %s", exc)
            warnings.append("Company-specific skill baselines could not be loaded.")
    elif meta.company_name:
        warnings.append(
            "The extracted company name was not verified in the job-description text; "
            "company-specific proficiency baselines were not applied."
        )

    baseline_by_id = {
        str(item["skill_set_id"]): item
        for item in company_levels
        if item.get("skill_set_id") is not None
    }
    proficiency_by_id = {
        str(item["proficiency_level_id"]): item
        for item in proficiency_levels
        if item.get("proficiency_level_id") is not None
    }

    # Step 5: Create exactly one output row for each usable canonical record.
    merged: List[LLMSkill] = []
    source_by_id: Dict[str, str] = {}
    baseline_by_output_id: Dict[str, Dict[str, Any]] = {}

    for canonical in canonical_skills:
        raw_id = canonical.get("id", canonical.get("skill_set_id"))
        if raw_id is None:
            continue

        skill_id = str(raw_id)
        name = (
            canonical.get("skill_name")
            or canonical.get("skill_set_name")
            or canonical.get("short_name")
            or f"Skill {skill_id}"
        )

        jd_skill = extracted_by_id.get(skill_id)
        if jd_skill is None:
            for alias in (
                canonical.get("skill_name"),
                canonical.get("skill_set_name"),
                canonical.get("short_name"),
            ):
                if alias and norm(alias) in extracted_by_name:
                    jd_skill = extracted_by_name[norm(alias)]
                    break

        baseline = baseline_by_id.get(skill_id)

        jd_evidence = _jd_evidence_for_skill(str(name), jd_text)
        if jd_skill is not None:
            update = {
                "skill_name": str(name),
                "canonical_skill_id": skill_id,
                # Canonical taxonomy, not the LLM's guessed label, owns these.
                "category_code": canonical.get("category_code") or "OTHER",
                "category_name": canonical.get("category_name") or "Other",
            }
            if jd_evidence:
                update.update({"evidence": jd_evidence, "confidence": "high"})
            else:
                update.update({
                    "evidence": "Not explicitly identified in the job description.",
                    "confidence": "low",
                    "requirement_type": "unclear",
                })
            result_skill = jd_skill.model_copy(update=update)
        else:
            result_skill = LLMSkill(
                skill_name=str(name),
                canonical_skill_id=skill_id,
                category_code=canonical.get("category_code") or "OTHER",
                category_name=canonical.get("category_name") or "Other",
                requirement_type="required" if jd_evidence else "unclear",
                importance="medium",
                confidence="high" if jd_evidence else "low",
                evidence=jd_evidence or "Not explicitly identified in the job description.",
            )

        # A skill mention is not by itself evidence for a numeric proficiency.
        # Prefer the company baseline unless the JD contains an explicit level cue.
        explicit_level_cue = bool(jd_evidence and re.search(
            r"\b(expert|advanced|proficient|beginner|foundational|\d+\+?\s+years?|senior|junior|staff|principal)\b",
            jd_evidence,
            re.IGNORECASE,
        ))
        if explicit_level_cue and jd_skill is not None and jd_skill.target_proficiency is not None:
            source = "job_description"
        elif baseline is not None and baseline.get("required_level") is not None:
            source = "company_baseline"
            result_skill = result_skill.model_copy(update={
                "target_proficiency": int(baseline["required_level"]),
                "is_provisional": False,
            })
        else:
            source = "unavailable"
            result_skill = result_skill.model_copy(update={"target_proficiency": None})

        merged.append(result_skill)
        source_by_id[skill_id] = source
        if baseline is not None:
            baseline_by_output_id[skill_id] = baseline

    if len(merged) != len(canonical_skills):
        warnings.append(
            "Some canonical skills lacked usable IDs and could not be included."
        )

    # A taxonomy warning is emitted only when the catalog itself has fewer than
    # 12 usable records (handled above), or when even an expanded catalog cannot
    # supply 12 evidence-supported skills. Keep this diagnostic factual: the
    # selected rows are ranked by direct JD evidence whenever the taxonomy has
    # alternatives. Unsupported rows remain explicitly low-confidence.
    supported_count = sum(
        1 for skill in merged
        if skill.evidence and skill.evidence != "Not explicitly identified in the job description."
    )
    if len(merged) >= 12 and supported_count < 12:
        warnings.append(
            f"Only {supported_count} of the 12 selected canonical skills are supported by this job description. "
            "Add role-relevant canonical skills to Supabase so the analyzer can select 12 supported skills."
        )

    # Step 6: Resolve roadmap topics for the merged skills.
    topic_records: List[Dict[str, Any]] = []
    if db_available and merged:
        try:
            topic_records = db.get_roadmap_topics_for_skills(
                category_codes=list({
                    skill.category_code for skill in merged
                    if skill.category_code
                }),
                canonical_skill_ids=[
                    skill.canonical_skill_id for skill in merged
                    if skill.canonical_skill_id
                ],
            )
        except Exception as exc:
            logger.warning("Roadmap topic retrieval failed: %s", exc)
            warnings.append("Roadmap topics could not be retrieved.")

    topic_map = _resolve_roadmap_topics(merged, topic_records)
    skill_results: List[SkillResult] = []

    for skill in merged:
        skill_id = str(skill.canonical_skill_id or "")
        baseline = baseline_by_output_id.get(skill_id, {})
        proficiency_record = proficiency_by_id.get(
            str(baseline.get("required_proficiency_level_id", ""))
        )

        result = _build_skill_result(
            skill,
            topic_map.get(norm(skill.skill_name), []),
        )
        skill_results.append(
            result.model_copy(
                update={
                    "proficiency_source": source_by_id.get(
                        skill_id, "unavailable"
                    ),
                    "company_required_level": baseline.get("required_level"),
                    "company_proficiency_name": (
                        proficiency_record.get("proficiency_name")
                        if proficiency_record else None
                    ),
                }
            )
        )

    if meta.prompt_injection_detected:
        warnings.append(
            "Potential prompt injection detected. Only legitimate job content "
            "was considered."
        )

    if company_name_supported and not company_levels:
        warnings.append(
            "No company baseline was applied. Confirm that the verified company "
            "has baseline records in Supabase."
        )

    return JDAnalysisResponse(
        success=True,
        metadata=JobMetadataResponse(
            company_name=meta.company_name,
            job_title=meta.job_title,
            job_summary=meta.job_summary,
            employment_type=meta.employment_type,
            location=meta.location,
            experience_required=meta.experience_required,
            responsibilities=meta.responsibilities,
            qualifications=meta.qualifications,
            prompt_injection_detected=meta.prompt_injection_detected,
        ),
        skills=skill_results,
        analysis_notes=llm_result.analysis_notes,
        database_enrichment_available=db_available,
        warnings=warnings,
    )
