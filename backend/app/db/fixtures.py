"""Preloaded seed fixtures for RADIX Talent Match.

Provides fallback fixtures for the four sample resumes and six sample JDs
so backend APIs can resolve sample IDs offline and during test runs.
"""

from typing import Optional

CANDIDATE_FIXTURES: dict[str, dict] = {
    "ananya-rao": {
        "profile_id": "prf_sample_ananya",
        "name": "Ananya Rao",
        "email": None,
        "skills": [
            {"skill_name": "C++", "category_code": "COD", "evidence": "Implemented a multithreaded job scheduler in C++", "confidence": "high"},
            {"skill_name": "Java", "category_code": "COD", "evidence": "Designed a parking-lot management system in Java", "confidence": "high"},
            {"skill_name": "Python", "category_code": "COD", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "Solved 350+ problems on competitive programming platforms", "confidence": "high"},
            {"skill_name": "Operating Systems", "category_code": "OS", "evidence": "Simulating OS-level process scheduling algorithms", "confidence": "high"},
            {"skill_name": "Linux", "category_code": "OS", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Computer Networks", "category_code": "NETW", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "evidence": "Parking-lot management system using OOP design patterns", "confidence": "high"},
            {"skill_name": "System Design", "category_code": "SYSD", "evidence": "Distributed URL shortener with Redis", "confidence": "medium"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "evidence": "Backend intern shipped rate-limiter in production", "confidence": "medium"},
            {"skill_name": "Git", "category_code": "SWE", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Mentors juniors on DSA (indirect signal)", "confidence": "low"},
        ],
    },
    "karthik-subramaniam": {
        "profile_id": "prf_sample_karthik",
        "name": "Karthik Subramaniam",
        "email": None,
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "evidence": "Built churn prediction model in Python", "confidence": "high"},
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "Optimized SQL queries reducing runtime by 35%", "confidence": "high"},
            {"skill_name": "Machine Learning", "category_code": "AI", "evidence": "Trained XGBoost models with 84% ROC-AUC", "confidence": "high"},
            {"skill_name": "Data Visualization", "category_code": "SWE", "evidence": "Built executive dashboards in Power BI", "confidence": "high"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "Academic coursework only", "confidence": "low"},
            {"skill_name": "Quantitative Aptitude", "category_code": "APTI", "evidence": "Strong statistical reasoning in ML projects", "confidence": "high"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Presented analytics insights to non-technical stakeholders", "confidence": "high"},
        ],
    },
    "priya-menon": {
        "profile_id": "prf_sample_priya",
        "name": "Priya Menon",
        "email": None,
        "skills": [
            {"skill_name": "Java", "category_code": "COD", "evidence": "Core Java backend services", "confidence": "high"},
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "Relational schema design and indexing", "confidence": "high"},
            {"skill_name": "Technical Troubleshooting", "category_code": "SWE", "evidence": "Production incident response and RCA", "confidence": "high"},
            {"skill_name": "Ticketing / Incident Tools", "category_code": "OTHER", "evidence": "Managed incident workflows in Jira / ServiceNow", "confidence": "high"},
            {"skill_name": "Operating Systems", "category_code": "OS", "evidence": "Basic Linux server administration", "confidence": "medium"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Coordinated stakeholder status calls during outages", "confidence": "high"},
        ],
    },
    "rohan-verma": {
        "profile_id": "prf_sample_rohan",
        "name": "Rohan Verma",
        "email": None,
        "skills": [
            {"skill_name": "Python (basic)", "category_code": "COD", "evidence": "Introductory Python coursework", "confidence": "low"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Class representative", "confidence": "medium"},
            {"skill_name": "Quantitative Aptitude", "category_code": "APTI", "evidence": "Good academic math marks", "confidence": "medium"},
        ],
    },
}

JD_FIXTURES: dict[str, dict] = {
    "google-swe": {
        "jd_id": "jd_sample_google_swe",
        "company": "Google LLC",
        "role": "Software Engineer (SWE)",
        "source_file": "Google LLC - Software Engineer.pdf",
        "skills": [
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "Strong grasp of data structures and algorithms", "confidence": "high", "requirement": "required"},
            {"skill_name": "Programming", "category_code": "COD", "evidence": "Hands-on programming ability in modern languages", "confidence": "high", "requirement": "required"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "evidence": "Clean modular design and OOP principles", "confidence": "high", "requirement": "required"},
            {"skill_name": "Operating Systems", "category_code": "OS", "evidence": "Concurrency, multithreading, and OS internals", "confidence": "high", "requirement": "required"},
            {"skill_name": "System Design", "category_code": "SYSD", "evidence": "Scalable distributed architecture concepts", "confidence": "high", "requirement": "required"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "evidence": "Testing, code review, and version control", "confidence": "medium", "requirement": "required"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Cross-functional team collaboration", "confidence": "medium", "requirement": "preferred"},
        ],
    },
    "google-ds": {
        "jd_id": "jd_sample_google_ds",
        "company": "Google LLC",
        "role": "Data Scientist",
        "source_file": "Google LLC - Data Scientist.pdf",
        "skills": [
            {"skill_name": "Python", "category_code": "COD", "evidence": "Data manipulation and scientific computing in Python", "confidence": "high", "requirement": "required"},
            {"skill_name": "Machine Learning", "category_code": "AI", "evidence": "Supervised and unsupervised learning models", "confidence": "high", "requirement": "required"},
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "Complex query formulation across big data", "confidence": "high", "requirement": "required"},
            {"skill_name": "Quantitative Aptitude", "category_code": "APTI", "evidence": "Statistical inference and hypothesis testing", "confidence": "high", "requirement": "required"},
            {"skill_name": "Data Visualization", "category_code": "SWE", "evidence": "Dashboards and executive charts", "confidence": "medium", "requirement": "preferred"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Translating quantitative findings to product leaders", "confidence": "high", "requirement": "required"},
        ],
    },
    "microsoft-swe": {
        "jd_id": "jd_sample_microsoft_swe",
        "company": "Microsoft",
        "role": "Software Engineer",
        "source_file": "Microsoft - Software Engineer.pdf",
        "skills": [
            {"skill_name": "Programming", "category_code": "COD", "evidence": "Proficiency in C++, Java, or C#", "confidence": "high", "requirement": "required"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "Core algorithmic problem solving", "confidence": "high", "requirement": "required"},
            {"skill_name": "Cloud Infrastructure", "category_code": "CLOUD", "evidence": "Familiarity with Azure or distributed cloud services", "confidence": "medium", "requirement": "preferred"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "evidence": "Unit testing and CI/CD pipelines", "confidence": "medium", "requirement": "required"},
        ],
    },
    "microsoft-da": {
        "jd_id": "jd_sample_microsoft_da",
        "company": "Microsoft",
        "role": "Data Analyst",
        "source_file": "Microsoft - Data Analyst.pdf",
        "skills": [
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "ETL and data extraction via SQL", "confidence": "high", "requirement": "required"},
            {"skill_name": "Data Visualization", "category_code": "SWE", "evidence": "Power BI reporting and KPI metrics", "confidence": "high", "requirement": "required"},
            {"skill_name": "Quantitative Aptitude", "category_code": "APTI", "evidence": "Analytical reasoning and business metrics", "confidence": "high", "requirement": "required"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Business stakeholder reporting", "confidence": "medium", "requirement": "required"},
        ],
    },
    "oracle-ase": {
        "jd_id": "jd_sample_oracle_ase",
        "company": "Oracle",
        "role": "Associate Software Engineer",
        "source_file": "Oracle - Associate Software Engineer.pdf",
        "skills": [
            {"skill_name": "Java", "category_code": "COD", "evidence": "Java enterprise backend development", "confidence": "high", "requirement": "required"},
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "Relational database querying and optimization", "confidence": "high", "requirement": "required"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "Algorithmic thinking", "confidence": "high", "requirement": "required"},
            {"skill_name": "Linux", "category_code": "OS", "evidence": "Linux shell and command line", "confidence": "medium", "requirement": "preferred"},
        ],
    },
    "oracle-asa": {
        "jd_id": "jd_sample_oracle_asa",
        "company": "Oracle",
        "role": "Application Support Analyst",
        "source_file": "Oracle - Application Support Analyst.pdf",
        "skills": [
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "Data investigation queries", "confidence": "high", "requirement": "required"},
            {"skill_name": "Technical Troubleshooting", "category_code": "SWE", "evidence": "Investigating logs and application anomalies", "confidence": "high", "requirement": "required"},
            {"skill_name": "Ticketing / Incident Tools", "category_code": "OTHER", "evidence": "Incident tracking systems", "confidence": "medium", "requirement": "required"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Incident communication with technical teams", "confidence": "high", "requirement": "required"},
        ],
    },
}


def find_candidate_fixture(identifier: str) -> Optional[dict]:
    """Look up candidate fixture by profile_id or key name."""
    clean_id = identifier.lower().replace(" ", "-")
    for key, data in CANDIDATE_FIXTURES.items():
        if (
            data.get("profile_id") == identifier
            or key == clean_id
            or key in clean_id
            or clean_id in key
        ):
            return data
    return None


def find_jd_fixture(identifier: str) -> Optional[dict]:
    """Look up JD fixture by jd_id, key name, or source_file."""
    if not identifier or not identifier.strip():
        return None  # an empty string is a substring of every key and would match the first fixture
    clean_id = identifier.lower().replace(" ", "-").replace("_", "-")
    for key, data in JD_FIXTURES.items():
        src = (data.get("source_file") or "").lower()
        if (
            data.get("jd_id") == identifier
            or key == clean_id
            or key in clean_id
            or clean_id in key
            or src == identifier.lower()
            or (src and src in identifier.lower())
        ):
            return data
    return None
