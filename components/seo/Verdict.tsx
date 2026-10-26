import type { ReactNode } from 'react';

/** The one-sentence answer under an SEO page's H1: what the data says, before anything else. */
export function Verdict({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`seo-verdict ${className}`.trim()}>{children}</p>;
}

/** The "As of 23 Oct 2026, 16:20 UTC" / "last 24 hours" line, muted, under a verdict or a table. */
export function AsOf({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`seo-asof ${className}`.trim()}>{children}</p>;
}
