import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, Building2, GraduationCap } from "lucide-react";
import { useCompany } from "@cd/context/CompanyContext";
import { cn } from "@cd/lib/utils";
import { DIRECTORY_PATHS } from "@cd/routes";

const TABS = [
  { to: DIRECTORY_PATHS.intelligence, label: "Company Intelligence", icon: Building2 },
  { to: DIRECTORY_PATHS.skills, label: "Skill Intelligence", icon: GraduationCap },
];

/** In-page navigation for a selected company. The host AppShell provides the global sidebar,
 *  topbar, breadcrumb and theme toggle, so this deliberately adds none of those. */
export const CompanyLayout = () => {
  const { selected } = useCompany();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={DIRECTORY_PATHS.home}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All companies
        </Link>
        {selected?.companyName && <span className="truncate text-sm text-muted-foreground">{selected.companyName}</span>}
        <nav aria-label="Company views" className="ml-auto flex gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "bg-subtle text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
};
