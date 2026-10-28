"""Rule-based resume parser (Owner: Mahi Aggarwal).

Input: the text lines from resume_text_extractor.extract_text_lines().
Output: a dict in the "Parsed resume" shape from docs/api-contract.md §3.

How it works, step by step:
1. Split the lines into sections using known headings ("Education", "Technical
   Skills", "Projects", ...). Anything before the first heading is the header
   (name, headline, contact line).
2. Inside each section, join lines that were wrapped by the PDF back into one
   item, using bullets ("•", "-", "*") and simple continuation rules.
3. Parse each section with its own small function.
4. Build the skill list from the Skills section plus mentions in projects,
   internships, hackathons, achievements and certifications.

Rules this parser keeps:
- It never invents data. A field that is not in the resume stays empty.
- Every skill carries evidence quoted from the resume.
- Confidence describes how well the resume supports the skill (docs/scoring-rules.md):
    high   = listed in the Skills section AND mentioned in a project/experience/achievement
    medium = listed only, OR mentioned in a project/experience/achievement without being listed
    low    = indirect signal only (e.g. mentoring or presenting → Communication)
- Skills are only taken from the candidate's own sections. The headline and
  "Preferred Roles" are not used as evidence ("Data Scientist" is a role, not a skill).
"""

import re
from typing import Dict, List, Optional, Tuple

from app.services.skill_taxonomy import (
    TaxonomySkill,
    clean_skill_text,
    find_skills_in_text,
    has_depth_qualifier,
    lookup_listed_skill,
)

PARSER_MODE = "rules"

# ---------------------------------------------------------------------------
# 1. Sections
# ---------------------------------------------------------------------------

SECTION_HEADINGS: Dict[str, str] = {
    # education
    "education": "education",
    "academic background": "education",
    "academics": "education",
    "academic details": "education",
    "academic qualifications": "education",
    "academic qualification": "education",
    "education and training": "education",
    "educational background": "education",
    "academic profile": "education",
    "scholastic profile": "education",
    "qualifications": "education",
    "educational qualifications": "education",
    # skills
    "skills": "skills",
    "technical skills": "skills",
    "core skills": "skills",
    "key skills": "skills",
    "core competencies": "skills",
    "technical proficiency": "skills",
    "technical proficiencies": "skills",
    "technologies": "skills",
    "tech stack": "skills",
    "tools and technologies": "skills",
    "skills and tools": "skills",
    "programming languages": "skills",
    # projects
    "projects": "projects",
    "academic projects": "projects",
    "personal projects": "projects",
    "key projects": "projects",
    "selected projects": "projects",
    # internships / experience
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "internships": "experience",
    "internship": "experience",
    "internship experience": "experience",
    "employment history": "experience",
    "work history": "experience",
    # hackathons
    "hackathons": "hackathons",
    "hackathon": "hackathons",
    "competitions": "hackathons",
    # certifications
    "certifications": "certifications",
    "certification": "certifications",
    "certificates": "certifications",
    "licenses and certifications": "certifications",
    "courses and certifications": "certifications",
    # achievements
    "achievements": "achievements",
    "awards": "achievements",
    "honors": "achievements",
    "honours": "achievements",
    "accomplishments": "achievements",
    "key accomplishments": "achievements",
    "achievements and awards": "achievements",
    "honors and awards": "achievements",
    "positions of responsibility": "achievements",
    "awards and achievements": "achievements",
    "extracurricular activities": "achievements",
    "extra-curricular activities": "achievements",
    # preferred roles
    "preferred roles": "roles",
    "preferred role": "roles",
    "target roles": "roles",
    "desired roles": "roles",
    "roles of interest": "roles",
    "career interests": "roles",
    # summary (used as the headline when the header has none)
    "summary": "summary",
    "professional summary": "summary",
    "profile": "summary",
    "profile summary": "summary",
    "about me": "summary",
    "objective": "summary",
    "career objective": "summary",
    # contact details are skipped on purpose (only the email is read, from anywhere)
    "contact": "ignore",
    "contact details": "ignore",
    "personal details": "ignore",
    "contact information": "ignore",
}

