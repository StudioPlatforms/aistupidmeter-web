import type { HourBucket } from '@/components/landing/types';
import type { HealthRow } from '@/components/landing/types';
import { MONTHS_SHORT, toDate, utcStamp } from '@/lib/seo';
import { VENDORS, vendorMention, type ProviderEpisode, type ProviderStatus, type ProvidersStatus } from '@/lib/seo-data';

/**
 * The status pages' shared, server-only helpers (app/status/page.tsx and app/status/[provider]).
 * Pure functions, no React: the hub and the provider pages must print the same words for the
 * same check, so the state names, the cause wording, the hourly cell codes, the episode grouping
 * and the verdict rule live here once.
 *
 * The one rule everything rests on: a failed check has three possible authors. Only a failure
 * the provider caused is downtime. A check that failed because of our own account, our own
 * request or our own server is "not measured": it is never shown as an outage and it counts as
 * neither uptime nor downtime. GET /providers/status does that classification; these helpers
 * only render it.
 */

export type HealthState = ProviderStatus['status'];
export type Cause = ProviderStatus['cause'];
export type Cell = '.' | 'w' | 'b' | 'o' | 'e';
export interface Hour extends HourBucket { known: boolean }

/** Every provider's name as the owner writes it: "Moonshot AI (Kimi)", "Z.ai (GLM)", "OpenAI". */
export const LABELS: Record<string, string> = Object.fromEntries(VENDORS.map((v) => [v.key, vendorMention(v)]));
export const labelOf = (provider: string): string => LABELS[provider] ?? provider;

/** The board's order, so lists read the same everywhere. */
export const ORDER = VENDORS.map((v) => v.key as string);
export const byOrder = (a: { provider: string }, b: { provider: string }): number =>
  (ORDER.indexOf(a.provider) + 1 || 99) - (ORDER.indexOf(b.provider) + 1 || 99);

/** What a check can show, and nothing more: the provider answered, or it did not. */
export const STATE_TEXT: Record<HealthState, string> = {
  operational: 'Answering',
  degraded: 'Slow',
  down: 'Not answering',
  unmeasured: 'Not measured',
};
export const STATE_TONE: Record<HealthState, 'ok' | 'warn' | 'bad' | 'na'> = {
  operational: 'ok',
  degraded: 'warn',
  down: 'bad',
  unmeasured: 'na',
};

/** Discreet on purpose (owner, 2026-10-18): which of our own things failed is internal. */
export const CAUSE_TEXT: Record<ProviderEpisode['cause'], string> = {
  provider: 'provider did not answer',
  'our-account': 'an issue on our side',
  probe: 'an issue on our side',
  'our-server': 'an issue on our side',
  latency: 'slow response',
};

const OUR_SIDE = new Set<string>(['our-account', 'probe', 'our-server']);
/** True when the failure was ours, so it must never be called an outage. */
export const isOurSide = (cause: string | null | undefined): boolean => !!cause && OUR_SIDE.has(cause);

/** The feed's "YYYY-MM-DD HH:MM:SS" (UTC, no zone) or an ISO string, as epoch ms; NaN when unparseable. */
export function parseUtc(s: string | null | undefined): number {
  if (!s) return NaN;
  const t = s.trim();
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t.replace(' ', 'T') : t.replace(' ', 'T') + 'Z');
}

/** "just now", "3 minutes ago", "2 hours ago", "4 days ago". */
export function ago(iso: string, now = Date.now()): string {
  const ms = now - parseUtc(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m === 1) return '1 minute ago';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h === 1) return '1 hour ago';
  if (h < 48) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** "12 min", "1h 30m", "2d 4h". */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** "589 ms" under a second, "1.4 s" above. */
export function secs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** "100%", "99.7%". */
export const pct = (u: number): string => `${Number.isInteger(u) ? u : u.toFixed(1)}%`;

