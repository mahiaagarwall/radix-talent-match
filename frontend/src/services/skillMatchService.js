import { ENDPOINTS } from '../app/config';
import { apiClient } from './apiClient';
import { getDataMode } from './mode';
import { tick } from './localRepository';
import { profileService } from './profileService';
import { jdService } from './jdService';
import { resultsService, normalizeResult } from './resultsService';
import { getScoringSettings } from './settingsService';
import { runSkillMatch } from '../utils/skillMatcher';

export const skillMatchService = {
  async run({ profileId, jdId }) {
    if (getDataMode() === 'api') {
      const body = await apiClient.post(ENDPOINTS.skillMatch, { profile_id: profileId, jd_id: jdId });
      return normalizeResult({ type: 'skill_match', ...body });
    }
    const [profile, jd] = await Promise.all([profileService.get(profileId), jdService.get(jdId)]);
    await tick(400);
    const result = runSkillMatch(profile, jd, getScoringSettings());
    return resultsService.saveLocal(result);
  },
};
