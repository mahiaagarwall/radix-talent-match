import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Linkedin, Play, Star } from "lucide-react";
import { Badge } from "@cd/components/ui/badge";
import { Button } from "@cd/components/ui/button";
import { CompanyLogo } from "@cd/components/CompanyLogo";
import { useSelectedCompany } from "@cd/hooks/useSelectedCompany";
import { errorMessage, useCompanyProfile } from "@cd/lib/companyApi";
import { PageError, PageSkeleton } from "@cd/components/QueryState";
import { buildIntelligenceSections, type IntelligenceField, type IntelligenceSection } from "@cd/data/intelligenceData";
import { isNullishStrict, splitItems } from "@cd/lib/companyData";

const NotAvailable = () => (
  <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs italic text-muted-foreground">Not Available</span>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex max-w-full break-words rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground/90">{children}</span>
);

const linkClass = "inline-flex items-center gap-1 break-all font-medium text-primary underline-offset-2 transition-colors hover:text-primary-hover hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring";

export function renderValue(field: IntelligenceField): React.ReactNode {
  const raw = field.value ?? "";
  if (isNullishStrict(raw)) return <NotAvailable />;

  switch (field.type) {
    case "url":
      return (
        <a href={raw} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {raw.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
        </a>
      );
    case "video":
      return (
        <a href={raw} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Play className="h-3.5 w-3.5" /> Watch video
        </a>
      );
    case "rating":
      return (
        <span className="inline-flex items-center gap-1 font-medium">
          <Star className="h-4 w-4 fill-warning text-warning" /> {raw}
        </span>
      );
    case "list": {
      const items = splitItems(raw);
      if (items.length <= 1) return <span>{items[0] ?? raw}</span>;
      return (
        <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    }
    case "paragraph":
      return <p className="leading-relaxed">{raw}</p>;
    default: {
      // auto: pill detection on ; and ,
      if (raw.includes(";")) {
        return <div className="flex flex-wrap gap-1.5">{raw.split(";").map((s) => s.trim()).filter(Boolean).map((s, i) => <Pill key={i}>{s}</Pill>)}</div>;
      }
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const hasThousandsSeparator = /\d,\d{3}(?!\d)/.test(raw); // "740,000 employees" is one value, not a list
      if (!hasThousandsSeparator && parts.length > 1 && raw.length <= 80 && parts.every((p) => p.length <= 30)) {
        return <div className="flex flex-wrap gap-1.5">{parts.map((s, i) => <Pill key={i}>{s}</Pill>)}</div>;
      }
      return <span>{raw}</span>;
    }
  }
}

const FieldRow = ({ field }: { field: IntelligenceField }) => (
  <div className="flex flex-col gap-1 border-b border-border/60 py-3.5 last:border-0 sm:flex-row sm:gap-6">
    <dt className="text-[13px] font-medium text-muted-foreground sm:w-1/3 sm:shrink-0">{field.label}</dt>
    <dd className="min-w-0 break-words text-sm leading-relaxed text-foreground sm:w-2/3">{renderValue(field)}</dd>
  </div>
);

const SectionCard = memo(({ section }: { section: IntelligenceSection }) => {
  const Icon = section.icon;
  const populated = section.fields.filter((f) => !isNullishStrict(f.value)).length;
  return (
    <section
      id={`section-${section.id}`}
      data-section
      className="scroll-mt-44 overflow-hidden rounded-xl border border-border bg-card shadow-card"
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-primary"><Icon className="h-[18px] w-[18px]" /></span>
        <h2 className="text-base font-semibold text-foreground sm:text-lg">{section.title}</h2>
        <Badge className="ml-auto border-border bg-card tabular-nums text-muted-foreground">{populated}/{section.fields.length}</Badge>
      </div>
      <dl className="px-4 py-1 sm:px-5">
        {section.fields.map((f) => <FieldRow key={f.key} field={f} />)}
      </dl>
    </section>
  );
});
SectionCard.displayName = "SectionCard";

const CompanyIntelligence = () => {
  const selected = useSelectedCompany();
  const query = useCompanyProfile(selected?.companyId);
  const bundle = query.data ?? null;
  const [active, setActive] = useState(0);
  const isScrollingRef = useRef(false);
  const scrollTimer = useRef<number>();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => buildIntelligenceSections(bundle?.profile), [bundle]);

  const scrollToSection = useCallback((idx: number) => {
    const el = document.getElementById(`section-${sections[idx].id}`);
    if (!el) return;
    isScrollingRef.current = true;
    setActive(idx);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => { isScrollingRef.current = false; }, 800);
  }, [sections]);

  useEffect(() => () => window.clearTimeout(scrollTimer.current), []);

  // scroll-spy
  useEffect(() => {
    const onScroll = () => {
      if (isScrollingRef.current) return;
      const probe = 190; // just below the sticky bars
      let current = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(`section-${s.id}`);
        if (el && el.getBoundingClientRect().top - probe <= 0) current = i;
      });
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  // auto-center active tab
  useEffect(() => {
    const tab = tabRefs.current[active];
    const bar = tabBarRef.current;
    if (!tab || !bar) return;
    bar.scrollTo({ left: tab.offsetLeft - bar.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  if (!selected) return null; // guard redirects to the directory list when nothing is selected
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <PageError message={errorMessage(query.error, "Could not load this company. Check your connection and try again.")} onRetry={() => query.refetch()} />;
  if (!bundle) return <PageError message="This company is not in the database." />;

  const { summary, profile } = bundle;
  const industry = profile.category || summary.category;

  return (
    <div>
      {/* sticky top information bar */}
      <div className="sticky top-[var(--topbar-h)] z-20 flex h-16 items-center gap-3 rounded-t-xl border border-border bg-surface px-3 sm:px-5">
        <CompanyLogo name={summary.name} websiteUrl={profile.website_url || summary.websiteUrl} logoUrl={selected.logoUrl} className="h-10 w-10" />
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{summary.name}</h1>
          {industry && <Badge className="hidden border-primary/25 bg-subtle text-primary sm:inline-flex">{industry}</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {profile.website_url && (
            <Button asChild variant="outline" size="sm">
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">Website</span></a>
            </Button>
          )}
          {profile.linkedin_url && (
            <Button asChild variant="outline" size="sm">
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"><Linkedin className="h-4 w-4" /><span className="hidden sm:inline">LinkedIn</span></a>
            </Button>
          )}
        </div>
      </div>

      {/* sticky tab bar (22 tabs) */}
      <div className="sticky top-[calc(var(--topbar-h)+4rem)] z-10 border-x border-b border-border bg-surface">
        <nav aria-label="Company sections"><div ref={tabBarRef} className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2 sm:px-6">
          {sections.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              aria-current={active === i ? "true" : undefined}
              onClick={() => scrollToSection(i)}
              className={`relative shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active === i
                  ? "bg-subtle text-primary after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div></nav>
      </div>

      <div className="space-y-5 py-5">
        {sections.map((s) => <SectionCard key={s.id} section={s} />)}
      </div>
    </div>
  );
};

export default CompanyIntelligence;
