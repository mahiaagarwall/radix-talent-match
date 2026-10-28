# RADIX Talent Match — Unified API & Data Contract

Status: **LOCKED & FULLY INTEGRATED across all 5 modules.**  
Contract Owner & Lead Architect: **Akshat Mehra** (Scrum Master & Skill Matching Lead)  
Last Updated: 27 October 2026

---

## 1. Skill Object (Canonical Shared Contract)

Every module uses this uniform schema for representing skills:

```json
{
  "skill_name": "Python",
  "category_code": "COD",
  "evidence": "Built full-stack applications using Python and FastAPI",
  "confidence": "high",
  "requirement": "required"
}
```

- `skill_name`: Canonical or normalized skill name (string).
- `category_code`: Exactly one of the 13 approved RADIX categories:
  `COD`, `DSA`, `OOD`, `APTI`, `COMM`, `AI`, `CLOUD`, `SQL`, `SWE`, `SYSD`, `NETW`, `OS`, `OTHER`.
- `confidence`: Extraction certainty (`high` | `medium` | `low`).
  - `high`: Directly listed with corroborating project/experience evidence.
  - `medium`: Explicitly listed in a skills section.
  - `low`: Inferred from context or weak mention.
  - *Note: `confidence` reflects extraction certainty, never candidate proficiency level.*
- `requirement`: `required` (default, weight 1.0) or `preferred` (weight 0.5 for nice-to-have skills).
- `origin`: Frontend-only flag (`extracted` | `edited` | `manual`) stripped before API transmission.

---

## 2. API Endpoints Overview

| Module | Method & Route | Request Format | Response Format |
|---|---|---|---|
| **System** | `GET /api/health` | — | `{"status": "ok", "service": "radix-talent-match", "modules": {...}}` |
| **System** | `GET /health` | — | `{"status": "healthy", "service": "jd-analyzer"}` |
| **Resume Parsing** | `POST /api/resumes/parse` | `multipart/form-data` (`file`) or `JSON` | Parsed Resume Object (§3) |
| **Profile Builder** | `POST /api/profiles` | JSON Candidate Profile | Persisted Profile Object with `profile_id` (`prf_*`) |
| **Profile Builder** | `GET /api/profiles` | — | `CandidateProfile[]` |
| **Profile Builder** | `GET /api/profiles/{id}` | — | Candidate Profile Object (§4) |
| **Profile Builder** | `PATCH /api/profiles/{id}`| JSON partial/full Profile | Updated Profile Object |
| **Profile Builder** | `DELETE /api/profiles/{id}`| — | `{"status": "deleted", "profile_id": "..."}` |
| **JD Analytics** | `POST /api/jd/analyze` | `multipart/form-data` (`file`) or `{text, company, role}` | Analyzed JD Object (§5) |
| **JD Analytics** | `POST /api/jd` | JSON JD record | Persisted JD Record (`jd_*`) |
| **JD Analytics** | `GET /api/jd` | — | `JobDescription[]` |
| **JD Analytics** | `GET /api/jd/{id}` | — | Job Description Object |
| **JD Analytics** | `PATCH /api/jd/{id}` | JSON partial/full JD | Updated Job Description Object |
| **Talent Check** | `POST /api/talent-check` | `{"profile_id": "...", "company_id": "..."}` | Talent Check Result (§6) |
| **Talent Check** | `POST /api/talent-check/compare` | `{"candidate_a_id": "...", "candidate_b_id": "...", "company_id": "..."}` | Candidate Comparison Result (§7) |
| **Talent Check** | `GET /api/talent-check/companies` | — | Company requirement summaries |
| **Talent Check** | `GET /api/talent-check/candidates` | — | Available candidate summaries |
| **Talent Check** | `GET /api/companies` | — | Company requirement profiles dictionary |
| **Skill Matching** | `POST /api/skill-match` | `{"profile_id": "...", "jd_id": "..."}` | Skill Match Result (§8) |
| **Skill Matching** | `GET /api/skill-match/{id}` | — | Persisted Skill Match Result |
| **Results** | `GET /api/results` | — | List of recent evaluation results |

---

## 3. Parsed Resume Schema (`POST /api/resumes/parse`)

