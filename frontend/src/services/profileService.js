import { ENDPOINTS } from '../app/config';
import { apiClient, ApiError } from './apiClient';
import { getDataMode } from './mode';
import { createLocalCollection, tick } from './localRepository';
import { KEYS } from './storage';
import { generateId, nowIso } from '../utils/format';
import { validateProfile } from '../utils/validation';

const local = createLocalCollection(KEYS.profiles, 'profile_id');

export function emptyProfile() {
  return {
    profile_id: null,
    name: '',
    email: '',
    education: [],
    skills: [],
    projects: [],
    internships: [],
    hackathons: [],
    certifications: [],
    preferred_roles: [],
    resume_reference: null,
  };
}

// Accepts backend variations (brief uses `cv_file` and a string `education`).
export function normalizeProfile(raw) {
  if (!raw) return null;
  const education =
    typeof raw.education === 'string'
      ? raw.education
        ? [{ degree: raw.education, field: '', institution: '', graduation_year: '', grade: '' }]
        : []
      : raw.education || [];
  let resume_reference = raw.resume_reference ?? null;
  if (!resume_reference && raw.cv_file) resume_reference = { file_name: raw.cv_file, source: 'api' };
  return {
    ...emptyProfile(),
    ...raw,
    education,
    resume_reference,
    skills: (raw.skills || []).map((s) => ({ ...s })),
  };
}

// `origin` is a frontend-only provenance marker (extracted / edited / manual).
// It is not part of the agreed contract, so it is stripped before sending.
export function toApiProfile(profile) {
  const { created_at: _c, updated_at: _u, ...rest } = profile;
  return {
    ...rest,
    skills: (profile.skills || []).map(({ origin: _o, ...s }) => s),
  };
}

export function profileFromParsedResume(parsed, resumeReference) {
  const mark = (items) => (items || []).map((x) => ({ ...x, origin: 'extracted' }));
  return {
    ...emptyProfile(),
    name: parsed.name || '',
    email: parsed.email || '',
    education: mark(parsed.education),
    skills: mark(parsed.skills),
    projects: mark(parsed.projects),
    internships: mark(parsed.internships),
    hackathons: mark(parsed.hackathons),
    certifications: mark(parsed.certifications),
    preferred_roles: [...(parsed.preferred_roles || [])],
    resume_reference: resumeReference || null,
  };
}

function assertValid(profile) {
  const { valid, errors } = validateProfile(profile);
  if (!valid) throw new ApiError('Fix the highlighted fields before saving.', { code: 'validation', details: errors });
}

export const profileService = {
  async list() {
    if (getDataMode() === 'api') {
      const body = await apiClient.get(ENDPOINTS.profiles);
      const items = Array.isArray(body) ? body : body?.profiles || body?.items || [];
      return items.map(normalizeProfile);
    }
    await tick();
    return local.list();
  },

  async get(profileId) {
    if (getDataMode() === 'api') {
      return normalizeProfile(await apiClient.get(ENDPOINTS.profile(profileId)));
    }
    await tick();
    const found = local.get(profileId);
    if (!found) throw new ApiError(`Profile "${profileId}" was not found in local demo storage.`, { status: 404, code: 'not_found' });
    return found;
  },

  async create(profile) {
    assertValid(profile);
    if (getDataMode() === 'api') {
      return normalizeProfile(await apiClient.post(ENDPOINTS.profiles, toApiProfile(profile)));
    }
    await tick(150);
    const now = nowIso();
    const saved = { ...profile, profile_id: profile.profile_id || generateId('prf'), created_at: now, updated_at: now };
    return local.upsert(saved);
  },

  async update(profileId, profile) {
    assertValid(profile);
    if (getDataMode() === 'api') {
      return normalizeProfile(await apiClient.patch(ENDPOINTS.profile(profileId), toApiProfile(profile)));
    }
    await tick(150);
    const existing = local.get(profileId);
    if (!existing) throw new ApiError(`Profile "${profileId}" no longer exists.`, { status: 404, code: 'not_found' });
    return local.upsert({ ...profile, profile_id: profileId, created_at: existing.created_at, updated_at: nowIso() });
  },

  async remove(profileId) {
    if (getDataMode() === 'api') {
      throw new ApiError('Deleting profiles is not part of the agreed API contract yet.', { code: 'unsupported' });
    }
    await tick();
    local.remove(profileId);
  },

  // Used by the sample workspace loader (demo only).
  upsertLocal(profile) {
    return local.upsert(profile);
  },
};
