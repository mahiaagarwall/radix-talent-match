import {
  Building2, Eye, Users, Landmark, Globe2, Package, Cpu, Handshake, Swords, Target, Leaf,
  HeartHandshake, Newspaper, BarChart3, ShieldAlert, MapPinned, ShieldCheck, GraduationCap,
  Award, Wallet, Star, Mail, type LucideIcon,
} from "lucide-react";
import type { CompanyProfile } from "@cd/lib/companyData";

export type FieldType = "text" | "url" | "video" | "rating" | "list" | "paragraph" | "auto";

export interface IntelligenceField {
  key: string;
  label: string;
  type: FieldType;
  value?: string;
}

export interface IntelligenceSection {
  id: string;
  title: string;
  icon: LucideIcon;
  fields: IntelligenceField[];
}

const f = (key: string, label: string, type: FieldType = "auto"): IntelligenceField => ({ key, label, type });


const DEFS: { id: string; title: string; icon: LucideIcon; fields: IntelligenceField[] }[] = [
  { id: "identity", title: "Company Identity", icon: Building2, fields: [
    f("name", "Legal Name", "text"), f("short_name", "Short Name", "text"), f("category", "Category", "text"),
    f("incorporation_year", "Incorporated", "text"), f("nature_of_company", "Nature of Company", "text"),
    f("headquarters_address", "Headquarters", "text"), f("employee_size", "Employee Size", "text"), f("office_count", "Office Count", "text"),
  ] },
  { id: "overview", title: "Overview & Vision", icon: Eye, fields: [
    f("overview_text", "Overview", "paragraph"), f("vision_statement", "Vision", "paragraph"),
    f("mission_statement", "Mission", "paragraph"), f("core_values", "Core Values", "list"), f("history_timeline", "History & Scale", "list"),
  ] },
  { id: "leadership", title: "Leadership", icon: Users, fields: [
    f("ceo_name", "CEO", "text"), f("ceo_linkedin_url", "CEO LinkedIn", "url"), f("key_leaders", "Key Leaders", "list"),
    f("board_members", "Board Members", "list"), f("decision_maker_access", "Decision-Maker Access", "paragraph"),
    f("warm_intro_pathways", "Warm Intro Pathways", "list"),
  ] },
  { id: "funding", title: "Funding & Financials", icon: Landmark, fields: [
    f("annual_revenue", "Annual Revenue"), f("annual_profit", "Annual Profit"), f("revenue_mix", "Revenue Mix", "list"),
    f("valuation", "Valuation"), f("yoy_growth_rate", "YoY Growth"), f("profitability_status", "Profitability"),
    f("key_investors", "Key Investors", "list"), f("recent_funding_rounds", "Recent Funding"), f("total_capital_raised", "Capital Raised"),
    f("burn_rate", "Burn Rate"), f("runway_months", "Runway"), f("burn_multiplier", "Burn Multiplier"),
  ] },
  { id: "global", title: "Global Presence", icon: Globe2, fields: [
    f("operating_countries", "Operating Countries", "list"), f("office_locations", "Office Locations", "list"),
    f("office_count", "Offices", "text"), f("headquarters_address", "Headquarters", "text"),
  ] },
  { id: "products", title: "Products & Services", icon: Package, fields: [
    f("offerings_description", "Offerings", "list"), f("pain_points_addressed", "Pain Points Addressed", "list"),
    f("focus_sectors", "Focus Sectors", "list"), f("top_customers", "Top Customers", "list"),
    f("product_pipeline", "Product Pipeline", "list"), f("innovation_roadmap", "Innovation Roadmap", "list"), f("case_studies", "Case Studies", "list"),
  ] },
  { id: "tech", title: "Technology Stack", icon: Cpu, fields: [
    f("tech_stack", "Tech Stack", "list"), f("cybersecurity_posture", "Cybersecurity", "list"),
    f("ai_ml_adoption_level", "AI / ML Adoption", "paragraph"), f("tech_adoption_rating", "Tech Adoption", "paragraph"),
    f("r_and_d_investment", "R&D Investment"), f("intellectual_property", "Intellectual Property", "list"),
  ] },
  { id: "partnerships", title: "Partnerships & Ecosystem", icon: Handshake, fields: [
    f("technology_partners", "Technology Partners", "list"), f("partnership_ecosystem", "Partnership Ecosystem", "list"),
    f("industry_associations", "Industry Associations", "list"), f("event_participation", "Events", "list"),
  ] },
  { id: "competitive", title: "Competitive Landscape", icon: Swords, fields: [
    f("key_competitors", "Key Competitors", "list"), f("competitive_advantages", "Competitive Advantages", "list"),
    f("unique_differentiators", "Differentiators", "list"), f("weaknesses_gaps", "Weaknesses & Gaps", "list"),
    f("benchmark_vs_peers", "Benchmark vs Peers", "list"), f("market_share_percentage", "Market Share"),
    f("key_challenges_needs", "Key Challenges", "list"),
  ] },
  { id: "market", title: "Market Opportunity", icon: Target, fields: [
    f("tam", "TAM"), f("sam", "SAM"), f("som", "SOM"), f("future_projections", "Future Projections"),
    f("strategic_priorities", "Strategic Priorities", "list"), f("go_to_market_strategy", "Go-to-Market", "list"),
  ] },
  { id: "value", title: "Core Value Proposition & ESG", icon: Leaf, fields: [
    f("core_value_proposition", "Value Proposition", "list"), f("esg_ratings", "ESG Commitments", "list"),
    f("sustainability_csr", "Sustainability & CSR", "list"), f("carbon_footprint", "Carbon Footprint", "paragraph"),
    f("ethical_sourcing", "Ethical Sourcing", "list"), f("ethical_standards", "Ethical Standards", "list"),
  ] },
  { id: "culture", title: "Culture & Work Life", icon: HeartHandshake, fields: [
    f("work_culture_summary", "Culture Summary", "list"), f("manager_quality", "Manager Quality"),
    f("psychological_safety", "Psychological Safety"), f("feedback_culture", "Feedback Culture", "list"),
    f("diversity_inclusion_score", "Diversity & Inclusion", "list"), f("diversity_metrics", "Diversity Metrics", "list"),
    f("burnout_risk", "Burnout Risk"), f("mission_clarity", "Mission Clarity"), f("crisis_behavior", "Crisis Behavior"),
    f("typical_hours", "Typical Hours"), f("overtime_expectations", "Overtime"), f("weekend_work", "Weekend Work"),
    f("employee_turnover", "Employee Turnover"), f("avg_retention_tenure", "Avg. Tenure"), f("layoff_history", "Layoff History"),
  ] },
  { id: "news", title: "Recent News & Milestones", icon: Newspaper, fields: [
    f("recent_news", "Recent News", "list"), f("hiring_velocity", "Hiring Velocity", "list"),
  ] },
  { id: "sales", title: "Sales & Customer Metrics", icon: BarChart3, fields: [
    f("sales_motion", "Sales Motion"), f("customer_acquisition_cost", "Customer Acquisition Cost"),
    f("customer_lifetime_value", "Customer Lifetime Value"), f("cac_ltv_ratio", "CAC : LTV"), f("churn_rate", "Churn Rate"),
    f("net_promoter_score", "Net Promoter Score"), f("customer_concentration_risk", "Customer Concentration Risk"),
    f("customer_testimonials", "Testimonials", "list"), f("exit_strategy_history", "Exit Strategy History", "list"),
  ] },
  { id: "risk", title: "Risk & Compliance", icon: ShieldAlert, fields: [
    f("regulatory_status", "Regulatory Status", "list"), f("legal_issues", "Legal Issues", "list"),
    f("supply_chain_dependencies", "Supply Chain Dependencies", "list"), f("geopolitical_risks", "Geopolitical Risks", "list"),
    f("macro_risks", "Macro Risks", "list"),
  ] },
  { id: "location", title: "Work Location & Commute", icon: MapPinned, fields: [
    f("remote_policy_details", "Remote Policy"), f("flexibility_level", "Flexibility", "list"),
    f("location_centrality", "Location"), f("public_transport_access", "Public Transport", "list"),
    f("cab_policy", "Cab Policy", "list"), f("airport_commute_time", "Airport Commute"), f("office_zone_type", "Office Zone"),
  ] },
  { id: "safety", title: "Safety & Wellbeing", icon: ShieldCheck, fields: [
    f("area_safety", "Area Safety", "list"), f("safety_policies", "Safety Policies", "list"),
    f("infrastructure_safety", "Infrastructure Safety", "list"), f("emergency_preparedness", "Emergency Preparedness", "list"),
    f("health_support", "Health Support", "list"), f("leave_policy", "Leave Policy", "list"),
  ] },
  { id: "career", title: "Career Growth & Learning", icon: GraduationCap, fields: [
    f("training_spend", "Training Spend"), f("onboarding_quality", "Onboarding"), f("learning_culture", "Learning Culture", "list"),
    f("exposure_quality", "Exposure Quality"), f("mentorship_availability", "Mentorship", "list"),
    f("internal_mobility", "Internal Mobility"), f("promotion_clarity", "Promotion Clarity", "list"),
    f("tools_access", "Tools Access", "list"), f("role_clarity", "Role Clarity"), f("early_ownership", "Early Ownership"),
    f("work_impact", "Work Impact", "list"), f("execution_thinking_balance", "Execution vs Thinking"),
    f("automation_level", "Automation Level"), f("cross_functional_exposure", "Cross-Functional Exposure", "list"),
    f("company_maturity", "Company Maturity"), f("client_quality", "Client Quality", "list"),
    f("exit_opportunities", "Exit Opportunities", "list"), f("skill_relevance", "Skill Relevance"),
    f("external_recognition", "External Recognition"), f("network_strength", "Network Strength", "list"),
    f("global_exposure", "Global Exposure", "list"),
  ] },
  { id: "brand", title: "Brand & Reputation", icon: Award, fields: [
    f("brand_value", "Brand Value"), f("brand_sentiment_score", "Brand Sentiment", "paragraph"),
    f("awards_recognitions", "Awards & Recognition", "list"), f("marketing_video_url", "Marketing Video", "video"),
    f("website_quality", "Website Quality", "paragraph"),
  ] },
  { id: "compensation", title: "Compensation & Benefits", icon: Wallet, fields: [
    f("fixed_vs_variable_pay", "Fixed vs Variable Pay"), f("bonus_predictability", "Bonus Predictability"),
    f("esops_incentives", "ESOPs & Incentives", "list"), f("family_health_insurance", "Family Health Insurance", "list"),
    f("relocation_support", "Relocation Support", "list"), f("lifestyle_benefits", "Lifestyle Benefits", "list"),
  ] },
  { id: "digital", title: "Digital Presence & Ratings", icon: Star, fields: [
    f("website_url", "Website", "url"), f("linkedin_url", "LinkedIn", "url"), f("twitter_handle", "Twitter / X", "text"),
    f("facebook_url", "Facebook", "url"), f("instagram_url", "Instagram", "url"), f("website_rating", "Website Rating", "rating"),
    f("website_traffic_rank", "Traffic Rank", "list"), f("social_media_followers", "Social Followers", "text"),
    f("glassdoor_rating", "Glassdoor", "rating"), f("indeed_rating", "Indeed", "rating"), f("google_rating", "Google", "rating"),
  ] },
  { id: "contact", title: "Contact Information", icon: Mail, fields: [
    f("primary_contact_email", "Primary Email", "text"), f("primary_phone_number", "Primary Phone", "text"),
    f("contact_person_name", "Contact Person", "text"), f("contact_person_title", "Title", "text"),
    f("contact_person_email", "Contact Email", "text"), f("contact_person_phone", "Contact Phone", "text"),
  ] },
];

/** Returns the 22-section schema, merging profile values into each field when passed. */
export function buildIntelligenceSections(profile?: CompanyProfile | Record<string, string>): IntelligenceSection[] {
  return DEFS.map((s) => ({
    ...s,
    fields: s.fields.map((fld) => ({ ...fld, value: profile ? (profile as Record<string, string>)[fld.key] ?? "" : undefined })),
  }));
}
