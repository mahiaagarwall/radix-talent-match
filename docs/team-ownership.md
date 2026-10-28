# RADIX Talent Match — Team Role Ownership & Module Integration

Lead Architect & Scrum Master: **Akshat Mehra**  
Last Updated: 27 October 2026  
Status: **Integrated Application Complete & Demo Ready**

---

## 1. Official Team Assignments & Contributions

| Role / Identifier | Module Owner | Primary Module | Integrated Components & Responsibilities |
|---|---|---|---|
| **P1** | **Aashish Kumar** | **Profile Builder** | • React candidate profile form with 9 structured sections<br>• Backend profile router (`/api/profiles`, CRUD operations, DELETE support)<br>• `ProfileRepository` with live Supabase synchronization and local memory store<br>• Database migration `001_create_profiles.sql` (`candidate_profiles`, `profile_skills`, view `profiles`) |
| **P2** | **Krishna Pandey** | **JD Analytics** | • PDF and DOCX document extraction (`pypdf`, `python-docx`)<br>• Rule-based and optional LLM skill extraction with evidence and confidence<br>• Proficiency and category mapping across canonical catalog<br>• Backend endpoints (`POST /api/jd/analyze`, `POST /api/jd`, `GET /api/jd`, `GET /api/jd/{id}`)<br>• Database migration `003_add_canonical_skills.sql` |
| **P3** | **Mahi Aggarwal** | **Resume Parsing** | • Pure-Python resume text extraction (PDF / DOCX)<br>• Contact information parsing (name, email, phone)<br>• Skill taxonomy matching with evidence sentences and confidence ratings<br>• Resume storage service and prefill payload generation<br>• Backend endpoint (`POST /api/resumes/parse`) |
| **P4** | **Krishna Khanna** | **Talent Check** | • 12 RADIX skillset category definitions and rubric scoring (0–10 level scale)<br>• Company requirements loader (`talent_check_company_skillsets.json`)<br>• Dual-source candidate profile loader (resolves live profiles and sample candidates)<br>• Candidate comparison engine (`POST /api/talent-check/compare`) and view<br>• Acceptance test script (`run_acceptance_test.py`) |
| **P5** | **Akshat Mehra** | **Skill Matching & Scrum Master** | • Lead Architect and Scrum Master coordinating whole-application integration<br>• Deterministic 4-tier skill matching engine (`skill_matcher.py`, `skill_normalizer.py`)<br>• Transparent weighted scoring formula ($100 \times \frac{\sum w_i m_i}{\sum w_i}$)<br>• Supabase schema reconciliation (TEXT IDs for profile/JD linkages in `002_reconcile_id_types_and_jds.sql`)<br>• Unified FastAPI router (`main.py`, `backend/app/api/__init__.py`) eliminating all 501 stubs<br>• Test orchestration: 163 backend tests, 49 frontend tests, 100% pass rate |

---

## 2. Integrated Data Flow Across Modules

```
[Resume PDF/DOCX] ──(Mahi: Resume Parsing)──► Parsed Resume Payload
                                                     │
                                                     ▼
                                          (Aashish: Profile Builder) ──► candidate_profiles (prf_*)
                                                     │
        ┌────────────────────────────────────────────┴───────────────────────────────────────┐
        ▼                                                                                    ▼
(Krishna Khanna: Talent Check)                                                      (Akshat: Skill Matching)
        ▲                                                                                    ▲
        │                                                                                    │
talent_check_company_skillsets.json                                              (Krishna Pandey: JD Analytics)
                                                                                             ▲
                                                                                             │
                                                                                    [JD PDF/DOCX or Text]
```

1. **Candidate Onboarding:** Mahi's parser extracts text and structured fields from resumes. Aashish's Profile Builder prefills these fields, allowing candidate edits, and persists the verified profile with a stable `prf_*` ID into Supabase `candidate_profiles` and `profile_skills`.
2. **Job Description Processing:** Krishna Pandey's JD Analytics extracts required and preferred skills from job descriptions, mapping each to a canonical category and saving them with a stable `jd_*` ID into `job_descriptions`.
3. **Company Readiness (Talent Check):** Krishna Khanna's Talent Check evaluates candidates against company-wide baseline requirements across the 12 RADIX categories, providing single-candidate readiness scores and side-by-side candidate comparison with actionable gap explanations.
4. **Job Fit (Skill Matching):** Akshat's Skill Matching evaluates the candidate's verified skills against the specific JD's requirements using the deterministic 4-tier engine, computing a weighted match score and persisting the result into `skill_match_results`.