/** The newest lastChecked across the providers in the feed; null when there is none. */
export function latestCheck(providers: ProviderStatus[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const p of providers) {
    const ms = parseUtc(p.lastChecked);
    if (Number.isFinite(ms) && ms > bestMs) { bestMs = ms; best = p.lastChecked; }
  }
  return best;
}

/** A fixed 168-hour timeline ending at the current hour, so gaps in the data are visible as gaps. */
export function timeline(hours: HourBucket[], now: Date = new Date()): Hour[] {
  const byHour = new Map(hours.map((h) => [h.t, h]));
  const out: Hour[] = [];
  const end = new Date(now.getTime());
  end.setUTCMinutes(0, 0, 0);
  for (let i = 167; i >= 0; i--) {
    const t = new Date(end.getTime() - i * 3600_000).toISOString().replace('.000Z', 'Z');
    const found = byHour.get(t);
    out.push(found ? { ...found, known: true } : { t, total: 0, down: 0, degraded: 0, unmeasured: 0, known: false });
  }
  return out;
}

/** The board's cell code for one hour (components/landing/StatusBoard): an hour with no check stays empty. */
export function cell(h: Hour): Cell {
  if (!h.known || h.total === 0) return 'e';
  if (h.down > 0) return 'b';
  if (h.unmeasured >= h.total) return 'o';
  if (h.degraded > 0) return 'w';
  return '.';
}

/** An hour's tooltip, in UTC: the server does not know the visitor's time zone. */
export function hourTitle(h: Hour): string {
  const when = h.t.replace('T', ' ').replace(':00:00Z', ':00 UTC');
  if (!h.known || h.total === 0) return `${when} — no checks`;
  const parts = [`${h.total} check${h.total === 1 ? '' : 's'}`];
  if (h.down) parts.push(`${h.down} not answering`);
  if (h.degraded) parts.push(`${h.degraded} slow`);
  if (h.unmeasured) parts.push(`${h.unmeasured} not measured`);
  return `${when} — ${parts.join(', ')}`;
}

/** A provider as the landing's board draws it, on the fixed 168-hour timeline, so gaps stay gaps. */
export function boardRow(p: ProviderStatus, now: Date = new Date()): HealthRow {
  const hours = timeline(p.hours, now);
  return {
    provider: p.provider,
    status: p.status,
    uptime7d: p.uptime7d,
    latencyMs: p.medianLatencyMs ?? p.responseTime,
    lastChecked: p.lastChecked,
    lastHour: hours[hours.length - 1].t,
    cells: hours.map(cell).join(''),
  };
}

/** The same 168 hours as a calendar: one row per UTC day, one column per hour; null outside the window. */
export interface WeekRow { date: string; label: string; cells: Array<Hour | null> }

export function weekRows(hours: HourBucket[], now: Date = new Date()): WeekRow[] {
  const rows = new Map<string, WeekRow>();
  for (const h of timeline(hours, now)) {
    const date = h.t.slice(0, 10);
    let row = rows.get(date);
    if (!row) {
      const d = toDate(`${date}T00:00:00Z`);
      row = { date, label: `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`, cells: new Array<Hour | null>(24).fill(null) };
      rows.set(date, row);
    }
    row.cells[Number(h.t.slice(11, 13))] = h;
  }
  return Array.from(rows.values());
}

/** One line per provider+cause, rather than one line per episode; keeps the most recent end so the line can be dated. */
export interface GroupedEpisodes {
  provider: string;
  cause: ProviderEpisode['cause'];
  episodes: number;
  minutes: number;
  error: string | null;
  lastEndedAt: string | null;
  ongoing: boolean;
}

