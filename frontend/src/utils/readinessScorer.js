// Demo Talent Check engine ("demo-readiness-v1").
//
// Company required levels come ONLY from the official requirements file.
// Candidate levels are ESTIMATES inferred from resume/profile evidence using the
// rubric in docs/scoring-rules.md. Extraction confidence feeds the estimate's
// uncertainty; it is never reported as proficiency.

import { RADIX_CATEGORIES, categoryName } from '../data/categories';
import { hasDepthQualifier } from './skillNormalizer';

export const READINESS_METHOD = 'demo-readiness-v1';

const ITEM_POINTS = { high: 6, medium: 5, low: 3 };
const BASIC_CAP = 4;
const MAX_ESTIMATE = 9; // a resume alone never yields the top of the scale

export function estimateCategoryLevel(skills) {
  if (!skills.length) return { level: 0, uncertainty: 'high' };
  const points = skills
    .map((s) => {
      const p = ITEM_POINTS[s.confidence] ?? ITEM_POINTS.low;
      return hasDepthQualifier(s.skill_name) ? Math.min(p, BASIC_CAP) : p;
    })
    .sort((a, b) => b - a);
  const corroborating = points.slice(1).filter((p) => p >= 5).length;
  const level = Math.min(MAX_ESTIMATE, points[0] + Math.min(3, corroborating));
  const best = skills.map((s) => s.confidence);
  let uncertainty = 'high';
  if (best.includes('high') && skills.length >= 2) uncertainty = 'low';
  else if (best.includes('high') || best.includes('medium')) uncertainty = 'medium';
  return { level, uncertainty };
}

function statusFor(required, estimated) {
  if (required === null || required === undefined) return 'not-assessed';
  if (required === 0) return 'not-required';
  if (estimated === 0) return 'no-evidence';
  const gap = required - estimated;
  if (gap <= 0) return 'meets';
  if (gap <= 2) return 'close';
  return 'gap';
}

const RECOMMENDATION_HINTS = {
  COD: 'ship a small, well-tested project in your strongest language and link the repository',
  DSA: 'build a visible problem-solving record (e.g. a competitive programming profile) and note complexity analysis in projects',
  OOD: 'design and document a project around clear classes, interfaces and design patterns',
  APTI: 'practise timed quantitative and logical-reasoning sets; resumes rarely evidence this, so assessment scores help',
  COMM: 'add evidence such as presentations, technical writing, mentoring or client-facing work',
  AI: 'complete an applied ML project with a stated evaluation metric (precision/recall, RMSE)',
  CLOUD: 'deploy a project to a cloud provider and describe the services used',
  SQL: 'add a project with non-trivial SQL: joins, aggregation, indexing or schema design',
  SWE: 'show engineering practice: tests, code review, CI pipelines, version control on team projects',
  SYSD: 'write up the architecture of a scalable service you built, including trade-offs',
  NETW: 'add coursework or a project touching TCP/IP, HTTP or client-server design',
  OS: 'build or document work involving processes, threads, scheduling or memory management',
};

export function runTalentCheck(profile, company, { requirementsSource = null, synthetic = false } = {}) {
  if (!profile) throw new Error('Select a candidate profile.');
  if (!company) throw new Error('Select a company from the requirements file.');
  const skills = profile.skills || [];

  const skillset_gap = RADIX_CATEGORIES.map(({ code }) => {
    const inCategory = skills.filter((s) => s.category_code === code);
    const { level, uncertainty } = estimateCategoryLevel(inCategory);
    const required = company.requirements[code] ?? null;
    const status = statusFor(required, level);
    const gapSize = required === null ? null : Math.max(0, required - level);
    return {
      category_code: code,
      required_level: required,
      candidate_level: level,
      candidate_level_is_estimate: true,
      gap: required !== null && required > 0 && level < required,
      gap_size: gapSize,
      status,
      uncertainty,
      evidence: inCategory.map((s) => ({
        skill_name: s.skill_name,
        evidence: s.evidence || '',
        confidence: s.confidence,
      })),
    };
  });

  const assessed = skillset_gap.filter((r) => r.required_level !== null && r.required_level > 0);
  const requiredTotal = assessed.reduce((sum, r) => sum + r.required_level, 0);
  const covered = assessed.reduce((sum, r) => sum + Math.min(r.candidate_level, r.required_level), 0);
  const readiness_score = requiredTotal ? Math.round((100 * covered) / requiredTotal) : 0;

  const strongest = [...assessed]
    .filter((r) => r.candidate_level > 0)
    .sort((a, b) => b.candidate_level - b.required_level - (a.candidate_level - a.required_level) || b.candidate_level - a.candidate_level)
    .slice(0, 3)
    .map((r) => r.category_code);

  const priority_gaps = [...assessed]
    .filter((r) => r.gap)
    .sort((a, b) => b.gap_size - a.gap_size || b.required_level - a.required_level)
    .slice(0, 4)
    .map((r) => r.category_code);

  const recommendations = priority_gaps.map((code) => {
    const row = skillset_gap.find((r) => r.category_code === code);
    return {
      category_code: code,
      text: `${categoryName(code)} — estimated ${row.candidate_level}/10 vs. required ${row.required_level}/10: ${RECOMMENDATION_HINTS[code]}.`,
    };
  });

  const meets = assessed.filter((r) => r.status === 'meets').length;
  const summary = `Estimated readiness ${readiness_score}/100 for ${company.company_name}. The candidate meets or exceeds ${meets} of ${assessed.length} assessed skillsets${
    priority_gaps.length ? `; the largest gaps are ${priority_gaps.map(categoryName).join(', ')}` : ''
  }. Levels are inferred from resume evidence and should be confirmed by assessment.`;

  return {
    type: 'talent_check',
    profile_id: profile.profile_id,
    candidate_name: profile.name,
    company_id: company.company_id,
    company: company.company_name,
    readiness_score,
    skillset_gap,
    strongest,
    priority_gaps,
    recommendations,
    summary,
    requirements_source: { file: requirementsSource, synthetic },
    scoring: {
      method: READINESS_METHOD,
      formula: '100 × Σ min(estimated, required) / Σ required',
      status: 'demo — pending team agreement',
    },
  };
}
