// Pure normalizers. Inputs are the raw JSON shapes (short_json / full_json / skill_levels)
// so Phase 2 can pipe Supabase rows in untouched.

export const PROFILE_KEYS = [
  "name",
  "short_name",
  "category",
  "incorporation_year",
  "nature_of_company",
  "overview_text",
  "headquarters_address",
  "operating_countries",
  "office_count",
  "office_locations",
  "employee_size",
  "vision_statement",
  "mission_statement",
  "core_values",
  "history_timeline",
  "recent_news",
  "website_url",
  "twitter_handle",
  "facebook_url",
  "primary_contact_email",
  "primary_phone_number",
  "regulatory_status",
  "legal_issues",
  "esg_ratings",
  "supply_chain_dependencies",
  "geopolitical_risks",
  "macro_risks",
  "carbon_footprint",
  "ethical_sourcing",
  "marketing_video_url",
  "customer_testimonials",
  "website_quality",
  "website_rating",
  "website_traffic_rank",
  "social_media_followers",
  "glassdoor_rating",
  "indeed_rating",
  "google_rating",
  "awards_recognitions",
  "brand_sentiment_score",
  "event_participation",
  "pain_points_addressed",
  "focus_sectors",
  "offerings_description",
  "top_customers",
  "core_value_proposition",
  "unique_differentiators",
  "competitive_advantages",
  "weaknesses_gaps",
  "key_challenges_needs",
  "key_competitors",
  "market_share_percentage",
  "sales_motion",
  "customer_concentration_risk",
  "exit_strategy_history",
  "benchmark_vs_peers",
  "future_projections",
  "strategic_priorities",
  "industry_associations",
  "case_studies",
  "go_to_market_strategy",
  "innovation_roadmap",
  "product_pipeline",
  "tam",
  "sam",
  "som",
  "leave_policy",
  "health_support",
  "fixed_vs_variable_pay",
  "bonus_predictability",
  "esops_incentives",
  "family_health_insurance",
  "relocation_support",
  "lifestyle_benefits",
  "hiring_velocity",
  "employee_turnover",
  "avg_retention_tenure",
  "diversity_metrics",
  "work_culture_summary",
  "manager_quality",
  "psychological_safety",
  "feedback_culture",
  "diversity_inclusion_score",
  "ethical_standards",
  "burnout_risk",
  "layoff_history",
  "mission_clarity",
  "sustainability_csr",
  "crisis_behavior",
  "annual_revenue",
  "annual_profit",
  "revenue_mix",
  "valuation",
  "yoy_growth_rate",
  "profitability_status",
  "key_investors",
  "recent_funding_rounds",
  "total_capital_raised",
  "customer_acquisition_cost",
  "customer_lifetime_value",
  "cac_ltv_ratio",
  "churn_rate",
  "net_promoter_score",
  "burn_rate",
  "runway_months",
  "burn_multiplier",
  "remote_policy_details",
  "typical_hours",
  "overtime_expectations",
  "weekend_work",
  "flexibility_level",
  "location_centrality",
  "public_transport_access",
  "cab_policy",
  "airport_commute_time",
  "office_zone_type",
  "area_safety",
  "safety_policies",
  "infrastructure_safety",
  "emergency_preparedness",
  "ceo_name",
  "ceo_linkedin_url",
  "key_leaders",
  "warm_intro_pathways",
  "decision_maker_access",
  "contact_person_name",
  "contact_person_title",
  "contact_person_email",
  "contact_person_phone",
  "board_members",
  "training_spend",
  "onboarding_quality",
  "learning_culture",
  "exposure_quality",
  "mentorship_availability",
  "internal_mobility",
  "promotion_clarity",
  "tools_access",
  "role_clarity",
  "early_ownership",
  "work_impact",
  "execution_thinking_balance",
  "automation_level",
  "cross_functional_exposure",
  "company_maturity",
  "brand_value",
  "client_quality",
  "exit_opportunities",
  "skill_relevance",
  "external_recognition",
  "network_strength",
  "global_exposure",
  "technology_partners",
  "intellectual_property",
  "r_and_d_investment",
  "ai_ml_adoption_level",
  "tech_stack",
  "cybersecurity_posture",
  "partnership_ecosystem",
  "tech_adoption_rating",
] as const;

export type ProfileKey = (typeof PROFILE_KEYS)[number];
export type CompanyProfile = Record<ProfileKey, string> & { [extra: string]: string };

export type CompanyCategory = "Super Dream" | "Dream" | "Standard" | "Regular";

