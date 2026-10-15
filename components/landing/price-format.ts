/** Formatting for the cost-per-result figures (GET /dashboard/price), shared by server and client parts. */

/** What 1,000 results cost: "$24.22", "$0.30", "$6,089". */
export function per1k(cost: number): string {
  const v = cost * 1000;
  if (v >= 1000) return `$${Math.round(v).toLocaleString('en-US')}`;
  if (v >= 100) return `$${Math.round(v)}`;
  return `$${v.toFixed(2)}`;
}

export const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

/** "81×", "4.3×". */
export const times = (ratio: number): string =>
  ratio >= 10 ? `${Math.round(ratio).toLocaleString('en-US')}×` : `${ratio.toFixed(1).replace(/\.0$/, '')}×`;

/** Typical time for one attempt or one session. */
export function duration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
  return ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "23 Sep – 14 Oct", in UTC and without the locale's month names, so server and browser render the same text. */
export function dayRange(from: string, to: string): string {
  const d = (s: string) => { const t = new Date(s); return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`; };
  return `${d(from)} – ${d(to)}`;
}

/** The cheaper model passed at least as often by construction; say "more often" only when it clearly did. */
export const oftenWord = (base: number, other: number): string => (other - base >= 0.02 ? 'more often' : 'about as often');

export const LOGO_VENDORS = new Set(['openai', 'anthropic', 'google', 'deepseek', 'glm', 'kimi']);
export const logoFor = (vendor: string): string => `/logos/${LOGO_VENDORS.has(vendor) ? vendor : 'openai'}.svg`;
