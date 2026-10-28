import type { CompanyCategory } from "@cd/lib/companyData";

/** CSS custom-property reference for a category colour. The theme tokens (index.css) keep the brand hue
 *  in light mode and a lighter tint in dark mode so text and badges stay readable. */
export const categoryVar = (c: CompanyCategory | "All"): string =>
  `var(--cat-${c === "All" ? "all" : c.toLowerCase().replace(" ", "-")})`;
