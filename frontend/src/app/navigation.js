import {
  Building2,
  LayoutDashboard,
  FileSearch,
  UserRoundPen,
  BriefcaseBusiness,
  Gauge,
  GitCompareArrows,
  ClipboardList,
  Settings,
} from 'lucide-react';

// Workflow order follows the participant brief:
// Pick a JD › Parse a resume › Build/update profile › Talent Check › Skill Matching
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/company-directory', label: 'Company Directory', icon: Building2 },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { to: '/jd-analytics', label: 'JD Analytics', icon: BriefcaseBusiness, step: 1 },
      { to: '/resume-parsing', label: 'Resume Parsing', icon: FileSearch, step: 2 },
      { to: '/profile-builder', label: 'Profile Builder', icon: UserRoundPen, step: 3 },
      { to: '/talent-check', label: 'Talent Check', icon: Gauge, step: 4 },
      { to: '/skill-matching', label: 'Skill Matching', icon: GitCompareArrows, step: 5 },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/results', label: 'Results', icon: ClipboardList },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// More specific paths first: titleForPath returns the first match.
const TITLES = [
  ['/company-directory/company/intelligence', 'Company Intelligence'],
  ['/company-directory/company/skills', 'Skill Intelligence'],
  ['/company-directory', 'Company Directory'],
  ['/resume-parsing', 'Resume Parsing'],
  ['/profile-builder', 'Profile Builder'],
  ['/jd-analytics', 'JD Analytics'],
  ['/talent-check', 'Talent Check'],
  ['/skill-matching', 'Skill Matching'],
  ['/results', 'Results'],
  ['/settings', 'Settings'],
];

export function titleForPath(pathname) {
  if (pathname === '/') return 'Dashboard';
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? hit[1] : 'Not found';
}

export function sectionForPath(pathname) {
  const hit = TITLES.find(([p]) => pathname.startsWith(`${p}/`));
  return hit ? { to: hit[0], label: hit[1] } : null;
}

// Breadcrumb label for the current page under a section: the page's own title when it has one
// (e.g. "Skill Intelligence"), otherwise "Details" (e.g. /profile-builder/:id).
export function detailLabelForPath(pathname) {
  const section = sectionForPath(pathname);
  if (!section) return titleForPath(pathname);
  const own = TITLES.find(([p]) => pathname === p);
  return own ? own[1] : 'Details';
}
