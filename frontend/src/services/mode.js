import { DEFAULT_DATA_MODE } from '../app/config';
import { readJson, writeJson, KEYS } from './storage';

// The data mode decides which adapter every service uses:
//   demo -> local persistence adapter + labelled sample fixtures
//   api  -> FastAPI backend; failures surface as errors, never as fake success

const listeners = new Set();

export function getDataMode() {
  const override = readJson(KEYS.mode, null);
  return override === 'api' || override === 'demo' ? override : DEFAULT_DATA_MODE;
}

export function setDataMode(mode) {
  if (mode !== 'api' && mode !== 'demo') throw new Error(`Unknown data mode: ${mode}`);
  writeJson(KEYS.mode, mode);
  listeners.forEach((fn) => fn(mode));
}

export function onDataModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isDemoMode = () => getDataMode() === 'demo';
