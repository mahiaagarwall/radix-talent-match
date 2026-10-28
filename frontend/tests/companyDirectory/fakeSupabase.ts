// In-memory stand-in for the Supabase client, built from the portal seed plus synthetic rows.
// Records every table that is queried so tests can assert the read-only allowlist.
// No network is ever used.
import { SEED_COMPANIES } from "@cd/data/seedCompanies";
import { SKILL_TOPICS } from "@cd/data/skillTopics";

export const queriedTables: string[] = [];
export const selectLog: { table: string; cols: string[] }[] = [];

/** "ok" (default), "error" (every request fails) or "empty" (every request returns no rows). */
export const fakeState: { mode: "ok" | "error" | "empty" } = { mode: "ok" };

const PROFICIENCY = [
  { proficiency_level_id: 1, proficiency_name: "Beginner", proficiency_code: "BEG" },
  { proficiency_level_id: 2, proficiency_name: "Intermediate", proficiency_code: "INT" },
  { proficiency_level_id: 3, proficiency_name: "Proficient", proficiency_code: "PRO" },
  { proficiency_level_id: 4, proficiency_name: "Advanced", proficiency_code: "ADV" },
  { proficiency_level_id: 5, proficiency_name: "Expert", proficiency_code: "EXP" },
];
const profId = (name: string) => PROFICIENCY.find((p) => p.proficiency_name === name)!.proficiency_level_id;

type Row = Record<string, unknown>;

// Synthetic, clearly fictional companies: one Super Dream; one with missing/null fields and JSON stored as text.
const SYNTHETIC: Row[] = [
  {
    company_id: 2,
    short_json: { name: "Globex Systems", short_name: "Globex", company_type: "Super Dream", headquarters_address: "Pune, India" },
    full_json: {},
  },
  {
    company_id: 3,
    short_json: JSON.stringify({ name: "Initech Labs", company_type: null, employee_size: null, headquarters_address: undefined }),
    full_json: null,
  },
];

const TABLES: Record<string, Row[]> = {
  company_json: [
    ...SEED_COMPANIES.map((c) => ({ company_id: c.company_id, short_json: c.short_json, full_json: c.full_json })),
    ...SYNTHETIC,
  ],
  company_skill_levels: SEED_COMPANIES.flatMap((c) =>
    c.skill_levels.map((s) => ({
      company_id: c.company_id,
      skill_set_id: s.skill_set_id,
      required_level: s.required_level,
      required_proficiency_level_id: profId(s.required_proficiency),
    })),
  ),
  skill_set_master: SEED_COMPANIES[0].skill_levels.map((s) => ({ skill_set_id: s.skill_set_id, skill_set_name: s.skill_set_name, short_name: s.skill_set_name })),
  proficiency_levels: PROFICIENCY,
  skill_set_topics: Object.entries(SKILL_TOPICS).flatMap(([id, ladder]) =>
    ladder.map((t) => ({ skill_set_id: Number(id), level_number: t.level_number, topics: t.topic })),
  ),
};

type Result = { data: Row[] | null; error: { message: string } | null; status: number };

class Builder {
  private rows: Row[];
  private cols: string[] = [];
  constructor(private table: string) {
    queriedTables.push(table);
    this.rows = fakeState.mode === "empty" ? [] : [...(TABLES[table] ?? [])];
  }
  select(cols: string) {
    this.cols = cols.split(",").map((c) => c.trim());
    selectLog.push({ table: this.table, cols: this.cols });
    return this;
  }
  eq(col: string, val: unknown) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
  in(col: string, vals: unknown[]) { this.rows = this.rows.filter((r) => vals.includes(r[col])); return this; }
  order(col: string) { this.rows.sort((a, b) => Number(a[col]) - Number(b[col])); return this; }
  private result(): Result {
    if (fakeState.mode === "error") return { data: null, error: { message: "permission denied for table " + this.table }, status: 401 };
    return { data: this.rows.map((r) => Object.fromEntries(this.cols.map((c) => [c, r[c]]))), error: null, status: 200 };
  }
  maybeSingle() {
    const r = this.result();
    return Promise.resolve({ ...r, data: r.data ? r.data[0] ?? null : null });
  }
  then(onfulfilled?: (v: Result) => unknown, onrejected?: (e: unknown) => unknown) {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
}

export const fakeSupabase = { from: (table: string) => new Builder(table) };
