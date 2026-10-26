"""Company Requirements Service for Talent Check (Owner: Krishna Khanna).

Loads and normalizes company skillsets from data/talent_check_company_skillsets.json.
Supports the 3 in-scope companies (Google, Microsoft, Oracle) and all companies in the file.
Never invents requirements if the file is missing.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# The 12 official scored RADIX categories (OTHER is not scored in Talent Check)
SCORED_RADIX_CATEGORIES = [
    "COD", "DSA", "OOD", "APTI", "COMM", "AI",
    "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS"
]

RADIX_CATEGORY_NAMES: Dict[str, str] = {
    "COD": "Coding",
    "DSA": "Data Structures & Algorithms",
    "OOD": "Object-Oriented Design",
    "APTI": "Aptitude",
    "COMM": "Communication",
    "AI": "Artificial Intelligence",
    "CLOUD": "Cloud",
    "SQL": "SQL",
    "SWE": "Software Engineering",
    "SYSD": "System Design",
    "NETW": "Networking",
    "OS": "Operating Systems",
    "OTHER": "Other skills",
}

# In-scope companies for the hackathon
IN_SCOPE_COMPANIES = {
    "google": "4",
    "oracle": "3",
    "microsoft": "78",
}

LEVEL_KEYS = [
    "skillsets",
    "skill_levels",
    "requirements",
    "expected_levels",
    "levels",
    "skills",
    "skillset_levels"
]

NAME_TO_CODE = {
    "cod": "COD", "coding": "COD", "programming": "COD",
    "dsa": "DSA", "data structures & algorithms": "DSA", "data structures and algorithms": "DSA",
    "ood": "OOD", "object-oriented design": "OOD", "object oriented design": "OOD", "oop": "OOD",
    "apti": "APTI", "aptitude": "APTI", "quantitative aptitude": "APTI",
    "comm": "COMM", "communication": "COMM", "communication skills": "COMM",
    "ai": "AI", "artificial intelligence": "AI", "machine learning": "AI",
    "cloud": "CLOUD", "cloud computing": "CLOUD", "cloud infrastructure": "CLOUD",
    "sql": "SQL", "databases": "SQL", "database": "SQL",
    "swe": "SWE", "software engineering": "SWE", "software engineering practices": "SWE",
    "sysd": "SYSD", "system design": "SYSD", "systems design": "SYSD",
    "netw": "NETW", "networking": "NETW", "computer networks": "NETW",
    "os": "OS", "operating systems": "OS", "operating system": "OS",
}


def normalize_category_code(key: str) -> Optional[str]:
    """Maps a category string or code to one of the 12 RADIX category codes."""
    if not key:
        return None
    cleaned = str(key).strip().lower()
    return NAME_TO_CODE.get(cleaned)


def resolve_requirements_file_path(file_path: Optional[str] = None) -> Path:
    """Finds the company skillsets file without guessing or inventing data."""
    if file_path:
        p = Path(file_path)
        if p.exists() and p.is_file():
            return p
        raise FileNotFoundError(f"Specified requirements file does not exist: {file_path}")

    # Search standard workspace locations
    backend_dir = Path(__file__).resolve().parent.parent.parent  # backend/
    workspace_root = backend_dir.parent                          # root/

    candidates = [
        workspace_root / "data" / "talent_check_company_skillsets.json",
        workspace_root / "frontend" / "public" / "data" / "talent_check_company_skillsets.json",
        backend_dir / "data" / "talent_check_company_skillsets.json",
    ]

    for cand in candidates:
        if cand.exists() and cand.is_file():
            return cand

    raise FileNotFoundError(
        "Company skillsets file not found. Checked: "
        + ", ".join(str(c) for c in candidates)
        + ". Do not invent company requirements if the file is missing."
    )


def _read_levels(raw: Any, warnings: List[str], company_label: str) -> Dict[str, int]:
    levels: Dict[str, int] = {}
    
    def put(k: Any, v: Any):
        code = normalize_category_code(str(k))
        if not code or code not in SCORED_RADIX_CATEGORIES:
            warnings.append(f"{company_label}: ignored unknown or unscored skillset '{k}'.")
            return
        
        val = None
        if isinstance(v, dict):
            val = v.get("required_level") or v.get("level") or v.get("expected_level")
        else:
            val = v

        try:
            num = int(val)
            if 0 <= num <= 10:
                levels[code] = num
            else:
                warnings.append(f"{company_label}: ignored {code} level {num} (out of 0-10 range).")
        except (ValueError, TypeError):
            warnings.append(f"{company_label}: ignored {code} with non-numeric level '{v}'.")

    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                cat = item.get("category_code") or item.get("code") or item.get("skillset") or item.get("category")
                put(cat, item)
    elif isinstance(raw, dict):
        for k, v in raw.items():
            put(k, v)

    return levels


def _normalize_company(obj: Any, fallback_name: Optional[str], warnings: List[str], file_synthetic: bool) -> Optional[Dict[str, Any]]:
    if not isinstance(obj, dict):
        return None

    name = obj.get("company_name") or obj.get("company") or obj.get("name") or fallback_name
    if not name:
        warnings.append("Skipped an unidentifiable company entry with no name.")
        return None

    level_source = None
    for k in LEVEL_KEYS:
        if k in obj and obj[k] is not None:
            level_source = obj[k]
            break

    if level_source is None:
        code_like = {k: v for k, v in obj.items() if normalize_category_code(k)}
        if code_like:
            level_source = code_like

    if level_source is None and isinstance(obj, list):
        level_source = obj

    requirements = _read_levels(level_source, warnings, str(name))
    if not requirements:
        warnings.append(f"{name}: no recognisable skillset levels found, company skipped.")
        return None

    cid = str(obj.get("company_id") or obj.get("id") or str(name).lower().replace(" ", "-"))
    short_name = obj.get("short_name") or str(name)
    category = obj.get("category")

    missing = [c for c in SCORED_RADIX_CATEGORIES if c not in requirements]
    synthetic = bool(file_synthetic or obj.get("synthetic"))

    return {
        "company_id": cid,
        "company_name": str(name).strip(),
        "short_name": str(short_name).strip(),
        "category": str(category).strip() if category else None,
        "requirements": requirements,
        "missing_categories": missing,
        "synthetic": synthetic,
    }


def load_company_skillsets(file_path: Optional[str] = None) -> Dict[str, Any]:
    """Loads company skillsets from data/talent_check_company_skillsets.json.
    
    Raises FileNotFoundError if file is missing (never invents requirements).
    """
    resolved_path = resolve_requirements_file_path(file_path)
    warnings: List[str] = []

    with open(resolved_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, (dict, list)):
        raise ValueError(f"Requirements file {resolved_path} must be a JSON object or array.")

    file_synthetic = bool(isinstance(data, dict) and (data.get("synthetic") or data.get("_synthetic")))
    entries: List[tuple] = []

    if isinstance(data, list):
        entries = [(None, c) for c in data]
    elif isinstance(data, dict):
        companies_val = data.get("companies")
        if isinstance(companies_val, list):
            entries = [(None, c) for c in companies_val]
        elif isinstance(companies_val, dict):
            entries = list(companies_val.items())
        else:
            entries = [(k, v) for k, v in data.items() if not str(k).startswith("_") and k not in ("version", "synthetic", "source")]

    companies: List[Dict[str, Any]] = []
    for fallback_name, value in entries:
        norm = _normalize_company(value, fallback_name, warnings, file_synthetic)
        if norm:
            companies.append(norm)

    if not companies:
        raise ValueError(f"No valid company skillset levels found in {resolved_path}.")

    companies_by_id = {c["company_id"]: c for c in companies}

    return {
        "source": str(resolved_path),
        "synthetic": any(c["synthetic"] for c in companies),
        "companies": companies,
        "companies_by_id": companies_by_id,
        "warnings": warnings,
    }


def get_company_by_id_or_name(company_identifier: str, skillsets_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Finds a company by company_id, short_name, or company_name case-insensitively."""
    if skillsets_data is None:
        skillsets_data = load_company_skillsets()

    ident = str(company_identifier).strip().lower()

    # 1. Exact company_id match
    for c in skillsets_data["companies"]:
        if c["company_id"].lower() == ident:
            return c

    # 2. Check alias map for in-scope companies (google, oracle, microsoft)
    if ident in IN_SCOPE_COMPANIES:
        in_scope_id = IN_SCOPE_COMPANIES[ident]
        for c in skillsets_data["companies"]:
            if c["company_id"] == in_scope_id:
                return c

    # 3. Exact short_name or company_name match (case-insensitive)
    for c in skillsets_data["companies"]:
        if c["short_name"].lower() == ident or c["company_name"].lower() == ident:
            return c

    # 4. Partial substring match
    for c in skillsets_data["companies"]:
        if ident in c["company_name"].lower() or ident in c["short_name"].lower():
            return c

    raise ValueError(f"Company '{company_identifier}' not found in requirements data.")