BULLET_RE = re.compile(r"^\s*(?:[•●▪■◦‣∙·*]|-(?=\s)|–(?=\s)|\d{1,2}[.)](?=\s))\s*")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
DASH_SPLIT_RE = re.compile(r"\s+[—–-]\s+")  # " — ", " – " or " - " between two parts
NEGATIVE_RE = re.compile(
    r"^(none( listed)?|n/?a|nil|not applicable|no (formal )?certifications?( listed)?)\.?$|no formal certifications",
    re.IGNORECASE,
)


def _heading_key(line: str) -> str:
    text = BULLET_RE.sub("", line).strip().rstrip(":").strip().lower()
    text = text.replace("&", " and ")
    return re.sub(r"\s+", " ", text)


def detect_heading(line: str) -> Optional[Tuple[List[str], str]]:
    """If the line is a section heading, returns (section names, text after the colon).

    Handles combined headings such as "Hackathons / Internships" and inline
    headings such as "Skills: Python, Java".
    """
    head, rest = line, ""
    if ":" in line:
        before, after = line.split(":", 1)
        if after.strip() and _heading_key(before) in SECTION_HEADINGS:
            head, rest = before, after.strip()
    key = _heading_key(head)
    if not key or len(key.split()) > 6:
        return None
    if key in SECTION_HEADINGS:
        return [SECTION_HEADINGS[key]], rest
    # Combined heading: every part must be a known heading.
    parts = [p.strip() for p in re.split(r"\s*(?:/|,|\|| and )\s*", key) if p.strip()]
    if len(parts) > 1 and all(p in SECTION_HEADINGS for p in parts):
        sections = []
        for p in parts:
            if SECTION_HEADINGS[p] not in sections:
                sections.append(SECTION_HEADINGS[p])
        return sections, rest
    return None


def split_sections(lines: List[str]) -> Tuple[List[str], List[Tuple[List[str], List[str]]]]:
    """Returns (header lines, [(section names, section lines), ...])."""
    header: List[str] = []
    sections: List[Tuple[List[str], List[str]]] = []
    for line in lines:
        found = detect_heading(line)
        if found:
            names, rest = found
            sections.append((names, [rest] if rest else []))
        elif sections:
            sections[-1][1].append(line)
        else:
            header.append(line)
    return header, sections


# ---------------------------------------------------------------------------
# 2. Joining wrapped lines into items
# ---------------------------------------------------------------------------

CONTINUATION_END_RE = re.compile(r"(,|/|&|\(|-|–|—|\b(and|or|of|for|with|to|in|on|the|a|an|using|at))\s*$", re.IGNORECASE)
# A PDF line at least this long that does not end a sentence was almost certainly
# wrapped by the page width (the sample PDFs wrap at about 85–95 characters).
PDF_WRAP_MIN_LENGTH = 60


def group_items(lines: List[str], pdf_wrapping: bool = False) -> List[str]:
    """Joins wrapped lines back into whole items.

    A line starts a new item when it begins with a bullet. A line without a
    bullet continues the previous item when the previous item was a bullet, when
    it starts with a lowercase letter or "(", or when the previous line ends with
    a comma, a slash or a word like "and" / "of".

    pdf_wrapping=True (PDF only) also joins a line onto a previous line that is
    long and has no ending punctuation. DOCX paragraphs are already whole items.
    """
    items: List[str] = []
    started_with_bullet: List[bool] = []
    last_line = ""
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        is_bullet = bool(BULLET_RE.match(line))
        text = BULLET_RE.sub("", line).strip()
        if not text:
            continue
        if not is_bullet and items:
            prev = items[-1]
            wrapped = pdf_wrapping and len(last_line) >= PDF_WRAP_MIN_LENGTH and last_line[-1] not in ".!?:"
            if started_with_bullet[-1] or text[0].islower() or text[0] in "([&" or CONTINUATION_END_RE.search(prev) or wrapped:
                # "horizontally-" + "scalable" → "horizontally-scalable" (no space after a split hyphen)
                joiner = "" if re.search(r"\w-$", prev) else " "
                items[-1] = f"{prev}{joiner}{text}"
                last_line = line
                continue
        items.append(text)
        started_with_bullet.append(is_bullet)
        last_line = line
    return [re.sub(r"\s+", " ", i).strip() for i in items]


