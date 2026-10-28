import { ENDPOINTS } from '../app/config';
import { apiClient, ApiError } from './apiClient';
import { getDataMode } from './mode';
import { createLocalCollection, tick } from './localRepository';
import { KEYS } from './storage';
import { generateId, nowIso } from '../utils/format';
import { validateDocumentFile, fileMeta } from '../utils/fileValidation';
import { validateJd } from '../utils/validation';
import { dedupeSkills } from '../utils/skillNormalizer';
import { scanJobDescriptionText } from '../utils/jdKeywordScan';
import { JD_FIXTURES, FIXTURE_NOTICE, findJdFixtureByFile, sampleJdId } from '../data/fixtures';

const local = createLocalCollection(KEYS.jds, 'jd_id');

export function emptyJd() {
  return {
    jd_id: null,
    company: '',
    role: '',
    role_category: '',
    location: '',
    employment_type: '',
    source_type: 'jd',
    source_file: null,
    source_kind: 'manual',
    experience_requirements: '',
    education_requirements: '',
    skills: [],
  };
}

// Accepts the brief's extracted-skill-list shape ({source_type, source_file,
// company, role, skills}) plus an optional jd_id.
export function normalizeJd(raw) {
  if (!raw) return null;
  return {
    ...emptyJd(),
    ...raw,
    jd_id: raw.jd_id ?? raw.id ?? null,
    source_kind: raw.source_kind || 'api',
    skills: dedupeSkills(raw.skills || []),
  };
}

function fixtureDraft(fixture, sourceFile) {
  return {
    ...emptyJd(),
    ...JSON.parse(JSON.stringify(fixture.jd)),
    source_file: sourceFile,
    source_kind: 'sample-fixture',
  };
}

