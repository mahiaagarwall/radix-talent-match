import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderApp';
import { loadSampleWorkspace, resetDemoData } from '../src/services/sampleWorkspace';
import { skillMatchService } from '../src/services/skillMatchService';
import { MatchResultView } from '../src/components/skill-matching/MatchResultView';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

describe('Skill Matching Page & Components', () => {
  beforeEach(() => {
    resetDemoData();
    vi.restoreAllMocks();
  });

  it('renders empty selection state when no profiles or JDs exist', async () => {
    renderApp('/skill-matching');
    expect(
      await screen.findByText(/Matching needs a saved profile and an analyzed job description/),
    ).toBeInTheDocument();
  });

  it('enables match execution only after selecting both candidate and JD', async () => {
    loadSampleWorkspace();
    const user = userEvent.setup();
    renderApp('/skill-matching');

    const profileSelect = await screen.findByLabelText('Candidate profile');
    const jdSelect = screen.getByLabelText('Job description');
    const runBtn = screen.getByRole('button', { name: /Run match/ });

    // Initially disabled before selection
    expect(runBtn).toBeDisabled();

    // Select candidate only
    await user.selectOptions(profileSelect, 'prf_sample_ananya-rao');
    expect(runBtn).toBeDisabled();

    // Select JD as well
    await user.selectOptions(jdSelect, 'jd_sample_google-swe');
    expect(runBtn).toBeEnabled();
  });

  it('displays API error state when match fails', async () => {
    loadSampleWorkspace();
    const user = userEvent.setup();

    vi.spyOn(skillMatchService, 'run').mockRejectedValueOnce(
      new Error('FastAPI server connection refused'),
    );

    renderApp('/skill-matching');
    await user.selectOptions(await screen.findByLabelText('Candidate profile'), 'prf_sample_ananya-rao');
    await user.selectOptions(screen.getByLabelText('Job description'), 'jd_sample_google-swe');
    await user.click(screen.getAllByRole('button', { name: /Run match/ })[0]);

    expect(await screen.findByText('Match failed')).toBeInTheDocument();
    expect(await screen.findByText(/FastAPI server connection refused/)).toBeInTheDocument();
  });

  it('renders MatchResultView with not_scored state gracefully', () => {
    const notScoredResult = {
      result_id: 'sm_test_unscored',
      type: 'skill_match',
      profile_id: 'prf_1',
      candidate_name: 'Test Candidate',
      jd_id: 'jd_1',
      company: 'Test Co',
      role: 'Test Role',
      match_score: null,
      scoring_status: 'not_scored',
      matched_skills: [],
      partial_skills: [],
      missing_skills: [],
      skill_results: [],
      counts: { matched: 0, partial: 0, missing: 0 },
      summary: 'Not scored: the job description contains no extracted skills to match against.',
      recommendations: [],
      scoring: {
        method: 'demo-weighted-v1',
        formula: '100 × Σ(weight × match_value) / Σ(weight)',
        status: 'completed',
      },
      created_at: new Date().toISOString(),
    };

    render(
      <MemoryRouter>
        <MatchResultView result={notScoredResult} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Not Scored')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/Not scored: the job description contains no extracted skills/)).toBeInTheDocument();
  });

  it('renders matched, partial and missing count tiles correctly', () => {
    const result = {
      result_id: 'sm_test_counts',
      type: 'skill_match',
      profile_id: 'prf_1',
      candidate_name: 'Test Candidate',
      jd_id: 'jd_1',
      company: 'Google LLC',
      role: 'SWE',
      match_score: 85,
      scoring_status: 'completed',
      matched_skills: ['Python', 'DSA'],
      partial_skills: ['SQL'],
      missing_skills: ['AWS'],
      skill_results: [
        { skill_name: 'Python', category_code: 'COD', requirement: 'required', weight: 1, status: 'matched', match_value: 1, reason: 'Matched', candidate_evidence: [] },
        { skill_name: 'DSA', category_code: 'DSA', requirement: 'required', weight: 1, status: 'matched', match_value: 1, reason: 'Matched', candidate_evidence: [] },
        { skill_name: 'SQL', category_code: 'SQL', requirement: 'required', weight: 1, status: 'partial', match_value: 0.5, reason: 'Partial', candidate_evidence: [] },
        { skill_name: 'AWS', category_code: 'CLOUD', requirement: 'preferred', weight: 0.5, status: 'missing', match_value: 0, reason: 'Missing', candidate_evidence: [] },
      ],
      counts: { matched: 2, partial: 1, missing: 1 },
      summary: '85/100: 2 of 4 JD skills are supported.',
      recommendations: [{ skill_name: 'AWS', priority: 'medium', text: 'Build AWS skills' }],
      scoring: { method: 'demo-weighted-v1', formula: 'formula' },
      created_at: new Date().toISOString(),
    };

    render(
      <MemoryRouter>
        <MatchResultView result={result} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Strong match')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Matched').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Partial').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Missing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Build AWS skills')).toBeInTheDocument();
  });
});
