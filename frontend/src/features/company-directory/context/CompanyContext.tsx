import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface SelectedCompany {
  companyId: number;
  companyName: string;
  logoUrl: string;
}

/** Namespaced like the host's other keys ("radix-tm:*"). */
export const SELECTED_COMPANY_KEY = "radix-tm:company-directory:selected-company";
/** Key used by the standalone portal; migrated once, then removed. */
export const LEGACY_SELECTED_COMPANY_KEY = "selected-company";

function parseSelected(raw: string | null): SelectedCompany | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const p = parsed as Partial<Record<keyof SelectedCompany, unknown>>;
    const id = Number(p.companyId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return {
      companyId: id,
      companyName: typeof p.companyName === "string" ? p.companyName.slice(0, 200) : "",
      logoUrl: typeof p.logoUrl === "string" ? p.logoUrl.slice(0, 2000) : "",
    };
  } catch {
    return null;
  }
}

/** Reads localStorage. Returns null if missing/invalid (invalid values are removed). The company itself is loaded from Supabase. */
export function readSelectedCompany(): SelectedCompany | null {
  try {
    const current = localStorage.getItem(SELECTED_COMPANY_KEY);
    const selected = parseSelected(current);
    if (selected) return selected;
    if (current !== null) localStorage.removeItem(SELECTED_COMPANY_KEY); // malformed or stale shape

    const legacy = parseSelected(localStorage.getItem(LEGACY_SELECTED_COMPANY_KEY));
    localStorage.removeItem(LEGACY_SELECTED_COMPANY_KEY);
    if (legacy) localStorage.setItem(SELECTED_COMPANY_KEY, JSON.stringify(legacy));
    return legacy;
  } catch {
    return null;
  }
}

export function writeSelectedCompany(c: SelectedCompany | null) {
  try {
    if (c) localStorage.setItem(SELECTED_COMPANY_KEY, JSON.stringify(c));
    else localStorage.removeItem(SELECTED_COMPANY_KEY);
  } catch {
    /* storage unavailable: context state still works for this session */
  }
}

interface CompanyContextValue {
  selected: SelectedCompany | null;
  selectCompany: (c: SelectedCompany) => void;
  clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  // Restore on startup from localStorage
  const [selected, setSelected] = useState<SelectedCompany | null>(() => readSelectedCompany());

  const selectCompany = useCallback((c: SelectedCompany) => {
    writeSelectedCompany(c); // persist first; never rely solely on React state
    setSelected(c);
  }, []);

  const clearCompany = useCallback(() => {
    writeSelectedCompany(null);
    setSelected(null);
  }, []);

  const value = useMemo(() => ({ selected, selectCompany, clearCompany }), [selected, selectCompany, clearCompany]);
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};
