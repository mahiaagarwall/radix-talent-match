import { getDataMode } from './mode';
import { profileService, profileFromParsedResume } from './profileService';
import { jdService } from './jdService';
import { RESUME_FIXTURES, JD_FIXTURES, sampleProfileId } from '../data/fixtures';
import { nowIso } from '../utils/format';
import { clearAll } from './storage';

// Loads the hand-annotated sample pack (4 candidates, 6 JDs) into demo storage.
// Idempotent: stable sample IDs mean re-loading updates instead of duplicating.
export function loadSampleWorkspace() {
  if (getDataMode() !== 'demo') throw new Error('The sample workspace is only available in demo mode.');
  const now = nowIso();
  RESUME_FIXTURES.forEach((f) => {
    const draft = profileFromParsedResume(f.parsed, {
      file_name: f.source_files[0],
      file_type: 'pdf',
      file_size: null,
      storage_path: `data/resumes/pdf/${f.source_files[0]}`,
      source: 'sample-pack',
    });
    profileService.upsertLocal({ ...draft, profile_id: sampleProfileId(f.key), created_at: now, updated_at: now });
  });
  JD_FIXTURES.forEach((f) => jdService.upsertLocalSample(f.key));
  return { profiles: RESUME_FIXTURES.length, jds: JD_FIXTURES.length };
}

export function resetDemoData() {
  clearAll();
}
