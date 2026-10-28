import { describe, it, expect, vi } from 'vitest';
import { resumeService } from '../src/services/resumeService';
import { setDataMode } from '../src/services/mode';
import { ENDPOINTS } from '../src/app/config';

const pdf = (name = 'Jordan Lee.pdf') => new File(['%PDF-1.7 synthetic'], name, { type: 'application/pdf' });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Synthetic backend response in the docs/api-contract.md §3 shape.
const parsedBody = {
  source_type: 'resume',
  source_file: 'Jordan Lee.pdf',
  name: 'Jordan Lee',
  email: 'jordan.lee@example.com',
  headline: 'Backend-focused graduate',
  education: [{ degree: 'B.Tech', field: 'Computer Science', institution: '', graduation_year: '2025', grade: '' }],
  skills: [{ skill_name: 'Python', category_code: 'COD', evidence: 'Built a REST API in Python', confidence: 'high' }],
  projects: [],
  internships: [],
  hackathons: [],
  certifications: [],
  achievements: [],
  preferred_roles: [],
  resume_reference: '11111111-2222-3333-4444-555555555555',
  parser_mode: 'rules',
  warnings: [],
  persistence: { status: 'saved', message: 'Saved to Supabase (parsed_resumes).' },
};

describe('resume parsing in API mode', () => {
  it('uploads the file as multipart "file" and uses the backend response', async () => {
    setDataMode('api');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(parsedBody));

    const out = await resumeService.parse(pdf());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`${ENDPOINTS.parseResume}$`));
    expect(init.method).toBe('POST');
    expect(init.body.get('file').name).toBe('Jordan Lee.pdf');
    expect(out.origin).toBe('api');
    expect(out.parsed.name).toBe('Jordan Lee');
    expect(out.parsed.skills).toHaveLength(1);
    expect(out.resumeReference.storage_path).toBe(parsedBody.resume_reference);
    expect(out.resumeReference.source).toBe('upload (saved to Supabase)');
    expect(out.notice).toContain('Saved to Supabase');
  });

  it('does not fall back to a demo fixture for a sample-pack file name', async () => {
    setDataMode('api');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...parsedBody, name: 'Jordan Lee' }));
    const out = await resumeService.parse(pdf('Ananya Rao.pdf'));
    expect(out.origin).toBe('api');
    expect(out.parsed.name).toBe('Jordan Lee');
  });

  it('maps backend error codes to the page error types', async () => {
    setDataMode('api');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ detail: 'No selectable text was found in this PDF.', code: 'ocr_required' }, 422),
    );
    await expect(resumeService.parse(pdf())).rejects.toMatchObject({
      code: 'unreadable',
      status: 422,
      message: 'No selectable text was found in this PDF.',
    });
  });

  it('reports a failed database save and warnings in the notice', async () => {
    setDataMode('api');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({
        ...parsedBody,
        resume_reference: null,
        warnings: ['No email address was found in the resume.'],
        persistence: { status: 'failed', message: 'Could not connect to the database. The parsed data below was not saved.' },
      }),
    );
    const out = await resumeService.parse(pdf());
    expect(out.resumeReference.storage_path).toBeNull();
    expect(out.resumeReference.source).toBe('upload');
    expect(out.notice).toMatch(/not saved.*No email address/);
  });

  it('rejects an invalid file before anything is sent', async () => {
    setDataMode('api');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(resumeService.parse(new File(['hello'], 'notes.txt'))).rejects.toMatchObject({ code: 'unsupported' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('resume parsing in demo mode', () => {
  it('still uses the sample fixture and never calls the backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const out = await resumeService.parse(pdf('Ananya Rao.pdf'));
    expect(out.origin).toBe('fixture');
    expect(out.parsed.name).toBe('Ananya Rao');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