export const jdService = {
  async list() {
    if (getDataMode() === 'api') {
      const body = await apiClient.get(ENDPOINTS.jds);
      const items = Array.isArray(body) ? body : body?.items || body?.job_descriptions || [];
      return items.map(normalizeJd);
    }
    await tick();
    return local.list();
  },

  async get(jdId) {
    if (getDataMode() === 'api') return normalizeJd(await apiClient.get(ENDPOINTS.jd(jdId)));
    await tick();
    const found = local.get(jdId);
    if (!found) throw new ApiError(`Job description "${jdId}" was not found in local demo storage.`, { status: 404, code: 'not_found' });
    return found;
  },

  /** Analyze a PDF/DOCX file. Resolves to { draft, origin, notice } — not yet saved. */
  async analyzeFile(file, { company = '', role = '', signal } = {}) {
    const check = await validateDocumentFile(file);
    if (!check.ok) throw new ApiError(check.message, { code: check.code });

    if (getDataMode() === 'api') {
      const form = new FormData();
      form.append('file', file);
      if (company) form.append('company', company);
      if (role) form.append('role', role);
      try {
        const body = await apiClient.upload(ENDPOINTS.analyzeJd, form, { signal });
        return { draft: normalizeJd({ ...body, source_file: body?.source_file || file.name }), origin: 'api', notice: null };
      } catch (err) {
        if (err?.status === 503) {
          const fixture = findJdFixtureByFile(file.name);
          if (fixture) {
            const draft = fixtureDraft(fixture, file.name);
            if (company) draft.company = company;
            if (role) draft.role = role;
            return {
              draft,
              origin: 'fixture',
              notice: `LLM service returned 503. Loaded verified sample fixture for "${file.name}". To enable live AI extraction, set GROQ_API_KEY in backend/.env.`,
            };
          }
        }
        throw err;
      }
    }

    await tick(700);
    const fixture = findJdFixtureByFile(file.name);
    if (!fixture) {
      throw new ApiError(
        `Demo mode cannot extract skills from "${file.name}". JD analysis runs on the FastAPI backend; only the six supplied sample JDs have demo fixtures. You can paste the JD text instead.`,
        { code: 'demo_unavailable', details: fileMeta(file) },
      );
    }
    const draft = fixtureDraft(fixture, file.name);
    if (company) draft.company = company;
    if (role) draft.role = role;
    return { draft, origin: 'fixture', notice: FIXTURE_NOTICE };
  },

  /** Analyze pasted text. In demo mode this is a labelled keyword scan. */
  async analyzeText({ text, company, role, signal }) {
    if (!String(text || '').trim()) throw new ApiError('Paste job description text or upload a file.', { code: 'validation' });
    if (getDataMode() === 'api') {
      try {
        const body = await apiClient.post(ENDPOINTS.analyzeJd, { text, company, role }, { signal });
        return { draft: normalizeJd({ ...body, company: body?.company || company, role: body?.role || role }), origin: 'api', notice: null };
      } catch (err) {
        if (err?.status === 503) {
          const skills = scanJobDescriptionText(text);
          if (skills.length) {
            return {
              draft: { ...emptyJd(), company, role, source_file: 'Pasted text', source_kind: 'keyword-scan', raw_text: text, skills },
              origin: 'keyword-scan',
              notice: `LLM service is offline (503). Extracted ${skills.length} skills using keyword scan. To enable live AI extraction, set GROQ_API_KEY in backend/.env.`,
            };
          }
        }
        throw err;
      }
    }
    await tick(500);
    const skills = scanJobDescriptionText(text);
    if (!skills.length) {
      throw new ApiError('The demo keyword scan found no recognisable skills. Add requirements manually or connect the backend.', {
        code: 'no_skills',
      });
    }
    return {
      draft: { ...emptyJd(), company, role, source_file: 'Pasted text', source_kind: 'keyword-scan', raw_text: text, skills },
      origin: 'keyword-scan',
      notice:
        'Demo keyword scan: skills were matched against a fixed keyword list. Evidence is the sentence each term appears in; every skill is marked low confidence. Review before saving.',
    };
  },

  loadSampleDraft(key) {
    const fixture = JD_FIXTURES.find((f) => f.key === key);
    if (!fixture) throw new ApiError(`Unknown sample JD "${key}".`, { code: 'not_found' });
    return { draft: fixtureDraft(fixture, fixture.source_files[0]), origin: 'fixture', notice: FIXTURE_NOTICE };
  },

  sampleList() {
    return JD_FIXTURES.map((f) => ({ key: f.key, company: f.jd.company, role: f.jd.role }));
  },

  async save(draft) {
    const jd = { ...draft, skills: dedupeSkills(draft.skills) };
    const { valid, errors } = validateJd(jd);
    if (!valid) throw new ApiError('Fix the highlighted fields before saving.', { code: 'validation', details: errors });

    if (getDataMode() === 'api') {
      const payload = { ...jd };
      delete payload.created_at;
      delete payload.updated_at;
      const body = jd.jd_id
        ? await apiClient.patch(ENDPOINTS.jd(jd.jd_id), payload)
        : await apiClient.post(ENDPOINTS.jds, payload);
      return normalizeJd(body);
    }
    await tick(150);
    const now = nowIso();
    const existing = jd.jd_id ? local.get(jd.jd_id) : null;
    return local.upsert({
      ...jd,
      jd_id: jd.jd_id || generateId('jd'),
      created_at: existing?.created_at || now,
      updated_at: now,
    });
  },

  async remove(jdId) {
    if (getDataMode() === 'api') {
      throw new ApiError('Deleting job descriptions is not part of the agreed API contract yet.', { code: 'unsupported' });
    }
    await tick();
    local.remove(jdId);
  },

  upsertLocalSample(key) {
    const fixture = JD_FIXTURES.find((f) => f.key === key);
    const now = nowIso();
    const existing = local.get(sampleJdId(key));
    return local.upsert({
      ...fixtureDraft(fixture, fixture.source_files[0]),
      jd_id: sampleJdId(key),
      created_at: existing?.created_at || now,
      updated_at: now,
    });
  },
};
