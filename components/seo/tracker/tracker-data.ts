import { bucketOf } from '@/lib/fleet-buckets';
import { dayLabel, utcStamp } from '@/lib/seo';
import { VENDORS, getCanaryIncidents, type CanaryIncident, type DriftSuite, type SeoModel, type Vendor } from '@/lib/seo-data';
import { DRIFT_SUITES, getWorseData, listJoin, numWord, type ModelWorse, type WorseData } from '@/components/seo/worse/worse-data';

/**
 * The data behind /ai-degradation-tracker: for every model on the board, each suite's
 * Page-Hinkley detector as a verdict, with how close its statistic is to the threshold, the
 * 24-hour board's own early warning (below baseline), and the hourly canary's alarms over the
 * last 30 days. Everything is read from the same feeds as the drift page and the "is X getting
 * worse" pages (worse-data.ts) plus the canary incident feed; nothing is typed. These are the
 * two signals drift-aware routing reads (apps/api router/selector/drift-flags.ts): a fired
 * detector and an open canary incident.
 */

export type Tone = 'bad' | 'warn' | 'ok' | 'na';

/** One suite of one model, as the tracker shows it. */
export interface SuiteCell {
  suite: DriftSuite;
  label: string;
  tone: Tone;
  /** The pill: "Decline detected", "Confirming", "Below baseline", "No decline", "Calibrating", "No baseline yet". */
  state: string;
  /** The line under the pill: "statistic 0.24 of 0.30", "day 5 of 10". */
  detail: string | null;
  /** The detector's statistic as a share of its threshold, 0 to 1; null when it is not armed. */
  meter: number | null;
  /** The 24-hour board score for this suite, when the model has one. */
  score: number | null;
  /** The detector has a state at all, is past its cold start, is still in it. */
  hasDetector: boolean;
  armed: boolean;
  calibrating: boolean;
}

export interface CanaryCell {
  tone: Tone;
  state: string;
  detail: string | null;
  open: CanaryIncident | null;
}

export interface TrackerRow {
  worse: ModelWorse;
  model: SeoModel;
  cells: SuiteCell[];
  canary: CanaryCell;
  tone: Tone;
  /** "Alarm", "Watch", "No decline", "Calibrating", "No data yet". */
  status: string;
  /** Why the row is red or amber, in words: "coding detector fired", "canary alarm open since 14:00 UTC". */
  reasons: string[];
  /** What drift-aware routing does with the model while its alarm is open; null without one. */
  routerNote: string | null;
}

export interface TrackerGroup {
  vendor: Vendor;
  /** The section's id: "gpt", "claude", "gemini", "deepseek", "kimi", "glm". */
  anchor: string;
  rows: TrackerRow[];
}

export interface TrackerData {
  worse: WorseData;
  /** The canary's alarms over the last 30 days, newest first; null when the feed did not answer. */
  incidents: CanaryIncident[] | null;
  rows: TrackerRow[];
  groups: TrackerGroup[];
  asOf: string | null;
}

const SEVERITY: Record<Tone, number> = { bad: 0, warn: 1, ok: 2, na: 3 };
/**
 * The routing modes that rank on each suite (apps/api router/selector/index.ts driftSuitesFor):
 * agentic coding reads coding and tool use, the combined-score modes read all three.
 */
const MODES: Record<DriftSuite, string> = { hourly: 'coding', deep: 'reasoning', tooling: 'tool-use' };

export const familyAnchor = (v: Vendor): string => v.family.toLowerCase();
const stat = (x: number): string => x.toFixed(2);
const capWord = (x: number): string => { const w = numWord(x); return w.charAt(0).toUpperCase() + w.slice(1); };

