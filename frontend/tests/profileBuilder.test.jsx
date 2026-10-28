import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderApp';
import { profileService, profileFromParsedResume } from '../src/services/profileService';
import { setDataMode } from '../src/services/mode';
import { apiClient } from '../src/services/apiClient';
import { writeJson, KEYS } from '../src/services/storage';

describe('Profile Builder Integration', () => {
  beforeEach(() => {
    setDataMode('demo');
    window.localStorage.clear();
  });

  it('prefills the form from parsed resume draft and preserves all sections', async () => {
    const user = userEvent.setup();
    const parsedData = {
      name: 'Priya Menon',
      email: 'priya@example.com',
      education: [{ degree: 'B.Tech', field: 'Information Technology', institution: 'IIT Madras', graduation_year: '2025' }],
      skills: [
        { skill_name: 'React', category_code: 'SWE', evidence: 'Developed dashboard in React', confidence: 'high' },
        { skill_name: 'Python', category_code: 'COD', evidence: 'REST APIs with FastAPI', confidence: 'medium' },
      ],
      projects: [{ title: 'Cloud Portal', description: 'Self-service cloud provisioning' }],
      internships: [{ role: 'DevOps Intern', organization: 'CloudCorp', description: 'Automated CI/CD pipelines' }],
      hackathons: [{ name: 'HackTech 2024', result: '1st Place', description: 'Built automated code reviewer' }],
      certifications: [{ name: 'AWS Solutions Architect', issuer: 'Amazon Web Services' }],
      preferred_roles: ['DevOps Engineer', 'Cloud Architect'],
    };

    const draft = {
      profile: profileFromParsedResume(parsedData, { file_name: 'Priya Menon.pdf', source: 'upload' }),
      origin: 'fixture',
      notice: 'Extracted from resume',
    };
    writeJson(KEYS.resumeDraft, draft);

    renderApp('/profile-builder');

    // Confirm pre-filled basic information
    const nameInput = await screen.findByLabelText(/Full name/);
    expect(nameInput).toHaveValue('Priya Menon');
    expect(screen.getByLabelText(/^Email/)).toHaveValue('priya@example.com');

    // Confirm resume reference is shown
    expect(screen.getByText(/Priya Menon\.pdf/)).toBeInTheDocument();

    // Confirm prefilled skills and origin badges
    expect(screen.getByLabelText('Skill name for row 1')).toHaveValue('React');
    expect(screen.getByLabelText('Skill name for row 2')).toHaveValue('Python');
    const extractedBadges = screen.getAllByText('Extracted');
    expect(extractedBadges.length).toBeGreaterThanOrEqual(2);

    // Edit a value (e.g., name and skill name)
    await user.clear(nameInput);
    await user.type(nameInput, 'Priya M.');

    // Save profile
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);

    // Verify confirmation and saved profile
    expect(await screen.findByText(/Profile saved to local demo storage/)).toBeInTheDocument();
    const profiles = await profileService.list();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Priya M.');
    expect(profiles[0].email).toBe('priya@example.com');
    expect(profiles[0].skills).toHaveLength(2);
    expect(profiles[0].projects).toHaveLength(1);
    expect(profiles[0].internships).toHaveLength(1);
    expect(profiles[0].hackathons).toHaveLength(1);
    expect(profiles[0].certifications).toHaveLength(1);
    expect(profiles[0].preferred_roles).toEqual(['DevOps Engineer', 'Cloud Architect']);
  });

  it('interacts correctly in API mode and surfaces API errors without demo fallback', async () => {
    setDataMode('api');
    const user = userEvent.setup();

    // Mock API error on create
    vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Internal Database Error in Supabase'));

    renderApp('/profile-builder');
    const nameInput = await screen.findByLabelText(/Full name/);
    await user.type(nameInput, 'Karthik Subramaniam');
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);

    // Error must be displayed on screen
    expect(await screen.findByText('Internal Database Error in Supabase')).toBeInTheDocument();

    // Check that nothing was saved into local demo storage
    const rawDemo = window.localStorage.getItem(KEYS.profiles);
    expect(rawDemo).toBeNull();
  });

  it('saves and updates profile through API mode with stable ID', async () => {
    setDataMode('api');
    const user = userEvent.setup();

    const mockSaved = {
      profile_id: 'prf_api_test_456',
      name: 'Rohan Verma',
      email: 'rohan@example.com',
      education: [],
      skills: [{ skill_name: 'Java', category_code: 'COD', evidence: 'Spring Boot', confidence: 'high' }],
      projects: [],
      internships: [],
      hackathons: [],
      certifications: [],
      preferred_roles: ['Software Engineer'],
      resume_reference: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockSaved);
    vi.spyOn(apiClient, 'get').mockResolvedValue([mockSaved]);

    renderApp('/profile-builder');
    const nameInput = await screen.findByLabelText(/Full name/);
    await user.type(nameInput, 'Rohan Verma');
    await user.click(screen.getAllByRole('button', { name: /Save profile/ })[0]);

    expect(await screen.findByText(/Profile saved to the FastAPI backend/)).toBeInTheDocument();
    expect(screen.getAllByText(/prf_api_test_456/).length).toBeGreaterThanOrEqual(1);
    expect(postSpy).toHaveBeenCalled();
  });
});
