/**
 * Shared bits for the workspace pages (/account/team, /account/team/projects/[id]): calls to the
 * account API through /api/account (which signs them for the user), and the formatters every
 * table on those pages uses, so a dollar or a percentage reads the same everywhere.
 */

export interface ApiResult<T> { ok: boolean; status: number; data: T | null; message: string | null; error: string | null }

/** Call /api/account/org{path}. Never throws: a network failure comes back as ok:false. */
export async function wsApi<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const r = await fetch(`/api/account/org${path}`, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    const j = await r.json().catch(() => null);
    return {
      ok: r.ok && !!j?.success,
      status: r.status,
      data: (j?.data ?? null) as T | null,
      message: j?.message ?? null,
      error: j?.success ? null : (j?.message || j?.error || `Request failed (${r.status})`),
    };
  } catch {
    return { ok: false, status: 0, data: null, message: null, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/** Dollars: four decimals under a cent, cents under $100, whole dollars above. */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  const a = Math.abs(n);
  if (a < 0.01) return `$${n.toFixed(4)}`;
  if (a < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export const pct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(digits)}%`;

export const num = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-US');

export function ms(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n >= 10_000 ? `${(n / 1000).toFixed(0)} s` : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`;
}

export const day = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** "4m", "3h", "2d" — one short token, as the leaderboard does. */
export function ago(iso?: string | null): string {
  if (!iso) return '—';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/** Signed points, for score changes. */
export const pts = (d: number | null | undefined) =>
  d === null || d === undefined ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}`;

/** What each routing strategy does, in the words the preferences page uses. */
export const STRATEGIES: Array<{ id: string; label: string; help: string }> = [
  { id: 'best_overall', label: 'Best overall', help: 'Highest combined score across coding, reasoning and tool use.' },
  { id: 'best_coding', label: 'Best for coding', help: 'Highest coding score.' },
  { id: 'best_reasoning', label: 'Best for reasoning', help: 'Highest reasoning score.' },
  { id: 'best_tooling', label: 'Best for tool use', help: 'Highest tool-use score (agents).' },
  { id: 'best_value', label: 'Best value', help: 'Cheapest model within 5 points of the best score.' },
  { id: 'best_value_coding', label: 'Best value for coding', help: 'Cheapest within 5 points of the best coding score.' },
  { id: 'best_value_reasoning', label: 'Best value for reasoning', help: 'Cheapest within 5 points of the best reasoning score.' },
  { id: 'best_value_tooling', label: 'Best value for tool use', help: 'Cheapest within 5 points of the best tool-use score.' },
  { id: 'best_consistent', label: 'Most consistent', help: 'Smallest run-to-run spread among the leaders.' },
  { id: 'fastest_quality', label: 'Fastest good model', help: 'Lowest measured latency among the leaders.' },
  { id: 'cheapest', label: 'Cheapest', help: 'Lowest price, whatever the score.' },
  { id: 'fastest', label: 'Fastest', help: 'Lowest measured latency, whatever the score.' },
  { id: 'match_task', label: 'Match each request', help: 'Coding, reasoning or tool use, decided per request from its content.' },
  { id: 'custom_split', label: 'Your own traffic split', help: 'Weighted split across models you choose.' },
];
export const strategyLabel = (id: string) => STRATEGIES.find(s => s.id === id)?.label ?? id;

export const PROVIDERS: Array<{ id: string; label: string }> = [
  { id: 'openai', label: 'OpenAI' }, { id: 'anthropic', label: 'Anthropic' }, { id: 'google', label: 'Google' },
  { id: 'deepseek', label: 'DeepSeek' }, { id: 'kimi', label: 'Kimi' }, { id: 'glm', label: 'GLM (Z.ai)' },
];
export const providerLabel = (id: string) => PROVIDERS.find(p => p.id === id)?.label ?? id;

export const ROLE_LABEL: Record<string, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer', manager: 'Manager', member: 'Member' };

export interface ModelOption { id: number; name: string; label: string; vendor: string }

export interface WatchModel {
  modelId: number; name: string; label: string; vendor: string | null;
  score: number | null; delta7d: number | null; measuredAt: string | null; hasFreshData: boolean;
  taskRegressions: number; drift: string | null; note: string | null; addedBy: string | null; addedAt: string;
}

/** The audit actions, as people would say them. */
export const ACTION_WORDS: Record<string, string> = {
  'project.created': 'created the project',
  'project.updated': 'changed the project details',
  'project.deleted': 'deleted the project',
  'project.member_added': 'added',
  'project.member_removed': 'removed',
  'project.member_left': 'left the project',
  'project.member_updated': 'changed the role or cap of',
  'watchlist.model_added': 'started watching',
  'watchlist.model_removed': 'stopped watching',
  'team_watchlist.model_added': 'added to the team watchlist',
  'team_watchlist.model_removed': 'removed from the team watchlist',
  'team_alerts.updated': 'changed team alert settings',
  'alerts.updated': 'changed alert settings',
  'routing.updated': 'changed the routing policy',
  'budget.updated': 'changed the budget',
  'key.created': 'created the key',
  'key.revoked': 'revoked the key',
  'provider_key.added': 'added a provider key:',
  'provider_key.replaced': 'replaced a provider key:',
  'provider_key.removed': 'removed a provider key:',
  'webhook.created': 'added a webhook',
  'webhook.deleted': 'removed a webhook',
  'webhook.enabled': 'resumed a webhook',
  'webhook.disabled': 'paused a webhook',
  'budget.threshold_reached': 'reported a budget threshold for',
  'budget.reached': 'reported the budget reached for',
  'member.cap_warning': 'reported 80% of the monthly cap for',
  'member.cap_reached': 'reported the monthly cap reached for',
  'alert.model_regression': 'sent a change alert for',
};
