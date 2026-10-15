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
