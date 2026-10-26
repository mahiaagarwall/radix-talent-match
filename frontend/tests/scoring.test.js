import { describe, it, expect } from 'vitest';
import { runSkillMatch, computeScore, DEFAULT_SCORING, matchValueFor } from '../src/utils/skillMatcher';
import { runTalentCheck, estimateCategoryLevel } from '../src/utils/readinessScorer';
import { parseCompanyRequirements } from '../src/utils/companyRequirements';
import { canonicalSkillName, dedupeSkills } from '../src/utils/skillNormalizer';
import { scanJobDescriptionText } from '../src/utils/jdKeywordScan';
import { RESUME_FIXTURES, JD_FIXTURES } from '../src/data/fixtures';
import { SCORED_CATEGORY_CODES } from '../src/data/categories';

const profile = (key) => {
  const f = RESUME_FIXTURES.find((x) => x.key === key);
  return { profile_id: `p-${key}`, ...f.parsed };
};
const jd = (key) => {
  const f = JD_FIXTURES.find((x) => x.key === key);
  return { jd_id: `j-${key}`, ...f.jd };
};

describe('skill normalization', () => {
  it('maps aliases and strips depth qualifiers', () => {
    expect(canonicalSkillName('Computer Networks')).toBe('networking');
    expect(canonicalSkillName('Networking (fundamentals)')).toBe('networking');
    expect(canonicalSkillName('Data Structures & Algorithms')).toBe('data structures and algorithms');
    expect(canonicalSkillName('Power BI')).toBe('data visualization');
    expect(canonicalSkillName('SQL (basic)')).toBe('sql');
  });

  it('deduplicates skills by canonical name, keeping the strongest confidence', () => {
    const out = dedupeSkills([
      { skill_name: 'SQL', category_code: 'SQL', evidence: 'a', confidence: 'low' },
      { skill_name: 'MySQL', category_code: 'SQL', evidence: 'b', confidence: 'high' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe('high');
  });
});

describe('skill matching (demo-weighted-v1)', () => {
  it('reproduces the displayed score from the displayed classifications', () => {
    for (const r of RESUME_FIXTURES) {
      for (const j of JD_FIXTURES) {
        const res = runSkillMatch(profile(r.key), jd(j.key), DEFAULT_SCORING);
        const recomputed = computeScore(res.skill_results);
        expect(res.match_score).toBe(recomputed);
        // every row's match value is consistent with its status
        res.skill_results.forEach((row) => expect(row.match_value).toBe(matchValueFor(row.status, DEFAULT_SCORING)));
        // the three lists partition the requirements
        expect(res.matched_skills.length + res.partial_skills.length + res.missing_skills.length).toBe(res.skill_results.length);
        expect(res.match_score).toBeGreaterThanOrEqual(0);
        expect(res.match_score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('scores Ananya above Karthik for the Google SWE role (guide acceptance test)', () => {
    const ananya = runSkillMatch(profile('ananya-rao'), jd('google-swe'));
    const karthik = runSkillMatch(profile('karthik-subramaniam'), jd('google-swe'));
    expect(ananya.match_score).toBeGreaterThan(karthik.match_score);
    expect(karthik.missing_skills).toContain('System Design');
  });

  it('scores Karthik above Ananya for the Microsoft Data Analyst role', () => {
    const karthik = runSkillMatch(profile('karthik-subramaniam'), jd('microsoft-da'));
    const ananya = runSkillMatch(profile('ananya-rao'), jd('microsoft-da'));
    expect(karthik.match_score).toBeGreaterThan(ananya.match_score);
  });

  it('treats basic-qualified skills as full matches only when the JD asks for basic level', () => {
    const priya = profile('priya-menon');
    const support = runSkillMatch(priya, jd('oracle-asa'));
    expect(support.skill_results.find((r) => r.skill_name === 'SQL (basic)').status).toBe('matched');
    const ds = runSkillMatch(priya, jd('google-ds'));
    expect(ds.skill_results.find((r) => r.skill_name === 'SQL').status).toBe('partial');
  });

  it('is deterministic and responds to the partial value parameter', () => {
    const a = runSkillMatch(profile('priya-menon'), jd('google-ds'));
    const b = runSkillMatch(profile('priya-menon'), jd('google-ds'));
    expect(a.match_score).toBe(b.match_score);
    const generous = runSkillMatch(profile('priya-menon'), jd('google-ds'), { ...DEFAULT_SCORING, partial_value: 0.9 });
    expect(generous.match_score).toBeGreaterThan(a.match_score);
  });

  it('refuses to score a JD without skills', () => {
    expect(() => runSkillMatch(profile('ananya-rao'), { jd_id: 'x', skills: [] })).toThrow(/no extracted skills/);
  });
});

// Synthetic requirements used ONLY to exercise the scorer in tests.
const SYNTHETIC = {
  synthetic: true,
  companies: [
    {
      company_id: 'test-co',
      company_name: 'Test Co (synthetic)',
      skillsets: Object.fromEntries(SCORED_CATEGORY_CODES.map((c) => [c, 6])),
    },
  ],
};

describe('talent check (demo-readiness-v1)', () => {
  it('returns one row for each of the 12 RADIX skillsets', () => {
    const reqs = parseCompanyRequirements(SYNTHETIC);
    const res = runTalentCheck(profile('rohan-verma'), reqs.companies[0]);
    expect(res.skillset_gap).toHaveLength(12);
    expect(res.skillset_gap.every((r) => r.candidate_level_is_estimate)).toBe(true);
    expect(res.readiness_score).toBeGreaterThanOrEqual(0);
    expect(res.readiness_score).toBeLessThanOrEqual(100);
  });

  it('produces explainably different results for different candidates', () => {
    const company = parseCompanyRequirements(SYNTHETIC).companies[0];
    const rohan = runTalentCheck(profile('rohan-verma'), company);
    const priya = runTalentCheck(profile('priya-menon'), company);
    expect(rohan.readiness_score).toBeGreaterThan(priya.readiness_score);
    expect(priya.priority_gaps.length).toBeGreaterThan(0);
  });

  it('never estimates a level from no evidence, and caps resume-only estimates below 10', () => {
    expect(estimateCategoryLevel([]).level).toBe(0);
    const many = Array.from({ length: 6 }, (_, i) => ({ skill_name: `s${i}`, confidence: 'high' }));
    expect(estimateCategoryLevel(many).level).toBeLessThan(10);
  });
});

describe('company requirements parser', () => {
  it('accepts a keyed-object shape and an array-of-levels shape', () => {
    const keyed = parseCompanyRequirements({ 'Alpha Ltd': { COD: 7, DSA: 8 } });
    expect(keyed.companies[0].requirements).toEqual({ COD: 7, DSA: 8 });
    const arr = parseCompanyRequirements([{ name: 'Beta', levels: [{ category_code: 'Coding', required_level: 5 }] }]);
    expect(arr.companies[0].requirements.COD).toBe(5);
    expect(arr.companies[0].missing_categories).toHaveLength(11);
  });

  it('rejects files with no recognisable levels instead of inventing them', () => {
    expect(() => parseCompanyRequirements({ foo: 'bar' })).toThrow();
    const res = parseCompanyRequirements({ Gamma: { COD: 42, DSA: 5 } });
    expect(res.companies[0].requirements.COD).toBeUndefined();
    expect(res.warnings.length).toBe(1);
  });
});

describe('demo keyword scan', () => {
  it('only reports terms present in the text and quotes them as evidence', () => {
    const text = 'Key Responsibilities\nWrite optimized SQL queries for reporting.\nNice to Have\nExperience with Azure cloud.';
    const skills = scanJobDescriptionText(text);
    const sql = skills.find((s) => s.skill_name === 'SQL');
    expect(sql.evidence).toContain('SQL');
    expect(sql.requirement).toBe('required');
    expect(skills.find((s) => s.skill_name === 'Cloud Infrastructure').requirement).toBe('preferred');
    expect(skills.every((s) => s.confidence === 'low')).toBe(true);
    expect(skills.find((s) => s.skill_name === 'System Design')).toBeUndefined();
  });
});
