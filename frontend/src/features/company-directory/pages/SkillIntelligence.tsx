import { memo, useMemo, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { CompanyLogo } from "@cd/components/CompanyLogo";
import { useSelectedCompany } from "@cd/hooks/useSelectedCompany";
import { errorMessage, useCompanyProfile, useCompanySkills, type SkillTopic } from "@cd/lib/companyApi";
import { PageError, PageSkeleton } from "@cd/components/QueryState";
import {
  BLOOM_COLORS, BLOOM_LABELS, proficiencyToBloom, scoreToCriticality,
  type BloomCode, type Criticality, type DashboardSkill,
} from "@cd/lib/companyData";

const BLOOMS: BloomCode[] = ["CU", "AP", "AS", "EV", "CR"];
const CRIT: Record<Criticality, { cls: string; blurb: string }> = {
  Critical: { cls: "text-error", blurb: "Score 7+ · must be interview-ready" },
  Important: { cls: "text-warning", blurb: "Score 5–6 · expected to be solid" },
  Baseline: { cls: "text-muted-foreground", blurb: "Score below 5 · working familiarity" },
};

const SkillCard = memo(({ skill, topics }: { skill: DashboardSkill; topics: SkillTopic[] }) => {
  const [open, setOpen] = useState(false);
  const bloom = proficiencyToBloom(skill.requiredLevel);
  const crit = scoreToCriticality(skill.requiredLevel);
  const color = BLOOM_COLORS[bloom];

  return (
    <article className="rounded-xl border border-border bg-card shadow-card" data-testid="skill-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        type="button" className="flex w-full flex-col gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-base font-semibold leading-snug">{skill.name}</h3>
          <span
            className="rounded-full border px-2 py-0.5 text-xs font-semibold"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}
          >
            {bloom}
          </span>
          <span className="text-sm font-semibold tabular-nums">{skill.requiredLevel}/10</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${skill.name} required level`} aria-valuenow={skill.requiredLevel} aria-valuemin={0} aria-valuemax={10}>
          <div className="h-full rounded-full" style={{ width: `${skill.requiredLevel * 10}%`, backgroundColor: color }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${CRIT[crit].cls}`}>{crit}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {open ? "Hide" : "Show"} roadmap <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>

      {open && (
        <ol className="border-t border-border px-4 py-2">
          {topics.map((t) => {
            const locked = t.level_number > skill.requiredLevel;
            return (
              <li
                key={t.level_number}
                className={`flex items-start gap-3 border-b border-border/60 py-2 text-sm last:border-0 ${locked ? "text-muted-foreground" : ""}`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${locked ? "bg-muted text-muted-foreground" : ""}`}
                  style={locked ? undefined : { backgroundColor: `${color}1a`, color }}
                >
                  {t.level_number}
                </span>
                <span className="flex-1">{t.topic}</span>
                {locked && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                    <Lock className="h-3.5 w-3.5" /> Beyond scope
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
});
SkillCard.displayName = "SkillCard";

const SkillIntelligence = () => {
  const selected = useSelectedCompany();
  const profileQ = useCompanyProfile(selected?.companyId);
  const skillsQ = useCompanySkills(selected?.companyId);
  const skills = useMemo(
    () => [...(skillsQ.data?.skills ?? [])].sort((a, b) => b.requiredLevel - a.requiredLevel),
    [skillsQ.data],
  );

  if (!selected) return null;
  if (profileQ.isLoading || skillsQ.isLoading) return <PageSkeleton />;
  if (profileQ.isError || skillsQ.isError) {
    return <PageError message={errorMessage(profileQ.error ?? skillsQ.error, "Could not load skill intelligence. Check your connection and try again.")} onRetry={() => { profileQ.refetch(); skillsQ.refetch(); }} />;
  }
  const summary = profileQ.data?.summary;
  if (!summary) return <PageError message="This company is not in the database." />;
  const topicsBySkill = skillsQ.data?.topics ?? {};

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-4 sm:px-5">
        <CompanyLogo name={summary.name} websiteUrl={profileQ.data?.profile.website_url || summary.websiteUrl} logoUrl={selected.logoUrl} className="h-10 w-10" />
        <h1 className="text-xl font-bold sm:text-2xl">{summary.shortName || summary.name} Skill Intelligence</h1>
      </div>

      <div className="space-y-6 py-5">
        <section aria-label="Bloom levels">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Bloom levels</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {BLOOMS.map((b) => (
              <div key={b} className="rounded-lg border p-3" style={{ backgroundColor: `${BLOOM_COLORS[b]}14`, borderColor: `${BLOOM_COLORS[b]}55` }}>
                <p className="font-heading text-base font-bold" style={{ color: BLOOM_COLORS[b] }}>{b}</p>
                <p className="text-xs text-foreground/80">{BLOOM_LABELS[b]}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Criticality">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Criticality</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(CRIT) as Criticality[]).map((c) => (
              <div key={c} className="rounded-lg border border-border bg-card p-3">
                <p className={`text-sm font-semibold ${CRIT[c].cls}`}>{c}</p>
                <p className="text-xs text-muted-foreground">{CRIT[c].blurb}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Skills" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {skills.map((s) => <SkillCard key={s.skillId} skill={s} topics={topicsBySkill[s.skillId] ?? []} />)}
        </section>
      </div>
    </div>
  );
};

export default SkillIntelligence;
