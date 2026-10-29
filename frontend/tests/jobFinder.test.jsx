import { describe, it, expect, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from './renderApp';
import { fakeState, fakeTables, resetFakeTables, FAKE_MAX_ROWS } from './companyDirectory/fakeSupabase';
import { rankCompanies, buildRequirements, normalizeCompanyName, MIN_ASSESSED_SKILLSETS } from '../src/utils/companyMatcher';
import { runTalentCheck } from '../src/utils/readinessScorer';
import { jobFinderService } from '../src/services/jobFinderService';
import { profileService } from '../src/services/profileService';
import { loadSampleWorkspace } from '../src/services/sampleWorkspace';
import { setDataMode } from '../src/services/mode';
import { SCORED_CATEGORY_CODES } from '../src/data/categories';

const CODES = SCORED_CATEGORY_CODES;

// A profile strong in coding/DSA/SQL, nothing in cloud or system design.
const PROFILE = {
  profile_id: 'prf_test',
  name: 'Test Candidate',
  skills: [
    { skill_name: 'Python', category_code: 'COD', confidence: 'high', evidence: 'Built a Flask API' },
    { skill_name: 'Java', category_code: 'COD', confidence: 'high', evidence: 'Coursework projects' },
    { skill_name: 'Data Structures', category_code: 'DSA', confidence: 'high', evidence: '300 LeetCode problems' },
    { skill_name: 'Algorithms', category_code: 'DSA', confidence: 'medium', evidence: 'ICPC regional' },
    { skill_name: 'PostgreSQL', category_code: 'SQL', confidence: 'high', evidence: 'Designed schema for app' },
    { skill_name: 'OOP basics', category_code: 'OOD', confidence: 'low', evidence: '' },
  ],
};

function record(id, name, levels, extra = {}) {
  return {
    summary: { companyId: id, name, shortName: name, companyType: 'Dream', category: 'Tech', websiteUrl: '' },
    requirements: Object.entries(levels).map(([code, level], i) => ({ skillSetId: i + 1, name: code, shortName: code, requiredLevel: level })),
    techStack: extra.techStack ?? null,
    hiringSignal: extra.hiringSignal ?? null,
  };
}

const all = (level) => Object.fromEntries(CODES.map((c) => [c, level]));

describe('company ranking engine', () => {
  it('scores each company with its own requirements and the Talent Check formula', () => {
    const codingHeavy = record(1, 'Codeworks', { COD: 6, DSA: 6, SQL: 5, CLOUD: 2 });
    const cloudHeavy = record(2, 'Cloudly', { CLOUD: 9, SYSD: 9, OS: 8, COD: 3 });
    const res = rankCompanies(PROFILE, [cloudHeavy, codingHeavy]);

    expect(res.matches.map((m) => m.company_name)).toEqual(['Codeworks', 'Cloudly']);
    for (const m of res.matches) {
      const rec = m.company_id === 1 ? codingHeavy : cloudHeavy;
      const { requirements } = buildRequirements(rec.requirements);
      const expected = runTalentCheck(PROFILE, { company_id: String(m.company_id), company_name: m.company_name, requirements });
      expect(m.score).toBe(expected.readiness_score);
      // Only this company's categories appear in its result.
      expect(m.requirements.map((r) => r.category_code).sort()).toEqual(Object.keys(requirements).sort());
    }
    const cloudly = res.matches.find((m) => m.company_id === 2);
    expect(cloudly.missing.map((r) => r.category_code)).toEqual(expect.arrayContaining(['CLOUD', 'SYSD', 'OS']));
    expect(res.matches[0].score).toBeGreaterThan(cloudly.score);
  });

  it('evaluates every company before taking the top five', () => {
    const weak = Array.from({ length: 6 }, (_, i) => record(i + 1, `Weak ${i + 1}`, { CLOUD: 9, SYSD: 9, OS: 9, NETW: 9 }));
    const best = record(99, 'Best Fit', { COD: 5, DSA: 5, SQL: 5 });
    const res = rankCompanies(PROFILE, [...weak, best]);
    expect(res.assessed_count).toBe(7);
    expect(res.matches).toHaveLength(5);
    expect(res.matches[0].company_name).toBe('Best Fit');
    expect(res.matches.map((m) => m.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('excludes companies without enough Skill Intelligence instead of scoring them', () => {
    const res = rankCompanies(PROFILE, [
      record(1, 'Full', all(5)),
      record(2, 'Empty', {}),
      record(3, 'Thin', { COD: 5, DSA: 5 }),
    ]);
    expect(res.matches.map((m) => m.company_name)).toEqual(['Full']);
    expect(res.excluded.map((e) => e.company_name)).toEqual(['Empty', 'Thin']);
    expect(res.excluded[0].reason).toMatch(/No Skill Intelligence/);
    expect(res.excluded[1].reason).toMatch(new RegExp(`at least ${MIN_ASSESSED_SKILLSETS}`));
  });

  it('returns fewer than five when fewer are assessable, and nothing for an empty directory', () => {
    expect(rankCompanies(PROFILE, [record(1, 'A', all(4)), record(2, 'B', all(6))]).matches).toHaveLength(2);
    const empty = rankCompanies(PROFILE, []);
    expect(empty.matches).toEqual([]);
    expect(empty.total_companies).toBe(0);
  });

  it('does not let duplicate company or skill rows distort the ranking', () => {
    const dupSkills = record(1, 'Dup', { COD: 5, DSA: 5, SQL: 5 });
    dupSkills.requirements.push({ skillSetId: 50, name: 'Coding again', shortName: 'COD', requiredLevel: 8 });
    const res = rankCompanies(PROFILE, [dupSkills, record(1, 'Dup', { COD: 1, DSA: 1, SQL: 1 })]);
    expect(res.matches).toHaveLength(1);
    expect(res.duplicate_company_records).toBe(1);
    const m = res.matches[0];
    expect(m.requirements.filter((r) => r.category_code === 'COD')).toHaveLength(1);
    expect(m.requirements.find((r) => r.category_code === 'COD').required_level).toBe(8);
    expect(m.limitations.join(' ')).toMatch(/repeated Skill Intelligence row/);
  });

  it('separates missing-from-resume from unverifiable categories', () => {
    const m = rankCompanies(PROFILE, [record(1, 'Co', { COD: 5, CLOUD: 5, APTI: 6, COMM: 6 })]).matches[0];
    expect(m.missing.map((r) => r.category_code)).toEqual(['CLOUD']);
    expect(m.unverified.map((r) => r.category_code).sort()).toEqual(['APTI', 'COMM']);
    expect(m.matched.map((r) => r.category_code)).toEqual(['COD']);
  });

  it('breaks score ties deterministically', () => {
    const a = rankCompanies(PROFILE, [record(2, 'Zeta', all(5)), record(1, 'Alpha', all(5))]);
    const b = rankCompanies(PROFILE, [record(1, 'Alpha', all(5)), record(2, 'Zeta', all(5))]);
    expect(a.matches.map((m) => m.company_name)).toEqual(['Alpha', 'Zeta']);
    expect(b.matches.map((m) => m.company_name)).toEqual(['Alpha', 'Zeta']);
  });

  it('links analyzed JDs only to the same company and names it a potential employer otherwise', () => {
    const jd = {
      jd_id: 'jd_1',
      company: 'Google LLC',
      role: 'Software Engineer',
      skills: [{ skill_name: 'Python', category_code: 'COD', requirement: 'required', evidence: 'Python' }],
    };
    const res = rankCompanies(PROFILE, [record(1, 'Google', all(5)), record(2, 'Microsoft', all(5))], { jds: [jd] });
    const google = res.matches.find((m) => m.company_name === 'Google');
    const microsoft = res.matches.find((m) => m.company_name === 'Microsoft');
    expect(google.best_role).toMatchObject({ jd_id: 'jd_1', role: 'Software Engineer' });
    expect(microsoft.best_role).toBeNull();
    expect(normalizeCompanyName('Oracle Corporation')).toBe(normalizeCompanyName('Oracle'));
  });

  it('reports tech-stack overlap only for exact technologies', () => {
    const m = rankCompanies(PROFILE, [record(1, 'Co', all(5), { techStack: 'AWS; Microsoft Azure; Python; PostgreSQL' })]).matches[0];
    expect(m.tech_stack_matches).toEqual(['Python', 'PostgreSQL']);
  });

  it('refuses to score a profile with no RADIX skills', () => {
    expect(() => rankCompanies({ name: 'Empty', skills: [] }, [record(1, 'Co', all(5))])).toThrow(/no skills in the 12 RADIX categories/);
  });
});

// The fake directory mirrors production: skill_set_master.short_name holds the RADIX code.
function useCodedDirectory({ companies = 100 } = {}) {
  fakeTables.skill_set_master = CODES.map((code, i) => ({ skill_set_id: i + 1, skill_set_name: `${code} skill`, short_name: code }));
  fakeTables.company_json = Array.from({ length: companies }, (_, i) => ({
    company_id: i + 1,
    short_json: { name: `Company ${i + 1}`, short_name: `C${i + 1}`, company_type: 'Standard' },
    full_json: { tech_stack: 'Python; AWS', hiring_velocity: 'Engineering ~10 open roles' },
  }));
  // Company n requires level ((n + skill) % 9) + 1, so every company differs.
  fakeTables.company_skill_levels = fakeTables.company_json.flatMap((c) =>
    CODES.map((_, s) => ({ company_id: c.company_id, skill_set_id: s + 1, required_level: ((c.company_id + s) % 9) + 1 })),
  );
}

describe('Company Directory data for Job Finder', () => {
  afterEach(() => {
    resetFakeTables();
    fakeState.mode = 'ok';
    jobFinderService.clearDirectoryCache();
  });

  it('reads every skill-level row across pages, grouped by the right company', async () => {
    useCodedDirectory({ companies: 100 });
    expect(fakeTables.company_skill_levels.length).toBeGreaterThan(FAKE_MAX_ROWS);
    const { fetchAllCompanyIntelligence } = await import('@cd/lib/companyApi');
    const { companies, warnings } = await fetchAllCompanyIntelligence();

    expect(warnings).toEqual([]);
    expect(companies).toHaveLength(100);
    expect(companies.every((c) => c.requirements.length === 12)).toBe(true);
    const last = companies.find((c) => c.summary.companyId === 100);
    expect(last.requirements.map((r) => r.requiredLevel)).toEqual(CODES.map((_, s) => ((100 + s) % 9) + 1));
    expect(last.techStack).toBe('Python; AWS');
    expect(last.hiringSignal).toMatch(/open roles/);
  });

  it('ranks all directory companies for a saved profile', async () => {
    setDataMode('demo');
    useCodedDirectory({ companies: 100 });
    const saved = await profileService.create({ ...PROFILE, profile_id: undefined });
    const res = await jobFinderService.recommendCompanies({ profileId: saved.profile_id });
    expect(res.total_companies).toBe(100);
    expect(res.assessed_count).toBe(100);
    expect(res.matches).toHaveLength(5);
    const scores = res.matches.map((m) => m.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });

  it('surfaces directory failures and an empty directory as errors, not empty results', async () => {
    setDataMode('demo');
    const saved = await profileService.create({ ...PROFILE, profile_id: undefined });
    fakeState.mode = 'error';
    await expect(jobFinderService.recommendCompanies({ profileId: saved.profile_id })).rejects.toThrow(/permission denied/);
    fakeState.mode = 'empty';
    await expect(jobFinderService.recommendCompanies({ profileId: saved.profile_id })).rejects.toThrow(/returned no companies/);
  });
});

describe('Job Finder page', () => {
  afterEach(() => {
    resetFakeTables();
    jobFinderService.clearDirectoryCache();
  });

  it('shows the top companies from the Company Directory with explained scores', async () => {
    setDataMode('demo');
    loadSampleWorkspace();
    useCodedDirectory({ companies: 8 });

    renderApp('/job-finder');
    expect(await screen.findByRole('heading', { level: 1, name: 'Job Finder' })).toBeInTheDocument();
    expect(await screen.findByText(/Top 5 by compatibility/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/out of the/).textContent).toMatch(/8 companies out of the 8/);
    expect(screen.getAllByText(/Rank #/)).toHaveLength(5);
    expect(screen.getAllByText(/= 100 ×/).length).toBe(5);
    expect(screen.getAllByText(/Potential employer/).length).toBeGreaterThan(0);
    const firstCard = screen.getAllByText(/Rank #1/)[0].closest('.card');
    expect(within(firstCard).getByRole('button', { name: /Skill Intelligence/ })).toBeInTheDocument();
    expect(screen.getByText(/not a probability of being hired/)).toBeInTheDocument();
  });
});
