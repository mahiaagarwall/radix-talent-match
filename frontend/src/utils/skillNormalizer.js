// Skill-name normalization shared by JD Analytics (dedup) and Skill Matching.
// Deterministic and explainable: lowercase, strip qualifiers, then map known
// aliases onto a canonical name. Unknown names fall through unchanged.

const DEPTH_QUALIFIER = /\b(basic|basics|fundamentals?|foundational|exposure|beginner|introductory|intro)\b/i;

// canonical -> aliases (all lowercase, already passed through cleanName)
const ALIAS_GROUPS = {
  programming: ['coding', 'programming fundamentals', 'hands-on programming', 'software development'],
  'data structures and algorithms': ['dsa', 'data structures', 'algorithms', 'data structures algorithms'],
  'object-oriented design': [
    'ood',
    'oop',
    'oops',
    'object oriented design',
    'object-oriented programming',
    'object oriented programming',
    'design patterns',
    'solid principles',
  ],
  'quantitative aptitude': ['aptitude', 'quantitative reasoning', 'logical reasoning', 'analytical reasoning'],
  communication: [
    'communication skills',
    'stakeholder communication',
    'written communication',
    'verbal communication',
    'presentation skills',
  ],
  'machine learning': ['ml', 'scikit-learn', 'sklearn', 'predictive modeling', 'predictive modelling'],
  'cloud infrastructure': ['cloud', 'cloud computing', 'azure', 'aws', 'gcp', 'google cloud'],
  sql: ['mysql', 'postgresql', 'sql queries', 'structured query language'],
  'database schema design': ['schema design', 'data modeling', 'data modelling', 'database design'],
  'software engineering practices': [
    'software engineering',
    'software engineering fundamentals',
    'testing',
    'unit testing',
    'code review',
    'ci/cd',
    'sdlc',
    'agile',
  ],
  'system design': ['distributed systems', 'scalable systems', 'systems design'],
  networking: ['computer networks', 'computer networking', 'networks', 'networking concepts'],
  'operating systems': ['os', 'operating system'],
  linux: ['linux command line', 'unix'],
  'data visualization': ['power bi', 'tableau', 'dashboards', 'bi tools', 'data visualisation'],
  'a/b testing': ['ab testing', 'experimentation', 'experiment design'],
  'technical troubleshooting': ['troubleshooting', 'incident management', 'application support'],
  'ticketing / incident tools': ['ticketing tools', 'ticketing', 'incident tools', 'ticketing systems'],
  'c++': ['cpp'],
  'open-source contribution': ['open source', 'open-source', 'open source contributions'],
};

const ALIAS_LOOKUP = (() => {
  const map = new Map();
  for (const [canonical, aliases] of Object.entries(ALIAS_GROUPS)) {
    map.set(canonical, canonical);
    aliases.forEach((a) => map.set(a, canonical));
  }
  return map;
})();

// Canonical names that describe a broad competency rather than a specific
// technology. A candidate satisfies these with any well-evidenced skill in the
// named RADIX category (e.g. "Programming" is satisfied by C++ or Java).
export const GENERIC_COMPETENCIES = {
  programming: 'COD',
  communication: 'COMM',
  'quantitative aptitude': 'APTI',
};

function cleanName(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical qualifiers e.g. "SQL (basic)"
    .replace(DEPTH_QUALIFIER, ' ')
    .replace(/\b(strong|practical|working knowledge of|knowledge of|experience with)\b|\bsolid\b(?!\s*principles)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#/\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalSkillName(raw) {
  const cleaned = cleanName(raw);
  return ALIAS_LOOKUP.get(cleaned) ?? cleaned;
}

export function hasDepthQualifier(raw) {
  return DEPTH_QUALIFIER.test(String(raw || ''));
}

export function isGenericCompetency(raw) {
  return Object.prototype.hasOwnProperty.call(GENERIC_COMPETENCIES, canonicalSkillName(raw));
}

// Merge duplicate skills (same canonical name). Keeps the first occurrence's
// name/category and the strongest confidence; evidence strings are joined.
const RANK = { high: 3, medium: 2, low: 1 };

export function dedupeSkills(skills) {
  const out = [];
  const index = new Map();
  for (const skill of skills || []) {
    const key = canonicalSkillName(skill.skill_name);
    if (!key) continue;
    if (!index.has(key)) {
      index.set(key, out.length);
      out.push({ ...skill });
      continue;
    }
    const existing = out[index.get(key)];
    if ((RANK[skill.confidence] || 0) > (RANK[existing.confidence] || 0)) {
      existing.confidence = skill.confidence;
    }
    if (skill.evidence && !String(existing.evidence || '').includes(skill.evidence)) {
      existing.evidence = existing.evidence ? `${existing.evidence}; ${skill.evidence}` : skill.evidence;
    }
    if (skill.requirement === 'required') existing.requirement = 'required';
  }
  return out;
}
