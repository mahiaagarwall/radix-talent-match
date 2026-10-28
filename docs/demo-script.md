# RADIX Talent Match — Presentation & Demo Script

Lead Presenter: **Akshat Mehra** (Scrum Master & Skill Matching Lead)  
Target Duration: 6–8 Minutes  
Target Audience: Hackathon Judges & Technical Reviewers  
Last Updated: 27 October 2026  
Status: **Integrated Application Ready**

---

## 1. Demo Setup & Prerequisites

1. Ensure the unified FastAPI backend is running:
   ```bash
   cd backend
   .\.venv\Scripts\activate
   uvicorn app.main:app --port 8000
   ```
2. Ensure the React + Vite frontend is running:
   ```bash
   cd frontend
   npm run dev
   ```
3. Open `http://localhost:5173` in Chrome or Edge.

---

## 2. Step-by-Step Presentation Script

### Act 1: Introduction & Two Distinct Dimensions (45 Seconds)
- **Speaker (Akshat):**
  > "Good morning judges! We are proud to present **RADIX Talent Match** — an integrated full-stack talent assessment platform built by our 5-person team.
  > In enterprise hiring, there are two distinct questions that must never be conflated:
  > 1. **Talent Check:** 'How ready is this candidate for this *company* across baseline engineering competencies?'
  > 2. **Skill Matching:** 'How well does this candidate fit this *specific job opening*?'
  > Today, we will walk you through our end-to-end pipeline: from raw resume and JD ingestion to candidate profile management, company readiness comparison, and deterministic job matching."

---

### Act 2: Resume Ingestion & Profile Builder (90 Seconds)
- **Speaker:**
  > "Let's begin with candidate onboarding. Mahi Aggarwal built our Resume Parsing engine, and Aashish Kumar built our Profile Builder."
- **Action:**
  1. Navigate to `/resume-parsing`.
  2. Upload a candidate resume (e.g., `Ananya Rao.pdf`) or select a pre-loaded sample.
  3. Click **"Parse Resume"**.
- **Speaker:**
  > "Our pure-Python extractor processes the document, extracting personal details, education, work experience, projects, and skills. Crucially, each skill is paired with concrete textual evidence and an extraction confidence rating (`high`, `medium`, `low`).
  > Notice the action button: **'Transfer to Profile Builder'**."
- **Action:**
  1. Click **"Transfer to Profile Builder"** to open `/profile-builder`.
  2. Observe the form pre-filled with Ananya's extracted data across all 9 sections.
  3. Demonstrate editing or adding a skill.
  4. Click **"Save Profile"**.
- **Speaker:**
  > "Aashish's Profile Builder allows the candidate to review and refine their profile. When saved, it persists to Supabase `candidate_profiles` with a stable `prf_*` ID, while relational skills are indexed in `profile_skills`."

---

### Act 3: Job Description Analytics (60 Seconds)
- **Speaker:**
  > "Next, Krishna Pandey's JD Analytics module ingests employer requirements."
- **Action:**
  1. Navigate to `/jd-analytics`.
  2. Upload `Google LLC - Software Engineer.pdf` or paste job text into the text area.
  3. Click **"Analyze Job Description"**.
- **Speaker:**
  > "The analyzer extracts required skills, maps them to canonical RADIX categories, and distinguishes between core requirements (weight 1.0) and nice-to-have preferences (weight 0.5).
  > Saving persists the job description to `job_descriptions` with a stable `jd_*` identifier."

---

### Act 4: Talent Check & Candidate Comparison (90 Seconds)
- **Speaker:**
  > "Now we arrive at Krishna Khanna's Talent Check module, which evaluates candidates against baseline company expectations across 12 RADIX categories."
- **Action:**
  1. Navigate to `/talent-check`.
  2. Select **Google LLC**.
  3. Switch to the **"Candidate Comparison"** tab.
  4. Select **Candidate A:** Ananya Rao, and **Candidate B:** Karthik Subramaniam.
  5. Click **"Compare Candidates"**.
- **Speaker:**
  > "Notice the side-by-side radar chart, summary delta, and granular 12-category breakdown.
  > Ananya scores 47/100 readiness, leading Karthik's 30/100 by +17 points.
  > The breakdown shows exactly where they differ: Ananya leads in Data Structures (+6) and Object-Oriented Design (+6), whereas Karthik leads in SQL (+7) and AI (+6).
  > No synthetic scores are invented — every number is derived directly from the official company skillset requirements and verified candidate evidence."

---

### Act 5: Deterministic Skill Matching (90 Seconds)
- **Speaker:**
  > "Finally, we evaluate specific job fit with the Skill Matching module."
- **Action:**
  1. Navigate to `/skill-matching`.
  2. Select Candidate: **Ananya Rao**.
  3. Select Job Description: **Google LLC — Software Engineer (SWE)**.
  4. Click **"Run match"**.
- **Speaker:**
  > "Our 4-tier deterministic matching engine runs:
  > - **Rule 1 (Direct Match):** 5 skills directly matched with high-confidence evidence.
  > - **Rule 2 (Broad Competency):** The JD requires 'Programming'; Ananya has high-confidence C++ and Java, so full credit is awarded.
  > - **Rule 3 & 4 (Partial & Missing):** Communication is classified as partial because candidate evidence was flagged as low certainty.
  > Ananya achieves **96.15 / 100**."
- **Action:** Show the transparent mathematical formula card:
  $$\text{Match Score} = 100 \times \frac{\sum w_i m_i}{\sum w_i} = 100 \times \frac{6.25}{6.5} = 96.15\%$$
- **Action:** Switch candidate to **Rohan Verma** against the same JD.
- **Speaker:**
  > "Against the exact same Google role, Rohan scores only **15.38 / 100**. He lacks DSA, OOD, OS, and System Design. The system generates prioritized, actionable recommendations citing the exact missing requirements."

---

### Act 6: Architecture & Wrap-Up (45 Seconds)
- **Speaker:**
  > "Under the hood:
  > - Single unified FastAPI backend with zero HTTP 501 stubs.
  > - Automated backend (pytest) and frontend (Vitest) suites, plus lint and a type-checked production build.
  > - Clean production build and zero ESLint warnings.
  > - Supabase PostgreSQL database with unified migrations and safe offline fallback.
  > Thank you, and we welcome your questions!"
