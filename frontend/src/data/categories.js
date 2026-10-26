// RADIX skill categories, as defined in the participant brief (p. 9) and team guide.
// The twelve scored skillsets plus OTHER for anything outside them.

export const RADIX_CATEGORIES = [
  { code: 'COD', name: 'Coding' },
  { code: 'DSA', name: 'Data Structures & Algorithms' },
  { code: 'OOD', name: 'Object-Oriented Design' },
  { code: 'APTI', name: 'Aptitude' },
  { code: 'COMM', name: 'Communication' },
  { code: 'AI', name: 'Artificial Intelligence' },
  { code: 'CLOUD', name: 'Cloud' },
  { code: 'SQL', name: 'SQL' },
  { code: 'SWE', name: 'Software Engineering' },
  { code: 'SYSD', name: 'System Design' },
  { code: 'NETW', name: 'Networking' },
  { code: 'OS', name: 'Operating Systems' },
];

export const OTHER_CATEGORY = { code: 'OTHER', name: 'Other skills' };

export const ALL_CATEGORIES = [...RADIX_CATEGORIES, OTHER_CATEGORY];
export const CATEGORY_CODES = ALL_CATEGORIES.map((c) => c.code);
export const SCORED_CATEGORY_CODES = RADIX_CATEGORIES.map((c) => c.code);

const byCode = Object.fromEntries(ALL_CATEGORIES.map((c) => [c.code, c]));

export function categoryName(code) {
  return byCode[code]?.name ?? 'Unknown category';
}

export function isValidCategory(code) {
  return Object.prototype.hasOwnProperty.call(byCode, code);
}

// Extraction confidence: how sure the extractor is that the evidence supports the
// skill. It is NOT a proficiency level.
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'];

export function isValidConfidence(value) {
  return CONFIDENCE_LEVELS.includes(value);
}

export const REQUIREMENT_TYPES = ['required', 'preferred'];
