import { isValidCategory, isValidConfidence } from '../data/categories';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

export function validateSkill(skill) {
  const errors = {};
  if (!String(skill.skill_name || '').trim()) errors.skill_name = 'Skill name is required.';
  if (!isValidCategory(skill.category_code)) errors.category_code = 'Choose a RADIX category.';
  if (!isValidConfidence(skill.confidence)) errors.confidence = 'Choose a confidence level.';
  return errors;
}

// Returns { valid, errors, warnings }. Errors block saving; warnings do not.
// Email is validated when provided but not required: none of the four supplied
// sample resumes contains an email address.
export function validateProfile(profile) {
  const errors = {};
  const warnings = [];
  if (!String(profile.name || '').trim()) errors.name = 'Candidate name is required.';
  const email = String(profile.email || '').trim();
  if (email && !isValidEmail(email)) errors.email = 'Enter a valid email address, e.g. name@domain.com.';
  if (!email) warnings.push('No email address — add one if the candidate should be contactable.');

  const skillErrors = {};
  (profile.skills || []).forEach((s, i) => {
    const e = validateSkill(s);
    if (Object.keys(e).length) skillErrors[i] = e;
  });
  if (Object.keys(skillErrors).length) errors.skills = skillErrors;
  if (!(profile.skills || []).length) warnings.push('No skills yet — Talent Check and Skill Matching need skills to assess.');

  return { valid: Object.keys(errors).length === 0, errors, warnings };
}

export function validateJd(jd) {
  const errors = {};
  if (!String(jd.role || '').trim()) errors.role = 'Job title is required.';
  if (!String(jd.company || '').trim()) errors.company = 'Company name is required.';
  const skillErrors = {};
  (jd.skills || []).forEach((s, i) => {
    const e = validateSkill(s);
    if (Object.keys(e).length) skillErrors[i] = e;
  });
  if (Object.keys(skillErrors).length) errors.skills = skillErrors;
  if (!(jd.skills || []).length) errors.skillsEmpty = 'Add at least one required skill before saving.';
  return { valid: Object.keys(errors).length === 0, errors };
}
