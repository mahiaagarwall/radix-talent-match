import { readJson, writeJson, KEYS } from './storage';
import { DEFAULT_SCORING } from '../utils/skillMatcher';

// Skill Matching parameters. These are demo defaults pending team agreement;
// every result stores the parameters it was computed with.

export function getScoringSettings() {
  const saved = readJson(KEYS.scoring, null);
  if (!saved) return structuredCloneSafe(DEFAULT_SCORING);
  return {
    partial_value: clamp(Number(saved.partial_value), 0, 1, DEFAULT_SCORING.partial_value),
    weights: {
      required: clamp(Number(saved.weights?.required), 0.1, 10, DEFAULT_SCORING.weights.required),
      preferred: clamp(Number(saved.weights?.preferred), 0, 10, DEFAULT_SCORING.weights.preferred),
    },
  };
}

export function validateScoringSettings(s) {
  const errors = {};
  if (!(s.partial_value > 0 && s.partial_value < 1)) errors.partial_value = 'Partial value must be between 0 and 1 (exclusive).';
  if (!(s.weights.required > 0)) errors.required = 'Required weight must be greater than 0.';
  if (!(s.weights.preferred >= 0)) errors.preferred = 'Preferred weight cannot be negative.';
  if (s.weights.preferred > s.weights.required) errors.preferred = 'Preferred skills should not outweigh required skills.';
  return errors;
}

export function saveScoringSettings(s) {
  const errors = validateScoringSettings(s);
  if (Object.keys(errors).length) {
    const err = new Error('Invalid scoring settings.');
    err.details = errors;
    throw err;
  }
  writeJson(KEYS.scoring, s);
}

export function resetScoringSettings() {
  writeJson(KEYS.scoring, DEFAULT_SCORING);
  return structuredCloneSafe(DEFAULT_SCORING);
}

function clamp(n, min, max, fallback) {
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function structuredCloneSafe(v) {
  return JSON.parse(JSON.stringify(v));
}
