// Demo Skill Matching engine ("demo-weighted-v1").
//
// Implements the team guide's PROPOSED formula (subject to team agreement):
//   Match Score = 100 × Σ(weight × match_value) / Σ(weight)
// Classification rules, weights and the partial value are documented in
// docs/scoring-rules.md. Every input to the score is returned in `skill_results`,
// so the displayed classifications always reproduce the displayed score.

import { categoryName } from '../data/categories';
import { canonicalSkillName, hasDepthQualifier, GENERIC_COMPETENCIES } from './skillNormalizer';

export const MATCH_METHOD = 'demo-weighted-v1';

export const DEFAULT_SCORING = {
  partial_value: 0.5,
  weights: { required: 1, preferred: 0.5 },
};

const SUPPORTED = new Set(['high', 'medium']);

function evidenceOf(skill) {
  return {
    skill_name: skill.skill_name,
    category_code: skill.category_code,
    evidence: skill.evidence || '',
    confidence: skill.confidence,
  };
}

function classify(jdSkill, candidateSkills) {
  const canonical = canonicalSkillName(jdSkill.skill_name);
  const jdIsBasic = hasDepthQualifier(jdSkill.skill_name);

  // Rule 1 — named skill present (after alias normalization).
  const named = candidateSkills.filter((s) => canonicalSkillName(s.skill_name) === canonical);
  if (named.length) {
    const strong = named.filter((s) => SUPPORTED.has(s.confidence));
    const fullDepth = strong.filter((s) => jdIsBasic || !hasDepthQualifier(s.skill_name));
    if (fullDepth.length) {
      return {
        status: 'matched',
        candidate_evidence: fullDepth.map(evidenceOf),
        reason: `Candidate lists "${fullDepth[0].skill_name}" with ${fullDepth[0].confidence}-confidence evidence.`,
      };
    }
    if (strong.length) {
      return {
        status: 'partial',
        candidate_evidence: strong.map(evidenceOf),
        reason: `Candidate's resume qualifies "${strong[0].skill_name}" as basic-level, while the JD does not ask for basic level only.`,
      };
    }
    return {
      status: 'partial',
      candidate_evidence: named.map(evidenceOf),
      reason: `"${named[0].skill_name}" appears only with low-confidence evidence, so it is treated as uncertain.`,
    };
  }

  // Rule 2 — broad competency satisfied by any skill in its category.
  const genericCategory = GENERIC_COMPETENCIES[canonical];
  if (genericCategory) {
    const inCategory = candidateSkills.filter((s) => s.category_code === genericCategory);
    const strong = inCategory.filter((s) => SUPPORTED.has(s.confidence));
    if (strong.length) {
      return {
        status: 'matched',
        candidate_evidence: strong.map(evidenceOf),
        reason: `Broad competency satisfied by ${categoryName(genericCategory)} evidence: ${strong
          .map((s) => s.skill_name)
          .join(', ')}.`,
      };
    }
    if (inCategory.length) {
      return {
        status: 'partial',
        candidate_evidence: inCategory.map(evidenceOf),
        reason: `Only low-confidence ${categoryName(genericCategory)} evidence was found.`,
      };
    }
  }

  // Rule 3 — related evidence in the same RADIX category (OTHER is too broad to count).
  if (jdSkill.category_code !== 'OTHER') {
    const related = candidateSkills.filter((s) => s.category_code === jdSkill.category_code);
    if (related.length) {
      return {
        status: 'partial',
        candidate_evidence: related.map(evidenceOf),
        reason: `No direct evidence of "${jdSkill.skill_name}", but related ${categoryName(
          jdSkill.category_code,
        )} skills were found: ${related.map((s) => s.skill_name).join(', ')}.`,
      };
    }
  }

  return {
    status: 'missing',
    candidate_evidence: [],
    reason:
      jdSkill.category_code === 'OTHER'
        ? `No evidence of "${jdSkill.skill_name}" in the profile.`
        : `No evidence of "${jdSkill.skill_name}" or related ${categoryName(jdSkill.category_code)} skills in the profile.`,
  };
}

export function matchValueFor(status, scoring = DEFAULT_SCORING) {
  if (status === 'matched') return 1;
  if (status === 'partial') return scoring.partial_value;
  return 0;
}

export function weightFor(requirement, scoring = DEFAULT_SCORING) {
  return requirement === 'preferred' ? scoring.weights.preferred : scoring.weights.required;
}

export function computeScore(skillResults) {
  const totalWeight = skillResults.reduce((sum, r) => sum + r.weight, 0);
  if (!totalWeight) return 0;
  const earned = skillResults.reduce((sum, r) => sum + r.weight * r.match_value, 0);
  return Math.round((100 * earned) / totalWeight);
}