```json
{
  "source_type": "resume",
  "source_file": "Ananya Rao.pdf",
  "name": "Ananya Rao",
  "email": "ananya.rao@example.com",
  "phone": "+91-9876543210",
  "education": [
    {
      "degree": "B.Tech in Computer Science",
      "institution": "National Institute of Technology",
      "graduation_year": "2026",
      "grade": "CGPA 8.6 / 10"
    }
  ],
  "skills": [
    {
      "skill_name": "Python",
      "category_code": "COD",
      "evidence": "Engineered distributed systems in Python",
      "confidence": "high"
    }
  ],
  "projects": [
    {
      "title": "Cloud-Native Microservices",
      "description": "Architected event-driven microservices with Docker and Redis"
    }
  ],
  "internships": [
    {
      "role": "Software Engineering Intern",
      "organization": "Tech Innovations Ltd",
      "description": "Developed REST APIs and optimized database queries"
    }
  ],
  "hackathons": [
    {
      "name": "Smart India Hackathon",
      "result": "Finalist",
      "description": "Built real-time analytics dashboard"
    }
  ],
  "certifications": [
    {
      "name": "AWS Certified Cloud Practitioner",
      "issuer": "Amazon Web Services"
    }
  ],
  "preferred_roles": ["Backend Developer", "Software Engineer"],
  "resume_reference": {
    "file_name": "Ananya Rao.pdf",
    "file_type": "pdf",
    "file_size": 113995,
    "storage_path": null
  }
}
```

---

## 4. Candidate Profile Schema (`/api/profiles`)

Candidate Profile IDs use stable string identifiers prefixed with `prf_` (e.g. `prf_sample_ananya` or `prf_480026a760c4`).

```json
{
  "profile_id": "prf_480026a760c4",
  "name": "Ananya Rao",
  "email": "ananya.rao@example.com",
  "education": [ ... ],
  "skills": [ ... ],
  "projects": [ ... ],
  "internships": [ ... ],
  "hackathons": [ ... ],
  "certifications": [ ... ],
  "preferred_roles": ["Software Engineer"],
  "resume_reference": { ... },
  "created_at": "2026-10-27T12:00:00Z",
  "updated_at": "2026-10-27T12:00:00Z"
}
```

---

## 5. Job Description Schema (`/api/jd`)

Job Description IDs use stable string identifiers prefixed with `jd_` or semantic slugs (e.g. `jd_sample_google_swe` or `google-swe`).

```json
{
  "jd_id": "jd_sample_google_swe",
  "company": "Google LLC",
  "role": "Software Engineer (SWE)",
  "role_category": "SDE · Product Engineering",
  "location": "Bengaluru, India (Hybrid)",
  "employment_type": "Full-time",
  "source_type": "jd",
  "source_file": "Google LLC - Software Engineer.pdf",
  "source_kind": "upload",
  "experience_requirements": "0-2 years of relevant software engineering experience",
  "education_requirements": "Bachelor's degree in Computer Science or related technical field",
  "raw_text": "...",
  "skills": [
    {
      "skill_name": "Data Structures & Algorithms",
      "category_code": "DSA",
      "evidence": "Proficiency in data structures and algorithmic complexity",
      "confidence": "high",
      "requirement": "required"
    }
  ],
  "created_at": "2026-10-27T12:00:00Z",
  "updated_at": "2026-10-27T12:00:00Z"
}
```

---

## 6. Talent Check Result Schema (`POST /api/talent-check`)

Evaluates broad company readiness across all 12 RADIX skillsets against `talent_check_company_skillsets.json`.

```json
{
  "result_id": "tc_res_8df7a9b1",
  "type": "talent_check",
  "profile_id": "prf_sample_ananya",
  "candidate_name": "Ananya Rao",
  "company_id": "google",
  "company": "Google LLC (Subsidiary of Alphabet Inc.)",
  "readiness_score": 47,
  "skillset_gap": [
    {
      "category_code": "COD",
      "category_name": "Coding",
      "required_level": 8,
      "candidate_level": 8,
      "candidate_level_is_estimate": true,
      "gap": false,
      "gap_size": 0,
      "status": "meets",
      "uncertainty": "low",
      "evidence": [ ... ]
    }
  ],
  "strongest": ["System Design", "Coding", "Operating Systems"],
  "priority_gaps": ["Aptitude", "Cloud", "SQL", "Artificial Intelligence"],
  "recommendations": [
    {
      "category_code": "APTI",
      "text": "Address priority gap in Aptitude: Google LLC requires level 8, candidate currently estimated at level 0."
    }
  ],
  "summary": "Ananya Rao achieves a readiness score of 47/100 against Google LLC.",
  "requirements_source": {
    "file": "talent_check_company_skillsets.json",
    "synthetic": false
  },
  "created_at": "2026-10-27T12:00:00Z"
}
```

