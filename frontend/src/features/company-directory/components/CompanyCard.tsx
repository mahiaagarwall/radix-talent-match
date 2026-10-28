import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Badge } from "@cd/components/ui/badge";
import { CompanyLogo } from "@cd/components/CompanyLogo";
import { useCompany } from "@cd/context/CompanyContext";
import { isNullishStrict, type CompanySummary } from "@cd/lib/companyData";
import { categoryVar } from "@cd/lib/categoryStyle";
import { DIRECTORY_PATHS } from "@cd/routes";

const Value = ({ v }: { v: string }) =>
  isNullishStrict(v) ? <span className="italic text-muted-foreground">not publicly available</span> : <>{v}</>;

const CompanyCardBase = ({ company }: { company: CompanySummary }) => {
  const navigate = useNavigate();
  const { selectCompany } = useCompany();
  const cat = categoryVar(company.companyType);
  const negative = company.yoyGrowthRate.trim().startsWith("-");
  const Trend = negative ? TrendingDown : TrendingUp;

  const handleClick = () => {
    // 1. persist to localStorage + 2. update context (selectCompany does both)
    selectCompany({ companyId: company.companyId, companyName: company.name, logoUrl: company.logoUrl });
    // 3. navigate
    navigate(DIRECTORY_PATHS.intelligence);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={`company-card-${company.companyId}`}
      className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-5 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <CompanyLogo name={company.name} websiteUrl={company.websiteUrl} logoUrl={company.logoUrl} className="h-12 w-12" />
        <Badge
          className="border-[hsl(var(--c)/0.35)] bg-[hsl(var(--c)/0.12)] font-semibold text-[hsl(var(--c))]"
          style={{ "--c": cat } as React.CSSProperties}
        >
          {company.companyType}
        </Badge>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug text-foreground">{company.name}</h3>
      <p className="text-sm text-muted-foreground">{company.shortName}</p>

      <ul className="mt-4 space-y-2 border-t border-border/70 pb-8 pr-10 pt-4 text-sm text-foreground/80">
        <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words"><Value v={company.headquarters} /></span></li>
        <li className="flex items-start gap-2.5"><Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words"><Value v={company.employeeSize} /></span></li>
        <li className={`flex items-start gap-2.5 ${negative ? "text-error" : ""}`}>
          <Trend className={`mt-0.5 h-4 w-4 shrink-0 ${negative ? "text-error" : "text-muted-foreground"}`} />
          <span className="min-w-0 break-words"><Value v={company.yoyGrowthRate} /></span>
        </li>
      </ul>
      <span className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-subtle text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
};

export const CompanyCard = memo(CompanyCardBase);
