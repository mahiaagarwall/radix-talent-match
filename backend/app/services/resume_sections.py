"""Split resume text into sections and parse each section with plain rules.

Works on the text produced by document_reader (bullets start with "• ").
Everything returned here is copied from the resume text — nothing is invented.
"""

import re

BULLET = "•"

# Heading text (lower-case, no trailing colon) -> section key
HEADINGS = {
    "education": "education",
    "academics": "education",
    "academic background": "education",
    "technical skills": "skills",
    "skills": "skills",
    "key skills": "skills",
    "core skills": "skills",
    "projects": "projects",
    "academic projects": "projects",
    "personal projects": "projects",
    "hackathons / internships": "experience",
    "hackathons/internships": "experience",
    "internships / hackathons": "experience",
    "internships": "experience",
    "hackathons": "experience",
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "certifications": "certifications",
    "certificates": "certifications",
    "achievements": "achievements",
    "awards": "achievements",
    "accomplishments": "achievements",
    "preferred roles": "preferred_roles",
    "target roles": "preferred_roles",
    "summary": "summary",
    "objective": "summary",
}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
NONE_RE = re.compile(r"^(none|n/?a|nil)\b|no formal certifications|not listed", re.I)
DASH_SPLIT = re.compile(r"\s+[—–-]\s+")
RESULT_WORDS = re.compile(r"^(winner|finalist|runner[- ]up|semi[- ]finalist|participa\w*|\d+(st|nd|rd|th) place)", re.I)


def _heading_key(line: str):
    if line.startswith(BULLET):
        return None
    return HEADINGS.get(line.strip().rstrip(":").strip().lower())


PAGE_LINE = re.compile(r"^page \d+( of \d+)?$", re.I)
NAME_LINE = re.compile(r"^[A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+){1,3}$")


def _is_continuation(previous: str, line: str, previous_is_bullet: bool) -> bool:
    """A wrapped line from the PDF, not a new item."""
    if previous_is_bullet:
        return True  # bullets mark items, so any plain line after one is its wrapped tail
    if previous.endswith(","):
        return True
    return not re.search(r"[.;:!?]$", previous) and (line[:1].islower() or line[:1] == "(")


def split_sections(text: str) -> dict:
    """Return {"_header": [...], "<section>": [item, ...]} with wrapped lines re-joined."""
    sections: dict[str, list[str]] = {"_header": []}
    current = "_header"
    last_was_bullet = False
    for raw in text.splitlines():
        line = raw.strip()
        if not line or PAGE_LINE.match(line):
            continue
        key = _heading_key(line)
        if key:
            current = key
            sections.setdefault(current, [])
            last_was_bullet = False
            continue
        items = sections[current]
        if line.startswith(BULLET):
            items.append(line.lstrip(BULLET).strip())
            last_was_bullet = True
        elif current != "_header" and items and _is_continuation(items[-1], line, last_was_bullet):
            items[-1] = f"{items[-1]} {line}"
        else:
            items.append(line)
            last_was_bullet = False
    return sections


def split_commas(text: str) -> list[str]:
    """Split on commas that are not inside parentheses."""
    parts, depth, buf = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    parts.append(buf)
    return [p.strip() for p in parts if p.strip()]


def _cap(s: str) -> str:
    s = re.sub(r"^(a|an|the)\s+", "", s.strip(), flags=re.I)
    return s[:1].upper() + s[1:]


# ---------- field parsers ----------

def parse_name_and_headline(header: list[str]) -> tuple[str, str]:
    """Name = first header line shaped like a person's name (skips page banners)."""
    for i, line in enumerate(header):
        if NAME_LINE.match(line):
            # Headline = remaining header lines (may wrap in PDFs), minus contact details.
            rest = [l for l in header[i + 1 :] if not EMAIL_RE.search(l) and not re.search(r"\+?\d[\d\s()-]{7,}", l)]
            return line, " ".join(rest)
    return "", ""


