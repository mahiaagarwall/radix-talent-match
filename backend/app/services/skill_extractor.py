"""Skills: extraction, evidence checks and the confidence rule.

Confidence rule (docs/scoring-rules.md) — always computed here, never taken
from the LLM:
    high   = listed under Technical Skills AND demonstrated in projects /
             internships / hackathons / achievements
    medium = listed only, OR demonstrated only
    low    = only an indirect signal (e.g. mentoring → communication)
Confidence describes how well the resume EVIDENCES a skill, not proficiency.
"""

import re

from app.services import skill_catalog as catalog
from app.services.resume_sections import split_commas

QUALIFIER_PHRASE = re.compile(r"\b(exposure to|basics of|basic|basics|fundamentals|foundational|beginner)\b", re.I)
EVIDENCE_MAX = 200
LISTED_EVIDENCE = "Listed under Technical Skills"


def normalize_text(text: str) -> str:
    text = str(text or "").lower().replace("•", " ")
    text = re.sub(r"[‘’']", "'", text)
    text = re.sub(r"[“”\"]", '"', text)
    text = re.sub(r"[—–]", "-", text)
    return re.sub(r"\s+", " ", text).strip()


def evidence_in_text(evidence: str, resume_text: str) -> bool:
    """True if the evidence quote really comes from the resume (whitespace/case tolerant)."""
    ev, body = normalize_text(evidence), normalize_text(resume_text)
    if not ev:
        return False
    if ev in body:
        return True
    words = re.findall(r"[a-z0-9+#/]+", ev)
    if len(words) < 4:
        return False
    found = sum(1 for w in words if w in body)
    return found / len(words) >= 0.85 and _longest_run(words, body) >= 4


def _longest_run(words: list[str], body: str) -> int:
    best = run = 0
    for i in range(len(words)):
        run = 1
        while i + run <= len(words) and " ".join(words[i:i + run]) in body:
            run += 1
        best = max(best, run - 1)
    return best


def trim_evidence(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= EVIDENCE_MAX:
        return text
    return text[: EVIDENCE_MAX - 1].rsplit(" ", 1)[0] + "…"


def display_name(raw: str) -> str:
    """'basic Java' -> 'Java (basic)', 'Linux basics' -> 'Linux (basics)'. Keeps existing parentheses."""
    raw = raw.strip()
    if "(" in raw:
        return raw
    match = QUALIFIER_PHRASE.search(raw)
    if not match:
        return raw
    core = (raw[: match.start()] + raw[match.end():]).strip(" ,-")
    if not core:
        return raw
    qualifier = match.group(1).lower().replace(" to", "").replace(" of", "")
    return f"{core[:1].upper()}{core[1:]} ({qualifier})"


def listed_skills(skills_section: list[str]) -> list[str]:
    """Display names of every skill listed under Technical Skills.

    Known skills named inside parentheses ("Python (pandas, scikit-learn)") count as listed too.
    """
    out = []
    # Comma-list style ("C++, Python, ...") may wrap mid-item in PDFs ("basic\nJava"),
    # so join lines with a space; one-skill-per-line lists are joined with commas.
    joiner = " " if any("," in line for line in skills_section) else ", "
    for raw in split_commas(joiner.join(skills_section)):
        out.append(display_name(raw))
        inner = re.search(r"\(([^)]*)\)", raw)
        if inner and not catalog.DEPTH_QUALIFIER.search(inner.group(1)):
            for part in split_commas(inner.group(1)):
                if catalog.lookup(part):
                    out.append(part.strip())
    return out


def experience_items(sections: dict) -> list[str]:
    return [*sections.get("projects", []), *sections.get("experience", []), *sections.get("achievements", [])]


def find_demonstration(name: str, items: list[str]):
    """Return ("direct"|"indirect"|None, item text)."""
    direct, indirect = catalog.evidence_patterns(name)
    for item in items:
        if any(re.search(p, item, re.I) for p in direct):
            return "direct", item
    for item in items:
        if any(re.search(p, item, re.I) for p in indirect):
            return "indirect", item
    return None, None


def confidence_for(listed: bool, demonstration) -> str | None:
    if listed and demonstration == "direct":
        return "high"
    if listed or demonstration == "direct":
        return "medium"
    if demonstration == "indirect":
        return "low"
    return None


def build_skill(name: str, listed: bool, items: list[str], suggested_category=None, fallback_evidence=None):
    kind, item = find_demonstration(name, items)
    confidence = confidence_for(listed, kind)
    if confidence is None and fallback_evidence:
        confidence = "low"
    if confidence is None:
        return None
    if item:
        evidence = trim_evidence(item)
    elif listed:
        evidence = LISTED_EVIDENCE
    else:
        evidence = trim_evidence(fallback_evidence)
    return {
        "skill_name": name,
        "category_code": catalog.category_for(name, suggested_category),
        "evidence": evidence,
        "confidence": confidence,
    }


def dedupe(skills: list[dict]) -> list[dict]:
    rank = {"high": 3, "medium": 2, "low": 1}
    out, index = [], {}
    for s in skills:
        key = catalog.canonical(s["skill_name"])
        if not key:
            continue
        if key not in index:
            index[key] = len(out)
            out.append(s)
        elif rank[s["confidence"]] > rank[out[index[key]]["confidence"]]:
            out[index[key]] = s
    return out


def extract_skills_rules(sections: dict) -> list[dict]:
    """Rule-based skills: everything listed, plus known skills demonstrated in experience."""
    items = experience_items(sections)
    skills = [build_skill(name, True, items) for name in listed_skills(sections.get("skills", []))]
    present = {catalog.canonical(s["skill_name"]) for s in skills if s}
    for entry in catalog.CATALOG:
        if entry.name.lower() in present:
            continue
        skill = build_skill(entry.name, False, items)
        if skill:
            skills.append(skill)
    return dedupe([s for s in skills if s])


def verify_llm_skills(llm_skills: list[dict], sections: dict, resume_text: str) -> list[dict]:
    """Keep only LLM skills that the resume supports; recompute category and confidence."""
    items = experience_items(sections)
    # canonical -> name exactly as listed (keeps qualifiers like "SQL (basic)")
    listed = {catalog.canonical(n): n for n in listed_skills(sections.get("skills", []))}
    verified = []
    for raw in llm_skills:
        name = str(raw.get("skill_name") or "").strip()
        if not name:
            continue
        is_listed = catalog.canonical(name) in listed
        if is_listed:
            name = listed[catalog.canonical(name)]
        llm_evidence = str(raw.get("evidence") or "")
        quoted = llm_evidence if evidence_in_text(llm_evidence, resume_text) else None
        skill = build_skill(name, is_listed, items, raw.get("category_code"), fallback_evidence=quoted)
        if skill:
            verified.append(skill)
    # Anything listed that the LLM missed is still a skill.
    rule_skills = extract_skills_rules(sections)
    have = {catalog.canonical(s["skill_name"]) for s in verified}
    verified += [
        s for s in rule_skills
        if catalog.canonical(s["skill_name"]) not in have and catalog.canonical(s["skill_name"]) in listed
    ]
    return dedupe(verified)
