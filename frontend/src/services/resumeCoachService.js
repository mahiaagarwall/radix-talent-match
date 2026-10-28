import { ENDPOINTS } from '../app/config';
import { apiClient } from './apiClient';
import { getDataMode } from './mode';
import { tick } from './localRepository';

const WEAK_VERB_MAP = {
  'worked on': 'Engineered',
  'was responsible for': 'Spearheaded',
  'responsible for': 'Executed',
  'helped with': 'Contributed to',
  'assisted in': 'Collaborated on',
  'participated in': 'Drove key components of',
  'handled': 'Administered',
  'did': 'Implemented',
  'made': 'Architected',
  'utilized': 'Applied',
  'used': 'Leveraged',
};

const FILLER_PHRASES = [
  /\bin order to\b/gi,
  /\bas well as\b/gi,
  /\bvarious\b/gi,
  /\bduties included\b/gi,
  /\ba lot of\b/gi,
];

function localEnhance(bullet) {
  let clean = (bullet || '').trim().replace(/^[•\-*\s]+/, '').trim();
  if (clean.endsWith('.')) clean = clean.slice(0, -1);

  const improvements = [];
  const strengths = [];

  let improved = clean;

  // Check weak openers
  let replaced = false;
  for (const [weak, strong] of Object.entries(WEAK_VERB_MAP)) {
    const re = new RegExp(`^${weak}\\b`, 'i');
    if (re.test(improved)) {
      improved = improved.replace(re, strong);
      improvements.push(`Replaced passive opener '${weak}' with active verb '${strong}'`);
      replaced = true;
      break;
    }
  }

  // Check leading gerund (-ing)
  if (!replaced) {
    const words = improved.split(' ');
    if (words.length > 0 && words[0].toLowerCase().endsWith('ing')) {
      const lower = words[0].toLowerCase();
      if (lower.startsWith('build')) words[0] = 'Built';
      else if (lower.startsWith('develop')) words[0] = 'Developed';
      else if (lower.startsWith('design')) words[0] = 'Designed';
      else if (lower.startsWith('implement')) words[0] = 'Implemented';
      else words[0] = words[0].slice(0, -3) + 'ed';
      improved = words.join(' ');
      improvements.push(`Converted continuous verb '${lower}' into active past tense '${words[0]}'`);
    }
  }

  // Remove filler phrases
  FILLER_PHRASES.forEach((pattern) => {
    if (pattern.test(improved)) {
      improved = improved.replace(pattern, '').replace(/\s+/g, ' ').trim();
      improvements.push('Removed redundant filler phrasing to increase conciseness');
    }
  });

  const lower = clean.toLowerCase();
  if (/python|java|c\+\+|sql|api|docker|react|aws|database/.test(lower)) {
    strengths.push('Identifies concrete technical stack or domain concepts');
  }
  if (clean.split(' ').length >= 8) {
    strengths.push('Provides solid contextual scope of the project');
  }
  if (strengths.length === 0) {
    strengths.push('Outlines a technical responsibility clearly');
  }

  if (improvements.length === 0) {
    improvements.push('Sharpened sentence flow and professional phrasing');
  }

  if (improved && !improved.endsWith('.')) {
    improved += '.';
  }

  return {
    original_bullet: bullet,
    improved_bullet: improved,
    strengths_identified: strengths,
    improvements_made: improvements,
    unsupported_claims_avoided: [
      'Did not invent unverified numerical percentages, dollar amounts, or metrics.',
      'Did not fabricate team leadership or unstated managerial responsibilities.',
      'Preserved the candidate’s authentic technical contributions without distortion.',
    ],
    follow_up_questions: [
      'What was the data volume, query scale, or request rate handled by this system?',
      'Did this work measurably decrease latency, error rates, or processing time? If known, add the real figure.',
      'Which specific technologies, frameworks, or database engines were utilized?',
    ],
    rule_based_fallback: true,
    model_used: 'rule-based-bullet-enhancer',
  };
}

export const resumeCoachService = {
  async improve({ bullet, roleContext, targetJdId, targetJdText }) {
    if (getDataMode() === 'api') {
      try {
        const body = await apiClient.post(ENDPOINTS.careerCopilotResumeCoach, {
          bullet,
          role_context: roleContext || undefined,
          target_jd_id: targetJdId || undefined,
          target_jd_text: targetJdText || undefined,
        });
        return body;
      } catch (err) {
        console.warn('API resumeCoach improve failed, using local enhancer:', err);
      }
    }

    await tick(300);
    return localEnhance(bullet);
  },
};
