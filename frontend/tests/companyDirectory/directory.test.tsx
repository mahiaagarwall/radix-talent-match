// Company Directory integrated into the host app: rendered through the host providers, router and AppShell.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error host modules are JavaScript without type declarations
import { AppProviders, AppRoutes } from "../../src/App";
import { directoryQueryClient } from "@cd/CompanyDirectoryRoutes";
import { LEGACY_SELECTED_COMPANY_KEY, SELECTED_COMPANY_KEY } from "@cd/context/CompanyContext";
import { fakeState, queriedTables, selectLog } from "./fakeSupabase";

const location = { pathname: "" };
const LocationSpy = () => {
  location.pathname = useLocation().pathname;
  return null;
};

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>
        <AppRoutes />
        <LocationSpy />
      </AppProviders>
    </MemoryRouter>,
  );
}

const ACCENTURE = { companyId: 1, companyName: "Accenture plc", logoUrl: "" };
const select = (c: object) => localStorage.setItem(SELECTED_COMPANY_KEY, JSON.stringify(c));
const mainNav = () => screen.getByRole("navigation", { name: "Main navigation" });

beforeEach(() => {
  fakeState.mode = "ok";
  directoryQueryClient.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});
afterEach(cleanup);

describe("navigation", () => {
  it("puts Company Directory immediately below Dashboard and keeps the workflow links unchanged", () => {
    renderAt("/");
    const labels = within(mainNav()).getAllByRole("link").map((a) => a.textContent?.replace(/\d+$/, "").trim());
    expect(labels).toEqual([
      "Dashboard",
      "Company Directory",
      "JD Analytics",
      "Resume Parsing",
      "Profile Builder",
      "Talent Check",
      "Skill Matching",
      "Job Finder",
      "Resume Coach",
      "Results",
      "Settings",
    ]);
    const hrefs = within(mainNav()).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/",
      "/company-directory",
      "/jd-analytics",
      "/resume-parsing",
      "/profile-builder",
      "/talent-check",
      "/skill-matching",
      "/job-finder",
      "/resume-coach",
      "/results",
      "/settings",
    ]);
  });

  it("keeps the Dashboard at / and opens the directory from the sidebar with an active link", async () => {
    const user = userEvent.setup();
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: /See Talent in True Depth/ })).toBeInTheDocument();
    await user.click(within(mainNav()).getByRole("link", { name: /Company Directory/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Company Directory" })).toBeInTheDocument();
    expect(location.pathname).toBe("/company-directory");
    expect(within(mainNav()).getByRole("link", { name: /Company Directory/ })).toHaveClass("active");
    expect(within(mainNav()).getByRole("link", { name: /Dashboard/ })).not.toHaveClass("active");
    expect(document.title).toBe("Company Directory · PARALLAX");
  });

  it("keeps the directory link active on company subpages and shows the page in the breadcrumb", async () => {
    select(ACCENTURE);
    renderAt("/company-directory/company/skills");
    expect(await screen.findByRole("heading", { name: /Accenture Skill Intelligence/i })).toBeInTheDocument();
    expect(within(mainNav()).getByRole("link", { name: /Company Directory/ })).toHaveClass("active");
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Company Directory" })).toHaveAttribute("href", "/company-directory");
    expect(within(crumbs).getByText("Skill Intelligence")).toHaveAttribute("aria-current", "page");
    expect(document.title).toBe("Skill Intelligence · PARALLAX");
  });

  it("does not create a nested router", async () => {
    const errors = vi.spyOn(console, "error");
    renderAt("/company-directory");
    await screen.findByText("Accenture plc");
    const messages = errors.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => /inside another <Router>/i.test(m))).toBe(false);
  });

  it("sends unknown directory URLs to the host NotFound page", async () => {
    renderAt("/company-directory/nope");
    expect(await screen.findByRole("heading", { level: 1, name: /Page not found/ })).toBeInTheDocument();
  });
});

