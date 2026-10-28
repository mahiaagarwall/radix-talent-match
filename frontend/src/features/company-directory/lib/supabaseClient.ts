import { createClient } from "@supabase/supabase-js";

// Read-only public client for the Company Directory. Only the public project URL and
// anon (publishable) key may ever be used here; never a service-role key.

const REQUEST_TIMEOUT_MS = 15000;

const clean = (v: unknown) => String(v ?? "").trim().replace(/^["']|["']$/g, "").trim();

/** Accepts "https://abc.supabase.co", "abc.supabase.co" or a bare project ref "abc"; strips quotes, paths and trailing slashes. */
export function normalizeSupabaseUrl(raw: string): string | null {
  if (!raw) return null;
  let v = raw;
  if (!/^https?:\/\//i.test(v)) v = /[.:]/.test(v) ? `https://${v}` : `https://${v}.supabase.co`;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin; // drops /rest/v1, dashboard paths, trailing slash
  } catch {
    return null;
  }
}

const rawUrl = clean(import.meta.env.VITE_SUPABASE_URL);
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);
const url = normalizeSupabaseUrl(rawUrl);

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabaseHost = url ? new URL(url).host : "(not set)";

/** Human-readable reason the directory cannot load data, or null when configured. Never contains the key. */
export const supabaseConfigProblem: string | null = isSupabaseConfigured
  ? null
  : [
      !rawUrl && "VITE_SUPABASE_URL is empty",
      rawUrl && !url && "VITE_SUPABASE_URL is not a valid URL (expected https://<project-ref>.supabase.co)",
      !anonKey && "VITE_SUPABASE_ANON_KEY is empty",
    ]
      .filter(Boolean)
      .join("; ");

if (supabaseConfigProblem) {
  // eslint-disable-next-line no-console
  console.error(`[company-directory] ${supabaseConfigProblem}. Set it in frontend/.env.local (see frontend/.env.example) and restart "npm run dev".`);
}

/** fetch with a hard timeout so a stalled network never leaves the page loading forever. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// No auth session is persisted or refreshed. When not configured, the placeholder values keep
// the module importable; companyApi refuses to query and the pages show the configuration error.
export const supabase = createClient(url ?? "http://localhost:54321", anonKey || "missing-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: fetchWithTimeout },
});
