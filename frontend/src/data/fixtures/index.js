import { RESUME_FIXTURES } from './resumes';
import { JD_FIXTURES } from './jobDescriptions';

export { RESUME_FIXTURES, JD_FIXTURES };

export const FIXTURE_NOTICE =
  'Demo fixture: hand-annotated from the supplied hackathon sample pack. This was not produced by a document parser.';

function baseName(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\(\d+\)$/, '') // browser duplicate suffix, e.g. "Ananya Rao (1).pdf"
    .trim()
    .toLowerCase();
}

// Only an exact sample-pack file name maps to a fixture. Any other upload is
// never silently replaced with sample data.
export function findResumeFixtureByFile(fileName) {
  const b = baseName(fileName);
  return RESUME_FIXTURES.find((f) => f.source_files.some((s) => baseName(s) === b)) || null;
}

export function findJdFixtureByFile(fileName) {
  const b = baseName(fileName);
  return JD_FIXTURES.find((f) => f.source_files.some((s) => baseName(s) === b)) || null;
}

export const sampleProfileId = (key) => `prf_sample_${key}`;
export const sampleJdId = (key) => `jd_sample_${key}`;