describe("directory list", () => {
  it("lists companies, tolerates missing fields, and counts categories", async () => {
    renderAt("/company-directory");
    expect(await screen.findByText("Accenture plc")).toBeInTheDocument();
    expect(screen.getByText("Globex Systems")).toBeInTheDocument();
    // JSON stored as text, null fields; no short_name, so the name doubles as the short name
    expect(screen.getAllByText("Initech Labs").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("company-card-3")).getAllByText("not publicly available").length).toBeGreaterThan(0);
    const group = screen.getByRole("group", { name: "Filter by category" });
    const count = (label: string) => within(group).getByRole("button", { name: new RegExp(`^${label} \\(`) }).textContent;
    expect(count("All")).toBe("All (3)");
    expect(count("Super Dream")).toBe("Super Dream (1)");
    expect(count("Dream")).toBe("Dream (1)");
    expect(count("Regular")).toBe("Regular (1)"); // missing company_type
    expect(count("Standard")).toBe("Standard (0)");

    fireEvent.click(within(group).getByRole("button", { name: /^Super Dream/ }));
    expect(within(group).getByRole("button", { name: /^Super Dream/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Accenture plc")).toBeNull();
    expect(screen.getByText("Globex Systems")).toBeInTheDocument();
  });

  it("searches by name and location, shows the no-results state, and resets", async () => {
    const user = userEvent.setup();
    renderAt("/company-directory");
    await screen.findByText("Accenture plc");
    const search = screen.getByRole("searchbox", { name: "Search companies" });

    await user.type(search, "pune");
    await waitFor(() => expect(screen.queryByText("Accenture plc")).toBeNull());
    expect(screen.getByText("Globex Systems")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz-nothing");
    expect(await screen.findByText("No companies match your search")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(await screen.findByText("Accenture plc")).toBeInTheDocument();
  });

  it("shows an honest error with Retry when Supabase fails, then recovers", async () => {
    fakeState.mode = "error";
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/company-directory");
    const alert = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alert).toHaveTextContent("Could not load companies");
    expect(screen.queryByText("Accenture plc")).toBeNull(); // no fake success
    fakeState.mode = "ok";
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Accenture plc")).toBeInTheDocument();
  });

  it("explains an empty result (no rows or RLS) instead of showing a blank page", async () => {
    fakeState.mode = "empty";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    renderAt("/company-directory");
    expect(await screen.findByText("The database returned no companies")).toBeInTheDocument();
    expect(screen.getByText(/Row Level Security/)).toBeInTheDocument();
  });
});

describe("company pages and selection", () => {
  beforeEach(() => localStorage.clear());

  it("opens a company from its card and persists the selection under the namespaced key", async () => {
    renderAt("/company-directory");
    fireEvent.click(await screen.findByTestId("company-card-1"));
    expect(location.pathname).toBe("/company-directory/company/intelligence");
    expect(JSON.parse(localStorage.getItem(SELECTED_COMPANY_KEY)!).companyId).toBe(1);
    await waitFor(() => expect(document.querySelectorAll("section[data-section]")).toHaveLength(22));
    const sections = screen.getByRole("navigation", { name: "Company sections" });
    expect(within(sections).getAllByRole("button")).toHaveLength(22);
  });

  it("survives a refresh on the intelligence and skills pages and switches between them", async () => {
    select(ACCENTURE);
    renderAt("/company-directory/company/intelligence");
    await waitFor(() => expect(document.querySelectorAll("section[data-section]")).toHaveLength(22));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Company views" })).getByRole("link", { name: /Skill Intelligence/ }));
    expect(await screen.findByRole("heading", { name: /Accenture Skill Intelligence/i })).toBeInTheDocument();
    expect(location.pathname).toBe("/company-directory/company/skills");

    const cards = screen.getAllByTestId("skill-card");
    expect(cards).toHaveLength(12);
    fireEvent.click(within(cards[0]).getByRole("button"));
    expect(within(cards[0]).getAllByRole("listitem")).toHaveLength(10);
    expect(within(cards[0]).getByText("Data Structures & Algorithms")).toBeInTheDocument();
    expect(within(cards[0]).getAllByText("Beyond scope")).toHaveLength(2);

    fireEvent.click(screen.getByRole("link", { name: /All companies/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Company Directory" })).toBeInTheDocument();
  });

  it("redirects /company-directory/company to the intelligence page", async () => {
    select(ACCENTURE);
    renderAt("/company-directory/company");
    await waitFor(() => expect(location.pathname).toBe("/company-directory/company/intelligence"));
  });

  it("sends company pages without a selection to the directory, not to 404", async () => {
    renderAt("/company-directory/company/skills");
    await waitFor(() => expect(location.pathname).toBe("/company-directory"));
    expect(screen.queryByText(/Page not found/)).toBeNull();
  });

  it("drops malformed stored selections", async () => {
    localStorage.setItem(SELECTED_COMPANY_KEY, "{not json");
    renderAt("/company-directory/company/intelligence");
    await waitFor(() => expect(location.pathname).toBe("/company-directory"));
    expect(localStorage.getItem(SELECTED_COMPANY_KEY)).toBeNull();
    cleanup();

    localStorage.setItem(SELECTED_COMPANY_KEY, JSON.stringify({ companyId: "-4", companyName: 5 }));
    renderAt("/company-directory/company/intelligence");
    await waitFor(() => expect(location.pathname).toBe("/company-directory"));
  });

  it("migrates the standalone portal's selection key once", async () => {
    localStorage.setItem(LEGACY_SELECTED_COMPANY_KEY, JSON.stringify(ACCENTURE));
    renderAt("/company-directory/company/intelligence");
    await waitFor(() => expect(document.querySelectorAll("section[data-section]")).toHaveLength(22));
    expect(localStorage.getItem(LEGACY_SELECTED_COMPANY_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(SELECTED_COMPANY_KEY)!)).toEqual(ACCENTURE);
  });

  it("shows a clear message for a stale selection that is no longer in the database", async () => {
    select({ companyId: 999, companyName: "Gone Corp", logoUrl: "" });
    renderAt("/company-directory/company/intelligence");
    expect(await screen.findByRole("alert")).toHaveTextContent("This company is not in the database.");
  });

  it("queries only company_json and the four skill tables, never full_json for the list", async () => {
    queriedTables.length = 0;
    selectLog.length = 0;
    renderAt("/company-directory");
    fireEvent.click(await screen.findByTestId("company-card-1"));
    await waitFor(() => expect(document.querySelectorAll("section[data-section]")).toHaveLength(22));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Company views" })).getByRole("link", { name: /Skill Intelligence/ }));
    await screen.findAllByTestId("skill-card");

    const allowed = new Set(["company_json", "company_skill_levels", "skill_set_master", "proficiency_levels", "skill_set_topics"]);
    expect(new Set(queriedTables)).toEqual(allowed);
    const jsonSelects = selectLog.filter((q) => q.table === "company_json");
    expect(jsonSelects.some((q) => q.cols.includes("short_json") && !q.cols.includes("full_json"))).toBe(true);
    expect(jsonSelects.some((q) => q.cols.includes("full_json"))).toBe(true);
  });
});

describe("branding and theme", () => {
  const JSS = /JSS|Noida|University|INTELLIGENCE PLATFORM|Placement Analytics Portal|College/i;

  it("shows no JSS or college branding on any directory page, but keeps company logos", async () => {
    renderAt("/company-directory");
    await screen.findByText("Accenture plc");
    expect(document.body.textContent).not.toMatch(JSS);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Company Directory");
    for (const img of Array.from(document.images)) {
      expect(img.getAttribute("src") ?? "").not.toMatch(/jss|university|college/i);
      expect(img.getAttribute("alt") ?? "").not.toMatch(JSS);
    }
    cleanup();

    select(ACCENTURE);
    renderAt("/company-directory/company/intelligence");
    await waitFor(() => expect(document.querySelectorAll("section[data-section]")).toHaveLength(22));
    expect(screen.getAllByAltText("Accenture plc logo").length).toBeGreaterThan(0); // business logo kept
    for (const el of Array.from(document.querySelectorAll("[aria-label], [title], [alt]"))) {
      const label = ["aria-label", "title", "alt"].map((a) => el.getAttribute(a) ?? "").join(" ");
      expect(label).not.toMatch(/JSS|Noida|University/i);
    }
  });

  it("follows the host theme (data-theme) and has no second theme toggle", async () => {
    const user = userEvent.setup();
    renderAt("/company-directory");
    await screen.findByText("Accenture plc");
    const toggles = screen.getAllByRole("button", { name: /Switch to (dark|light) theme|dark mode|light mode/i });
    expect(toggles).toHaveLength(1); // only the host topbar toggle
    const before = document.documentElement.getAttribute("data-theme");
    await user.click(toggles[0]);
    const after = document.documentElement.getAttribute("data-theme");
    expect(after).not.toBe(before);
    expect(["light", "dark"]).toContain(after);
    expect(document.documentElement.classList.contains("dark")).toBe(false); // portal's class mechanism is gone
    expect(localStorage.getItem("theme")).toBeNull(); // no competing storage key
    expect(screen.getByTestId("company-directory")).toHaveClass("cd-root");
  });

  it("renders the decorative particle canvas behind the hero content", async () => {
    renderAt("/company-directory");
    await screen.findByText("Accenture plc");
    const canvas = screen.getByTestId("particle-background");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas.parentElement).toHaveClass("cd-hero");
    const heading = screen.getByRole("heading", { level: 1, name: "Company Directory" });
    expect(canvas.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("keyboard", () => {
  it("reaches the search, category filters and company cards with Tab", async () => {
    const user = userEvent.setup();
    renderAt("/company-directory");
    await screen.findByText("Accenture plc");
    const search = screen.getByRole("searchbox", { name: "Search companies" });
    act(() => search.focus());
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName(/^All \(3\)/);
    for (let i = 0; i < 4; i += 1) await user.tab();
    await user.tab();
    expect(document.activeElement).toHaveAttribute("data-testid", "company-card-1");
    await user.keyboard("{Enter}");
    expect(location.pathname).toBe("/company-directory/company/intelligence");
  });
});