def split_list(text: str) -> List[str]:
    """Splits "a, b (x, y), c; d | e" on separators that are outside parentheses."""
    parts, depth, current = [], 0, []
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if depth == 0 and ch in ",;|•":
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
    parts.append("".join(current))
    return [p.strip(" .\t") for p in parts if p.strip(" .\t")]


def _is_negative(text: str) -> bool:
    return bool(NEGATIVE_RE.search(text.strip()))


def _clip(text: str, limit: int = 240) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


# ---------------------------------------------------------------------------
# 3. Header: name, email, headline
# ---------------------------------------------------------------------------

NAME_WORD_RE = re.compile(r"^[A-Z][A-Za-z.'\-]*$")
CONTACT_HINT_RE = re.compile(r"@|https?://|www\.|linkedin|github\.com|\+?\d[\d\s\-()]{7,}", re.IGNORECASE)


def find_email(lines: List[str]) -> Optional[str]:
    for line in lines:
        match = EMAIL_RE.search(line)
        if match:
            return match.group(0).strip(".")
    return None


def looks_like_name(line: str) -> bool:
    text = line.strip()
    if not text or CONTACT_HINT_RE.search(text) or detect_heading(text):
        return False
    words = text.split()
    if not 1 < len(words) <= 4:
        return False
    # Allow "Ananya Rao", "Ananya R. Rao", "ANANYA RAO"
    return all(NAME_WORD_RE.match(w) or (w.isupper() and w.isalpha()) for w in words)


def parse_header(header: List[str], pdf_wrapping: bool = False) -> Tuple[str, str]:
    """Returns (name, headline). Contact lines are never used as the headline."""
    name = ""
    rest = header
    for i, line in enumerate(header[:3]):  # the name is at the very top of a resume
        if looks_like_name(line):
            name = " ".join(w.capitalize() if w.isupper() and len(w) > 1 else w for w in line.split())
            rest = header[i + 1 :]
            break
    headline_lines = [line for line in rest if not CONTACT_HINT_RE.search(line)]
    headline = " ".join(group_items(headline_lines, pdf_wrapping)[:1])
    return name, _clip(headline, 200)


# ---------------------------------------------------------------------------
# 4. Section parsers
# ---------------------------------------------------------------------------

DEGREE_RE = re.compile(
    r"\b("
    r"B\.\s?Tech|BTech|B\.\s?E\.?|B\.\s?Sc\.?|BSc|B\.\s?S\.?|B\.\s?A\.?|B\.\s?Com|BCA|BBA|"
    r"M\.\s?Tech|MTech|M\.\s?E\.?|M\.\s?Sc\.?|MSc|M\.\s?S\.?|MCA|MBA|M\.\s?A\.?|Ph\.?\s?D\.?|"
    r"Bachelor(?:'s)?(?: of [A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)?|Master(?:'s)?(?: of [A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)?|"
    r"Diploma|Higher Secondary|Senior Secondary|HSC|SSC|Class XII|Class X|12th|10th"
    r")(?![A-Za-z])"
)
GRADE_RE = re.compile(
    r"\b(?:CGPA|GPA|CPI|SGPA)\s*[:\-]?\s*\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?|\b\d{2,3}(?:\.\d+)?\s*%",
    re.IGNORECASE,
)
YEAR_PHRASE_RE = re.compile(r"\b(?:class of|batch of|graduating|graduation|expected)?\s*[:\-]?\s*((?:19|20)\d{2})\b", re.IGNORECASE)
INSTITUTION_RE = re.compile(r"\b(University|Institute|College|IIT|NIT|IIIT|BITS|School|Academy|Vidyalaya|Polytechnic)\b", re.IGNORECASE)


