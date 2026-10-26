import { ENDPOINTS, REQUIREMENTS_FILE_PATH } from '../app/config';
import { apiClient, ApiError } from './apiClient';
import { getDataMode } from './mode';
import { tick } from './localRepository';
import { readJson, writeJson, removeKey, KEYS } from './storage';
import { profileService } from './profileService';
import { resultsService, normalizeResult } from './resultsService';
import { parseCompanyRequirements } from '../utils/companyRequirements';
import { runTalentCheck } from '../utils/readinessScorer';

async function fetchBundledFile() {
  let response;
  try {
    response = await fetch(REQUIREMENTS_FILE_PATH, { headers: { Accept: 'application/json' } });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const type = response.headers.get('content-type') || '';
  // Vite's dev server answers unknown paths with index.html — treat that as missing.
  if (!type.includes('json')) return null;
  try {
    return parseCompanyRequirements(await response.json(), REQUIREMENTS_FILE_PATH);
  } catch (err) {
    throw new ApiError(`${REQUIREMENTS_FILE_PATH} exists but could not be used: ${err.message}`, { code: 'invalid_requirements' });
  }
}

export const talentCheckService = {
  /**
   * Resolves to the normalized requirements set, or null when no official file
   * is available (the page then shows its setup state).
   */
  async loadRequirements() {
    if (getDataMode() === 'api') {
      const body = await apiClient.get(ENDPOINTS.companies);
      return parseCompanyRequirements(body, 'FastAPI /api/companies');
    }
    const imported = readJson(KEYS.companies, null);
    if (imported?.companies?.length) return imported;
    return fetchBundledFile();
  },

  async importRequirementsFile(file) {
    if (!file) throw new ApiError('Choose a JSON file.', { code: 'validation' });
    if (!/\.json$/i.test(file.name)) throw new ApiError(`"${file.name}" is not a .json file.`, { code: 'unsupported' });
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      throw new ApiError(`"${file.name}" is not valid JSON.`, { code: 'unreadable' });
    }
    const parsed = parseCompanyRequirements(json, file.name);
    writeJson(KEYS.companies, parsed);
    return parsed;
  },

  clearImportedRequirements() {
    removeKey(KEYS.companies);
  },

  async run({ profileId, company, requirements }) {
    if (getDataMode() === 'api') {
      const body = await apiClient.post(ENDPOINTS.talentCheck, { profile_id: profileId, company_id: company.company_id });
      return normalizeResult({ type: 'talent_check', ...body });
    }
    const profile = await profileService.get(profileId);
    await tick(400);
    const result = runTalentCheck(profile, company, {
      requirementsSource: requirements?.source,
      synthetic: Boolean(company.synthetic),
    });
    return resultsService.saveLocal(result);
  },
};
