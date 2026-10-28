import { useEffect, useState } from "react";
import { cn } from "@cd/lib/utils";

const LOGO_DEV_KEY = import.meta.env.VITE_LOGO_DEV_PUBLISHABLE_KEY as string | undefined;

const domainOf = (url?: string) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

interface Props {
  name: string;
  websiteUrl?: string;
  logoUrl?: string; // seed/DB fallback
  className?: string;
}

/** Ordered logo candidates: Logo.dev (if a key is set) -> stored logo_url -> the company site's own icon
 *  (Google favicon service, no key needed; responds 404 when it has none) -> initial-letter circle.
 *  Recruiting-company logos only. */
export const logoSources = (websiteUrl?: string, logoUrl?: string): string[] => {
  const domain = domainOf(websiteUrl);
  const list = [
    LOGO_DEV_KEY && domain ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_KEY}&size=128&format=png` : "",
    (logoUrl ?? "").trim(),
    domain ? `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodeURIComponent(`https://${domain}`)}&size=128` : "",
  ].filter(Boolean);
  return [...new Set(list)];
};

export const CompanyLogo = ({ name, websiteUrl, logoUrl, className }: Props) => {
  const sources = logoSources(websiteUrl, logoUrl);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [name, websiteUrl, logoUrl]);

  const src = sources[idx];
  if (!src) {
    return (
      <div
        aria-label={name}
        className={cn("flex shrink-0 items-center justify-center rounded-full bg-subtle font-heading font-semibold text-primary", className ?? "h-10 w-10")}
      >
        {(name.trim()[0] ?? "?").toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`${name} logo`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => i + 1)}
      // Google's favicon service answers "no icon" with HTTP 404 *and* a 16px placeholder that browsers
      // render without firing onError. We ask for 128px, so a tiny image means "no logo": try the next source.
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth < 32) setIdx((i) => i + 1);
      }}
      className={cn("shrink-0 rounded-lg border border-border bg-white object-contain p-1", className ?? "h-10 w-10")}
    />
  );
};