def parse_education_item(text: str) -> Dict[str, str]:
    entry = {"degree": "", "field": "", "institution": "", "graduation_year": "", "grade": ""}
    rest = text

    grade = GRADE_RE.search(rest)
    if grade:
        entry["grade"] = re.sub(r"\s+", " ", grade.group(0)).strip()
        rest = rest.replace(grade.group(0), " ")

    years = YEAR_PHRASE_RE.findall(rest)
    if years:
        entry["graduation_year"] = years[-1]  # "2022 – 2026" → graduation year 2026
        rest = YEAR_PHRASE_RE.sub(" ", rest)

    degree = DEGREE_RE.search(rest)
    if degree:
        entry["degree"] = degree.group(0).strip()
        rest = rest[: degree.start()] + " , " + rest[degree.end() :]
        # "B.Tech in Computer Science" → field after "in"
        rest = re.sub(r"^\s*,\s*in\b", ",", rest.strip(), flags=re.IGNORECASE)

    parts = [p.strip(" ,.;:|()") for p in re.split(r"[,|;]|\s[—–-]\s|\bfrom\b|\bat\b", rest)]
    parts = [p for p in parts if p and re.search(r"[A-Za-z]{2,}", p)]
    for part in parts:
        if not entry["institution"] and INSTITUTION_RE.search(part):
            entry["institution"] = part
        elif not entry["field"] and entry["degree"]:
            entry["field"] = re.sub(r"^in\s+", "", part, flags=re.IGNORECASE)

    if not entry["degree"] and not entry["institution"]:
        # Not recognisable as a degree or school: keep the original text instead of guessing.
        entry["degree"] = _clip(text, 160)
    return entry


def parse_education(items: List[str]) -> List[Dict[str, str]]:
    entries = [parse_education_item(i) for i in items if not _is_negative(i)]
    # Merge an institution-only line with the degree line next to it.
    merged: List[Dict[str, str]] = []
    for entry in entries:
        prev = merged[-1] if merged else None
        if prev and _fills_gaps(prev, entry):
            for k, v in entry.items():
                if v and not prev[k]:
                    prev[k] = v
        else:
            merged.append(entry)
    return merged


def _fills_gaps(a: Dict[str, str], b: Dict[str, str]) -> bool:
    only_school = lambda e: e["institution"] and not DEGREE_RE.search(e["degree"] or "")  # noqa: E731
    has_degree = lambda e: bool(DEGREE_RE.search(e["degree"] or ""))  # noqa: E731
    return (only_school(a) and has_degree(b) and not b["institution"]) or (
        has_degree(a) and not a["institution"] and only_school(b) and not has_degree(b)
    )