export function groupEpisodes(list: ProviderEpisode[]): GroupedEpisodes[] {
  const by = new Map<string, GroupedEpisodes>();
  for (const e of list) {
    const key = `${e.provider}:${e.cause}`;
    const g = by.get(key);
    const end = e.endedAt ?? e.startedAt ?? null;
    if (g) {
      g.episodes++;
      g.minutes += e.minutes;
      if (!g.error) g.error = e.error;
      if (end && (!g.lastEndedAt || end > g.lastEndedAt)) g.lastEndedAt = end;
      g.ongoing = g.ongoing || !!e.ongoing;
    } else {
      by.set(key, { provider: e.provider, cause: e.cause, episodes: 1, minutes: e.minutes, error: e.error, lastEndedAt: end, ongoing: !!e.ongoing });
    }
  }
  return Array.from(by.values()).sort((a, b) => (b.lastEndedAt ?? '').localeCompare(a.lastEndedAt ?? ''));
}

/** Provider-caused failures to answer, newest first: the only episodes that are outages. */
export const outagesOf = (episodes: ProviderEpisode[]): ProviderEpisode[] =>
  episodes.filter((e) => e.kind === 'down' && e.cause === 'provider').sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const slowOf = (episodes: ProviderEpisode[]): ProviderEpisode[] =>
  episodes.filter((e) => e.cause === 'latency').sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const ourSideOf = (episodes: ProviderEpisode[]): ProviderEpisode[] =>
  episodes.filter((e) => isOurSide(e.cause));

/** "2026-10-18 11:10:01" → "18 Oct 2026, 11:10 UTC". */
export const stamp = (s: string | null | undefined): string => utcStamp(s);

/* ───────────────────────── the verdict ───────────────────────── */

export interface Verdict {
  state: HealthState;
  tone: 'ok' | 'warn' | 'bad' | 'na';
  /** The state word: Answering, Slow, Not answering, Not measured. */
  head: string;
  /** The rest of the sentence, after the state word. */
  text: string;
  /** The whole sentence, for the FAQ and the structured data. */
  sentence: string;
}

/**
 * One sentence from the data, in the four shapes the owner approved:
 *   Answering — checked 4 minutes ago, median 1.4 s over the last 24 hours.
 *   Slow — the last check answered in 7.2 s, above the 5 s threshold; median 1.4 s over the last 24 hours.
 *   Not answering since 15 Oct 2026, 00:52 UTC (DeepSeek 503 — Service Unavailable).
 *   Not measured: an issue on our side. (never an outage)
 */
export function verdictFor(p: ProviderStatus, episodes: ProviderEpisode[], meta: ProvidersStatus['meta'], apiName: string, now = Date.now()): Verdict {
  const median = secs(p.medianLatencyMs);
  const checked = ago(p.lastChecked, now);
  if (p.status === 'unmeasured' || isOurSide(p.cause)) {
    const text = `an issue on our side. The last check, ${checked}, could not be made from our side, which says nothing about the ${apiName} API. We check again every ${meta.checkIntervalMinutes} minutes.`;
    return { state: 'unmeasured', tone: 'na', head: 'Not measured:', text, sentence: `Not measured: ${text}` };
  }
  if (p.status === 'down') {
    const open = episodes.find((e) => e.ongoing && e.kind === 'down' && e.cause === 'provider');
    const since = open?.startedAt ?? p.lastChecked;
    const text = `since ${utcStamp(since)}${p.error ? ` (${p.error})` : ''}. Last check ${checked}.`;
    return { state: 'down', tone: 'bad', head: 'Not answering', text, sentence: `Not answering ${text}` };
  }
  if (p.status === 'degraded') {
    const last = secs(p.responseTime);
    const threshold = `${Math.round(meta.degradedAboveMs / 1000)} s`;
    const text = `— ${last ? `the last check answered in ${last}, above the ${threshold} threshold` : `the last check took longer than ${threshold}`}${median ? `; median ${median} over the last 24 hours` : ''}. Checked ${checked}.`;
    return { state: 'degraded', tone: 'warn', head: 'Slow', text, sentence: `Slow ${text}` };
  }
  const text = `— checked ${checked}${median ? `, median ${median} over the last 24 hours` : ''}.`;
  return { state: 'operational', tone: 'ok', head: 'Answering', text, sentence: `Answering ${text}` };
}
