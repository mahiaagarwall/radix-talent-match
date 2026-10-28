import { describe, it, expect, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderApp';
import { loadSampleWorkspace } from '../src/services/sampleWorkspace';
import { profileService } from '../src/services/profileService';
import { setDataMode } from '../src/services/mode';
import { computeScore } from '../src/utils/skillMatcher';

describe('routing', () => {
  const ROUTES = [
    ['/', /See Talent in True Depth/],
    ['/resume-parsing', /Resume Parsing/],
    ['/profile-builder', /Profile Builder/],
    ['/jd-analytics', /JD Analytics/],
    ['/talent-check', /Talent Check/],
    ['/skill-matching', /Skill Matching/],
    ['/job-finder', /Job Finder/],
    ['/resume-coach', /Resume Coach/],
    ['/results', /Results/],
    ['/settings', /Settings/],
    ['/does-not-exist', /Page not found/],
  ];

  it.each(ROUTES)('renders %s', async (route, heading) => {
    renderApp(route);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('renders detail routes for missing records with an error state', async () => {
    renderApp('/results/unknown-id');
    expect(await screen.findByText(/Could not open this result/)).toBeInTheDocument();
  });

  it('navigates with the sidebar and highlights the active link', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    await user.click(within(nav).getByRole('link', { name: /Skill Matching/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Skill Matching' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Skill Matching/ })).toHaveClass('active');
  });
});

describe('profile builder', () => {
  it('blocks saving without a name and shows the validation error', async () => {
    const user = userEvent.setup();
    renderApp('/profile-builder');
    await screen.findByLabelText(/Full name/);
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);
    expect(await screen.findByText('Candidate name is required.')).toBeInTheDocument();
    expect(await profileService.list()).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const user = userEvent.setup();
    renderApp('/profile-builder');
    await user.type(await screen.findByLabelText(/Full name/), 'Test Candidate');
    await user.type(screen.getByLabelText(/^Email/), 'not-an-email');
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);
    expect(await screen.findByText(/Enter a valid email address/)).toBeInTheDocument();
  });

  it('creates a demo profile with a skill, then loads and edits it', async () => {
    const user = userEvent.setup();
    renderApp('/profile-builder');
    await user.type(await screen.findByLabelText(/Full name/), 'Ananya Rao');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.type(screen.getByLabelText('Skill name for row 1'), 'Python');
    await user.selectOptions(screen.getByLabelText('Category for Python'), 'COD');
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);

    expect(await screen.findByText(/Profile saved to local demo storage/)).toBeInTheDocument();
    const [saved] = await profileService.list();
    expect(saved.name).toBe('Ananya Rao');
    expect(saved.skills).toEqual([expect.objectContaining({ skill_name: 'Python', category_code: 'COD', origin: 'manual' })]);

    // Edit the same stable profile ID.
    const nameInput = await screen.findByLabelText(/Full name/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Ananya R.');
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);
    await waitFor(async () => expect((await profileService.get(saved.profile_id)).name).toBe('Ananya R.'));
    expect(await profileService.list()).toHaveLength(1);
  });
});

describe('skill matching workspace', () => {
  it('lists saved JDs for selection and shows a score consistent with its classifications', async () => {
    loadSampleWorkspace();
    const user = userEvent.setup();
    renderApp('/skill-matching');
    const jdSelect = await screen.findByLabelText('Job description');
    expect(within(jdSelect).getAllByRole('option').length).toBe(7); // placeholder + 6 sample JDs

    await user.selectOptions(screen.getByLabelText('Candidate profile'), 'prf_sample_ananya-rao');
    await user.selectOptions(jdSelect, 'jd_sample_google-swe');
    await user.click(screen.getAllByRole('button', { name: /Run match/ })[0]);

    const ring = await screen.findByRole('img', { name: /Job match score: \d+ out of 100/ });
    const shown = Number(/score: (\d+)/.exec(ring.getAttribute('aria-label'))[1]);

    const stored = JSON.parse(window.localStorage.getItem('radix-tm:results'));
    expect(stored).toHaveLength(1);
    expect(stored[0].match_score).toBe(shown);
    expect(computeScore(stored[0].skill_results)).toBe(shown);
    const tile = (label) => Number(screen.getByText(label, { selector: '.count-tile__label' }).previousSibling.textContent);
    expect(tile('Matched')).toBe(stored[0].matched_skills.length);
    expect(tile('Partial')).toBe(stored[0].partial_skills.length);
    expect(tile('Missing')).toBe(stored[0].missing_skills.length);
  });
});

describe('empty and error states', () => {
  it('shows the results empty state when nothing has been run', async () => {
    renderApp('/results');
    expect(await screen.findByText('No assessments yet')).toBeInTheDocument();
  });

  it('shows the talent check setup state when the official requirements file is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    renderApp('/talent-check');
    expect(await screen.findByText(/talent_check_company_skillsets.json is not loaded/)).toBeInTheDocument();
  });

  it('surfaces API failures in API mode instead of falling back to demo data', async () => {
    setDataMode('api');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/results');
    expect(await screen.findByText('Could not load results')).toBeInTheDocument();
    expect(screen.getAllByText(/Cannot reach the backend/).length).toBeGreaterThan(0);
  });
});
