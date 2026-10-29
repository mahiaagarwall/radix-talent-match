import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderApp';
import { setDataMode } from '../src/services/mode';
import { loadSampleWorkspace } from '../src/services/sampleWorkspace';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Routes fetch calls by path; anything unexpected fails the test loudly. */
function stubApi(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const handler = routes[path];
    if (!handler) throw new Error(`unexpected request to ${path}`);
    return typeof handler === 'function' ? handler(init) : json(handler);
  });
}

const talentCheck = (id, name, company, score, at) => ({
  result_id: id, type: 'talent_check', profile_id: `prf_${name}`, candidate_name: name,
  company_id: '4', company, readiness_score: score, skillset_gap: [], status: 'completed', created_at: at,
});

describe('Dashboard ← Talent Check (API mode)', () => {
  it('shows Talent Check results returned by /api/results', async () => {
    setDataMode('api');
    stubApi({
      '/api/profiles': [],
      '/api/jd': [],
      '/api/results': [
        talentCheck('tc-2', 'Karthik Subramaniam', 'Oracle Corporation', 71, '2026-10-02T10:00:00Z'),
        talentCheck('tc-1', 'Ananya Rao', 'Google LLC', 62, '2026-10-01T10:00:00Z'),
      ],
    });
    renderApp('/');

    expect(await screen.findByText('Talent Check: Ananya Rao vs Google LLC — 62/100')).toBeInTheDocument();
    expect(screen.getByText('Talent Check: Karthik Subramaniam vs Oracle Corporation — 71/100')).toBeInTheDocument();
    expect(screen.getByText('Talent Check · Google LLC')).toBeInTheDocument();
    const stat = screen.getByText('Talent Checks').closest('.stat-card, .card, div');
    expect(within(stat.parentElement).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2 run')).toBeInTheDocument(); // workflow step 4
  });

  it('shows an error with retry instead of zeros when results fail to load', async () => {
    setDataMode('api');
    stubApi({ '/api/profiles': [], '/api/jd': [], '/api/results': () => json({ detail: 'database offline' }, 500) });
    renderApp('/');
    expect(await screen.findByText('Could not load workspace data')).toBeInTheDocument();
    expect(screen.getByText('database offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.queryByText('Talent Checks')).not.toBeInTheDocument();
  });
});

const GAP_RESULT = {
  resume: { kind: 'text', label: 'Pasted resume text', characters: 400 },
  job: { kind: 'pasted', label: 'Pasted job description', characters: 300 },
  summary: 'Strong Python evidence; Docker is not shown.',
  requirements: [
    { requirement: 'Python', kind: 'technical_skill', importance: 'mandatory', jd_evidence: 'Python is required', classification: 'matched', resume_evidence: ['inventory API in Python'], resume_section: 'Projects', missing_information: '', gap_type: 'none', next_step: '', jd_evidence_verified: true, note: null },
    { requirement: 'Docker', kind: 'tool', importance: 'mandatory', jd_evidence: 'Docker is required', classification: 'missing', resume_evidence: [], resume_section: null, missing_information: 'A containerised project', gap_type: 'skill_gap', next_step: 'Containerise a project.', jd_evidence_verified: true, note: null },
    { requirement: 'Stakeholder communication', kind: 'soft_skill', importance: 'preferred', jd_evidence: 'communicate with stakeholders', classification: 'unverified', resume_evidence: [], resume_section: null, missing_information: '', gap_type: 'information_gap', next_step: '', jd_evidence_verified: true, note: null },
  ],
  counts: { matched: 1, partial: 0, missing: 1, unverified: 1, mandatory: 2, preferred: 1 },
  alignment: { score: 40, method: '100 × Σ(weight × credit) / Σ weight', explanation: '40/100 = 100 × 2 ÷ 5 over 3 requirements (2 mandatory).' },
  bullet_improvements: [
    { original_text: 'Worked on inventory API in Python', problem: 'Passive', recommendation: 'Lead with the verb', improved_example: 'Built an inventory API in Python.', alignment: 'Backend role', follow_up_question: 'How many endpoints?' },
  ],
  action_plan: [{ priority: 1, action: 'Build and describe a Dockerised project.', requirement: 'Docker' }],
  follow_up_questions: ['Did the API have tests?'],
  safeguards: { evidence_quotes_removed: 1, requirements_downgraded: 0, requirements_dropped: 0, suggestions_removed: 0, notes: ['1 quoted resume excerpt(s) were removed because they do not appear in the resume.'] },
  model_used: 'groq:test-model',
  disclaimer: 'Alignment is not a probability of being hired.',
};

const RESUME_TEXT = 'Asha Verma. Projects: Worked on inventory API in Python with PostgreSQL. '.repeat(4);
const JD_TEXT = 'Junior Backend Engineer. Python is required. Docker is required. Must communicate with stakeholders. '.repeat(3);

describe('Resume Coach — job gap analysis', () => {
  it('sends both inputs to the backend and shows classified results with accept/reject', async () => {
    setDataMode('demo');
    const user = userEvent.setup();
    const fetchSpy = stubApi({ '/api/career-copilot/resume-coach/gap-analysis': () => json(GAP_RESULT) });
    renderApp('/resume-coach');

    await user.click(await screen.findByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Resume text'), { target: { value: RESUME_TEXT } });
    fireEvent.change(screen.getByLabelText('Job description text'), { target: { value: JD_TEXT } });
    await user.click(screen.getByRole('button', { name: /Analyze resume against this job/ }));

    expect(await screen.findByText('Strong Python evidence; Docker is not shown.')).toBeInTheDocument();
    const form = fetchSpy.mock.calls[0][1].body;
    expect(form.get('resume_text')).toBe(RESUME_TEXT);
    expect(form.get('jd_text')).toBe(JD_TEXT);
    expect(form.get('resume_file')).toBeNull();

    expect(screen.getByRole('region', { name: 'Matched' })).toHaveTextContent('Python');
    expect(screen.getByRole('region', { name: 'Missing from resume' })).toHaveTextContent('Docker');
    expect(screen.getByRole('region', { name: 'Unverified' })).toHaveTextContent('Stakeholder communication');
    expect(screen.getByText(/Priority 1/)).toBeInTheDocument();
    expect(screen.getByText(/not a probability of being hired/)).toBeInTheDocument();
    expect(screen.getByText(/quoted resume excerpt/)).toBeInTheDocument();

    const improved = screen.getByLabelText('Improved example (editable)');
    fireEvent.change(improved, { target: { value: 'Built an inventory API in Python with PostgreSQL.' } });
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy 1 accepted/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy 1 accepted/ })).not.toBeInTheDocument();
  });

  it('uploads a TXT resume and loads a saved JD into the editable text box', async () => {
    setDataMode('demo');
    loadSampleWorkspace();
    const user = userEvent.setup();
    const fetchSpy = stubApi({ '/api/career-copilot/resume-coach/gap-analysis': () => json(GAP_RESULT) });
    renderApp('/resume-coach');

    const file = new File([RESUME_TEXT], 'resume.txt', { type: 'text/plain' });
    fireEvent.change(await screen.findByLabelText('Upload a resume'), { target: { files: [file] } });
    expect(screen.getByText('resume.txt')).toBeInTheDocument();

    const select = screen.getByLabelText(/Load a saved job description/);
    const option = within(select).getAllByRole('option')[1];
    await user.selectOptions(select, option.value);
    const jdBox = screen.getByLabelText('Job description text');
    expect(jdBox.value).toMatch(/^Role: /);
    expect(jdBox.value).toMatch(/Required skill: /);

    await user.click(screen.getByRole('button', { name: /Analyze resume against this job/ }));
    await screen.findByText('Strong Python evidence; Docker is not shown.');
    const form = fetchSpy.mock.calls[0][1].body;
    expect(form.get('resume_file').name).toBe('resume.txt');
    expect(form.get('resume_text')).toBeNull();
    expect(form.get('jd_text')).toBe(jdBox.value);
  });

  it('rejects unsupported files locally and shows backend errors with retry', async () => {
    setDataMode('demo');
    const user = userEvent.setup();
    const fetchSpy = stubApi({
      '/api/career-copilot/resume-coach/gap-analysis': () => json({ detail: 'The language model could not complete the analysis (rate_limited).', code: 'llm_failed' }, 502),
    });
    renderApp('/resume-coach');

    fireEvent.change(await screen.findByLabelText('Upload a resume'), { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });
    fireEvent.change(screen.getByLabelText('Job description text'), { target: { value: JD_TEXT } });
    await user.click(screen.getByRole('button', { name: /Analyze resume against this job/ }));
    expect(await screen.findByText(/"photo.png" is not supported/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Remove photo.png/ }));
    await user.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Resume text'), { target: { value: RESUME_TEXT } });
    await user.click(screen.getByRole('button', { name: /Analyze resume against this job/ }));
    expect(await screen.findByText('Gap analysis failed')).toBeInTheDocument();
    expect(screen.getByText(/rate_limited/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.queryByText(/Alignment with this job/)).not.toBeInTheDocument();
  });
});

describe('module-owner metadata', () => {
  const OWNERS = ['Krishna Khanna', 'Krishna Pandey', 'Akshat Mehra', 'Aashish Kumar', 'Mahi Aggarwal'];
  const PAGES = [
    ['/resume-parsing', 'Resume Parsing'],
    ['/profile-builder', null],
    ['/jd-analytics', 'JD Analytics'],
    ['/talent-check', 'Talent Check'],
    ['/skill-matching', 'Skill Matching'],
    ['/job-finder', 'Job Finder'],
    ['/resume-coach', 'Resume Coach'],
  ];

  it.each(PAGES)('%s shows no module-owner label or name', async (route, heading) => {
    setDataMode('demo');
    loadSampleWorkspace();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404, headers: { 'content-type': 'text/html' } }));
    renderApp(route);
    if (heading) await screen.findByRole('heading', { level: 1, name: heading });
    else await screen.findByRole('heading', { level: 1 });
    const text = document.body.textContent;
    expect(text).not.toMatch(/module owner/i);
    for (const name of OWNERS) expect(text).not.toContain(name);
  });
});
