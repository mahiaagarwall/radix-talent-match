import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderApp';
import { jobFinderService } from '../src/services/jobFinderService';
import { resumeCoachService } from '../src/services/resumeCoachService';
import { loadSampleWorkspace } from '../src/services/sampleWorkspace';
import { setDataMode } from '../src/services/mode';

describe('Career Copilot Services', () => {
  it('jobFinderService recommends and ranks jobs locally', async () => {
    setDataMode('demo');
    loadSampleWorkspace();

    const result = await jobFinderService.recommend({
      candidateProfile: {
        name: 'Alex Rivera',
        skills: ['Python', 'SQL', 'Machine Learning'],
        preferred_roles: ['Data Scientist'],
      },
      minScore: 0,
      limit: 5,
    });

    expect(result.candidate_name).toBe('Alex Rivera');
    expect(result.total_jobs_evaluated).toBeGreaterThan(0);
    expect(result.matches.length).toBeGreaterThan(0);

    const first = result.matches[0];
    expect(first.overall_score).toBeGreaterThan(0);
    expect(first.overall_score).toBeLessThanOrEqual(100);
    expect(first.breakdown).toBeDefined();
    expect(first.match_tier).toBeDefined();
    expect(first.rationale).toBeDefined();
  });

  it('resumeCoachService enhances passive bullet points without fabrication', async () => {
    setDataMode('demo');
    const input = 'worked on implementing authentication service in order to improve security';
    const result = await resumeCoachService.improve({
      bullet: input,
      roleContext: 'Backend Engineer',
    });

    expect(result.original_bullet).toBe(input);
    expect(result.improved_bullet).toMatch(/^Engineered/);
    expect(result.improved_bullet).not.toContain('in order to');
    expect(result.improvements_made.length).toBeGreaterThan(0);
    expect(result.unsupported_claims_avoided.length).toBeGreaterThan(0);
    expect(result.follow_up_questions.length).toBeGreaterThan(0);

    // Guaranteed anti-fabrication: no fake metrics or percentages injected
    expect(result.improved_bullet).not.toMatch(/\d+%/);
    expect(result.improved_bullet).not.toContain('$');
  });
});

describe('Job Finder UI Page', () => {
  it('renders Job Finder and displays evaluated recommendations', async () => {
    setDataMode('demo');
    loadSampleWorkspace();

    renderApp('/job-finder');

    expect(await screen.findByRole('heading', { level: 1, name: 'Job Finder' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Candidate Profile/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Find Matching Jobs/ })).toBeInTheDocument();

    // Verify recommendations appear
    await waitFor(() => {
      expect(screen.getByText(/Evaluated \d+ roles/)).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /Run Skill Match/ }).length).toBeGreaterThan(0);
  });
});

describe('Resume Coach UI Page', () => {
  it('renders Resume Coach and coaches a sample bullet', async () => {
    const user = userEvent.setup();
    setDataMode('demo');

    renderApp('/resume-coach');

    expect(await screen.findByRole('heading', { level: 1, name: 'Resume Coach' })).toBeInTheDocument();
    expect(screen.getByText(/Strict Anti-Fabrication Guarantee/)).toBeInTheDocument();

    const coachBtn = screen.getByRole('button', { name: /Coach & Enhance Bullet/ });
    expect(coachBtn).toBeInTheDocument();

    await user.click(coachBtn);

    // Side-by-side comparison should be visible
    expect(await screen.findByText(/Side-by-Side Comparison/)).toBeInTheDocument();
    expect(screen.getByText(/Original Bullet/)).toBeInTheDocument();
    expect(screen.getByText(/Improved Bullet/)).toBeInTheDocument();
    expect(screen.getByText(/Key Refinements Applied/)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported Claims Avoided/)).toBeInTheDocument();
    expect(screen.getByText(/Prompts to Add Genuine Metrics/)).toBeInTheDocument();
  });
});
