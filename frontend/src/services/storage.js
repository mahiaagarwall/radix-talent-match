// Thin, failure-tolerant wrapper over localStorage. This is the ONLY place the
// demo persistence adapter touches browser storage, so it can be swapped for API
// persistence without changing callers.

const PREFIX = 'radix-tm:';

function store() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readJson(key, fallback) {
  const s = store();
  if (!s) return fallback;
  try {
    const raw = s.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  const s = store();
  if (!s) throw new Error('Browser storage is unavailable, so demo data cannot be saved.');
  try {
    s.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    throw new Error(`Could not write to browser storage: ${err.message}`);
  }
}

export function removeKey(key) {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function clearAll() {
  const s = store();
  if (!s) return;
  try {
    Object.keys(s)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => s.removeItem(k));
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  profiles: 'profiles',
  jds: 'jds',
  results: 'results',
  companies: 'company-requirements',
  mode: 'data-mode',
  scoring: 'scoring-settings',
  activeProfile: 'active-profile-id',
  activeJd: 'active-jd-id',
  resumeDraft: 'resume-draft',
  sidebar: 'sidebar-collapsed',
};
