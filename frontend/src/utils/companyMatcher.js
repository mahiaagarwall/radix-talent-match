// Job Finder company ranking ("company-fit-v1").
//
// Every Company Directory company is compared with the candidate using that
// company's own Skill Intelligence rows (company_skill_levels). The score is the
// existing Talent Check readiness formula, so Job Finder and Talent Check agree:
//   100 × Σ min(estimated level, required level) / Σ required level
// Candidate levels are estimates from profile evidence (see readinessScorer.js).
// Companies without enough usable requirements are excluded, never guessed.

import { SCORED_CATEGORY_CODES, categoryName } from '../data/categories';
import { runTalentCheck } from './readinessScorer';
import { runSkillMatch } from './skillMatcher';

export const COMPANY_FIT_METHOD = 'company-fit-v1';
export const COMPANY_FIT_FORMULA = '100 × Σ min(estimated, required) / Σ required';
export const DEFAULT_TOP_N = 5;
// A score over fewer skillsets than this would say little about the company.
export const MIN_ASSESSED_SKILLSETS = 3;

// Resumes rarely evidence these; no evidence means "not verifiable", not "absent".
const RESUME_UNVERIFIABLE = new Set(['APTI', 'COMM']);

// Same thresholds as the Company Directory's Skill Intelligence page (scoreToCriticality).
export function criticalityFor(level) {
  if (level >= 7) return 'Critical';
  if (level >= 5) return 'Important';
  return 'Baseline';
}

const CORPORATE_SUFFIX = /\b(incorporated|inc|llc|ltd|limited|plc|corp|corporation|co|company|pvt|private|gmbh|ag|sa)\b/g;