export interface CompanySummary {
  companyId: number;
  name: string;
  shortName: string;
  logoUrl: string;
  category: string;
  companyType: CompanyCategory;
  incorporationYear: string;
  employeeSize: string;
  headquarters: string;
  operatingCountries: string;
  officeLocations: string;
  yoyGrowthRate: string;
  websiteUrl: string;
}

export type Difficulty = "EXPERT" | "ADVANCED" | "PRO" | "BEGINNER";

export interface DashboardSkill {
  skillId: number;
  name: string;
  requiredLevel: number;
  requiredProficiency: string;
  difficulty: Difficulty;
}

export const asString = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return ""; }
};

export const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Split on newlines, periods (followed by space/end), semicolons and bullets. */
export const splitItems = (v: unknown): string[] =>
  asString(v)
    .split(/\n|;|[•●▪‣·]|\.(?=\s|$)/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);

export const titleCaseFromCode = (code: string): string =>
  asString(code)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const scoreToDifficulty = (score: number): Difficulty =>
  score >= 8 ? "EXPERT" : score >= 6 ? "ADVANCED" : score >= 4 ? "PRO" : "BEGINNER";

const toCategory = (v: unknown): CompanyCategory => {
  const s = asString(v).toLowerCase().replace(/[_-]/g, " ");
  if (s === "super dream") return "Super Dream";
  if (s === "dream") return "Dream";
  if (s === "standard") return "Standard";
  return "Regular";
};

export function normalizeCompanySummary(shortJson: unknown, companyId = 0): CompanySummary {
  const j = asRecord(shortJson);
  return {
    companyId,
    name: asString(j.name),
    shortName: asString(j.short_name) || asString(j.name),
    logoUrl: asString(j.logo_url),
    category: asString(j.category),
    companyType: toCategory(j.company_type),
    incorporationYear: asString(j.incorporation_year),
    employeeSize: asString(j.employee_size),
    headquarters: asString(j.headquarters_address),
    operatingCountries: asString(j.operating_countries),
    officeLocations: asString(j.office_locations),
    yoyGrowthRate: asString(j.yoy_growth_rate),
    websiteUrl: asString(j.website_url),
  };
}

export function normalizeCompanyProfile(fullJson: unknown, shortJson?: unknown): CompanyProfile {
  const full = asRecord(fullJson);
  const short = asRecord(shortJson);
  const out: Record<string, string> = {};
  for (const k of PROFILE_KEYS) out[k] = asString(full[k]) || asString(short[k]);
  for (const k of Object.keys(full)) if (!(k in out)) out[k] = asString(full[k]);
  return out as CompanyProfile;
}

export function normalizeDashboardSkills(skillLevels: unknown): DashboardSkill[] {
  const arr = Array.isArray(skillLevels) ? skillLevels : [];
  return arr.map((raw) => {
    const r = asRecord(raw);
    const level = Number(r.required_level) || 0;
    return {
      skillId: Number(r.skill_set_id) || 0,
      name: asString(r.skill_set_name),
      requiredLevel: level,
      requiredProficiency: asString(r.required_proficiency),
      difficulty: scoreToDifficulty(level),
    };
  });
}

// ---- shared display helpers ----
export const NULLISH = new Set(["", "na", "n/a", "none", "-", "null", "undefined", "not applicable"]);
export const isNullish = (v: unknown): boolean => NULLISH.has(asString(v).toLowerCase());
export const isNullishStrict = (v: unknown): boolean => {
  const s = asString(v).toLowerCase();
  return ["", "na", "n/a", "none", "-", "null", "undefined"].includes(s);
};

export type BloomCode = "CU" | "AP" | "AS" | "EV" | "CR";
export const proficiencyToBloom = (n: number): BloomCode =>
  n <= 2 ? "CU" : n <= 4 ? "AP" : n <= 6 ? "AS" : n <= 8 ? "EV" : "CR";

export type Criticality = "Critical" | "Important" | "Baseline";
export const scoreToCriticality = (n: number): Criticality =>
  n >= 7 ? "Critical" : n >= 5 ? "Important" : "Baseline";

export const CATEGORY_COLORS: Record<CompanyCategory, string> = {
  "Super Dream": "#7c3aed",
  Dream: "#2563eb",
  Standard: "#16a34a",
  Regular: "#d97706",
};

export const BLOOM_COLORS: Record<BloomCode, string> = {
  CU: "#3b82f6",
  AP: "#22c55e",
  AS: "#eab308",
  EV: "#ef4444",
  CR: "#a855f7",
};

export const BLOOM_LABELS: Record<BloomCode, string> = {
  CU: "Conceptual Understanding",
  AP: "Application",
  AS: "Analysis",
  EV: "Evaluation",
  CR: "Creation",
};
