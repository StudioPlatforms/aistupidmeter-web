import { slugifyModelName } from '@/lib/model-slug';
import type { Corpus, LandingSnapshot, PriceSnapshot, ProviderHealth, RosterModel } from './types';

// Absolute URL straight to the API on loopback: a relative path has no origin server-side.
const API = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/** Live Smart Router decisions for every mode. null when the API cannot answer — the page degrades. */
export async function getLandingSnapshot(): Promise<LandingSnapshot | null> {
  try {
    const res = await fetch(`${API}/dashboard/landing`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json as LandingSnapshot) : null;
  } catch {
    return null;
  }
}

/** The same health data the /status page renders. */
export async function getProviderHealth(): Promise<ProviderHealth[] | null> {
  try {
    const res = await fetch(`${API}/providers/status`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success && Array.isArray(json.providers) ? (json.providers as ProviderHealth[]) : null;
  } catch {
    return null;
  }
}

/** Every ranked model, for the crawlable index of model pages. */
export async function getModelRoster(): Promise<RosterModel[]> {
  try {
    const res = await fetch(`${API}/api/models`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((m: any) => m && m.name)
      .map((m: any) => ({
        name: String(m.name),
        displayName: String(m.displayName || m.name),
        vendor: String(m.vendor || m.provider || ''),
        slug: slugifyModelName(String(m.name)),
      }));
  } catch {
    return [];
  }
}

/** What a correct result costs per model, from the test records. null when the API cannot answer. */
export async function getPriceSnapshot(): Promise<PriceSnapshot | null> {
  try {
    const res = await fetch(`${API}/dashboard/price`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json as PriceSnapshot) : null;
  } catch {
    return null;
  }
}

/** Runs, tool-use and reasoning sessions since the first run — the counts the About page shows. */
export async function getCorpus(): Promise<Corpus | null> {
  try {
    const res = await fetch(`${API}/dashboard/enhanced-suites`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const c = (await res.json())?.data?.corpus;
    return c && Number(c.runs) > 0
      ? { runs: Number(c.runs) || 0, toolSessions: Number(c.toolSessions) || 0, deepSessions: Number(c.deepSessions) || 0 }
      : null;
  } catch {
    return null;
  }
}

/** All-time visits to the site — the figure the leaderboard footer shows. */
export async function getVisitTotal(): Promise<number | null> {
  try {
    const res = await fetch(`${API}/visitors/stats`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const v = Number((await res.json())?.totals?.visits);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** One board's top five, best first. `value` is a pass rate (0–1) for coding, a 0–100 score otherwise. */
export interface TopBoard { key: 'coding' | 'reasoning' | 'tooling'; rows: Array<{ name: string; displayName: string; vendor: string; value: number }> }
export interface TopFive { mode: 'live24h' | 'measured'; from?: string; to?: string; boards: TopBoard[] }

/** Real test runs count as live when the newest one is this recent. */
const LIVE_WINDOW_MS = 26 * 3600 * 1000;

/**
 * The landing's top five per board. It shows the 24-hour leaderboard only while real test runs are
 * being recorded — the price snapshot holds test records only, so its newest coding run says so.
 * Otherwise it shows the newest measured window, dated, from those same records: the homepage never
 * presents scores as a 24-hour measurement unless runs measured them in the last day.
 */
export async function getTopFive(price: PriceSnapshot | null): Promise<TopFive | null> {
  const newest = price?.coding?.to ? Date.parse(price.coding.to) : NaN;
  if (Number.isFinite(newest) && Date.now() - newest < LIVE_WINDOW_MS) {
    const sorts: Array<[TopBoard['key'], string]> = [['coding', '7axis'], ['reasoning', 'reasoning'], ['tooling', 'tooling']];
    try {
      const boards = await Promise.all(sorts.map(async ([key, sortBy]) => {
        const res = await fetch(`${API}/dashboard/scores?period=24h&sortBy=${sortBy}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error(String(res.status));
        const rows = ((await res.json())?.data ?? []) as Array<{ name: string; displayName?: string; vendor?: string; provider?: string; currentScore?: number; rankable?: boolean }>;
        return {
          key,
          rows: rows.filter(r => r.rankable !== false && typeof r.currentScore === 'number').slice(0, 5)
            .map(r => ({ name: r.name, displayName: r.displayName || r.name, vendor: r.vendor || r.provider || '', value: r.currentScore as number })),
        };
      }));
      if (boards.every(b => b.rows.length)) return { mode: 'live24h', boards };
    } catch { /* fall through to the measured window */ }
  }
  if (!price?.coding) return null;
  const top = <T,>(rows: T[], v: (r: T) => number) => [...rows].sort((a, b) => v(b) - v(a)).slice(0, 5);
  const boards: TopBoard[] = [
    { key: 'coding', rows: top(price.coding.models, r => r.passRate).map(r => ({ name: r.name, displayName: r.displayName, vendor: r.vendor, value: r.passRate })) },
    ...(price.reasoning?.models.length ? [{ key: 'reasoning' as const, rows: top(price.reasoning.models, r => r.score).map(r => ({ name: r.name, displayName: r.displayName, vendor: r.vendor, value: r.score })) }] : []),
    ...(price.tooling?.models.length ? [{ key: 'tooling' as const, rows: top(price.tooling.models, r => r.score).map(r => ({ name: r.name, displayName: r.displayName, vendor: r.vendor, value: r.score })) }] : []),
  ];
  return { mode: 'measured', from: price.coding.from, to: price.coding.to, boards };
}