---

## 7. Talent Check Comparison Schema (`POST /api/talent-check/compare`)

Side-by-side comparison of two candidates against the same company requirements:

```json
{
  "company_name": "Google LLC (Subsidiary of Alphabet Inc.)",
  "candidate_a": {
    "candidate_name": "Ananya Rao",
    "readiness_score": 47,
    "strongest": ["System Design", "Coding", "Operating Systems"],
    "priority_gaps": ["Aptitude", "Cloud", "SQL", "Artificial Intelligence"]
  },
  "candidate_b": {
    "candidate_name": "Karthik Subramaniam",
    "readiness_score": 30,
    "strongest": ["SQL", "Artificial Intelligence", "Coding"],
    "priority_gaps": ["Data Structures & Algorithms", "Cloud", "Software Engineering", "Networking"]
  },
  "score_difference": 17,
  "leader": "candidate_a",
  "overall_explanation": "Ananya Rao leads with 47/100 readiness vs Karthik Subramaniam's 30/100 (+17 pts higher)...",
  "category_comparisons": [
    {
      "category_code": "COD",
      "category_name": "Coding",
      "required_level": 8,
      "candidate_a_level": 8,
      "candidate_b_level": 6,
      "difference": 2,
      "leader": "candidate_a",
      "explanation": "Ananya Rao leads in Coding (level 8/10 vs Karthik Subramaniam's 6/10; required: 8/10)..."
    }
  ]
}
```

---

## 8. Skill Match Result Schema (`POST /api/skill-match`)

Deterministic job-specific skill matching evaluating candidate skills against specific JD requirements:

```json
{
  "match_id": "7f847ac8-3b1f-4d92-91d1-6d7c8192a543",
  "result_id": "7f847ac8-3b1f-4d92-91d1-6d7c8192a543",
  "type": "skill_match",
  "profile_id": "prf_sample_ananya",
  "candidate_name": "Ananya Rao",
  "jd_id": "jd_sample_google_swe",
  "jd_source_file": "Google LLC - Software Engineer.pdf",
  "company": "Google LLC",
  "role": "Software Engineer (SWE)",
  "match_score": 96.15,
  "scoring_version": "v1",
  "scoring_status": "completed",
  "matched_skills": [
    "Data Structures & Algorithms",
    "Object-Oriented Design",
    "Operating Systems",
    "System Design",
    "Software Engineering Practices",
    "Programming"
  ],
  "partial_skills": ["Communication"],
  "missing_skills": [],
  "skill_results": [
    {
      "skill_name": "Data Structures & Algorithms",
      "category_code": "DSA",
      "requirement": "required",
      "weight": 1.0,
      "status": "matched",
      "match_value": 1.0,
      "jd_evidence": "Proficiency in data structures and algorithmic complexity",
      "candidate_evidence": [
        {
          "skill_name": "Data Structures & Algorithms",
          "category_code": "DSA",
          "evidence": "Solved 450+ LeetCode problems across graphs and DP",
          "confidence": "high"
        }
      ],
      "reason": "Direct canonical match with high-confidence evidence."
    }
  ],
  "counts": {
    "matched": 6,
    "partial": 1,
    "missing": 0
  },
  "summary": "Candidate matches 6 out of 7 required and preferred skills with a score of 96.15%.",
  "recommendations": [
    {
      "skill_name": "Communication",
      "priority": "medium",
      "text": "Strengthen documented evidence for Communication to transition from partial to full match."
    }
  ],
  "scoring": {
    "method": "weighted_evidence_aware",
    "formula": "round(100 * sum(w_i * m_i) / sum(w_i), 2)",
    "partial_value": 0.5,
    "weights": {
      "required": 1.0,
      "preferred": 0.5
    }
  },
  "created_at": "2026-10-27T12:00:00Z"
}
```
