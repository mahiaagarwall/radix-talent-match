import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom lacks these browser APIs used by Recharts and the layout hooks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverStub;

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.scrollTo = () => {};

// jsdom has no canvas: return no context (the particle background then stays static) instead of
// jsdom's "Not implemented" console error. Particle tests install their own fake context.
window.HTMLCanvasElement.prototype.getContext = () => null;

// The Company Directory never touches the network in tests: an in-memory Supabase built from the seed.
vi.mock('@cd/lib/supabaseClient', async () => {
  const { fakeSupabase } = await import('./companyDirectory/fakeSupabase');
  return {
    supabase: fakeSupabase,
    supabaseHost: 'fake.supabase.test',
    isSupabaseConfigured: true,
    supabaseConfigProblem: null,
  };
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
