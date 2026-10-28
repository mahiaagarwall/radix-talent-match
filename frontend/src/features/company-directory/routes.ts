// All Company Directory URLs live under one namespace so they never collide with host routes
// (the host's "/" is the Dashboard).
export const DIRECTORY_BASE = "/company-directory";

export const DIRECTORY_PATHS = {
  home: DIRECTORY_BASE,
  company: `${DIRECTORY_BASE}/company`,
  intelligence: `${DIRECTORY_BASE}/company/intelligence`,
  skills: `${DIRECTORY_BASE}/company/skills`,
} as const;
