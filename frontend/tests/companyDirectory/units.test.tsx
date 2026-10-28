// Unit tests carried over from the standalone portal, plus data-layer configuration safety.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderValue } from "@cd/pages/CompanyIntelligence";
import { CompanyLogo, logoSources } from "@cd/components/CompanyLogo";
import { buildIntelligenceSections } from "@cd/data/intelligenceData";
import { SEED_COMPANIES } from "@cd/data/seedCompanies";
import {
  normalizeCompanyProfile,
  normalizeCompanySummary,
  normalizeDashboardSkills,
  proficiencyToBloom,
  scoreToCriticality,
} from "@cd/lib/companyData";

describe("normalizers", () => {
  it("builds 22 sections and 12 skills from the seed", () => {
    const c = SEED_COMPANIES[0];
    expect(buildIntelligenceSections(normalizeCompanyProfile(c.full_json, c.short_json))).toHaveLength(22);
    expect(normalizeDashboardSkills(c.skill_levels)).toHaveLength(12);
    expect(proficiencyToBloom(7)).toBe("EV");
    expect(scoreToCriticality(5)).toBe("Important");
  });

  it("never throws on null, wrong-typed or missing JSON", () => {
    for (const bad of [null, undefined, "x", 42, [], { name: null, company_type: 7 }]) {
      const s = normalizeCompanySummary(bad, 5);
      expect(s.name).toBe("");
      expect(s.companyId).toBe(5);
      expect(["Super Dream", "Dream", "Standard", "Regular"]).toContain(s.companyType);
      expect(() => buildIntelligenceSections(normalizeCompanyProfile(bad, bad))).not.toThrow();
      expect(normalizeDashboardSkills(bad)).toEqual([]);
    }
  });
});

describe("renderValue", () => {
  const text = (value: string) => render(<div>{renderValue({ key: "k", label: "L", type: "auto", value })}</div>).container;

  it("keeps numbers with thousands separators as one value", () => {
    expect(text("740,000 employees").textContent).toBe("740,000 employees");
  });
  it("still turns short comma / semicolon lists into pills", () => {
    expect(text("Dublin, Ireland").querySelectorAll("span.rounded-full")).toHaveLength(2);
    expect(text("A; B; C").querySelectorAll("span.rounded-full")).toHaveLength(3);
  });
  it("shows Not Available for nullish values", () => {
    expect(text("NA").textContent).toBe("Not Available");
  });
});

describe("CompanyLogo fallback chain (company logos are kept)", () => {
  it("orders: stored logo_url, then the site's icon, with no duplicates", () => {
    const s = logoSources("https://www.tcs.com/about", "https://cdn.example.com/tcs-logo.svg");
    expect(s[0]).toBe("https://cdn.example.com/tcs-logo.svg");
    expect(s[1]).toContain("faviconV2");
    expect(new Set(s).size).toBe(s.length);
  });

  it("walks the chain on image errors and ends on the letter circle", () => {
    render(<CompanyLogo name="TCS" websiteUrl="https://www.tcs.com" logoUrl="https://cdn.example.com/tcs-logo.svg" />);
    let img = screen.getByAltText("TCS logo");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    fireEvent.error(img);
    img = screen.getByAltText("TCS logo");
    expect(img.getAttribute("src")).toContain("faviconV2");
    fireEvent.error(img);
    expect(screen.queryByAltText("TCS logo")).toBeNull();
    expect(screen.getByLabelText("TCS")).toHaveTextContent("T");
  });

  it("treats the favicon service's tiny 404 placeholder as missing and falls back to the letter", () => {
    render(<CompanyLogo name="Acme" websiteUrl="https://acme.example" />);
    const img = screen.getByAltText("Acme logo");
    Object.defineProperty(img, "naturalWidth", { value: 16 });
    fireEvent.load(img);
    expect(screen.queryByAltText("Acme logo")).toBeNull();
    expect(screen.getByLabelText("Acme")).toHaveTextContent("A");
  });

  it("keeps a real logo that loaded at a usable size", () => {
    render(<CompanyLogo name="Acme" logoUrl="https://cdn.example/acme.png" />);
    const img = screen.getByAltText("Acme logo");
    Object.defineProperty(img, "naturalWidth", { value: 128 });
    fireEvent.load(img);
    expect(screen.getByAltText("Acme logo")).toBeInTheDocument();
  });
});

describe("Supabase configuration safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@cd/lib/supabaseClient");
  });

  it("refuses to query and explains which variable is missing", async () => {
    vi.resetModules();
    vi.doMock("@cd/lib/supabaseClient", () => ({
      supabase: { from: () => { throw new Error("must not query"); } },
      supabaseHost: "(not set)",
      isSupabaseConfigured: false,
      supabaseConfigProblem: "VITE_SUPABASE_ANON_KEY is empty",
    }));
    const api = await import("@cd/lib/companyApi");
    await expect(api.fetchCompanies()).rejects.toBeInstanceOf(api.DirectoryConfigError);
    await expect(api.fetchCompanySkills(1)).rejects.toThrow("VITE_SUPABASE_ANON_KEY is empty");
    const err = await api.fetchCompanyDetail(1).catch((e) => e);
    expect(api.errorMessage(err, "fallback")).toMatch(/not configured/);
    expect(api.errorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });

  it("reports missing variables without ever logging the key", async () => {
    const secret = "eyJhbGciOiJIUzI1NiJ9.test-anon-key-value-that-must-not-be-logged";
    const logs = [vi.spyOn(console, "error"), vi.spyOn(console, "info"), vi.spyOn(console, "log"), vi.spyOn(console, "warn")];
    logs.forEach((s) => s.mockImplementation(() => {}));

    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", secret);
    vi.resetModules();
    const missingUrl = await vi.importActual<typeof import("@cd/lib/supabaseClient")>("@cd/lib/supabaseClient");
    expect(missingUrl.isSupabaseConfigured).toBe(false);
    expect(missingUrl.supabaseConfigProblem).toBe("VITE_SUPABASE_URL is empty");

    vi.stubEnv("VITE_SUPABASE_URL", "abcdefgh");
    vi.resetModules();
    const ok = await vi.importActual<typeof import("@cd/lib/supabaseClient")>("@cd/lib/supabaseClient");
    expect(ok.isSupabaseConfigured).toBe(true);
    expect(ok.supabaseHost).toBe("abcdefgh.supabase.co");

    const printed = logs.flatMap((s) => s.mock.calls.flat().map(String)).join("\n");
    expect(printed).not.toContain(secret);
    expect(printed).not.toMatch(/anonKeyLength|key length/i);
  });
});
