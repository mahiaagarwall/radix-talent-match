// Central runtime configuration. Every URL and mode decision flows from here so
// the UI never hardcodes backend locations.

const env = import.meta.env ?? {};

export const API_BASE_URL = (env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const API_TIMEOUT_MS = Number(env.VITE_API_TIMEOUT_MS) || 20000;
export const DEFAULT_DATA_MODE = env.VITE_DATA_MODE === 'api' ? 'api' : 'demo';

// Endpoint paths. The first seven come from the team guide's recommended API
// contract; the rest are proposed additions documented in docs/api-contract.md.
export const ENDPOINTS = {
  analyzeJd: '/api/jd/analyze',
  parseResume: '/api/resumes/parse',
  profiles: '/api/profiles',
  profile: (id) => `/api/profiles/${encodeURIComponent(id)}`,
  talentCheck: '/api/talent-check',
  talentCheckCompare: '/api/talent-check/compare',
  skillMatch: '/api/skill-match',
  // Proposed additions (not in the guide yet):
  jds: '/api/jd',
  jd: (id) => `/api/jd/${encodeURIComponent(id)}`,
  companies: '/api/companies',
  results: '/api/results',
  result: (id) => `/api/results/${encodeURIComponent(id)}`,
  health: '/api/health',
  careerCopilotJobs: '/api/career-copilot/jobs/recommend',
  careerCopilotAvailableJobs: '/api/career-copilot/jobs/available',
  careerCopilotResumeCoach: '/api/career-copilot/resume-coach/improve',
};

export const REQUIREMENTS_FILE_PATH = '/data/talent_check_company_skillsets.json';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