function cellOf(m: ModelWorse, def: (typeof DRIFT_SUITES)[number]): SuiteCell {
  const ph = m.ph[def.key];
  const p = m.placements?.[def.board];
  const score = p && p.kind !== 'absent' && p.score !== null ? p.score : null;
  // The board's own trend rule only (lib/fleet-buckets, the API's trendFromSeries): downOn also
  // counts the absolute "critical" band, which is a level, not a fall.
  const below = !!p && p.kind !== 'absent' && p.score !== null
    && bucketOf({ trend: p.trend ?? undefined, standardError: p.se ?? undefined, currentScore: p.score }) === 'degraded';
  const funded = m.model.community.includes(def.key);
  const base = {
    suite: def.key, label: def.label, score,
    hasDetector: !!ph && (ph.armed || ph.fired || ph.days > 0),
    armed: !!ph && (ph.armed || ph.fired),
    calibrating: !!ph && !ph.armed && !ph.fired && ph.days > 0,
  };
  const note = (s: string | null) => (funded ? [s, 'community-funded runs'].filter(Boolean).join(' · ') : s);

  // No signature at all: the drift feed did not answer for this model, which says nothing about it.
  if (!m.signatureAt) {
    return below
      ? { ...base, tone: 'warn', state: 'Below baseline', detail: note('detector not checked this time'), meter: null }
      : { ...base, tone: 'na', state: 'Not checked', detail: note('the drift data did not answer'), meter: null };
  }
  // A detection resets the detector, which re-learns the model's level over the next three daily
  // runs (apps/api lib/page-hinkley.ts PH_REARM); the newest reading is what is shown.
  if (ph?.fired) return { ...base, tone: 'bad', state: 'Decline detected', detail: note('fired on its newest reading'), meter: 1 };
  if (ph?.armed) {
    const meter = ph.threshold > 0 ? Math.min(1, Math.max(0, ph.cusum) / ph.threshold) : null;
    if (ph.confirm > 1 && ph.cusum >= ph.threshold) {
      const days = ph.above >= 1 ? `${numWord(ph.above)} of ${numWord(ph.confirm)} days above the threshold` : `above the threshold; needs ${numWord(ph.confirm)} days in a row`;
      return { ...base, tone: 'warn', state: 'Confirming', detail: note(days), meter };
    }
    if (below) return { ...base, tone: 'warn', state: 'Below baseline', detail: note(`detector at ${stat(ph.cusum)} of ${stat(ph.threshold)}`), meter };
    return { ...base, tone: 'ok', state: 'No decline', detail: note(`detector at ${stat(ph.cusum)} of ${stat(ph.threshold)}`), meter };
  }
  if (ph && ph.days > 0) {
    const days = `day ${ph.days} of ${ph.coldStart}`;
    return below
      ? { ...base, tone: 'warn', state: 'Below baseline', detail: note(`detector calibrating, ${days}`), meter: null }
      : { ...base, tone: 'na', state: 'Calibrating', detail: note(days), meter: null };
  }
  return below
    ? { ...base, tone: 'warn', state: 'Below baseline', detail: note('no detector baseline yet'), meter: null }
    : { ...base, tone: 'na', state: 'No baseline yet', detail: note(null), meter: null };
}

