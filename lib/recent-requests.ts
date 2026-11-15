import type { AnalyticsOverview, CostSavings, RecentRequest } from './api-client';

/**
 * One routed request as the Smart Router dashboard (Recent activity) and Analytics (Recent requests,
 * and its CSV and JSON exports) show it, beyond the fields they always had: what the request asked
 * for, and why the router chose its model. Pure functions, so tests/aw1 can check them.
 *
 * `requestedModel` (and `strategy`, `benchmark`, `conversation`) arrive with the API's A1 release
 * (adaptive-routing plan §7.4): from then on on every item, possibly null; before it, absent. Each
 * page shows what a request asked for only when the API sends it, so the web can deploy before or
 * after the API in either order.
 */

/**
 * A request refused before any model was chosen (no provider key, an unknown mode, a project rule).
 * The API records the name the request sent as its model and the refusal code as its reason
 * (router/billing/request-accounting.ts logRefusal); the analytics route reads the same prefix.
 */
const REFUSED = /^Refused before routing:/;
export const refusedBeforeRouting = (req: Pick<RecentRequest, 'reason'>): boolean =>
  typeof req.reason === 'string' && REFUSED.test(req.reason);

/**
 * What the request's `model` field said, in the words the workspace's Requests view already uses for
 * project requests (components/workspace/project/ActivityTab.tsx): "asked for auto-best" when another
 * model answered, "named" when the request named the model that answered. null when the API does not
 * send `requestedModel` (before A1), when nothing was recorded, and for a request refused before
 * routing, whose row already shows the name it sent.
 */
export function askedFor(req: Pick<RecentRequest, 'model' | 'requestedModel' | 'reason'>): string | null {
  const asked = req.requestedModel;
  if (typeof asked !== 'string' || !asked.trim() || refusedBeforeRouting(req)) return null;
  return asked === req.model ? 'named' : `asked for ${asked}`;
}

/**
 * The routing reason shown under "Why this model": exactly as the API stored it when the request was
 * routed, so an old request keeps the words of its day (history is never rewritten). null when there
 * is none, and for a request refused before routing (no model was chosen; its row says why).
 */
export function whyThisModel(req: Pick<RecentRequest, 'reason'>): string | null {
  const reason = req.reason;
  if (typeof reason !== 'string' || !reason.trim() || refusedBeforeRouting(req)) return null;
  return reason;
}

/* ── exports (app/router/analytics, "Export data") ─────────────────────────────────────────────── */

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, a double quote or a line break, with its
 * quotes doubled. Text a spreadsheet would run as a formula (starting with =, +, -, @, tab or carriage
 * return) gets a leading apostrophe; the requested model is whatever the caller's app sent. Numbers
 * are written as they are; null and undefined are empty.
 */
export function csvField(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvRow = (fields: Array<string | number | boolean | null | undefined>): string => `${fields.map(csvField).join(',')}\n`;

/** The A1 fields, in export order, with their CSV headers. `Requested` follows the workspace requests CSV (`requested`). */
const A1_FIELDS: Array<['requestedModel' | 'strategy' | 'benchmark' | 'conversation', string]> = [
  ['requestedModel', 'Requested'],
  ['strategy', 'Strategy'],
  ['benchmark', 'Benchmark'],
  ['conversation', 'Conversation'],
];

/** Whether the API sent the A1 fields: present on the items (null counts), absent before A1. */
export const hasA1Fields = (rows: RecentRequest[]): boolean => rows.some(r => r.requestedModel !== undefined);

/**
 * The "# RECENT REQUESTS" block: today's seven columns first, in today's order, then the A1 fields
 * when the API sends them, then the routing reason (always; null reasons are empty).
 */
export function recentRequestsCsv(rows: RecentRequest[]): string {
  if (!rows.length) return '';
  const a1 = hasA1Fields(rows);
  let csv = '\n# RECENT REQUESTS\n';
  csv += csvRow(['Timestamp', 'Model', 'Provider', 'Status', 'Tokens', 'Cost', 'Latency', ...(a1 ? A1_FIELDS.map(([, h]) => h) : []), 'Reason']);
  for (const r of rows) {
    csv += csvRow([
      isoTime(r.timestamp), r.model, r.providerLabel ?? r.provider, r.success ? 'OK' : 'FAIL', r.tokensIn + r.tokensOut, r.cost, r.latency,
      ...(a1 ? A1_FIELDS.map(([k]) => r[k]) : []),
      r.reason,
    ]);
  }
  return csv;
}

/** ISO time for the export; a timestamp the browser cannot read is written as sent instead of failing the whole file. */
function isoTime(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString();
}

export interface AnalyticsExport {
  /** When the file was made, as the page words it (toLocaleString) for the CSV and as ISO for the JSON. */
  exportDateText: string;
  exportDateIso: string;
  timeRange: string;
  overview: AnalyticsOverview;
  costSavings: CostSavings | null;
  recentRequests: RecentRequest[];
}

/** The Analytics page's CSV export. Before AW1 the date was unquoted, and its comma split the row. */
export function analyticsCsv(x: AnalyticsExport): string {
  const o = x.overview.overview;
  let csv = '# ANALYTICS OVERVIEW\n';
  csv += csvRow(['Export Date', x.exportDateText]) + csvRow(['Time Range', x.timeRange]);
  csv += csvRow(['Total Requests', o.totalRequests]) + csvRow(['Success Rate', o.successRate]);
  csv += csvRow(['Total Cost', `$${o.totalCost}`]) + csvRow(['Total Tokens', o.totalTokens]);
  if (x.costSavings) {
    csv += `\n# COST SAVINGS\n${csvRow(['Actual Cost', `$${x.costSavings.actualCost}`])}${csvRow(['Worse Case', `$${x.costSavings.worstCaseCost}`])}${csvRow(['Savings', `$${x.costSavings.savings}`])}`;
  }
  if (x.overview.providers.length > 0) {
    csv += '\n# PROVIDER BREAKDOWN\nProvider,Requests,Percentage,Total Cost\n';
    x.overview.providers.forEach(p => { csv += csvRow([p.provider, p.requests, p.percentage, p.totalCost]); });
  }
  return csv + recentRequestsCsv(x.recentRequests);
}

/** The JSON export: every request as the API sent it, so the A1 fields and the reason are in it whenever the API has them. */
export function analyticsJson(x: AnalyticsExport): string {
  return JSON.stringify({
    exportDate: x.exportDateIso, timeRange: x.timeRange, overview: x.overview.overview, costSavings: x.costSavings,
    providers: x.overview.providers, topModels: x.overview.topModels, recentRequests: x.recentRequests,
  }, null, 2);
}
