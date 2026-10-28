import { useEffect, useMemo, useState } from "react";
import { SearchX, Search, X } from "lucide-react";
import { AnimatedParticleBackground } from "../../../components/ui/AnimatedParticleBackground";
import { Input } from "@cd/components/ui/input";
import { Button } from "@cd/components/ui/button";
import { Skeleton } from "@cd/components/ui/skeleton";
import { CompanyCard } from "@cd/components/CompanyCard";
import { PageError } from "@cd/components/QueryState";
import { type CompanyCategory } from "@cd/lib/companyData";
import { errorMessage, useCompanies } from "@cd/lib/companyApi";
import { categoryVar } from "@cd/lib/categoryStyle";

const FILTERS = ["All", "Super Dream", "Dream", "Standard", "Regular"] as const;
type Filter = (typeof FILTERS)[number];

const DirectoryHome = () => {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [input]);

  const { data, error, isLoading, isError, refetch } = useCompanies();
  const companies = useMemo(() => data ?? [], [data]);

  const searched = useMemo(
    () =>
      query
        ? companies.filter((c) =>
            [c.name, c.shortName, c.headquarters, c.companyType, c.category].some((v) => (v ?? "").toLowerCase().includes(query)),
          )
        : companies,
    [companies, query],
  );
  const counts = useMemo(() => {
    const m: Record<Filter, number> = { All: searched.length, "Super Dream": 0, Dream: 0, Standard: 0, Regular: 0 };
    searched.forEach((c) => {
      if (c.companyType in m) m[c.companyType] += 1;
    });
    return m;
  }, [searched]);
  const visible = useMemo(() => (filter === "All" ? searched : searched.filter((c) => c.companyType === filter)), [searched, filter]);

  const reset = () => {
    setInput("");
    setQuery("");
    setFilter("All");
  };

  return (
    <div className="space-y-7">
      <header className="cd-hero relative overflow-hidden rounded-2xl border border-border">
        <AnimatedParticleBackground particleCount={150} parallaxStrength={10} interactionRadius={120} interactionStrength={0.12} />
        <div className="relative z-10 px-5 py-9 sm:px-8 sm:py-12">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">Company Directory</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Research recruiting companies, their placement category and the skills they hire for.
          </p>

          <div className="relative mt-6 max-w-2xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search companies by name, location or category"
              aria-label="Search companies"
              className="h-12 pl-10 pr-10 text-sm sm:text-base"
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Companies">
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Filter by category">
          {FILTERS.map((f) => {
            const active = filter === f;
            const c = categoryVar(f as CompanyCategory | "All");
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  active
                    ? "border-[hsl(var(--c))] bg-[hsl(var(--c))] text-[hsl(var(--on-cat))] shadow-card"
                    : "border-[hsl(var(--c)/0.35)] bg-card text-[hsl(var(--c))] hover:border-[hsl(var(--c)/0.7)] hover:bg-[hsl(var(--c)/0.1)]"
                }`}
                style={{ "--c": c } as React.CSSProperties}
              >
                {f} <span className="ml-1 tabular-nums opacity-80">({counts[f]})</span>
              </button>
            );
          })}
        </div>

        <p className="sr-only" aria-live="polite">
          {isLoading || isError ? "" : `${visible.length} ${visible.length === 1 ? "company" : "companies"} shown`}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-xl" data-testid="company-skeleton" />)
          ) : isError ? (
            <div className="col-span-full">
              <PageError message={errorMessage(error, "Could not load companies. Check your connection and try again.")} onRetry={() => refetch()} />
            </div>
          ) : visible.length > 0 ? (
            visible.map((c) => <CompanyCard key={c.companyId} company={c} />)
          ) : companies.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-16 text-center" role="status">
              <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">The database returned no companies</p>
              <p className="max-w-md text-sm text-muted-foreground">
                The request worked but came back empty. Either <code>company_json</code> has no rows, or Row Level Security is
                blocking the anon key (add a SELECT policy for the <code>anon</code> role).
              </p>
              <Button variant="outline" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card py-16 text-center" role="status">
              <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">No companies match your search</p>
              <Button variant="outline" onClick={reset}>Reset filters</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DirectoryHome;