def _split_head_and_description(text: str) -> Tuple[str, str]:
    """ "Title — what was done" → ("Title", "what was done")."""
    parts = DASH_SPLIT_RE.split(text, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        return parts[0].strip(), parts[1].strip()
    if ":" in text:
        head, desc = text.split(":", 1)
        if 0 < len(head.split()) <= 8 and desc.strip():
            return head.strip(), desc.strip()
    return text.strip(), ""


TITLE_BREAK_RE = re.compile(r"\s\(|,\s|\s(?:with|using|in|for|on|as|to|that|which|via|including)\s")


def _short_title(text: str, limit: int = 80) -> str:
    """ "Built a URL shortener with a Redis cache ..." → "Built a URL shortener".

    Cuts at the first natural break after at least three words; the title is
    always the resume's own words, never a made-up name.
    """
    first = re.split(r"(?<=[.!?])\s", text.strip(), maxsplit=1)[0].rstrip(".")
    for match in TITLE_BREAK_RE.finditer(first):
        if len(first[: match.start()].split()) >= 3:
            return _clip(first[: match.start()], limit)
    return _clip(first, limit)


def parse_projects(items: List[str]) -> List[Dict[str, str]]:
    projects = []
    for item in items:
        if _is_negative(item):
            continue
        head, desc = _split_head_and_description(item)
        if desc and len(head.split()) <= 10:
            projects.append({"title": head, "description": desc})
        else:
            # No separate title in the resume: use the start of the sentence as the title
            # and keep the full original text as the description.
            projects.append({"title": _short_title(item), "description": item})
    return projects


HACKATHON_RE = re.compile(r"\b(hackathons?|ideathon|codeathon|datathon|buildathon|competition|contest|challenge|olympiad)\b", re.IGNORECASE)
RESULT_RE = re.compile(
    r"\b(winners?|won|runner[- ]?up|finalists?|semi[- ]?finalists?|participa(?:nt|ted)|"
    r"(?:1st|2nd|3rd|first|second|third)(?: place| prize)?|top \d+|honou?rable mention)\b",
    re.IGNORECASE,
)
EXPERIENCE_RE = re.compile(r"\b(intern(ship)?|engineer|developer|analyst|assistant|associate|worked|employed|trainee|consultant)\b", re.IGNORECASE)


def parse_internship(item: str) -> Dict[str, str]:
    head, desc = _split_head_and_description(item)
    role, org = head, ""
    at = re.split(r"\s+at\s+", head, maxsplit=1, flags=re.IGNORECASE)
    if len(at) == 2:
        role, org = at[0].strip(" ,"), re.sub(r"^(a|an|the)\s+", "", at[1].strip(" ,"), flags=re.IGNORECASE)
    elif "," in head and not desc:
        # "Software Engineer, Acme Corp" style
        first, second = head.split(",", 1)
        if EXPERIENCE_RE.search(first):
            role, org = first.strip(), second.strip()
    return {"role": role, "organization": org, "description": desc}


def parse_hackathon(item: str) -> Dict[str, str]:
    head, desc = _split_head_and_description(item)
    result, name = "", head
    pieces = [p.strip() for p in head.split(",")]
    for i, piece in enumerate(pieces):
        if RESULT_RE.search(piece) and not HACKATHON_RE.search(piece):
            result = piece
            name = ", ".join(pieces[:i] + pieces[i + 1 :]).strip()
            break
    if not result:
        match = RESULT_RE.search(head)
        if match:
            result = match.group(0)
    return {"name": name or head, "result": result, "description": desc}


def parse_activities(items: List[str], sections: List[str]) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """Splits items into (internships, hackathons). Mixed sections are classified per item."""
    internships, hackathons = [], []
    for item in items:
        if _is_negative(item):
            continue
        if "hackathons" in sections and ("experience" not in sections or HACKATHON_RE.search(item)):
            hackathons.append(parse_hackathon(item))
        else:
            internships.append(parse_internship(item))
    return internships, hackathons


KNOWN_ISSUERS = [
    "Google", "Microsoft", "Amazon", "AWS", "Oracle", "Cisco", "IBM", "Meta", "Coursera", "Udemy", "edX",
    "NPTEL", "Infosys", "HackerRank", "LinkedIn", "Salesforce", "Red Hat", "CompTIA", "Databricks", "Snowflake",
]


def parse_certifications(items: List[str]) -> List[Dict[str, str]]:
    certs = []
    for item in items:
        if _is_negative(item):  # "Self-taught; no formal certifications listed"
            continue
        for text in ([item] if len(item) > 80 else split_list(item) or [item]):
            if _is_negative(text):
                continue
            name, issuer = text, ""
            by = re.split(r"\s+(?:by|from|[—–-])\s+", text, maxsplit=1)
            if len(by) == 2 and len(by[1].split()) <= 5:
                name, issuer = by[0].strip(), by[1].strip(" ()")
            else:
                for known in KNOWN_ISSUERS:
                    if re.search(rf"(?<!\w){re.escape(known)}(?!\w)", text):
                        issuer = known
                        break
            certs.append({"name": name, "issuer": issuer})
    return certs


def parse_simple_list(items: List[str]) -> List[str]:
    return [i for i in items if not _is_negative(i)]


def parse_roles(items: List[str]) -> List[str]:
    roles: List[str] = []
    for item in items:
        for role in split_list(item):
            if not _is_negative(role) and len(role.split()) <= 6 and role not in roles:
                roles.append(role)
    return roles


# ---------------------------------------------------------------------------
# 5. Skills
# ---------------------------------------------------------------------------

# Indirect signals. They only ever produce LOW confidence Communication evidence.
COMMUNICATION_SIGNAL_RE = re.compile(
    r"\b(present(?:ed|ing|ations?)?|mentor(?:s|ed|ing)?|taught|teach(?:ing)?|blog|wrote|write-up|"
    r"coordinat(?:or|ed|ing)|led a team|workshops?|non-technical audience|public speaking)\b",
    re.IGNORECASE,
)

CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1}


