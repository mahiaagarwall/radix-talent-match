import json

from app.skill_extractor import _parse_llm_response
from app.jd_service import _jd_evidence_for_skill, _resolve_roadmap_topics
from app.schemas import LLMSkill


def test_parser_keeps_each_skill_once_when_categories_are_null():
    payload = {
        "metadata": {"job_title": "Software Engineer"},
        "skills": [
            {"skill_name": "Coding", "category_code": "COD", "category_name": "Coding"},
            {"skill_name": "Testing", "category_code": None, "category_name": None},
            {"skill_name": "Security", "category_code": "SEC", "category_name": None},
        ],
    }
    result = _parse_llm_response(json.dumps(payload))
    assert [skill.skill_name for skill in result.skills] == [
        "Coding", "Testing", "Security"
    ]
    assert len(result.skills) == 3
    assert result.skills[1].category_code == ""
    assert result.skills[2].category_name == ""


def test_evidence_matching_uses_jd_content_and_does_not_invent_ai():
    jd = (
        "Required: testing strategy and secure software design. "
        "Build reliable components and improve performance. "
        "Use REST APIs and participate in Agile ceremonies."
    )
    assert _jd_evidence_for_skill("Software Testing and Quality Assurance", jd)
    assert _jd_evidence_for_skill("Security Engineering", jd)
    assert _jd_evidence_for_skill("Reliability Engineering", jd)
    assert _jd_evidence_for_skill("API Design and Development", jd)
    assert _jd_evidence_for_skill("Agile Software Development", jd)
    assert _jd_evidence_for_skill("Performance Engineering", jd)
    assert _jd_evidence_for_skill("AI Native Engineering", jd) is None


def test_roadmap_category_is_derived_from_canonical_skill_when_db_has_none():
    skill = LLMSkill(
        skill_name="Coding",
        canonical_skill_id="1",
        category_code="COD",
        category_name="Coding",
    )
    mapped = _resolve_roadmap_topics(
        [skill],
        [{
            "topic_id": 1,
            "topic_name": "Basic programming concepts",
            "canonical_skill_id": "1",
            "level_number": 1,
        }],
    )
    topic = mapped["coding"][0]
    assert topic.skill_category == "COD"
    assert topic.canonical_skill_id == "1"
    assert topic.extra["level_number"] == 1