def find_email(text: str):
    match = EMAIL_RE.search(text)
    return match.group(0) if match else None


def parse_education(item: str) -> dict:
    main, _, grade = item.partition(" — ") if " — " in item else (item, "", "")
    parts = [p.strip() for p in main.split(",") if p.strip()]
    entry = {"degree": "", "field": "", "institution": "", "graduation_year": "", "grade": grade.strip()}
    year = YEAR_RE.search(item)
    if year:
        entry["graduation_year"] = year.group(0)
    rest = []
    for p in parts:
        if re.search(r"universit|institute|college|school|\biit\b|\bnit\b", p, re.I):
            entry["institution"] = p
        elif re.search(r"cgpa|gpa|%|grade", p, re.I) and not entry["grade"]:
            entry["grade"] = p
        elif YEAR_RE.search(p) and re.search(r"class of|batch|graduat|\d{4}\s*[-–]", p, re.I):
            continue
        else:
            rest.append(p)
    if rest:
        entry["degree"] = rest[0]
    if len(rest) > 1:
        entry["field"] = rest[1]
    return entry


PROJECT_VERB = re.compile(
    r"^(?:(?:built|designed|developed|implemented|created|wrote|ran|made|engineered|analy[sz]ed|contributed to)\s+(?:and\s+)?)+"
    r"(?:(?:an?|the)\s+)?",
    re.I,
)
PROJECT_STOP = re.compile(r"\s(with|using|in|on|for|as|comparing|including|that|to)\s|\s\(|,")


def parse_project(item: str) -> dict:
    core = PROJECT_VERB.sub("", item)
    title = PROJECT_STOP.split(core, maxsplit=1)[0].strip()
    if not title or len(title.split()) > 8:
        title = " ".join(item.split()[:6])
    return {"title": _cap(title), "description": item}


def parse_internship(item: str) -> dict:
    left, desc = (DASH_SPLIT.split(item, maxsplit=1) + [""])[:2] if DASH_SPLIT.search(item) else (item, "")
    role, org = left, ""
    if " at " in left:
        role, org = left.split(" at ", 1)
    return {"role": role.strip(), "organization": _cap(org) if org else "", "description": _cap(desc) if desc else ""}


def parse_hackathon(item: str) -> dict:
    left, desc = (DASH_SPLIT.split(item, maxsplit=1) + [""])[:2] if DASH_SPLIT.search(item) else (item, "")
    result, name = "", left.strip()
    head, sep, tail = left.partition(", ")
    if sep and RESULT_WORDS.match(head.strip()):
        result, name = head.strip(), tail.strip()
    return {"name": _cap(name), "result": result, "description": _cap(desc) if desc else ""}


def classify_experience(item: str) -> str:
    if re.search(r"\bintern(ship)?\b", item, re.I):
        return "internship"
    if re.search(r"hackathon|competition|contest|ideathon|challenge", item, re.I):
        return "hackathon"
    return "internship"


def parse_sections(text: str) -> dict:
    """Rule-based structured fields (everything except skills)."""
    sec = split_sections(text)
    name, headline = parse_name_and_headline(sec.get("_header", []))
    internships, hackathons = [], []
    for item in sec.get("experience", []):
        if classify_experience(item) == "hackathon":
            hackathons.append(parse_hackathon(item))
        else:
            internships.append(parse_internship(item))
    certs = [{"name": c, "issuer": ""} for c in sec.get("certifications", []) if not NONE_RE.search(c)]
    roles = [r for line in sec.get("preferred_roles", []) for r in split_commas(line)]
    return {
        "sections": sec,
        "name": name,
        "email": find_email(text),
        "headline": headline,
        "education": [parse_education(e) for e in sec.get("education", [])],
        "projects": [parse_project(p) for p in sec.get("projects", [])],
        "internships": internships,
        "hackathons": hackathons,
        "certifications": certs,
        "achievements": [a for a in sec.get("achievements", []) if not NONE_RE.search(a)],
        "preferred_roles": roles,
    }