export function normalizeCompanyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(CORPORATE_SUFFIX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const splitList = (text) =>
  String(text || '')
    .split(/[;,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Builds { CODE: level } from one company's rows. Rows whose skill set is not a RADIX
 * category are skipped; repeated rows for one category keep the highest level, once.
 */
export function buildRequirements(rows) {
  const requirements = {};
  const notes = [];
  const unmapped = [];
  let duplicates = 0;
  for (const row of rows || []) {
    const code = String(row.shortName || '').trim().toUpperCase();
    const level = Number(row.requiredLevel);
    if (!SCORED_CATEGORY_CODES.includes(code)) {
      unmapped.push(row.name || row.shortName || `skill set ${row.skillSetId}`);
      continue;
    }
    if (!Number.isFinite(level) || level <= 0) continue;
    if (requirements[code] !== undefined) {
      duplicates += 1;
      requirements[code] = Math.max(requirements[code], level);
    } else {
      requirements[code] = level;
    }
  }
  if (unmapped.length) notes.push(`Skipped skill sets that are not RADIX categories: ${unmapped.join(', ')}.`);
  if (duplicates) notes.push(`${duplicates} repeated Skill Intelligence row(s) were counted once (highest level kept).`);
  return { requirements, notes };
}

function classify(row) {
  if (row.status === 'meets') return 'matched';
  if (row.candidate_level > 0) return 'partial';
  return RESUME_UNVERIFIABLE.has(row.category_code) ? 'unverified' : 'missing';
}

// Best analyzed JD for this company, scored with the existing Skill Matching engine.
function bestRole(profile, company, jds) {
  const names = new Set([normalizeCompanyName(company.name), normalizeCompanyName(company.shortName)].filter(Boolean));
  const candidates = (jds || []).filter((jd) => names.has(normalizeCompanyName(jd.company)) && (jd.skills || []).length > 0);
  let best = null;
  for (const jd of candidates) {
    const match = runSkillMatch(profile, jd);
    if (!best || match.match_score > best.match_score) {
      best = { jd_id: jd.jd_id, role: jd.role, match_score: match.match_score, matched_skills: match.matched_skills, missing_skills: match.missing_skills };
    }
  }
  return best;
}

// Exact names only: alias groups would merge distinct tools (AWS vs. Azure).
const techKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();

function techStackOverlap(profile, techStack) {
  if (!techStack) return [];
  const stack = new Map(splitList(techStack).map((t) => [techKey(t), t]));
  const seen = new Set();
  const hits = [];
  for (const s of profile.skills || []) {
    const key = techKey(s.skill_name);
    if (stack.has(key) && !seen.has(key)) {
      seen.add(key);
      hits.push(stack.get(key));
    }
  }
  return hits;
}

/** Assesses one company, or returns { excluded: reason } when its data cannot support a score. */
export function assessCompany(profile, record, jds = []) {
  const { summary } = record;
  const { requirements, notes } = buildRequirements(record.requirements);
  const assessedCount = Object.keys(requirements).length;
  if (assessedCount < MIN_ASSESSED_SKILLSETS) {
    return {
      excluded: true,
      company_id: summary.companyId,
      company_name: summary.name || summary.shortName || `Company ${summary.companyId}`,
      reason: record.requirements?.length
        ? `Only ${assessedCount} usable Skill Intelligence requirement(s); at least ${MIN_ASSESSED_SKILLSETS} are needed.`
        : 'No Skill Intelligence requirements are recorded for this company.',
    };
  }

  const companyName = summary.name || summary.shortName;
  const check = runTalentCheck(profile, { company_id: String(summary.companyId), company_name: companyName, requirements });

  const requirementRows = check.skillset_gap
    .filter((r) => r.required_level !== null && r.required_level > 0)
    .map((r) => ({
      category_code: r.category_code,
      category_name: categoryName(r.category_code),
      required_level: r.required_level,
      candidate_level: r.candidate_level,
      criticality: criticalityFor(r.required_level),
      classification: classify(r),
      uncertainty: r.uncertainty,
      evidence: r.evidence,
    }))
    .sort((a, b) => b.required_level - a.required_level || a.category_code.localeCompare(b.category_code));

  const by = (c) => requirementRows.filter((r) => r.classification === c);
  const critical = requirementRows.filter((r) => r.criticality === 'Critical');
  const criticalMet = critical.filter((r) => r.classification === 'matched').length;
  const requiredTotal = requirementRows.reduce((sum, r) => sum + r.required_level, 0);
  const covered = requirementRows.reduce((sum, r) => sum + Math.min(r.candidate_level, r.required_level), 0);
  const unscored = SCORED_CATEGORY_CODES.filter((c) => requirements[c] === undefined);

  const limitations = [...notes];
  if (unscored.length) limitations.push(`No requirement recorded for ${unscored.map(categoryName).join(', ')}; excluded from the score.`);
  if (by('unverified').length) {
    limitations.push(`${by('unverified').map((r) => r.category_name).join(', ')} cannot be verified from a resume alone; scored as 0 until assessed.`);
  }
  if (record.techStack === null) limitations.push('Tech stack not available for this company.');

  const role = bestRole(profile, summary, jds);

  return {
    excluded: false,
    company_id: summary.companyId,
    company_name: companyName,
    short_name: summary.shortName,
    company_type: summary.companyType,
    category: summary.category,
    website_url: summary.websiteUrl,
    score: check.readiness_score,
    requirements: requirementRows,
    matched: by('matched'),
    partial: by('partial'),
    missing: by('missing'),
    unverified: by('unverified'),
    critical_met: criticalMet,
    critical_total: critical.length,
    explanation:
      `${check.readiness_score}/100 = 100 × ${covered} ÷ ${requiredTotal}: estimated candidate levels, capped at each required level, ` +
      `summed over ${requirementRows.length} ${companyName} Skill Intelligence skillsets. ` +
      `Meets ${by('matched').length} of ${requirementRows.length}${critical.length ? `, including ${criticalMet} of ${critical.length} Critical (7+)` : ''}.`,
    skill_intelligence_summary: requirementRows.slice(0, 4).map((r) => `${r.category_name} ${r.required_level}/10 (${r.criticality})`),
    tech_stack: record.techStack,
    tech_stack_matches: techStackOverlap(profile, record.techStack),
    hiring_signal: record.hiringSignal,
    best_role: role,
    limitations,
  };
}

/**
 * Scores every company first, then ranks: score, Critical requirements met, requirements
 * met, then name — so ties resolve the same way every time.
 */
export function rankCompanies(profile, records, { jds = [], topN = DEFAULT_TOP_N } = {}) {
  if (!profile) throw new Error('Select a candidate profile.');
  if (!(profile.skills || []).some((s) => SCORED_CATEGORY_CODES.includes(s.category_code))) {
    throw new Error(`${profile.name || 'This profile'} has no skills in the 12 RADIX categories, so no company can be scored. Add evidence-backed skills in Profile Builder.`);
  }

  // One record per company_id, so a duplicated company cannot take two ranking slots.
  const unique = new Map();
  for (const r of records || []) if (!unique.has(r.summary.companyId)) unique.set(r.summary.companyId, r);

  const assessed = [];
  const excluded = [];
  for (const record of unique.values()) {
    const res = assessCompany(profile, record, jds);
    (res.excluded ? excluded : assessed).push(res);
  }

  assessed.sort(
    (a, b) =>
      b.score - a.score ||
      b.critical_met - a.critical_met ||
      b.matched.length - a.matched.length ||
      a.company_name.localeCompare(b.company_name) ||
      a.company_id - b.company_id,
  );

  return {
    candidate_name: profile.name,
    profile_id: profile.profile_id,
    total_companies: unique.size,
    duplicate_company_records: (records || []).length - unique.size,
    assessed_count: assessed.length,
    excluded,
    matches: assessed.slice(0, topN).map((m, i) => ({ ...m, rank: i + 1 })),
    scoring: { method: COMPANY_FIT_METHOD, formula: COMPANY_FIT_FORMULA, min_assessed_skillsets: MIN_ASSESSED_SKILLSETS },
  };
}
