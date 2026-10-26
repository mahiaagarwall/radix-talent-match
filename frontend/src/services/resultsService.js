import { ENDPOINTS } from '../app/config';
import { apiClient, ApiError } from './apiClient';
import { getDataMode } from './mode';
import { createLocalCollection, tick } from './localRepository';
import { KEYS } from './storage';
import { generateId, nowIso } from '../utils/format';

const local = createLocalCollection(KEYS.results, 'result_id');

export function normalizeResult(raw) {
  if (!raw) return null;
  const type = raw.type || (raw.readiness_score !== undefined ? 'talent_check' : 'skill_match');
  return { ...raw, type, result_id: raw.result_id ?? raw.id };
}

export const resultsService = {
  async list() {
    if (getDataMode() === 'api') {
      const body = await apiClient.get(ENDPOINTS.results);
      const items = Array.isArray(body) ? body : body?.items || body?.results || [];
      return items.map(normalizeResult);
    }
    await tick();
    return local.list();
  },

  async get(resultId) {
    if (getDataMode() === 'api') return normalizeResult(await apiClient.get(ENDPOINTS.result(resultId)));
    await tick();
    const found = local.get(resultId);
    if (!found) throw new ApiError(`Result "${resultId}" was not found.`, { status: 404, code: 'not_found' });
    return found;
  },

  // Demo only: persist a locally computed result.
  saveLocal(result) {
    const now = nowIso();
    return local.upsert({
      ...result,
      result_id: generateId(result.type === 'talent_check' ? 'tc' : 'sm'),
      status: 'completed',
      mode: 'demo',
      created_at: now,
      updated_at: now,
    });
  },
};