function buildRecommendations(skillResults) {
  const recs = [];
  const missing = skillResults
    .filter((r) => r.status === 'missing')
    .sort((a, b) => b.weight - a.weight);
  const partial = skillResults
    .filter((r) => r.status === 'partial')
    .sort((a, b) => b.weight - a.weight);

  missing.slice(0, 4).forEach((r) => {
    recs.push({
      skill_name: r.skill_name,
      priority: r.requirement === 'preferred' ? 'medium' : 'high',
      text: `Build demonstrable evidence of ${r.skill_name} (${categoryName(r.category_code)}). The JD asks for: "${r.jd_evidence}".`,
    });
  });
  partial.slice(0, 3).forEach((r) => {
    recs.push({
      skill_name: r.skill_name,
      priority: 'medium',
      text: `Strengthen ${r.skill_name}: ${r.reason} Add a project, internship outcome or certification that shows it directly.`,
    });
  });
  return recs;
}

function buildSummary(result) {
  const { match_score, counts, skill_results } = result;
  const total = skill_results.length;
  const topMissing = skill_results
    .filter((r) => r.status === 'missing' && r.requirement !== 'preferred')
    .map((r) => r.skill_name)
    .slice(0, 3);
  const are = (n) => `${n} ${n === 1 ? 'is' : 'are'}`;
  let text = `${match_score}/100: ${counts.matched} of ${total} JD skills ${counts.matched === 1 ? 'is' : 'are'} supported by profile evidence, ${are(counts.partial)} partial and ${are(counts.missing)} missing.`;
  if (topMissing.length) text += ` Largest gaps: ${topMissing.join(', ')}.`;
  else if (counts.missing === 0 && counts.partial === 0) text += ' Every listed requirement has supporting evidence.';
  return text;
}

export function runSkillMatch(profile, jd, scoring = DEFAULT_SCORING) {
  if (!profile) throw new Error('Select a candidate profile.');
  if (!jd) throw new Error('Select an analyzed job description.');
  const jdSkills = jd.skills || [];
  if (!jdSkills.length) throw new Error('This job description has no extracted skills to match against.');
  const candidateSkills = profile.skills || [];

  const skill_results = jdSkills.map((jdSkill) => {
    const requirement = jdSkill.requirement === 'preferred' ? 'preferred' : 'required';
    const verdict = classify(jdSkill, candidateSkills);
    return {
      skill_name: jdSkill.skill_name,
      category_code: jdSkill.category_code,
      requirement,
      weight: weightFor(requirement, scoring),
      status: verdict.status,
      match_value: matchValueFor(verdict.status, scoring),
      jd_evidence: jdSkill.evidence || '',
      jd_confidence: jdSkill.confidence,
      candidate_evidence: verdict.candidate_evidence,
      reason: verdict.reason,
    };
  });

  const counts = {
    matched: skill_results.filter((r) => r.status === 'matched').length,
    partial: skill_results.filter((r) => r.status === 'partial').length,
    missing: skill_results.filter((r) => r.status === 'missing').length,
  };

  const result = {
    type: 'skill_match',
    profile_id: profile.profile_id,
    candidate_name: profile.name,
    jd_id: jd.jd_id,
    jd_source_file: jd.source_file || null,
    company: jd.company,
    role: jd.role,
    match_score: computeScore(skill_results),
    matched_skills: skill_results.filter((r) => r.status === 'matched').map((r) => r.skill_name),
    partial_skills: skill_results.filter((r) => r.status === 'partial').map((r) => r.skill_name),
    missing_skills: skill_results.filter((r) => r.status === 'missing').map((r) => r.skill_name),
    skill_results,
    counts,
    scoring: {
      method: MATCH_METHOD,
      formula: '100 × Σ(weight × match_value) / Σ(weight)',
      partial_value: scoring.partial_value,
      weights: { ...scoring.weights },
      status: 'demo — pending team agreement',
    },
  };
  result.summary = buildSummary(result);
  result.recommendations = buildRecommendations(skill_results);
  return result;
}

// Per-category roll-up for charts.
export function categoryBreakdown(skillResults) {
  const map = new Map();
  for (const r of skillResults || []) {
    const row = map.get(r.category_code) || {
      category_code: r.category_code,
      matched: 0,
      partial: 0,
      missing: 0,
      total: 0,
    };
    row[r.status] += 1;
    row.total += 1;
    map.set(r.category_code, row);
  }
  return [...map.values()];
}