def _display_name(raw: str) -> str:
    """Keeps the resume's own wording, but moves depth words into brackets:
    "basic Java" → "Java (basic)", "exposure to ticketing tools" → "ticketing tools (exposure)".
    """
    text = raw.strip()
    if "(" in text:
        return text
    match = re.search(r"\b(basic|basics|fundamentals?|foundational|exposure|beginner|introductory|intro)\b", text, re.IGNORECASE)
    if not match:
        return text
    core = re.sub(r"\b(exposure to|basics of|fundamentals of|intro to|introduction to)\b", " ", text, flags=re.IGNORECASE)
    core = re.sub(rf"\b{re.escape(match.group(0))}\b", " ", core, flags=re.IGNORECASE)
    core = re.sub(r"\s+", " ", core).strip(" -")
    return f"{core} ({match.group(0).lower()})" if core else text


def _strip_label(text: str) -> str:
    """ "Languages: C++, Java" → "C++, Java" (only short labels are removed)."""
    if ":" in text:
        label, rest = text.split(":", 1)
        if rest.strip() and len(label.split()) <= 3:
            return rest.strip()
    return text


def _listed_skills(items: List[str]) -> List[Tuple[str, str, Optional[TaxonomySkill], str]]:
    """Returns (display name, canonical key, taxonomy entry or None, source text) for each Skills item."""
    out = []
    for item in items:
        for token in split_list(_strip_label(item)):
            token = token.strip()
            if not token or _is_negative(token):
                continue
            if len(token.split()) > 5:
                # A sentence inside the Skills section, e.g. "Proficient in Python and SQL".
                for tax in find_skills_in_text(token):
                    out.append((tax.name, clean_skill_text(tax.name), tax, token))
                continue
            tax = lookup_listed_skill(token)
            key = clean_skill_text(tax.name) if tax else clean_skill_text(token)
            inner = re.search(r"\(([^)]*)\)", token)
            # "SQL (basic)" keeps its bracket; "Python (pandas, scikit-learn)" becomes "Python".
            name = token if not inner or has_depth_qualifier(inner.group(1)) else re.sub(r"\s*\([^)]*\)", "", token).strip()
            if key:
                out.append((_display_name(name), key, tax, token))
            # Known tools inside brackets: "Python (pandas, scikit-learn)"
            if inner:
                for sub in split_list(inner.group(1)):
                    sub_tax = lookup_listed_skill(sub)
                    if sub_tax and not has_depth_qualifier(sub):
                        out.append((sub.strip(), clean_skill_text(sub_tax.name), sub_tax, token))
    return out


def build_skills(skill_items: List[str], evidence_lines: List[str]) -> List[Dict[str, str]]:
    skills: Dict[str, Dict[str, str]] = {}  # canonical key → skill
    taxonomy_for: Dict[str, Optional[TaxonomySkill]] = {}
    order: List[str] = []

    def add(key: str, skill: Dict[str, str]):
        if key not in skills:
            skills[key] = skill
            order.append(key)
            return
        existing = skills[key]
        if CONFIDENCE_RANK[skill["confidence"]] > CONFIDENCE_RANK[existing["confidence"]]:
            existing["confidence"] = skill["confidence"]
        if skill["evidence"] and skill["evidence"] not in existing["evidence"]:
            existing["evidence"] = f"{existing['evidence']}; {skill['evidence']}" if existing["evidence"] else skill["evidence"]

    # 1. Skills listed in the Skills section → medium ("listed only").
    for name, key, tax, _source in _listed_skills(skill_items):
        taxonomy_for[key] = tax
        add(key, {"skill_name": name, "category_code": tax.category if tax else "OTHER", "evidence": "Listed under Technical Skills", "confidence": "medium"})

    listed_keys = set(order)

    # 2. Mentions in projects / internships / hackathons / achievements / certifications.
    for line in evidence_lines:
        quote = _clip(line)
        for tax in find_skills_in_text(line):
            key = clean_skill_text(tax.name)
            if key in listed_keys:
                existing = skills[key]
                # Listed AND demonstrated → high, unless the resume itself says "basic".
                demonstrated = "medium" if has_depth_qualifier(existing["skill_name"]) else "high"
                if CONFIDENCE_RANK[demonstrated] > CONFIDENCE_RANK[existing["confidence"]]:
                    existing["confidence"] = demonstrated
                if existing["evidence"] == "Listed under Technical Skills":
                    existing["evidence"] = quote
                elif quote not in existing["evidence"]:
                    existing["evidence"] = f"{existing['evidence']}; {quote}"
            else:
                taxonomy_for.setdefault(key, tax)
                add(key, {"skill_name": tax.name, "category_code": tax.category, "evidence": quote, "confidence": "medium"})

    # 3. Indirect communication signals → low (never raises an existing skill).
    comm_key = clean_skill_text("Communication")
    if comm_key not in skills:
        for line in evidence_lines:
            if COMMUNICATION_SIGNAL_RE.search(line):
                add(comm_key, {"skill_name": "Communication", "category_code": "COMM", "evidence": f"{_clip(line)} (indirect signal)", "confidence": "low"})
                break

    return [skills[k] for k in order]


