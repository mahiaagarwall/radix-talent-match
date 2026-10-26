"""Profile Loader Service for Talent Check (Owner: Krishna Khanna).

Dual-source profile loader:
1. First queries Supabase (tables parsed_resumes, resume_skills, and view resume_category_evidence).
2. Gracefully falls back to local fixtures (Ananya Rao, Karthik Subramaniam, Priya Menon, Rohan Verma)
   if not found in DB or if database is offline.
"""

import hashlib
import json
import uuid
from typing import Dict, Any, List, Optional
from app.db import get_db_connection

# Built-in local profile fixtures corresponding to the 4 sample resumes
LOCAL_PROFILE_FIXTURES: List[Dict[str, Any]] = [
    {
        "profile_id": "ananya-rao",
        "key": "ananya-rao",
        "name": "Ananya Rao",
        "email": None,
        "headline": "Systems-leaning generalist — strong fit for SWE-heavy roles, weaker fit for data roles",
        "education": [{"degree": "B.Tech", "field": "Computer Science and Engineering", "graduation_year": "2026", "grade": "CGPA 8.6 / 10"}],
        "skills": [
            {"skill_name": "C++", "category_code": "COD", "evidence": "Implemented a multithreaded job scheduler in C++", "confidence": "high"},
            {"skill_name": "Java", "category_code": "COD", "evidence": "Designed a parking-lot management system in Java", "confidence": "high"},
            {"skill_name": "Python", "category_code": "COD", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "Solved 350+ problems on competitive programming platforms; mentors juniors on DSA", "confidence": "high"},
            {"skill_name": "Operating Systems", "category_code": "OS", "evidence": "Multithreaded job scheduler simulating OS-level process scheduling algorithms (Round Robin, Priority, SJF)", "confidence": "high"},
            {"skill_name": "Linux", "category_code": "OS", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Computer Networks", "category_code": "NETW", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "evidence": "Parking-lot management system in Java using OOP design patterns (Factory, Strategy)", "confidence": "high"},
            {"skill_name": "System Design", "category_code": "SYSD", "evidence": "Built a distributed URL-shortening service with a Redis-backed cache and a horizontally-scalable API layer", "confidence": "medium"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "evidence": "Backend intern — shipped a rate-limiter used in production", "confidence": "medium"},
            {"skill_name": "Git", "category_code": "SWE", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Mentors juniors on DSA through the college coding club (indirect signal)", "confidence": "low"},
        ],
        "projects": [
            {"title": "Distributed URL shortener", "description": "Built a distributed URL-shortening service with a Redis-backed cache"},
            {"title": "Multithreaded job scheduler", "description": "Simulating OS-level process scheduling algorithms in C++"},
            {"title": "Parking-lot management system", "description": "Java OOP design patterns (Factory, Strategy)"},
        ],
        "internships": [
            {"role": "Summer intern, backend team", "organization": "Mid-size product startup", "description": "Shipped a rate-limiter used in production"}
        ],
        "hackathons": [
            {"name": "National-level 24-hour hackathon", "result": "Finalist", "description": "Built a real-time chat backend"}
        ],
        "certifications": [],
        "achievements": ["Solved 350+ problems on competitive programming platforms; mentors juniors on DSA through the college coding club"],
        "preferred_roles": ["Software Engineer", "Backend Engineer"],
    },
    {
        "profile_id": "karthik-subramaniam",
        "key": "karthik-subramaniam",
        "name": "Karthik Subramaniam",
        "email": None,
        "headline": "Data-leaning analyst — strong fit for Data Scientist / Data Analyst roles, weaker fit for pure SWE roles",
        "education": [{"degree": "B.Tech", "field": "Computer Science and Engineering", "graduation_year": "2026", "grade": "CGPA 8.2 / 10"}],
        "skills": [
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "End-to-end churn-prediction pipeline (SQL extraction → feature engineering → logistic regression model)", "confidence": "high"},
            {"skill_name": "Database Schema Design", "category_code": "SQL", "evidence": "Designed a normalized schema and dashboard for a college event-management system", "confidence": "medium"},
            {"skill_name": "Python", "category_code": "COD", "evidence": "Python (pandas, scikit-learn); churn-prediction pipeline", "confidence": "high"},
            {"skill_name": "Java (basic)", "category_code": "COD", "evidence": "Listed as 'basic Java' under Technical Skills", "confidence": "medium"},
            {"skill_name": "Machine Learning", "category_code": "AI", "evidence": "scikit-learn listed; built a logistic regression churn model", "confidence": "high"},
            {"skill_name": "Statistics", "category_code": "APTI", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "A/B Testing (basics)", "category_code": "APTI", "evidence": "Ran and analyzed an A/B test simulation comparing two onboarding flows", "confidence": "high"},
            {"skill_name": "Power BI", "category_code": "OTHER", "evidence": "Data Analytics intern — built two recurring dashboards used by the growth team", "confidence": "high"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Presented A/B test results to a non-technical audience", "confidence": "medium"},
        ],
        "projects": [
            {"title": "Churn-prediction pipeline", "description": "SQL extraction → feature engineering → logistic regression model"},
            {"title": "Event-management schema and dashboard", "description": "Normalized schema and dashboard for event management"},
            {"title": "A/B test simulation", "description": "Ran and analyzed an A/B test simulation"},
        ],
        "internships": [
            {"role": "Data Analytics intern", "organization": "Fintech startup", "description": "Built two recurring dashboards used by the growth team"}
        ],
        "hackathons": [
            {"name": "Inter-college data visualization competition", "result": "Runner-up", "description": ""}
        ],
        "certifications": [{"name": "Google Data Analytics Certificate", "issuer": "Google"}],
        "achievements": ["Published a short analysis write-up on a public dataset"],
        "preferred_roles": ["Data Analyst", "Data Scientist"],
    },
    {
        "profile_id": "priya-menon",
        "key": "priya-menon",
        "name": "Priya Menon",
        "email": None,
        "headline": "Entry-level, support-oriented — best fit for the Oracle FSS roles, weaker fit for Google / Microsoft",
        "education": [{"degree": "B.Tech", "field": "Information Technology", "graduation_year": "2026", "grade": "CGPA 7.4 / 10"}],
        "skills": [
            {"skill_name": "SQL (basic)", "category_code": "SQL", "evidence": "SQL (basic) listed; student attendance tracker with a MySQL backend", "confidence": "high"},
            {"skill_name": "Java", "category_code": "COD", "evidence": "Built a simple student attendance tracker using Java", "confidence": "high"},
            {"skill_name": "Linux (basics)", "category_code": "OS", "evidence": "Listed as 'Linux basics' under Technical Skills", "confidence": "medium"},
            {"skill_name": "Networking (fundamentals)", "category_code": "NETW", "evidence": "Networking fundamentals listed; Cisco Networking Basics", "confidence": "high"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Volunteer coordinator for a college technical fest", "confidence": "medium"},
        ],
        "projects": [
            {"title": "Student attendance tracker", "description": "Built a simple student attendance tracker using Java and MySQL"}
        ],
        "internships": [
            {"role": "Summer intern, IT support desk", "organization": "Local business", "description": "Handled first-level troubleshooting and escalations"}
        ],
        "hackathons": [],
        "certifications": [{"name": "Cisco Networking Basics", "issuer": "Cisco"}],
        "achievements": ["Volunteer coordinator for a college technical fest"],
        "preferred_roles": ["Application Support Analyst", "Associate Software Engineer"],
    },
    {
        "profile_id": "rohan-verma",
        "key": "rohan-verma",
        "name": "Rohan Verma",
        "email": None,
        "headline": "Strong all-rounder — competitive fit across nearly every role in this pack",
        "education": [{"degree": "B.Tech", "field": "Computer Science and Engineering", "graduation_year": "2026", "grade": "CGPA 9.1 / 10"}],
        "skills": [
            {"skill_name": "C++", "category_code": "COD", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Python", "category_code": "COD", "evidence": "Open-source contributor (2 merged PRs to a mid-size Python library)", "confidence": "high"},
            {"skill_name": "SQL", "category_code": "SQL", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Data Structures & Algorithms", "category_code": "DSA", "evidence": "500+ problems solved across competitive programming platforms", "confidence": "high"},
            {"skill_name": "System Design", "category_code": "SYSD", "evidence": "Scalable notification service (pub-sub architecture, horizontally-scalable workers)", "confidence": "high"},
            {"skill_name": "Object-Oriented Design", "category_code": "OOD", "evidence": "Wrote a technical blog series on object-oriented design patterns", "confidence": "high"},
            {"skill_name": "Operating Systems", "category_code": "OS", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Machine Learning (basic)", "category_code": "AI", "evidence": "Recommendation engine using collaborative filtering", "confidence": "high"},
            {"skill_name": "Software Engineering Practices", "category_code": "SWE", "evidence": "SWE intern — shipped a feature end-to-end including tests and CI", "confidence": "high"},
            {"skill_name": "Git", "category_code": "SWE", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Docker", "category_code": "CLOUD", "evidence": "Listed under Technical Skills", "confidence": "medium"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Technical blog series with architecture diagrams", "confidence": "medium"},
        ],
        "projects": [
            {"title": "Scalable notification service", "description": "Pub-sub architecture, horizontally-scalable workers with diagrams"},
            {"title": "Movie recommendation engine", "description": "Collaborative filtering on movie-ratings dataset"},
            {"title": "OOD patterns blog series", "description": "Object-oriented design patterns in real-world systems"},
        ],
        "internships": [
            {"role": "Software Engineering intern", "organization": "Series-B startup", "description": "Shipped a feature end-to-end including tests and CI"}
        ],
        "hackathons": [
            {"name": "National inter-college hackathon", "result": "Winner", "description": "Real-time collaborative document editor"}
        ],
        "certifications": [],
        "achievements": ["500+ problems solved across competitive programming platforms"],
        "preferred_roles": ["Software Engineer", "Data Scientist", "Backend Engineer"],
    },
]


def _find_in_local_fixtures(profile_id: str) -> Optional[Dict[str, Any]]:
    """Checks the local fixtures for a profile."""
    pid_clean = str(profile_id).strip().lower()
    for p in LOCAL_PROFILE_FIXTURES:
        if (
            p["profile_id"].lower() == pid_clean
            or p["key"].lower() == pid_clean
            or p["name"].lower() == pid_clean
            or pid_clean in p["name"].lower()
            or pid_clean in p["profile_id"].lower()
        ):
            return dict(p)
    return None


def _find_in_supabase(profile_id: str) -> Optional[Dict[str, Any]]:
    """Queries parsed_resumes and resume_skills from Supabase."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Try by resume_id (UUID) or candidate_name / source_file
        is_uuid = False
        try:
            uuid.UUID(profile_id)
            is_uuid = True
        except ValueError:
            is_uuid = False

        if is_uuid:
            cur.execute(
                """
                SELECT resume_id, source_file, candidate_name, email, headline,
                       education, projects, internships, hackathons, certifications,
                       achievements, preferred_roles
                FROM parsed_resumes
                WHERE resume_id = %s
                LIMIT 1;
                """,
                (profile_id,)
            )
        else:
            cur.execute(
                """
                SELECT resume_id, source_file, candidate_name, email, headline,
                       education, projects, internships, hackathons, certifications,
                       achievements, preferred_roles
                FROM parsed_resumes
                WHERE lower(candidate_name) = lower(%s)
                   OR lower(source_file) LIKE lower(%s)
                LIMIT 1;
                """,
                (profile_id, f"%{profile_id}%")
            )

        row = cur.fetchone()
        if not row:
            conn.close()
            return None

        (
            resume_id, source_file, candidate_name, email, headline,
            education, projects, internships, hackathons, certifications,
            achievements, preferred_roles
        ) = row

        # Fetch skills for this resume
        cur.execute(
            """
            SELECT skill_name, category_code, evidence, confidence
            FROM resume_skills
            WHERE resume_id = %s
            ORDER BY skill_name;
            """,
            (resume_id,)
        )
        skill_rows = cur.fetchall()
        conn.close()

        skills = [
            {
                "skill_name": s_name,
                "category_code": c_code,
                "evidence": ev or "",
                "confidence": conf or "medium",
            }
            for s_name, c_code, ev, conf in skill_rows
        ]

        return {
            "profile_id": str(resume_id),
            "name": candidate_name,
            "email": email,
            "headline": headline or "",
            "skills": skills,
            "education": education if isinstance(education, list) else [],
            "projects": projects if isinstance(projects, list) else [],
            "internships": internships if isinstance(internships, list) else [],
            "hackathons": hackathons if isinstance(hackathons, list) else [],
            "certifications": certifications if isinstance(certifications, list) else [],
            "achievements": achievements if isinstance(achievements, list) else [],
            "preferred_roles": preferred_roles if isinstance(preferred_roles, list) else [],
            "source": "supabase",
        }
    except Exception:
        # Supabase connection or table error; gracefully fall back to local fixtures
        return None


def get_candidate_profile(profile_id: str) -> Dict[str, Any]:
    """Retrieves candidate profile using the dual-source strategy (Supabase first, local fixtures fallback)."""
    if not profile_id or not str(profile_id).strip():
        raise ValueError("Profile ID must not be empty.")

    # 1. Supabase query
    db_profile = _find_in_supabase(profile_id)
    if db_profile:
        return db_profile

    # 2. Local fixtures fallback
    local_profile = _find_in_local_fixtures(profile_id)
    if local_profile:
        return local_profile

    raise ValueError(f"Candidate profile '{profile_id}' not found in database or local fixtures.")


def list_candidate_profiles() -> List[Dict[str, Any]]:
    """Returns list of all available candidate profiles across Supabase and fixtures."""
    profiles: List[Dict[str, Any]] = []
    seen_names = set()

    # 1. Supabase profiles
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT resume_id, candidate_name, headline FROM parsed_resumes ORDER BY created_at DESC;")
        for rid, name, headline in cur.fetchall():
            profiles.append({
                "profile_id": str(rid),
                "name": name,
                "headline": headline,
                "source": "supabase",
            })
            seen_names.add(name.lower())
        conn.close()
    except Exception:
        pass

    # 2. Add local fixtures if not in DB
    for p in LOCAL_PROFILE_FIXTURES:
        if p["name"].lower() not in seen_names:
            profiles.append({
                "profile_id": p["profile_id"],
                "name": p["name"],
                "headline": p.get("headline", ""),
                "source": "fixture",
            })
            seen_names.add(p["name"].lower())

    return profiles


def seed_sample_profiles_to_supabase() -> int:
    """Inserts sample candidate profiles and skills into Supabase if not already present."""
    inserted = 0
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        for p in LOCAL_PROFILE_FIXTURES:
            cur.execute("SELECT resume_id FROM parsed_resumes WHERE lower(candidate_name) = lower(%s);", (p["name"],))
            existing = cur.fetchone()
            if existing:
                continue

            file_sha = hashlib.sha256(p["name"].encode("utf-8")).hexdigest()
            cur.execute(
                """
                INSERT INTO parsed_resumes (
                    source_file, file_sha256, candidate_name, email, headline,
                    education, projects, internships, hackathons, certifications,
                    achievements, preferred_roles, parsed_json, parser_mode, source_tag
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                ) RETURNING resume_id;
                """,
                (
                    f"{p['name']}.pdf",
                    file_sha,
                    p["name"],
                    p.get("email"),
                    p.get("headline", ""),
                    json.dumps(p.get("education", [])),
                    json.dumps(p.get("projects", [])),
                    json.dumps(p.get("internships", [])),
                    json.dumps(p.get("hackathons", [])),
                    json.dumps(p.get("certifications", [])),
                    json.dumps(p.get("achievements", [])),
                    json.dumps(p.get("preferred_roles", [])),
                    json.dumps(p),
                    "rules",
                    "sample-pack",
                )
            )
            resume_id = cur.fetchone()[0]

            for s in p.get("skills", []):
                cur.execute(
                    """
                    INSERT INTO resume_skills (
                        resume_id, skill_name, category_code, evidence, confidence
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (resume_id, lower(skill_name)) DO NOTHING;
                    """,
                    (
                        resume_id,
                        s["skill_name"],
                        s["category_code"],
                        s.get("evidence", ""),
                        s.get("confidence", "medium"),
                    )
                )
            inserted += 1

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error seeding Supabase: {e}")

    return inserted
