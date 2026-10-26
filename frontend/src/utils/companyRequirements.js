// Parser for talent_check_company_skillsets.json.
//
// The official file was NOT in the hackathon starter pack, so its exact shape is
// unknown. This parser accepts the plausible shapes documented in
// docs/api-contract.md and rejects anything it cannot interpret — it never fills
// in levels that are not present in the file.

import { ALL_CATEGORIES, SCORED_CATEGORY_CODES } from '../data/categories';
import { slugify } from './format';

const NAME_TO_CODE = new Map();
ALL_CATEGORIES.forEach((c) => {
  NAME_TO_CODE.set(c.code.toLowerCase(), c.code);
  NAME_TO_CODE.set(c.name.toLowerCase(), c.code);
});
NAME_TO_CODE.set('ai', 'AI');
NAME_TO_CODE.set('data structures and algorithms', 'DSA');

function toCode(key) {
  return NAME_TO_CODE.get(String(key || '').trim().toLowerCase()) || null;
}

const LEVEL_KEYS = ['skillsets', 'skill_levels', 'requirements', 'expected_levels', 'levels', 'skills', 'skillset_levels'];

function readLevels(raw, warnings, companyLabel) {
  const levels = {};
  const put = (key, value) => {
    const code = toCode(key);
    if (!code) {
      warnings.push(`${companyLabel}: ignored unknown skillset "${key}".`);
      return;
    }
    const n = typeof value === 'object' && value !== null ? Number(value.required_level ?? value.level ?? value.expected_level) : Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      warnings.push(`${companyLabel}: ignored ${code} because its level "${JSON.stringify(value)}" is not a number from 0 to 10.`);
      return;
    }
    levels[code] = n;
  };
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === 'object') {
        put(item.category_code ?? item.code ?? item.skillset ?? item.category, item);
      }
    });
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([k, v]) => put(k, v));
  }
  return levels;
}

function normalizeCompany(obj, fallbackName, warnings, fileSynthetic) {
  const name = obj?.company_name ?? obj?.company ?? obj?.name ?? fallbackName;
  if (!name) {
    warnings.push('Skipped a company entry with no name.');
    return null;
  }
  let levelSource = null;
  for (const key of LEVEL_KEYS) {
    if (obj && obj[key] !== undefined) {
      levelSource = obj[key];
      break;
    }
  }
  // Shape B: the object itself is {COD: 7, DSA: 8, ...}
  if (levelSource === null && obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const codeLike = Object.keys(obj).filter((k) => toCode(k));
    if (codeLike.length) levelSource = Object.fromEntries(codeLike.map((k) => [k, obj[k]]));
  }
  if (levelSource === null && Array.isArray(obj)) levelSource = obj;
  const requirements = readLevels(levelSource, warnings, name);
  const provided = SCORED_CATEGORY_CODES.filter((c) => requirements[c] !== undefined);
  if (!provided.length) {
    warnings.push(`${name}: no recognisable skillset levels, so the company was skipped.`);
    return null;
  }
  return {
    company_id: String(obj?.company_id ?? obj?.id ?? slugify(name)),
    company_name: String(name),
    requirements,
    missing_categories: SCORED_CATEGORY_CODES.filter((c) => requirements[c] === undefined),
    synthetic: Boolean(fileSynthetic || obj?.synthetic),
  };
}

export function parseCompanyRequirements(json, sourceLabel = 'talent_check_company_skillsets.json') {
  const warnings = [];
  if (json === null || typeof json !== 'object') {
    throw new Error('The requirements file must contain a JSON object or array.');
  }
  const fileSynthetic = Boolean(json.synthetic || json._synthetic);
  let entries = [];
  if (Array.isArray(json)) entries = json.map((c) => [null, c]);
  else if (Array.isArray(json.companies)) entries = json.companies.map((c) => [null, c]);
  else if (json.companies && typeof json.companies === 'object') entries = Object.entries(json.companies);
  else entries = Object.entries(json).filter(([k]) => !k.startsWith('_') && k !== 'synthetic' && k !== 'version');

  const companies = entries
    .map(([key, value]) => normalizeCompany(value, key, warnings, fileSynthetic))
    .filter(Boolean);

  if (!companies.length) {
    throw new Error(
      'No companies with recognisable 12-skillset levels were found. Check that the file is the official talent_check_company_skillsets.json.',
    );
  }
  return {
    source: sourceLabel,
    loaded_at: new Date().toISOString(),
    synthetic: companies.some((c) => c.synthetic),
    companies,
    warnings,
  };
}