# ---------------------------------------------------------------------------
# 6. Putting it together
# ---------------------------------------------------------------------------


def parse_resume_lines(lines: List[str], source_kind: str = "docx") -> Dict:
    """Parses resume text lines into the contract shape (without file/storage fields).

    source_kind is "pdf" or "docx"; PDFs need extra joining of wrapped lines.
    """
    pdf_wrapping = source_kind == "pdf"
    header, sections = split_sections(lines)
    name, headline = parse_header(header, pdf_wrapping)

    result = {
        "source_type": "resume",
        "name": name,
        "email": find_email(lines),
        "headline": headline,
        "education": [],
        "skills": [],
        "projects": [],
        "internships": [],
        "hackathons": [],
        "certifications": [],
        "achievements": [],
        "preferred_roles": [],
    }
    skill_items: List[str] = []
    evidence_lines: List[str] = []
    summary = ""

    for names, section_lines in sections:
        items = group_items(section_lines, pdf_wrapping)
        if names == ["skills"]:
            skill_items.extend(items)
        elif names == ["education"]:
            result["education"].extend(parse_education(items))
        elif names == ["projects"]:
            result["projects"].extend(parse_projects(items))
            evidence_lines.extend(items)
        elif set(names) <= {"experience", "hackathons"}:
            internships, hackathons = parse_activities(items, names)
            result["internships"].extend(internships)
            result["hackathons"].extend(hackathons)
            evidence_lines.extend(items)
        elif names == ["certifications"]:
            result["certifications"].extend(parse_certifications(items))
            evidence_lines.extend(i for i in items if not _is_negative(i))
        elif names == ["achievements"]:
            # Hackathons are often listed under Achievements / Accomplishments / Awards.
            for item in parse_simple_list(items):
                if HACKATHON_RE.search(item):
                    result["hackathons"].append(parse_hackathon(item))
                else:
                    result["achievements"].append(item)
            evidence_lines.extend(items)
        elif names == ["roles"]:
            result["preferred_roles"].extend(parse_roles(items))
        elif names == ["summary"]:
            summary = summary or " ".join(items)
        # "ignore" sections (contact details) and unusual combinations are skipped.

    if not result["headline"] and summary:
        result["headline"] = _clip(summary, 200)

    result["skills"] = build_skills(skill_items, evidence_lines)
    return result


def collect_warnings(parsed: Dict) -> List[str]:
    """Plain-language notes about what could not be found, shown in the UI."""
    warnings = []
    if not parsed["name"]:
        warnings.append("No candidate name was found at the top of the resume. Enter it in Profile Builder.")
    if not parsed["email"]:
        warnings.append("No email address was found in the resume.")
    if not parsed["skills"]:
        warnings.append("No skills were recognised. Check that the resume has a Skills section.")
    if not parsed["education"]:
        warnings.append("No education section was found.")
    return warnings
