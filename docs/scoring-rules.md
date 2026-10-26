# Scoring rules (demo implementation — pending team agreement)

The team guide requires Talent Check and Skill Matching to use a **documented** formula agreed by the
team before implementation. These are the deterministic rules the frontend's demo mode implements so
the UI can be built and tested. They are labelled "Illustrative demo scoring" everywhere they appear.
When the FastAPI backend owns scoring (API mode), the backend's rules apply and this file should be
updated to match.

## Skill Matching — `demo-weighted-v1` (`frontend/src/utils/skillMatcher.js`)

Formula proposed in the team guide:

    Match Score = round( 100 × Σ(weight × match_value) / Σ(weight) )

| Parameter | Demo default | Where to change |
|---|---|---|
| match value — matched | 1 | fixed |
| match value — partial | 0.5 | Settings page |
| match value — missing | 0 | fixed |
| weight — required skill | 1 | Settings page |
| weight — preferred ("Nice to Have") | 0.5 | Settings page |

Every result stores the parameters it was computed with.

### Classification of each JD skill (first rule that applies)

1. **Named match.** Candidate has a skill with the same normalized name (lower-case, parentheticals and
   depth words removed, aliases mapped — e.g. "Computer Networks" → networking, "Power BI" → data
   visualization).
   - with `high`/`medium` confidence → **matched**,
   - unless the candidate's skill is depth-qualified ("basic", "fundamentals", "exposure") and the JD
     skill is not → **partial**,
   - only `low` confidence → **partial** (uncertain evidence).
2. **Broad competency.** JD skills "Programming", "Communication" and "Quantitative Aptitude" describe a
   category rather than a technology; any `high`/`medium` candidate skill in COD / COMM / APTI
   respectively → **matched**; only low-confidence ones → **partial**.
3. **Related evidence.** Any candidate skill in the same RADIX category (not OTHER) → **partial**.
4. Otherwise → **missing**.

Extraction confidence is used only as *evidence certainty*; it is never shown as proficiency.

Recommendations list the highest-weight missing skills (quoting the JD's own evidence) and the
partial skills with the reason they were partial.

## Talent Check — `demo-readiness-v1` (`frontend/src/utils/readinessScorer.js`)

Company **required levels** come only from `talent_check_company_skillsets.json`. Nothing is inferred.

Candidate **estimated level** per category (0–10 scale, from profile evidence only):

- no skills in the category → 0 ("No evidence")
- item points: high 6, medium 5, low 3; a depth-qualified skill is capped at 4
- level = best item + min(3, number of other items scoring ≥ 5), capped at **9** — a resume alone never
  yields the top of the scale

Status: `meets` (est ≥ req) · `close` (gap 1–2) · `gap` (gap ≥ 3) · `no-evidence` (est 0) ·
`not-assessed` (category absent from the file).
Uncertainty: low (≥2 items incl. a high-confidence one) · medium · high (none / only low).

    Readiness = round( 100 × Σ min(estimated, required) / Σ required )   over categories with required > 0

Strongest areas = top 3 by (estimated − required). Priority gaps = top 4 by gap size, then required
level. Each priority gap gets a category-specific recommendation.

## Demo fixtures

`frontend/src/data/fixtures/` holds hand annotations of the four supplied resumes and six supplied JDs
(evidence quoted from the documents). Confidence rule for resumes: high = listed under Technical Skills
**and** corroborated by a project/internship/achievement; medium = listed only, or shown in a project
without being listed; low = indirect signal. They are not parser output and are labelled as such.
