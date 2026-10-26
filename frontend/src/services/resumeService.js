import { ENDPOINTS } from '../app/config';
import { apiClient, ApiError } from './apiClient';
import { getDataMode } from './mode';
import { tick } from './localRepository';
import { validateDocumentFile, fileMeta } from '../utils/fileValidation';
import { RESUME_FIXTURES, FIXTURE_NOTICE, findResumeFixtureByFile } from '../data/fixtures';

function cloneParsed(parsed) {
  return JSON.parse(JSON.stringify(parsed));
}

// Normalizes the backend parse response into the shape the UI expects.
export function normalizeParsedResume(raw) {
  const body = raw?.parsed || raw?.candidate ? { ...raw, ...(raw.candidate || {}), ...(raw.parsed || {}) } : raw;
  return {
    source_type: 'resume',
    name: body?.name || '',
    email: body?.email || null,
    headline: body?.headline || body?.summary || '',
    education: typeof body?.education === 'string' ? [{ degree: body.education }] : body?.education || [],
    skills: body?.skills || [],
    projects: body?.projects || [],
    internships: body?.internships || body?.experience || [],
    hackathons: body?.hackathons || [],
    certifications: (body?.certifications || []).map((c) => (typeof c === 'string' ? { name: c, issuer: '' } : c)),
    achievements: body?.achievements || [],
    preferred_roles: body?.preferred_roles || [],
    source_file: body?.source_file || null,
  };
}

export const resumeService = {
  /**
   * Parse an uploaded resume.
   * Resolves to { parsed, origin: 'api' | 'fixture', notice, resumeReference }.
   */
  async parse(file, { signal } = {}) {
    const check = await validateDocumentFile(file);
    if (!check.ok) throw new ApiError(check.message, { code: check.code });
    const meta = fileMeta(file);

    if (getDataMode() === 'api') {
      const form = new FormData();
      form.append('file', file);
      const body = await apiClient.upload(ENDPOINTS.parseResume, form, { signal });
      return {
        parsed: normalizeParsedResume(body),
        origin: 'api',
        notice: null,
        resumeReference: { ...meta, storage_path: body?.resume_reference || body?.storage_path || null, source: 'upload' },
      };
    }

    await tick(700); // keeps the processing state visible; no parsing happens in the browser
    const fixture = findResumeFixtureByFile(file.name);
    if (!fixture) {
      throw new ApiError(
        `Demo mode cannot extract data from "${file.name}". Resume parsing runs on the FastAPI backend; only the four supplied sample resumes have demo fixtures.`,
        { code: 'demo_unavailable', details: meta },
      );
    }
    return {
      parsed: cloneParsed(fixture.parsed),
      origin: 'fixture',
      notice: FIXTURE_NOTICE,
      resumeReference: { ...meta, storage_path: null, source: 'upload (demo — not stored remotely)' },
    };
  },

  async loadSample(key) {
    const fixture = RESUME_FIXTURES.find((f) => f.key === key);
    if (!fixture) throw new ApiError(`Unknown sample resume "${key}".`, { code: 'not_found' });
    await tick(300);
    return {
      parsed: cloneParsed(fixture.parsed),
      origin: 'fixture',
      notice: FIXTURE_NOTICE,
      resumeReference: {
        file_name: fixture.source_files[0],
        file_type: 'pdf',
        file_size: null,
        storage_path: `data/resumes/pdf/${fixture.source_files[0]}`,
        source: 'sample-pack',
      },
    };
  },

  sampleList() {
    return RESUME_FIXTURES.map((f) => ({ key: f.key, name: f.parsed.name, headline: f.parsed.headline }));
  },
};