/** "40 min", "1 h", "3 h", "2 days": how long an alarm stayed open (the canary checks on the hour, so 59 minutes reads as 1 h). */
export function durationText(fromIso: string, toIso: string): string {
  const min = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  if (min < 55) return `${Math.max(1, min)} min`;
  const h = min / 60;
  if (h < 36) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

function canaryOf(m: ModelWorse, incidents: CanaryIncident[] | null): CanaryCell {
  if (incidents === null) return { tone: 'na', state: 'Not checked', detail: 'the incident feed did not answer', open: null };
  const mine = incidents.filter((i) => String(i.modelId) === m.model.id);
  const open = mine.find((i) => !i.resolvedAt) ?? null;
  if (open) return { tone: 'bad', state: 'Canary alarm', detail: `open since ${utcStamp(open.detectedAt)}`, open };
  const last = mine[0];
  if (last && last.resolvedAt) return { tone: 'ok', state: 'No alarm', detail: `last on ${dayLabel(last.detectedAt)}, closed after ${durationText(last.detectedAt, last.resolvedAt)}`, open: null };
  // A model tracked for less than the feed's 30 days gets no day count: the detectors count
  // distinct UTC dates and the roster whole elapsed days, and two numbers would disagree.
  const young = m.model.daysTracked !== null && m.model.daysTracked < 30;
  return { tone: 'ok', state: 'No alarm', detail: young ? 'none since tracking began' : 'none in 30 days', open: null };
}

/** One model's row; exported for the edge-case checks, the page uses getTrackerData. */
export function rowOf(m: ModelWorse, incidents: CanaryIncident[] | null): TrackerRow {
  const cells = DRIFT_SUITES.map((d) => cellOf(m, d));
  const canary = canaryOf(m, incidents);
  const tones = [...cells.map((c) => c.tone), canary.tone === 'bad' ? 'bad' : null].filter(Boolean) as Tone[];
  const tone: Tone = tones.includes('bad') ? 'bad' : tones.includes('warn') ? 'warn' : cells.every((c) => c.tone === 'na') ? 'na' : 'ok';
  const status = tone === 'bad' ? 'Alarm' : tone === 'warn' ? 'Watch' : tone === 'ok' ? 'No decline'
    : cells.every((c) => c.state === 'Not checked') ? 'Not checked'
      : cells.every((c) => c.state === 'No baseline yet') ? 'No data yet' : 'Calibrating';

  const reasons = [
    ...cells.filter((c) => c.tone === 'bad').map((c) => `${c.label.toLowerCase()} detector fired`),
    ...(canary.open ? [`canary alarm open since ${utcStamp(canary.open.detectedAt)}`] : []),
    ...cells.filter((c) => c.tone === 'warn').map((c) => (c.state === 'Confirming' ? `${c.label.toLowerCase()} detector confirming` : `${c.label.toLowerCase()} below its baseline`)),
  ];

  const firedSuites = cells.filter((c) => c.tone === 'bad').map((c) => c.suite);
  const modes = [...firedSuites.map((s) => MODES[s]), ...(firedSuites.some((s) => s === 'hourly' || s === 'tooling') ? ['agentic coding'] : [])];
  const routerNote = canary.open
    ? 'Smart Router: for new requests, behind every model without an alarm in every mode, until the canary alarm closes.'
    : modes.length
      ? `Smart Router: for new requests, behind every model without an alarm in the ${listJoin(modes)} modes and the combined-score modes.`
      : null;

  return { worse: m, model: m.model, cells, canary, tone, status, reasons, routerNote };
}

/** Everything the tracker page needs. */
export async function getTrackerData(): Promise<TrackerData> {
  const [worse, incidents] = await Promise.all([getWorseData(), getCanaryIncidents()]);
  const tracked = worse.models.filter((m) => m.onBoard || m.detectors.some((d) => d.kind !== 'none'));
  const rows = tracked
    .map((m, i) => ({ row: rowOf(m, incidents), i }))
    .sort((a, b) => SEVERITY[a.row.tone] - SEVERITY[b.row.tone] || a.i - b.i)
    .map((x) => x.row);
  const groups = VENDORS
    .map((v) => ({ vendor: v, anchor: familyAnchor(v), rows: rows.filter((r) => r.model.vendor === v.key) }))
    .filter((g) => g.rows.length > 0);
  return { worse, incidents, rows, groups, asOf: worse.asOf };
}

/* ───────────────────────── counts and sentences ───────────────────────── */

export interface TrackerCounts {
  models: number;
  alarms: number;
  watch: number;
  calibrating: number;
  /** Model-suite detectors past their cold start, and how many of them have fired. */
  armed: number;
  fired: number;
  series: number;
  /** Canary alarms over the last 30 days, and how many are open now. */
  canary30: number;
  canaryOpen: number;
}

export function trackerCounts(d: TrackerData): TrackerCounts {
  const cells = d.rows.flatMap((r) => r.cells);
  return {
    models: d.rows.length,
    alarms: d.rows.filter((r) => r.tone === 'bad').length,
    watch: d.rows.filter((r) => r.tone === 'warn').length,
    calibrating: d.rows.filter((r) => r.cells.some((c) => c.calibrating)).length,
    armed: cells.filter((c) => c.armed).length,
    fired: cells.filter((c) => c.state === 'Decline detected').length,
    series: cells.filter((c) => c.hasDetector).length,
    canary30: d.incidents?.length ?? 0,
    canaryOpen: d.incidents?.filter((i) => !i.resolvedAt).length ?? 0,
  };
}

const named = (rows: TrackerRow[]): string => listJoin(rows.map((r) => `${r.model.displayName} (${listJoin(r.reasons)})`));

/** The answer under the "Status now" heading; null when nothing could be read. */
export function statusSentence(d: TrackerData): string | null {
  if (!d.rows.length) return null;
  const c = trackerCounts(d);
  const alarms = d.rows.filter((r) => r.tone === 'bad');
  const watch = d.rows.filter((r) => r.tone === 'warn');
  const unchecked = d.rows.filter((r) => r.status === 'Not checked');
  const judged = c.models - unchecked.length;
  const parts: string[] = [];
  if (alarms.length) {
    parts.push(`${alarms.length} of the ${c.models} models on the tracker ${alarms.length === 1 ? 'has' : 'have'} an open alarm: ${named(alarms)}.`);
    parts.push(`By default the Smart Router puts ${alarms.length === 1 ? 'it' : 'them'} behind every model without an alarm, for new requests in the modes the alarm affects.`);
  } else if (judged > 0) {
    parts.push(judged === c.models ? `None of the ${c.models} models on the tracker has an open alarm.` : `None of the ${judged} models that could be checked has an open alarm.`);
  }
  if (unchecked.length) parts.push(`The drift data for ${listJoin(unchecked.map((r) => r.model.displayName))} did not answer this time, so ${unchecked.length === 1 ? 'it is' : 'they are'} left unjudged.`);
  if (watch.length) parts.push(`${watch.length === 1 ? 'One model is' : `${capWord(watch.length)} models are`} on watch, with an early warning that no detector has confirmed yet: ${named(watch)}.`);
  if (c.series) parts.push(`${c.armed - c.fired} of ${c.series} per-suite detectors are armed with no detection${c.calibrating ? `, and ${c.calibrating} ${c.calibrating === 1 ? 'model is' : 'models are'} still calibrating` : ''}.`);
  return parts.join(' ');
}

/** One family's line under its heading. */
export function familySentence(g: TrackerGroup): string {
  const fam = g.vendor.family;
  const alarms = g.rows.filter((r) => r.tone === 'bad');
  const watch = g.rows.filter((r) => r.tone === 'warn');
  const unchecked = g.rows.filter((r) => r.status === 'Not checked').length;
  const n = g.rows.length;
  const tail = unchecked ? ` The drift data for ${unchecked === 1 ? 'one model' : `${numWord(unchecked)} models`} did not answer this time.` : '';
  if (alarms.length) return `${alarms.length} of ${n} ${fam} ${n === 1 ? 'model has' : 'models have'} an open alarm: ${named(alarms)}.${tail}`;
  if (unchecked === n) return `The drift data for the ${fam} ${n === 1 ? 'model' : 'models'} did not answer this time.`;
  if (watch.length) return `No ${fam} model has an open alarm; ${watch.length === 1 ? 'one is' : `${numWord(watch.length)} are`} on watch: ${named(watch)}.${tail}`;
  const judged = n - unchecked;
  if (!unchecked) return n === 1 ? `The ${fam} model on the tracker has no open alarm.` : `None of the ${n} ${fam} models on the tracker has an open alarm.`;
  return (judged === 1 ? `The ${fam} model checked has no open alarm.` : `None of the ${judged} ${fam} models checked has an open alarm.`) + tail;
}

/* ───────────────────────── the canary log ───────────────────────── */

const fmtMean = (x: number): string => x.toFixed(1);

export function pText(p: number): string {
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
}

/** "Canary score fell from 79.4 to 50.0 over the last 6 hours (Welch's t-test, p = 0.008)." */
export function incidentText(i: CanaryIncident): string {
  const window = i.window ? i.window.replace(/\bh\b/, 'hours') : 'test window';
  const fall = i.baselineMean !== null && i.recentMean !== null
    ? `Canary score fell from ${fmtMean(i.baselineMean)} over the prior seven days to ${fmtMean(i.recentMean)} over the ${window}`
    : `Canary score fell sharply over the ${window}`;
  return `${fall}${i.p !== null ? ` (Welch’s t-test, ${pText(i.p)})` : ''}.`;
}
