'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ApiRequestError, importEndpoint, personalEndpointsApi, teamEndpointsApi } from '@/lib/api-client';
import type {
  ProviderEndpoint,
  Endpoint, EndpointAuthScheme, EndpointCreate, EndpointLimits, EndpointList, EndpointModel, EndpointRole, EndpointSharing,
  EndpointModelPatch, EndpointPatch, EndpointProbe, EndpointProbeStatus, EndpointProbeStep, EndpointView, ModelSource, DeferredProbe,
  EndpointsApi, EndpointUsage, SharedEndpoint, TeamEndpoint, TeamEndpointList,
} from '@/lib/api-client';
import Link from 'next/link';
import { routerProvider } from '@/lib/router-providers';
import { Pane, Modal, Empty, Loader, Note, Tag, Pill, ProviderMark, CopyButton } from '@/components/studio';
import HealthView from '@/components/router/EndpointHealth';
import '@/styles/studio-endpoints.css';

/**
 * "Your endpoints" on the Providers page: OpenAI-compatible servers an account runs or rents (R3,
 * staff only). The page renders this only when GET /router/endpoints answered 200; the API answers
 * 404 to every account endpoints are not switched on for.
 *
 * From R5 the same pane, dialog and rows serve a workspace's servers too (`scope`): "Servers for
 * every project" on the workspace page (the owner adds them and chooses which projects, and whether
 * members' personal keys, may use them) and "Servers for this project" on a project's Smart Router
 * tab (its managers add them; everyone in the project reads them, with the workspace's servers shared
 * with it). Their models are called ep/team.<slug>/<model>, and the workspace pages call them servers
 * (plan §6.4). The personal pane is unchanged by this; only `scope` switches the words and the calls.
 *
 * Adding one is three steps in one dialog. 1, the connection: saved at once, and the API starts a
 * test of the address and the model list in which no model is asked to answer. 2, that test, line by
 * line as it arrives. 3, the models: which to test (at most 4 per test, because each one makes
 * Ollama or LM Studio load it and possibly unload another), which to turn on, and their context
 * size, output cap and declared price. A model can be turned on only after it passed a test and its
 * context size is known; the API refuses anything else (needs_test, needs_context), and the reason
 * is shown next to the model.
 *
 * Requests reach an endpoint model when they name it, ep/<slug>/<model>. Endpoints are not
 * benchmarked, and nothing here reads like a score. Copy: the API contract, with its R3 changes.
 */

// ── rules the API applies too (checked here first so a typo is named before a round trip) ─────────

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set(['auto', 'ep', 'all', 'team']);
/** API keys, Cloudflare Access values and model ids: printable ASCII, no space. */
const PRINTABLE = /^[\x21-\x7E]+$/;
/** Models per test: each tested model is loaded by Ollama and LM Studio. */
const MAX_TEST = 4;
const POLL_MS = 1500;
const SLOW_POLL_MS = 4000;
/** The connection test is polled for up to 2 minutes, a model test (up to 4 cold loads) for 15. */
const CONNECTION_POLL_LIMIT_MS = 120_000;
const MODEL_POLL_LIMIT_MS = 15 * 60_000;

const AUTH_OPTIONS: Array<{ id: EndpointAuthScheme; label: string }> = [
  { id: 'bearer', label: 'API key as Bearer token' },
  { id: 'x-api-key', label: 'x-api-key header' },
  { id: 'api-key', label: 'api-key header' },
  { id: 'none', label: 'No key' },
];

/** Default ports of the common servers; a chip puts the port and /v1 on the host typed so far. */
const PRESETS: Array<{ label: string; port: number }> = [
  { label: 'vLLM', port: 8000 },
  { label: 'SGLang', port: 30000 },
  { label: 'llama.cpp', port: 8080 },
  { label: 'Ollama', port: 11434 },
  { label: 'LM Studio', port: 1234 },
  { label: 'TGI', port: 8080 },
];

const LOCKED = 'Endpoint changes are paused on this account for an hour: several addresses you added turned out, through DNS or a redirect, to point at private networks.';
/**
 * A crash pause (D39, R6). The API pauses the endpoint whose request was running when the router crashed,
 * and from R6 also one added (or moved) to an address where that happened within 7 days, so the sentence
 * names the address, which is true of both. A first pause ends with a passing model test; an owner-only
 * one (healthError starts with OWNER_ONLY_PREFIX, the API's quarantine.ts) only when AI Stupid Level
 * resumes it, so it has its own sentence and no "Test again" (R6 review M4).
 */
const quarantined = (noun: Noun) => `The router crashed during a request to this address, so this ${noun} is paused. Test one of its models to resume it. A second crash within 7 days keeps it paused until AI Stupid Level resumes it.`;
const OWNER_ONLY_PREFIX = 'Paused after two router crashes within 7 days';
/** What a member who only reads a crash-paused server is told (no reason text reaches them). */
const READONLY_PAUSED = 'The router crashed during a request to this address, so this server is paused until it is resumed.';
const ownerOnlyText = (noun: Noun) => `The router crashed twice within 7 days during requests to this address, so this ${noun} stays paused until AI Stupid Level resumes it. A test cannot resume it.`;
/** Why "Test again" is off for an owner-only pause (its tooltip; the row's sentence says it in full). */
const OWNER_ONLY_NO_TEST = 'Only AI Stupid Level can resume it: a test cannot.';
const CONTACT_HREF = '/contact?topic=support';
/** An owner-only crash pause: the state, and the API's own sentence in the list (healthError) or the detail (health.lastError). */
export function isOwnerOnlyPause(state: unknown, error: unknown): boolean {
  return state === 'quarantined' && typeof error === 'string' && error.slice(0, OWNER_ONLY_PREFIX.length) === OWNER_ONLY_PREFIX;
}
/** The owner-only sentence with the way to reach us. */
function OwnerOnlyText({ noun }: { noun: Noun }) {
  return <>{ownerOnlyText(noun)} <Link href={CONTACT_HREF}>Contact us</Link> to have it checked and resumed.</>;
}
const NO_KEY_NOTE = 'Without a key, anyone who finds this address can use your server, including other AI Stupid Level accounts. Set an API key on your server.';
const UNPROTECTED_TIP = 'No key: anyone who finds this address can use it. Set an API key on your server.';
const SLUG_RULE = 'Use lowercase letters, digits and hyphens (at most 32, not starting or ending with a hyphen). auto, ep, all and team are taken.';
const MODEL_ID_RULE = 'Model ids can use printable ASCII characters only, without spaces (at most 200). The router has to name the model in an HTTP header.';

// ── small formatters ─────────────────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`);
const fmtInt = (n: number) => n.toLocaleString('en-US');

function fmtWait(sec: number): string {
  if (sec < 60) return `${Math.max(1, sec)} s`;
  const min = Math.ceil(sec / 60);
  return min < 60 ? `${min} min` : plural(Math.ceil(min / 60), 'hour');
}

/** "14:02" today, "Nov 10, 14:02" before. */
function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? hm : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${hm}`;
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The model id prefix the API derives from a name when none is given. */
export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 32).replace(/-+$/, '');
}

const epId = (ns: Ns, slug: string, model: string) => `ep/${ns}${slug}/${model}`;
const vendorName = (v: string) => routerProvider(v)?.name ?? (v === 'xai' ? 'xAI' : v ? v.charAt(0).toUpperCase() + v.slice(1) : 'a cloud provider');
/** "a" or "an" by the sound of the word: an OpenAI, an Anthropic, an xAI ("ex"), a Google, a DeepSeek. */
export const articleFor = (word: string, capital = false) => {
  const a = /^[aeiou]/i.test(word) || /^x/i.test(word) ? 'an' : 'a';
  return capital ? a.charAt(0).toUpperCase() + a.slice(1) : a;
};
const isRunning = (s: EndpointProbeStatus | undefined | null) => s === 'queued' || s === 'running';

// ── where the endpoints belong (R5) ───────────────────────────────────────────────────────────────

/**
 * Whose endpoints a pane shows. `personal` (the default) is the Providers page, exactly as before R5.
 * `workspace`: the workspace's servers, for the owner (`projects` names the projects a server can be
 * shared with). `project`: one project's servers and the workspace's servers shared with it;
 * `canManage` (a project manager or the owner) may change the project's own servers, everyone else
 * reads them. `modelSource` is the project's saved source when the API has the setting (D45).
 */
export type EndpointScope =
  | { kind: 'personal' }
  | { kind: 'workspace'; projects: Array<{ id: number; name: string }> }
  | { kind: 'project'; projectId: number; canManage: boolean; isOwner: boolean; modelSource?: ModelSource | null }
  /**
   * M4: a provider account's endpoints (/account/provider/endpoints; `api` is providerEndpointsApi()). https only,
   * always a key, hosts on the account's verified domains; their models are listed on /account/provider/models,
   * never routed by ep/ ids.
   */
  | { kind: 'provider'; hostRule: 'verified' | 'verified_or_attested' | 'none'; verifiedDomains: string[] };

type Noun = 'endpoint' | 'server';
/** The namespace in a model id: '' for ep/<slug>/…, 'team.' for a workspace's or project's ep/team.<slug>/… */
type Ns = '' | 'team.';

interface ScopeCtx {
  kind: EndpointScope['kind'];
  api: EndpointsApi;
  ns: Ns;
  /** What one is called: "endpoint" on the Providers page, "server" on the workspace pages (plan §6.4). */
  noun: Noun;
  /** The workspace's projects, for "Share with" (workspace scope only). */
  projects: Array<{ id: number; name: string }>;
  /** M4, provider scope: the host rule and the verified domains, for the form's hints. */
  hostRule?: 'verified' | 'verified_or_attested' | 'none';
  verifiedDomains?: string[];
}

const PERSONAL_SCOPE: ScopeCtx = { kind: 'personal', api: personalEndpointsApi, ns: '', noun: 'endpoint', projects: [] };
const ScopeContext = createContext<ScopeCtx>(PERSONAL_SCOPE);
const useScope = () => useContext(ScopeContext);
const isTeam = (s: ScopeCtx) => s.kind === 'workspace' || s.kind === 'project';
const isProvider = (s: ScopeCtx) => s.kind === 'provider';

// ── what the API said, in a sentence ──────────────────────────────────────────────────────────────

interface Where { host?: string; port?: string }

function hostPort(baseUrl: string): Where {
  try {
    const u = new URL(baseUrl);
    return { host: u.hostname, port: u.port || (u.protocol === 'http:' ? '80' : '443') };
  } catch {
    return {};
  }
}

/**
 * §6.1 "Guard and probe messages, by code", for an answer that carries a code but no sentence, and
 * for the checks this form makes itself. The API's own message wins whenever it sends one: it knows
 * the address a name resolved to, which this page does not. `team`: a workspace's or project's
 * servers (R5), where the few sentences that name the thing say "server".
 */
function codeMessage(code: string | null | undefined, at: Where = {}, body?: Record<string, unknown>, team = false): string | null {
  const d = body && body.detail && typeof body.detail === 'object' ? body.detail as Record<string, unknown> : {};
  const host = (typeof d.host === 'string' && d.host) || at.host || 'The server';
  const port = typeof d.port === 'number' || typeof d.port === 'string' ? String(d.port) : at.port;
  const location = typeof d.location === 'string' && d.location ? d.location : 'another address';
  switch (code) {
    case 'address_not_allowed':
      return `${host} points to an address the router does not connect to. The router only connects to public internet addresses; a server on your own network needs a public address or a tunnel first.`;
    case 'host_not_allowed':
      return 'localhost, .local, .internal and single-word names only exist on your own network. Use a public host name or a tunnel URL.';
    case 'own_host': return 'That is AI Stupid Level itself. Add your own model server, not the Smart Router.';
    case 'use_provider_key': return `${host} is a built-in provider. Add its key under Available providers, where the router measures its models.`;
    case 'url_credentials': return 'Put the key in the API key field, not in the URL.';
    case 'url_query_not_allowed':
    case 'url_fragment_not_allowed': return 'The base URL cannot contain ? or #. Put keys in the API key field.';
    case 'scheme_not_allowed': return 'Use https://, or tick the plain-HTTP box for a server without TLS.';
    case 'http_not_acknowledged': return 'Tick “I understand this is unencrypted” to use a plain-HTTP address.';
    case 'port_not_allowed':
      return `Port ${port ?? 'this'} is reserved for other services (databases, mail, remote admin). Endpoints can use 80, 443, or 1024–65535 except those ports.`;
    case 'dns_failed': return `${host} does not resolve.`;
    case 'dns_timeout': return `${host} did not resolve in time.`;
    case 'ipv6_unreachable': return `${host} has only an IPv6 address; the router connects over IPv4.`;
    case 'redirect_refused': return `The server redirected to ${location}. Redirects are not followed: use the final address.`;
    case 'tls_failed': return `The TLS certificate for ${host} could not be verified.`;
    case 'connect_refused': return `Nothing answered on ${host}${port ? `:${port}` : ''} (connection refused).`;
    case 'connect_timeout': return `${host}${port ? `:${port}` : ''} did not accept a connection within 5 s.`;
    case 'compressed_response': return 'The server sent a compressed answer although the router asked for none. Turn off forced compression in front of the server.';
    case 'not_openai_compatible': return 'The server answered, but GET /models did not return an OpenAI model list.';
    case 'invalid_model_id': return MODEL_ID_RULE;
    case 'endpoint_actions_locked': return LOCKED;
    case 'url_invalid': return 'That is not a valid URL.';
    case 'url_too_long': return 'The URL is longer than 2,048 characters.';
    case 'name_required': return team ? 'Give the server a name (up to 60 characters).' : 'Give the endpoint a name (up to 60 characters).';
    case 'slug_invalid': return SLUG_RULE;
    case 'slug_taken': return team
      ? 'The workspace already has a server with this model id prefix. Choose another one.'
      : 'You already have an endpoint with this model id prefix. Choose another one.';
    case 'endpoint_exists': return team ? 'A server with this base URL has already been added here.' : 'You have already added an endpoint with this base URL.';
    case 'key_invalid': return 'The key can use printable ASCII characters only, without spaces (at most 4,096).';
    case 'timeout_invalid': return 'Wait for the first byte must be between 10 and 900 seconds.';
    case 'limit_reached': return team
      ? 'The workspace’s plan limit for servers is reached. Remove a server to add another.'
      : 'Your plan’s endpoint limit is reached. Remove an endpoint to add another.';
    case 'plan_required': return team ? 'The workspace’s plan does not include servers of its own.' : 'Your own endpoints are included in Pro and above.';
    case 'needs_test': return 'Test this model before you turn it on.';
    case 'needs_context': return 'Enter this model’s context size before you turn it on.';
    case 'probe_running': return `A test of this ${team ? 'server' : 'endpoint'} is already running.`;
    case 'not_found': return team ? 'This server no longer exists. Close this and reload the page.' : 'This endpoint no longer exists. Close this and reload the page.';
    default: return null;
  }
}

/**
 * Which probe limit refused a test (429 probe_rate_limited, `limit`), in a sentence. The numbers
 * are the API's PROBE_LIMITS (plan §R3 "Probe limits"). `destination` is either the account's own
 * hourly limit for one server or the ceiling all accounts share for it; one sentence covers both.
 */
function probeLimitText(limit: unknown, at: Where, team = false): string {
  switch (limit) {
    case 'endpoint': return `This ${team ? 'server' : 'endpoint'} has had 6 tests in the last 10 minutes, the most allowed.`;
    case 'user': return 'Your account has run 30 tests in the last hour, the most allowed.';
    case 'destination': return `Tests of ${at.host || 'this server'} have reached their hourly limit.`;
    case 'queue': return 'Many tests are waiting to run right now.';
    case 'queued_per_user': return 'You already have 3 tests waiting to start.';
    case 'crash_cooloff': return 'Model tests of this endpoint are paused for a while, after one of its answers caused a router error. Testing the connection still works.';
    default: return team ? 'This server has been tested as often as the limits allow for now.' : 'This endpoint, or the server it runs on, has been tested as often as the limits allow for now.';
  }
}

function errorText(err: unknown, at: Where = {}, team = false): string {
  if (!(err instanceof ApiRequestError)) {
    return err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.';
  }
  const wait = err.retryAfterSec;
  if (err.status === 423 || err.error === 'endpoint_actions_locked') {
    return wait != null && wait > 0 ? `${LOCKED} Try again in ${fmtWait(wait)}.` : LOCKED;
  }
  if (err.status === 429) {
    // The proxy forwards the body, not Retry-After: the wait comes from retryAfterSec.
    const later = wait != null ? ` Try again in ${fmtWait(wait)}.` : ' Try again later.';
    if (err.error === 'probe_rate_limited') return `${probeLimitText(err.body.limit, at, team)}${later}`;
    if (err.error === 'rate_limited') return `You have added as many ${team ? 'servers' : 'endpoints'} as an hour allows.${later}`;
    return `Too many requests in a short time.${later}`;
  }
  const field = err.field;
  if (err.error === 'invalid_model_settings' && field && !err.body.message) return `${FIELD_LABEL[field] ?? field} is out of range.`;
  const own = err.message && !/^Request failed with status \d+$/.test(err.message) ? err.message : null;
  return own ?? codeMessage(err.code ?? err.error, at, err.body, team) ?? 'Something went wrong. Try again.';
}

const FIELD_LABEL: Record<string, string> = {
  declaredContextTokens: 'Context', maxOutputTokens: 'Max output', priceInPerMTok: 'Input price', priceOutPerMTok: 'Output price', enabled: 'Use',
  roles: 'Use for',
};

// ── status chip (§6.1 "Status chips") ─────────────────────────────────────────────────────────────

interface Chip { label: string; tone?: 'good' | 'warn' | 'bad' | 'accent'; detail?: ReactNode }

function chipFor(e: Endpoint, testing: boolean, limits: EndpointLimits | null, noun: Noun = 'endpoint'): Chip {
  if (testing) return { label: 'Testing…', tone: 'accent' };
  if (e.healthState === 'quarantined') {
    return isOwnerOnlyPause(e.healthState, e.healthError)
      // A label no longer than the first pause's, so the pill fits a 320 px row; the sentence says the rest.
      ? { label: 'Paused after two crashes', tone: 'bad', detail: <OwnerOnlyText noun={noun} /> }
      : { label: 'Paused after a router crash', tone: 'bad', detail: quarantined(noun) };
  }
  if (!e.active) return { label: 'Paused' };
  if (e.overPlanLimit) {
    return noun === 'server'
      ? { label: 'Over the plan’s limit', tone: 'warn', detail: `${limits ? `The workspace’s plan includes ${plural(limits.max, 'server')}. ` : ''}This one is kept and is used again when the plan allows it.` }
      : { label: 'Over your plan’s limit', tone: 'warn', detail: `Your plan includes ${plural(limits?.max ?? 0, 'endpoint')}. This one is kept and is used again when your plan allows it.` };
  }
  // The API's sentence for the last failure, ending in a full stop.
  const said = e.healthError && e.healthError.trim() ? e.healthError.trim().replace(/\.?$/, '.') : '';
  switch (e.healthState) {
    case 'up': return { label: 'Up', tone: 'good' };
    case 'degraded': return { label: 'Degraded', tone: 'warn', detail: said || undefined };
    case 'down':
      return {
        label: e.healthChangedAt ? `Down since ${fmtClock(e.healthChangedAt)}` : 'Down',
        tone: 'bad',
        detail: `${said || 'It is not answering.'} Requests skip it until it answers again.`,
      };
    case 'blocked': return { label: 'Blocked', tone: 'bad', detail: `${said ? `${said} ` : ''}Fix the DNS record, then test again.` };
    case 'auth_failed': {
      const status = /\b(401|403)\b/.exec(e.healthError || '')?.[1];
      return { label: 'Key refused', tone: 'bad', detail: `The server refused the key${status ? ` (HTTP ${status})` : ''}. Update the key, then test again.` };
    }
    case 'stopped_checking': return { label: 'No longer checked', tone: 'warn', detail: 'Down for 7 days. Test again to resume checks.' };
    default: return e.needsTest ? { label: 'Needs a new test', tone: 'warn' } : { label: 'Not tested' };
  }
}

// ── the pane ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The dialog's footer strip, where each step puts its buttons (as the router key dialog does), so
 * they stay in view while a long form or model list scrolls. A portal keeps the buttons inside the
 * step that owns their state.
 */
function Foot({ el, children }: { el: HTMLElement | null; children: ReactNode }) {
  return el ? createPortal(children, el) : null;
}

type Flow =
  | { step: 'connection'; mode: 'add' }
  | { step: 'connection'; mode: 'edit'; id: string }
  /** `deferred`: the API did not start the test (create or address change under the kill switch) and said why. */
  | { step: 'test'; mode: 'add' | 'manage'; id: string; probeId: number | null; deferred?: string | null }
  | { step: 'models'; mode: 'add' | 'manage'; id: string }
  /** R6: the endpoint's health over time (24-hour bars, 7-day uptime, recent failures). */
  | { step: 'health'; mode: 'manage'; id: string };

interface Notice { tone?: 'good' | 'warn' | 'bad'; title: string; body?: ReactNode }

/**
 * `modelSource`: the account's saved Model source when the API has the setting (R4, D45); undefined
 * against an older API, which keeps R3's wording: there, endpoints answer only requests that name them.
 *
 * From R5: `scope` says whose endpoints these are (the account's own when absent) and `api` makes the
 * calls for that scope (teamEndpointsApi() for a workspace or project). `importable`: the caller's own
 * endpoints, offered under "Copy from your endpoints…" to those who may add servers here (team scopes).
 */
export default function EndpointsPane({ list, reload, modelSource, scope, api, importable }: {
  list: EndpointList | TeamEndpointList;
  reload: () => Promise<void>;
  modelSource?: ModelSource;
  scope?: EndpointScope;
  api?: EndpointsApi;
  importable?: Endpoint[] | null;
}) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  // An endpoint the dialog created or changed, until the list has caught up with it.
  const [fresh, setFresh] = useState<Endpoint | null>(null);
  const [footEl, setFootEl] = useState<HTMLDivElement | null>(null);
  const [importing, setImporting] = useState(false);

  const kind = scope?.kind ?? 'personal';
  // "Share with" lists the workspace's projects: the list's own (R5: every project, for the owner), else the page's.
  const listProjects = 'projects' in list && Array.isArray(list.projects) ? list.projects : null;
  const workspaceProjects = scope?.kind === 'workspace' ? (listProjects ?? scope.projects) : null;
  const projectId = scope?.kind === 'project' ? scope.projectId : undefined;
  // A workspace's or project's pane never falls back to the personal calls: without `api` it makes its own.
  const ctx = useMemo<ScopeCtx>(() => (kind === 'personal' ? PERSONAL_SCOPE
    : kind === 'provider' ? { kind, api: api ?? personalEndpointsApi, ns: '', noun: 'endpoint', projects: [],
      hostRule: scope?.kind === 'provider' ? scope.hostRule : 'verified', verifiedDomains: scope?.kind === 'provider' ? scope.verifiedDomains : [] }
      : { kind, api: api ?? teamEndpointsApi(projectId), ns: 'team.', noun: 'server', projects: workspaceProjects ?? [] }),
  [kind, api, projectId, workspaceProjects, scope]);
  const provider = kind === 'provider';
  const team = isTeam(ctx);
  // Who may change them: a project's manager (the page says), the workspace list's own word (R5 contract §2).
  const listCanManage = 'canManage' in list && typeof list.canManage === 'boolean' ? list.canManage : true;
  const canManage = scope?.kind === 'project' ? scope.canManage : kind === 'workspace' || kind === 'provider' ? listCanManage : true;

  const sorted = useMemo(() => [...list.endpoints].sort((a, b) => a.position - b.position), [list.endpoints]);
  // A project's list holds its own servers and the workspace's servers shared with it (`source`).
  const endpoints = useMemo(() => (kind === 'project' ? sorted.filter(e => (e as TeamEndpoint).source !== 'workspace') : sorted), [kind, sorted]);
  const fromWorkspace = useMemo(() => (kind === 'project' ? sorted.filter(e => (e as TeamEndpoint).source === 'workspace') : []), [kind, sorted]);
  const shared: SharedEndpoint[] = 'shared' in list && Array.isArray(list.shared) ? list.shared : [];
  const limits: EndpointLimits | null = list.limits ?? null;
  const free = !team && !provider && !!limits && limits.max === 0 && limits.plan === 'free';
  const atLimit = !!limits && !limits.soft && limits.max >= 0 && limits.used >= limits.max;
  const byId = (id: string) => endpoints.find(e => e.id === id) ?? (fresh && fresh.id === id ? fresh : undefined);
  const canImport = team && canManage && !!importable && importable.length > 0;

  const markTesting = useCallback((id: string, on: boolean) => setTesting(t => (!!t[id] === on ? t : { ...t, [id]: on })), []);

  const act = async (e: Endpoint, what: string, run: () => Promise<Notice | null>) => {
    setBusy(`${e.id}:${what}`);
    try {
      const n = await run();
      setNotice(n);
      await reload();
    } catch (err) {
      setNotice({ tone: 'bad', title: `${e.name}: not done`, body: errorText(err, hostPort(e.baseUrl), team) });
    } finally {
      setBusy(null);
    }
  };

  const pause = (e: Endpoint) => act(e, 'pause', async () => {
    await ctx.api.update(e.id, { active: !e.active });
    return null;
  });

  // A project on Only our own servers whose last ready server this is: every request would fail.
  const usable = (e: Endpoint) => e.active && !e.overPlanLimit && (e.enabledModelCount ?? 0) > 0 && e.healthState !== 'quarantined';
  const lastForProjectOnly = (e: Endpoint) => scope?.kind === 'project' && scope.modelSource === 'only_endpoints' && usable(e)
    && [...endpoints, ...fromWorkspace].filter(usable).length === 1;

  const remove = (e: Endpoint) => {
    // The same plain confirmation the provider keys above use. Under Only my endpoints, removing the
    // last one leaves routed requests nowhere to go (§6.1 remove confirmation).
    // A ready shared server keeps a personal Only working (contract §5), so it is not the last then.
    const lastUnderOnly = modelSource === 'only_endpoints' && endpoints.length === 1 && !shared.some(usable);
    const text = provider
      ? `Remove ${e.name}?${(e as ProviderEndpoint).provider?.listings?.length ? ' The models listed on it are detached and paused until you choose another endpoint for them.' : ''}`
      : team
      ? `Remove ${e.name}? Requests that name its models (ep/team.${e.slug}/…) will fail with model_not_found.${lastForProjectOnly(e)
        ? '\n\nThis project’s Model source is Only our own servers and this is its last ready server: every request made with its keys will fail with no_endpoints until you add another.'
        // The workspace page cannot see each project's source: say what removal does to one on Only.
        : kind === 'workspace' ? '\n\nA project set to Only our own servers that has no other server ready will fail every request with no_endpoints.' : ''}`
      : `Remove ${e.name}? Requests that name its models (ep/${e.slug}/…) will fail with model_not_found.${lastUnderOnly
        ? '\n\nModel source is Only my endpoints and this is your last endpoint: every request routed with your personal router keys will fail with no_endpoints until you add another.'
        : ''}`;
    if (!confirm(text)) return;
    void act(e, 'remove', async () => {
      const r = await ctx.api.remove(e.id);
      const warnings = (r?.warnings ?? []).filter(w => typeof w === 'string' && w);
      return {
        tone: warnings.length ? 'warn' : 'good',
        title: `${e.name} removed`,
        body: warnings.length ? <ul className="ep-list">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : undefined,
      };
    });
  };

  const move = (e: Endpoint, by: -1 | 1) => {
    const ids = endpoints.map(x => x.id);
    const i = ids.indexOf(e.id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void act(e, 'move', async () => { await ctx.api.reorder(ids); return null; });
  };

  const closeFlow = () => { setFlow(null); setFresh(null); void reload(); };

  const flowEndpoint = flow && 'id' in flow ? byId(flow.id) : undefined;
  const add = () => setFlow({ step: 'connection', mode: 'add' });
  const addLabel = team ? 'Add server' : 'Add endpoint';
  // The order is a preference: health, what a model is tagged for (Use for) and, under a price or latency
  // strategy, price or latency come first (the API's orderEndpoints, plan §5.2), then this order (review SHOULD-2).
  const orderFirst = 'Health, Use for and, under Cheapest, Fastest or Fastest good model, price or latency come first; then this order';
  const orderTitle = kind === 'project'
    ? `This project’s preferred order. ${orderFirst}, with this project’s own servers before the workspace’s.`
    : kind === 'workspace' ? `The workspace’s preferred order. ${orderFirst}.` : `Your preferred order. ${orderFirst}.`;

  /** After "Save models": how to use what was turned on, for the scope it was turned on in. */
  const savedBody = (example: string | null): ReactNode => {
    if (provider) return <>List tested models on <Link href="/account/provider/models">Models</Link>.</>;
    const pointer = kind === 'personal'
      // §6.1 "Save models" toast: only where the API has Model source (R4) and it is still All.
      ? (modelSource === 'all' ? <>To route automatic requests to your endpoints, set <Link href="/router/preferences">Model source in Routing preferences</Link>.</> : null)
      : kind === 'project'
        ? (scope?.kind === 'project' && scope.modelSource === 'all' ? <>To send this project’s automatic requests to its servers first or only, choose Prefer our servers or Only our own servers in Routing rules.</> : null)
        : <>Projects use it when a request names it, and for every request once their Routing rules choose Prefer our servers or Only our own servers.</>;
    if (!example) return pointer ?? undefined;
    return (
      <>
        Name a model in your requests to use it, for example <code className="ep-id is-long">{example}</code> <CopyButton text={example} />
        {pointer && <> {pointer}</>}
      </>
    );
  };

  const headActions: ReactNode = provider
    ? (canManage && endpoints.length > 0 ? (
        <button type="button" className="st-btn is-sm" onClick={add} disabled={atLimit}
          title={atLimit && limits ? `A provider account can have ${plural(limits.max, 'endpoint')}.` : undefined}>
          Add endpoint
        </button>
      ) : undefined)
    : kind === 'personal'
    ? (endpoints.length > 0 && !free ? (
        <button
          type="button"
          className="st-btn is-sm"
          onClick={add}
          disabled={atLimit}
          title={atLimit && limits ? `Your plan includes ${plural(limits.max, 'endpoint')}.` : undefined}
        >
          Add endpoint
        </button>
      ) : undefined)
    : canManage && (endpoints.length > 0 || fromWorkspace.length > 0 || canImport) ? (
        <span className="ep-head-acts">
          {canImport && <button type="button" className="st-btn is-sm" onClick={() => setImporting(true)} disabled={atLimit}>Copy from your endpoints…</button>}
          {(endpoints.length > 0 || fromWorkspace.length > 0) && (
            <button type="button" className="st-btn is-sm" onClick={add} disabled={atLimit}
              title={atLimit && limits ? `The workspace’s plan includes ${plural(limits.max, 'server')}.` : undefined}>
              {addLabel}
            </button>
          )}
        </span>
      ) : undefined;

  const emptyText = provider ? (
    <>
      The https API your models are served from. {scope?.kind === 'provider' && scope.hostRule === 'none'
        ? 'Any OpenAI-compatible API with a key.'
        : <>Its host must be on one of your verified domains{scope?.kind === 'provider' && scope.verifiedDomains.length ? ` (${scope.verifiedDomains.join(', ')})` : ''}.</>}
      {' '}We test it here, and once you start benchmarking we run our tests through it with your key.
    </>
  ) : (
    <>
      Any OpenAI-compatible API works: vLLM, SGLang, llama.cpp, Ollama (/v1), LM Studio, TGI or a hosting company.
      {team || modelSource
        // R4: Model source can route automatic requests to them (§6.1 empty state, as the plan words it).
        ? <> They have no benchmark scores yet, so routing uses your order, your declared price and live health.</>
        : <> They have no benchmark scores yet, so automatic routing leaves them out: a request reaches one when it names
          one of its models, at the price you declare and only while it answers.</>}
    </>
  );

  return (
    <ScopeContext.Provider value={ctx}>
      <Pane
        title={provider ? 'Endpoints' : kind === 'workspace' ? 'Servers for every project' : kind === 'project' ? 'Servers for this project' : 'Your endpoints'}
        sub={provider
          ? 'The OpenAI-compatible APIs your listed models are served from'
          : kind === 'workspace'
          ? <>
              OpenAI-compatible servers the workspace runs or rents. The projects you share one with can name its models
              (<code className="st-ic">ep/team.&lt;prefix&gt;/&lt;model&gt;</code>), and send every request to it first, or only to such
              servers, when their routing rules say so.
            </>
          : kind === 'project'
            ? <>
                OpenAI-compatible servers this project&rsquo;s keys can use: its own and the workspace&rsquo;s servers shared with it.
                Members&rsquo; personal keys follow their own Model source. To keep a team&rsquo;s traffic on your servers, give people
                project keys.
              </>
            : 'OpenAI-compatible servers you run or rent'}
        ruled
        flush
        className="ep-pane"
        actions={headActions}
        foot={!free && limits && limits.max > 0 && canManage ? <LimitLine limits={limits} team={team} provider={provider} /> : undefined}
      >
        {notice && (
          <div className="ep-notice">
            <Note tone={notice.tone} title={notice.title}>
              {notice.body}
              <div className="sk-note-act">
                <button type="button" className="st-btn is-sm is-quiet" onClick={() => setNotice(null)}>Dismiss</button>
              </div>
            </Note>
          </div>
        )}

        {free ? (
          <div className="sk-pad"><p className="st-text">Your own endpoints are included in Pro and above.</p></div>
        ) : endpoints.length === 0 ? (
          !canManage ? (
            fromWorkspace.length === 0 ? <div className="sk-pad"><p className="st-text">This project has no servers yet.</p></div> : null
          ) : team && fromWorkspace.length > 0 ? (
            <div className="sk-pad"><p className="st-text">No servers of this project&rsquo;s own. Add one, or use the workspace&rsquo;s servers below.</p></div>
          ) : (
            <div className="sk-pad">
              <Empty
                title={provider ? 'Add the endpoint your models are served from' : 'Add your own model servers'}
                actions={<>
                  {canImport && <button type="button" className="st-btn" onClick={() => setImporting(true)} disabled={atLimit}>Copy from your endpoints…</button>}
                  <button type="button" className="st-btn is-primary" onClick={add} disabled={atLimit}>{addLabel}</button>
                </>}
              >
                {emptyText}
              </Empty>
            </div>
          )
        ) : (
          <div className="ep-rows">
            {endpoints.map((e, i) => (
              <EndpointRow
                key={e.id}
                e={e}
                first={i === 0}
                last={i === endpoints.length - 1}
                chip={chipFor(e, !!testing[e.id] || isRunning(e.lastProbe?.status), limits, ctx.noun)}
                busy={busy}
                onModels={() => setFlow({ step: 'models', mode: 'manage', id: e.id })}
                onHealth={() => setFlow({ step: 'health', mode: 'manage', id: e.id })}
                // A first crash pause ends with a passing model test, not the address test (R6), so "Test
                // again" opens the models, where one is ticked and tested. An owner-only one ends only when
                // AI Stupid Level resumes it: no test can, so the button is off (R6 review M4).
                onTest={() => setFlow(e.healthState === 'quarantined'
                  ? { step: 'models', mode: 'manage', id: e.id }
                  : { step: 'test', mode: 'manage', id: e.id, probeId: null })}
                testOff={isOwnerOnlyPause(e.healthState, e.healthError) ? OWNER_ONLY_NO_TEST : null}
                onEdit={() => setFlow({ step: 'connection', mode: 'edit', id: e.id })}
                onPause={() => pause(e)}
                onRemove={() => remove(e)}
                onMove={by => move(e, by)}
                canMove={canManage && endpoints.length > 1}
                readOnly={!canManage}
                orderTitle={orderTitle}
                extra={provider ? <ProviderRowExtra e={e as ProviderEndpoint} /> : team ? <TeamRowExtra e={e as TeamEndpoint} usage={kind === 'workspace'} /> : undefined}
              />
            ))}
          </div>
        )}

        {shared.length > 0 && (
          <div className="ep-shared">
            {/* Workspace servers whose owner lets members use them with their personal keys (R5, D32; §6.1 read-only group). */}
            <p className="st-label">Shared with you{shared[0].orgName ? ` by ${shared[0].orgName}` : ''}</p>
            <p className="ep-shared-note">
              Your personal keys use these servers only when you name them (<code className="ep-id">ep/team.&lt;name&gt;/&lt;model&gt;</code>)
              {modelSource ? ' or choose Prefer or Only my endpoints in Routing preferences.' : '.'}
            </p>
            <div className="ep-rows">
              {shared.map(e => <ReadOnlyRow key={e.id} e={e} chip={chipFor(e, false, limits)} ns="team." />)}
            </div>
          </div>
        )}

        {fromWorkspace.length > 0 && (
          <div className="ep-shared">
            <p className="st-label">From the workspace</p>
            <p className="ep-shared-note">
              Shared with this project by the workspace owner{scope?.kind === 'project' && scope.isOwner
                ? <>, who changes them under <Link href="/account/team?tab=settings">Servers for every project</Link></>
                : null}. Routing orders them together with this project&rsquo;s own: by health, Use for and, under Cheapest,
              Fastest or Fastest good model, price or latency; where none of these decides, this project&rsquo;s own servers come first.
            </p>
            <div className="ep-rows">
              {fromWorkspace.map(e => <ReadOnlyRow key={e.id} e={e} chip={chipFor(e, false, null, 'server')} ns="team." />)}
            </div>
          </div>
        )}
      </Pane>

      <Modal
        open={!!flow}
        onClose={closeFlow}
        size={flow?.step === 'models' ? 'wide' : undefined}
        footer={flow ? <div className="ep-foot" ref={setFootEl} /> : undefined}
        title={flow?.mode === 'add'
          ? (team ? 'Add a server' : 'Add an endpoint')
          : <span className="sk-mtitle"><ProviderMark provider="endpoint" />{flowEndpoint ? (flow?.step === 'connection' ? `Edit ${flowEndpoint.name}` : flowEndpoint.name) : (team ? 'Server' : 'Endpoint')}</span>}
        sub={flow && flow.mode !== 'add' && flowEndpoint
          ? (flow.step === 'test' ? `Connection test · ${flowEndpoint.host}` : flow.step === 'models' ? `Models · ${flowEndpoint.host}`
            : flow.step === 'health' ? `Health · ${flowEndpoint.host}` : flowEndpoint.host)
          : undefined}
      >
        {flow?.mode === 'add' && (
          <ol className="sk-steps-head ep-stepsbar" aria-label="Steps">
            <li className={flow.step === 'connection' ? 'is-on' : 'is-done'}>1. Connection{flow.step !== 'connection' ? ' ✓' : ''}</li>
            <li className={flow.step === 'test' ? 'is-on' : flow.step === 'models' ? 'is-done' : ''}>2. Test{flow.step === 'models' ? ' ✓' : ''}</li>
            <li className={flow.step === 'models' ? 'is-on' : ''}>3. Models</li>
          </ol>
        )}

        {flow?.step === 'connection' && (flow.mode === 'add' || flowEndpoint) && (
          <ConnectionStep
            key={flow.mode === 'edit' ? `edit-${flow.id}` : 'add'}
            endpoint={flow.mode === 'edit' ? flowEndpoint : undefined}
            egress={list.egress}
            foot={footEl}
            onCancel={closeFlow}
            onCreated={(e, probeId, deferred) => {
              setFresh(e);
              setFlow({ step: 'test', mode: 'add', id: e.id, probeId, deferred });
              void reload();
            }}
            onEdited={(e, probeId, retest, deferred) => {
              if (e) setFresh(e);
              void reload();
              if (retest && flow.mode === 'edit') setFlow({ step: 'test', mode: 'manage', id: flow.id, probeId, deferred });
              else { setFlow(null); setNotice({ tone: 'good', title: 'Saved' }); }
            }}
          />
        )}

        {flow?.step === 'test' && flowEndpoint && (
          <TestStep
            key={`test-${flow.id}`}
            endpoint={flowEndpoint}
            probeId={flow.probeId}
            deferred={flow.deferred ?? null}
            foot={footEl}
            onTesting={on => markTesting(flow.id, on)}
            onChanged={() => void reload()}
            onModels={() => setFlow({ step: 'models', mode: flow.mode, id: flow.id })}
            onEdit={() => setFlow({ step: 'connection', mode: 'edit', id: flow.id })}
            onClose={closeFlow}
          />
        )}

        {flow?.step === 'models' && flowEndpoint && provider && (
          <ProviderModelsStep
            key={`pmodels-${flow.id}`}
            endpoint={flowEndpoint}
            foot={footEl}
            onTesting={on => markTesting(flow.id, on)}
            onChanged={() => void reload()}
            onClose={closeFlow}
          />
        )}

        {flow?.step === 'models' && flowEndpoint && !provider && (
          <ModelsStep
            key={`models-${flow.id}`}
            endpoint={flowEndpoint}
            limits={limits}
            foot={footEl}
            onTesting={on => markTesting(flow.id, on)}
            onChanged={() => void reload()}
            onClose={closeFlow}
            onSaved={example => {
              setFlow(null);
              setFresh(null);
              setNotice({ tone: 'good', title: 'Saved', body: savedBody(example) });
              void reload();
            }}
          />
        )}

        {flow?.step === 'health' && flowEndpoint && (
          <HealthView
            key={`health-${flow.id}`}
            loadHealth={() => ctx.api.health(flow.id, '24h')}
            loadView={() => ctx.api.get(flow.id)}
            noun={ctx.noun}
            foot={footEl}
            onClose={closeFlow}
          />
        )}

        {/* The list no longer has it (removed elsewhere, or while its test ran): say so, never wait forever. */}
        {flow && 'id' in flow && !flowEndpoint && (
          <>
            <Note tone="warn" title={team ? 'The server is gone' : 'The endpoint is gone'}>{goneText(ctx.noun)}</Note>
            <Foot el={footEl}><button type="button" className="st-btn" onClick={closeFlow}>Close</button></Foot>
          </>
        )}
      </Modal>

      {canImport && (
        <ImportDialog
          open={importing}
          candidates={importable!}
          existing={endpoints}
          projectId={scope?.kind === 'project' ? scope.projectId : undefined}
          onClose={() => setImporting(false)}
          onDone={(e, probeId, deferred) => {
            setImporting(false);
            setFresh(e);
            void reload();
            setFlow({ step: 'test', mode: 'add', id: e.id, probeId, deferred });
          }}
        />
      )}
    </ScopeContext.Provider>
  );
}

function LimitLine({ limits, team = false, provider = false }: { limits: EndpointLimits; team?: boolean; provider?: boolean }) {
  if (provider) return <>{fmtInt(limits.used)} of {plural(limits.max, 'endpoint')} per provider account</>;
  if (team) {
    if (limits.used > limits.max && !limits.soft) {
      return <>{plural(limits.used, 'server')}, {fmtInt(limits.max)} can be used on the workspace’s plan. The rest are kept and come back when the plan allows them.</>;
    }
    return <>{fmtInt(limits.used)} of {plural(limits.max, 'server')} on the workspace’s plan</>;
  }
  if (limits.used > limits.max && !limits.soft) {
    return <>{plural(limits.used, 'endpoint')}, {fmtInt(limits.max)} can be used on your plan. The rest are kept and come back when your plan allows them.</>;
  }
  return <>{fmtInt(limits.used)} of {plural(limits.max, 'endpoint')} on your plan</>;
}

// ── one endpoint in the list ──────────────────────────────────────────────────────────────────────

function EndpointRow({ e, first, last, chip, busy, onModels, onHealth, onTest, onEdit, onPause, onRemove, onMove, canMove, readOnly = false, orderTitle, extra, testOff = null }: {
  e: Endpoint; first: boolean; last: boolean; chip: Chip; busy: string | null; canMove: boolean;
  onModels: () => void; onHealth: () => void; onTest: () => void; onEdit: () => void; onPause: () => void; onRemove: () => void; onMove: (by: -1 | 1) => void;
  /** R6 review M4: why a test cannot help (an owner-only crash pause); "Test again" is then off. */
  testOff?: string | null;
  /** R5: someone who may not change it (a project member): no order buttons, no actions. */
  readOnly?: boolean;
  orderTitle: string;
  /** R5: the lines a workspace's or project's server adds (who can use it, its model ids, usage). */
  extra?: ReactNode;
}) {
  const unprotected = typeof e.unprotected === 'boolean' ? e.unprotected : e.authScheme === 'none' || e.keyHint === null;
  const on = e.enabledModelCount;
  const anyBusy = !!busy && busy.startsWith(`${e.id}:`);
  const meta = [
    e.host,
    e.p50Ms24h != null ? `p50 ${fmtMs(e.p50Ms24h)} · 24 h` : null,
    on == null ? null : on === 0 ? 'No model on' : `${plural(on, 'model')} on`,
  ].filter(Boolean).join(' · ');

  const detailId = `endpoint-${e.id}-detail`;
  // A member who only reads the server (R5 readOnly) gets no reason text from the API (it is masked), so the
  // web cannot tell a first pause from an owner-only one: a neutral sentence, no instruction (R6 connector
  // verification N5: members were told a test resumes a server only AI Stupid Level can).
  const detail = readOnly && e.healthState === 'quarantined' ? READONLY_PAUSED : chip.detail;
  return (
    // The id lets the Providers page's name-conflict banner jump here (NameConflictBanner).
    <div className={`ep-row${e.active ? '' : ' is-paused'}`} id={`endpoint-${e.id}`} tabIndex={-1}>
      <ProviderMark provider="endpoint" />
      <div className="ep-row-main">
        <div className="ep-row-t">
          <span className="ep-name">{e.name}</span>
          {e.allowHttp && <Tag tone="warn" title="Plain HTTP: prompts, answers and the key cross the internet unencrypted.">Unencrypted</Tag>}
          {unprotected && <Tag tone="warn" title={UNPROTECTED_TIP}>Unprotected</Tag>}
        </div>
        <div className="ep-row-meta">{meta}</div>
        {detail && <p className={`ep-row-detail${chip.tone === 'bad' ? ' is-bad' : ''}`} id={detailId}>{detail}</p>}
        {extra}
      </div>
      <div className="ep-row-end">
        <Pill tone={chip.tone}>{chip.label}</Pill>
        {canMove && !readOnly && (
          <span className="ep-move" role="group" aria-label="Order" title={orderTitle}>
            <button type="button" onClick={() => onMove(-1)} disabled={first || anyBusy} aria-label={`Move ${e.name} up`}><Chevron up /></button>
            <button type="button" onClick={() => onMove(1)} disabled={last || anyBusy} aria-label={`Move ${e.name} down`}><Chevron /></button>
          </span>
        )}
      </div>
      {!readOnly && (
        <div className="ep-row-act">
          <button type="button" className="st-btn is-sm" onClick={onModels}>Models</button>
          <button type="button" className="st-btn is-sm" onClick={onHealth}>Health</button>
          <button type="button" className="st-btn is-sm" onClick={onTest} disabled={anyBusy || !!testOff}
            title={testOff ?? undefined} aria-describedby={testOff && chip.detail ? detailId : undefined}>Test again</button>
          <button type="button" className="st-btn is-sm" onClick={onEdit} disabled={anyBusy}>Edit</button>
          <button type="button" className="st-btn is-sm" onClick={onPause} disabled={anyBusy}>
            {busy === `${e.id}:pause` ? (e.active ? 'Pausing…' : 'Resuming…') : e.active ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="st-btn is-sm is-danger" onClick={onRemove} disabled={anyBusy}>
            {busy === `${e.id}:remove` ? 'Removing…' : 'Remove'}
          </button>
        </div>
      )}
    </div>
  );
}

/** M4: a provider endpoint's own lines: a safety hold, a new certificate issuer waiting for staff, what is listed on it. */
function ProviderRowExtra({ e }: { e: ProviderEndpoint }) {
  const x = e.provider;
  if (!x) return null;
  const listed = x.listings.filter(l => l.state !== 'delisted');
  return (
    <>
      {x.hold && (
        <p className="ep-row-detail is-bad">
          {x.hold.reason === 'domain_lapse'
            ? `Paused for a security check since ${fmtDay(x.hold.since)}: the domain proof of ${e.host} lapsed. Requests and our tests resume by themselves when the DNS record is back.`
            : `Paused for a security check since ${fmtDay(x.hold.since)}: the TLS certificate of ${e.host} has a new issuer. It resumes once our staff confirm the change.`}
        </p>
      )}
      <p className="ep-row-meta">
        {listed.length ? `Listed here: ${listed.map(l => l.model).join(', ')}` : 'No model listed on it yet'}
        {x.tls ? ` · TLS issuer recorded ${fmtDay(x.tls.since)}` : ''}
      </p>
    </>
  );
}

/**
 * M4, step 3 of the provider dialog (§2.8): tick up to 4 models for the model test (chat, tools, stream). A
 * provider's models are listed on /account/provider/models (price, precision, context), never turned on
 * here: no ep/ id routes to a provider endpoint.
 */
function ProviderModelsStep({ endpoint, foot, onTesting, onChanged, onClose }: {
  endpoint: Endpoint; foot: HTMLElement | null; onTesting: (on: boolean) => void; onChanged: () => void; onClose: () => void;
}) {
  const scope = useScope();
  const [view, setView] = useState<EndpointView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [probeId, setProbeId] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const { probe, error: probeError } = useProbe(endpoint.id, probeId, MODEL_POLL_LIMIT_MS);
  const at = hostPort(endpoint.baseUrl);

  const load = useCallback(async () => {
    try { setView(await scope.api.get(endpoint.id)); setLoadError(null); } catch (err) { setLoadError(errorText(err, at)); }
  }, [scope.api, endpoint.id]);
  useEffect(() => { void load(); }, [load]);
  const running = !!probe && isRunning(probe.status);
  useEffect(() => {
    onTesting(running);
    if (probe && !running) { void load(); onChanged(); }
  }, [running, probe?.status]);

  const toggle = (name: string, on: boolean) => setTicked(t => (on ? (t.includes(name) || t.length >= 4 ? t : [...t, name]) : t.filter(x => x !== name)));
  const test = async () => {
    if (!ticked.length || starting) return;
    setStarting(true); setTestError(null);
    try { setProbeId(await startProbe(scope.api, endpoint.id, ticked, true)); } catch (err) { setTestError(errorText(err, at)); } finally { setStarting(false); }
  };
  const addManual = async (ev: FormEvent) => {
    ev.preventDefault();
    const name = manual.trim();
    if (!name) return;
    if (!PRINTABLE.test(name) || name.length > 200) { setManualError(MODEL_ID_RULE); return; }
    try { await scope.api.addModel(endpoint.id, name); setManual(''); setManualError(null); await load(); } catch (err) { setManualError(errorText(err, at)); }
  };

  const models = view?.models ?? [];
  return (
    <div className="ep-models">
      <p className="st-text">
        Tick up to 4 models and test them: we send a short chat, a tool call and a streamed answer to each. Then list the ones
        that passed on <Link href="/account/provider/models">Models</Link>, with their price, precision and context.
      </p>
      {loadError && <Note tone="bad" title="Not loaded">{loadError}</Note>}
      {!view && !loadError && <Loader label="Loading the models…" />}
      {view && models.length === 0 && <p className="st-text">The endpoint listed no model. Add one by its id below.</p>}
      {models.length > 0 && (
        <div className="ep-table-wrap">
          <table className="ep-table">
            <thead><tr><th scope="col">Test</th><th scope="col">Model</th><th scope="col">Context</th><th scope="col">Last test</th></tr></thead>
            <tbody>
              {models.map(m => {
                const on = ticked.includes(m.model);
                return (
                  <tr key={m.id}>
                    <td data-label="Test">
                      <input type="checkbox" className="st-check" checked={on} disabled={running || (!on && ticked.length >= 4)}
                        onChange={ev => toggle(m.model, ev.target.checked)} aria-label={`Test ${m.model}`} />
                    </td>
                    <td data-label="Model"><code className="ep-id is-long">{m.model}</code></td>
                    <td data-label="Context">{m.contextTokens != null ? `${fmtInt(m.contextTokens)} tokens` : 'not known yet'}</td>
                    <td data-label="Last test">
                      {m.lastProbeOk === true ? <Pill tone="good">Passed</Pill> : m.lastProbeOk === false ? <Pill tone="bad">Failed</Pill> : <span className="st-faint">Not tested</span>}
                      {m.lastProbeAt ? <span className="st-faint"> {fmtDay(m.lastProbeAt)}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(probe || probeError) && <ProbeView probe={probe} at={at} />}
      {probeError && <Note tone="bad">{probeError}</Note>}
      {testError && <Note tone="bad" title="Not tested">{testError}</Note>}
      <form className="ep-manual" onSubmit={addManual}>
        <label className="st-field-label" htmlFor="ep-pmanual">Add a model the endpoint does not list</label>
        <div className="ep-manual-row">
          <input id="ep-pmanual" className="st-input" value={manual} placeholder="Its id, exactly as the endpoint names it" spellCheck={false}
            onChange={ev => { setManual(ev.target.value); setManualError(null); }} aria-invalid={!!manualError} />
          <button type="submit" className="st-btn" disabled={!manual.trim()}>Add</button>
        </div>
        {manualError && <p className="st-error">{manualError}</p>}
      </form>
      <Foot el={foot}>
        <span className="ep-foot-note">{ticked.length ? `${plural(ticked.length, 'model')} ticked, at most 4` : 'Tick up to 4 models'}</span>
        <button type="button" className="st-btn" onClick={onClose}>Done</button>
        <button type="button" className="st-btn is-primary" onClick={() => void test()} disabled={!ticked.length || starting || running}>
          {running ? 'Testing…' : starting ? 'Starting…' : 'Test ticked models'}
        </button>
      </Foot>
    </div>
  );
}

/**
 * A server shown for reading only: a workspace server shared with the reader (Providers page,
 * "Shared with you") or with this project ("From the workspace"). Its model ids, when the list
 * carries them, so they can be copied into requests.
 */
function ReadOnlyRow({ e, chip, ns }: { e: Endpoint & { models?: TeamEndpoint['models'] }; chip: Chip; ns: Ns }) {
  const ids = modelIdsOf(e, ns);
  return (
    <div className="ep-row is-shared">
      <ProviderMark provider="endpoint" />
      <div className="ep-row-main">
        <div className="ep-row-t"><span className="ep-name">{e.name}</span></div>
        {/* The ids themselves when the list carries them; otherwise the prefix every one starts with. */}
        <div className="ep-row-meta">{e.host}{ids.length ? null : <> · <code className="ep-id">ep/{ns}{e.slug}/…</code></>}</div>
        {ids.length > 0 && <ModelIds ids={ids} />}
      </div>
      <div className="ep-row-end"><Pill tone={chip.tone}>{chip.label}</Pill></div>
    </div>
  );
}

/** The ids a server's turned-on models are named by, from the list (the API's own modelId when it gives one). */
function modelIdsOf(e: { slug: string; models?: TeamEndpoint['models'] }, ns: Ns): string[] {
  return Array.isArray(e.models) ? e.models.filter(m => m && m.enabled !== false).map(m => m.modelId || epId(ns, e.slug, m.model)) : [];
}

/** Copyable model ids, one per line: what a request names to reach this server. */
function ModelIds({ ids }: { ids: string[] }) {
  return (
    <ul className="ep-ids" aria-label="Model ids">
      {ids.map(id => (
        <li key={id}><code className="ep-id is-long">{id}</code><CopyButton text={id} /></li>
      ))}
    </ul>
  );
}

/** "Shared with every project", "Shared with Client A and Client B", "Not shared with any project yet". */
function shareText(e: TeamEndpoint, projects: Array<{ id: number; name: string }>): string {
  if (e.shareProjects !== 'selected') return 'Shared with every project';
  const names = (e.projectIds ?? []).map(id => projects.find(p => p.id === id)?.name).filter((n): n is string => !!n);
  if (!names.length) return 'Not shared with any project yet';
  return `Shared with ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}`;
}

/**
 * What a workspace's or project's server row adds: who can use it (workspace page), the ids of its
 * turned-on models, and (owner, workspace page) how much it was used in the last 30 days.
 */
function TeamRowExtra({ e, usage }: { e: TeamEndpoint; usage: boolean }) {
  const { kind, projects, api } = useScope();
  const ids = modelIdsOf(e, 'team.');
  // Requests to this server in the last 30 days (GET /account/org/endpoints/:id `usage30d`, owner
  // only), read when the owner asks: counts per kind of key and per person, never what was sent.
  const [use, setUse] = useState<{ kind: 'closed' } | { kind: 'loading' } | { kind: 'ok'; u: EndpointUsage | null } | { kind: 'error'; text: string }>({ kind: 'closed' });
  const toggleUse = async () => {
    if (use.kind !== 'closed') { setUse({ kind: 'closed' }); return; }
    setUse({ kind: 'loading' });
    try {
      const v = await api.get(e.id);
      setUse({ kind: 'ok', u: v.usage30d ?? null });
    } catch (err) {
      setUse({ kind: 'error', text: errorText(err, hostPort(e.baseUrl), true) });
    }
  };
  return (
    <>
      {kind === 'workspace' && (
        <p className="ep-row-share">
          {shareText(e, projects)}
          {e.membersCanUse ? ' · Members may also use it with their personal keys' : ''}
          {usage && <> · <button type="button" className="ep-inline-btn" aria-expanded={use.kind !== 'closed'} onClick={() => void toggleUse()}>Requests, last 30 days</button></>}
        </p>
      )}
      {use.kind !== 'closed' && (
        <p className="ep-usage" role="status">
          {use.kind === 'loading' ? <span className="st-faint">Loading…</span>
            : use.kind === 'error' ? <span className="st-error">{use.text}</span>
            : !use.u ? <span className="st-faint">Not available on this server yet.</span>
            : use.u.requests === 0 ? 'No requests in the last 30 days.'
            : <UsageFacts u={use.u} />}
        </p>
      )}
      {ids.length > 0 && <ModelIds ids={ids} />}
    </>
  );
}

function UsageFacts({ u }: { u: EndpointUsage }) {
  // `project` counts a project server's own project, `workspace` the projects a workspace server is
  // shared with: both are project keys (R5 contract §1 Usage30d).
  const projectKeys = (u.byKeySource?.project ?? 0) + (u.byKeySource?.workspace ?? 0);
  const parts = [
    projectKeys ? `${fmtInt(projectKeys)} with project keys` : null,
    u.byKeySource?.personal ? `${fmtInt(u.byKeySource.personal)} with members’ personal keys` : null,
  ].filter(Boolean);
  const people = (u.byMember ?? []).filter(m => m && m.requests > 0);
  return (
    <>
      <span>{plural(u.requests, 'request')}{parts.length ? `: ${parts.join(', ')}` : ''}.</span>
      {people.length > 0 && (
        <span className="ep-usage-people">
          {people.slice(0, 8).map(m => `${m.label} ${fmtInt(m.requests)}`).join(' · ')}{people.length > 8 ? ` · ${plural(people.length - 8, 'other')}` : ''}
        </span>
      )}
    </>
  );
}

/**
 * "Copy from your endpoints…": one of the caller's own endpoints copied into the workspace (owner) or
 * this project (manager). The API copies it under a new public id and encrypts the key again on its
 * side, so the key never passes through the browser; the personal endpoint stays as it is.
 */
function ImportDialog({ open, candidates, existing, projectId, onClose, onDone }: {
  open: boolean; candidates: Endpoint[]; projectId?: number; onClose: () => void;
  /** The servers already here: one base URL can be added once per workspace (or project), so a copy of it would be refused. */
  existing: Endpoint[];
  onDone: (e: Endpoint, probeId: number | null, deferred: string | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  // A prefix the workspace already uses (409 slug_taken): the copy can take another one (contract §2 `slug`).
  const [rename, setRename] = useState<{ id: string; slug: string; error?: string } | null>(null);
  // A plain-HTTP endpoint is copied only with "I understand this is unencrypted" ticked again: the team's
  // prompts would cross it now (the R5 API asks for acknowledgeUnencrypted on import).
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  // Both come from the API, normalised as it stores them; it compares them exactly.
  const sameUrl = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
  const alreadyHere = (e: Endpoint) => existing.find(x => sameUrl(x.baseUrl, e.baseUrl));
  const copy = async (e: Endpoint, slug?: string) => {
    if (slug !== undefined && (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug))) { setRename({ id: e.id, slug, error: SLUG_RULE }); return; }
    if (e.allowHttp && !acked[e.id]) { setError({ id: e.id, text: codeMessage('http_not_acknowledged')! }); return; }
    setBusy(e.id);
    setError(null);
    if (slug !== undefined) setRename({ id: e.id, slug });
    try {
      const r = await importEndpoint(e.id, projectId, { ...(slug !== undefined ? { slug } : {}), ...(e.allowHttp ? { acknowledgeUnencrypted: true } : {}) });
      if (!r?.endpoint?.id) { setError({ id: e.id, text: 'The server was copied, but the answer did not describe it. Close this window and reload the page to see it.' }); return; }
      setRename(null);
      onDone(r.endpoint, typeof r.probeId === 'number' ? r.probeId : null, deferredText(r.probe, true));
    } catch (err) {
      if (err instanceof ApiRequestError && err.error === 'slug_taken') {
        setRename({ id: e.id, slug: slug ?? `${e.slug.slice(0, 30).replace(/-+$/, '')}-2`, error: errorText(err, {}, true) });
      } else {
        // Another prefix would not help (the address is already here, the key cannot be read, …): say why, once.
        setRename(null);
        setError({ id: e.id, text: errorText(err, hostPort(e.baseUrl), true) });
      }
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Copy from your endpoints" sub={projectId == null ? 'Into the workspace' : 'Into this project'}>
      <div className="ep-step-body">
        <p className="st-text">
          Copies the address, key and settings of one of your own endpoints {projectId == null ? 'to the workspace' : 'to this project'}, where
          its models are called <code className="ep-id">ep/team.&lt;prefix&gt;/&lt;model&gt;</code>. The key is copied and encrypted again on our
          side; it never passes through your browser. Its models arrive turned off, with their test results: turn on the ones
          {projectId == null ? ' the team' : ' this project'} should use. Your own endpoint stays as it is.
          {projectId == null && ' The copy is shared with every project and not with members’ personal keys; change that with Edit.'}
        </p>
        <div className="ep-rows ep-import">
          {candidates.map(e => { const here = alreadyHere(e); return (
            <div key={e.id} className="ep-row is-shared">
              <ProviderMark provider="endpoint" />
              <div className="ep-row-main">
                <div className="ep-row-t">
                  <span className="ep-name">{e.name}</span>
                  {e.allowHttp && <Tag tone="warn" title="Plain HTTP: prompts, answers and the key cross the internet unencrypted.">Unencrypted</Tag>}
                </div>
                <div className="ep-row-meta">
                  {[e.host, e.enabledModelCount != null ? (e.enabledModelCount === 0 ? 'No model on' : `${plural(e.enabledModelCount, 'model')} on`) : null].filter(Boolean).join(' · ')}
                  {' · '}<code className="ep-id">ep/{e.slug}/…</code>
                </div>
                {e.allowHttp && !here && (
                  <label className="st-toggle ep-ack ep-import-ack">
                    <input type="checkbox" className="st-check" checked={!!acked[e.id]} disabled={!!busy}
                      onChange={ev => { setAcked(a => ({ ...a, [e.id]: ev.target.checked })); if (error?.id === e.id) setError(null); }} />
                    <span>
                      <b>I understand this is unencrypted</b>
                      <span>{projectId == null ? 'The team’s' : 'This project’s'} prompts and answers{e.authScheme !== 'none' && e.keyHint !== null ? ', and this key,' : ''} cross the internet in plain text.</span>
                    </span>
                  </label>
                )}
                {rename?.id === e.id && (
                  <form className="ep-rename" onSubmit={ev => { ev.preventDefault(); void copy(e, rename.slug.trim()); }}>
                    <label className="st-field-label" htmlFor={`ep-rename-${e.id}`}>Model id prefix in the workspace</label>
                    <div className="ep-manual-row">
                      <input id={`ep-rename-${e.id}`} className="st-input" value={rename.slug} maxLength={32} spellCheck={false} disabled={!!busy}
                        onChange={ev => setRename({ id: e.id, slug: ev.target.value.toLowerCase() })} aria-invalid={!!rename.error} aria-describedby={`ep-rename-hint-${e.id}`} />
                      <button type="submit" className="st-btn is-primary" disabled={!!busy || !rename.slug.trim()}>{busy === e.id ? 'Copying…' : 'Copy with this prefix'}</button>
                    </div>
                    <p className={rename.error ? 'st-error' : 'st-hint'} id={`ep-rename-hint-${e.id}`}>
                      {rename.error ?? <>Its models will be called <code className="ep-id">ep/team.{rename.slug || e.slug}/&lt;model&gt;</code>.</>}
                    </p>
                  </form>
                )}
                {here && <p className="ep-row-detail">Already {projectId == null ? 'in the workspace' : 'in this project'} as {here.name}: one address can be added once.</p>}
                {error?.id === e.id && <p className="st-error ep-rowerr" role="alert">{error.text}</p>}
              </div>
              <div className="ep-row-end">
                {rename?.id !== e.id && (
                  <button type="button" className="st-btn is-sm" onClick={() => void copy(e)} disabled={!!busy || !!here}>{busy === e.id ? 'Copying…' : 'Copy'}</button>
                )}
              </div>
            </div>
          ); })}
        </div>
      </div>
    </Modal>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={up ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} />
    </svg>
  );
}

// ── step 1: the connection (add, or edit) ─────────────────────────────────────────────────────────

interface ParsedBase { scheme?: string; host?: string; port?: string; error?: string }

function parseBase(raw: string): ParsedBase {
  const v = raw.trim();
  if (!v) return {};
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return { error: 'Start the address with https:// (or http:// for a server without TLS).' };
  let u: URL;
  try { u = new URL(v); } catch { return { error: 'That is not a valid URL.' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: codeMessage('scheme_not_allowed') ?? undefined };
  const at = { scheme: u.protocol, host: u.hostname, port: u.port || (u.protocol === 'http:' ? '80' : '443') };
  if (u.username || u.password) return { ...at, error: codeMessage('url_credentials') ?? undefined };
  if (v.includes('?') || v.includes('#')) return { ...at, error: codeMessage('url_query_not_allowed') ?? undefined };
  return at;
}

/** Trailing slashes off, and a pasted /chat/completions with them: the base URL ends before it. */
function normalizeBase(raw: string): { url: string; stripped: boolean } {
  let v = raw.trim().replace(/\/+$/, '');
  const stripped = /\/chat\/completions$/i.test(v);
  if (stripped) v = v.replace(/\/chat\/completions$/i, '').replace(/\/+$/, '');
  return { url: v, stripped };
}

/** A preset chip: keep the scheme and host typed so far, set the server's default port and /v1. */
function withPreset(raw: string, port: number): { value: string; select?: [number, number] } {
  const v = raw.trim();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (u.hostname) return { value: `${u.protocol}//${u.hostname}:${port}/v1` };
  } catch { /* nothing usable typed yet */ }
  const host = 'your-server.example.com';
  return { value: `https://${host}:${port}/v1`, select: [8, 8 + host.length] };
}

function ConnectionStep({ endpoint, egress: egressIn, foot, onCancel, onCreated, onEdited }: {
  /** Set when editing. */
  endpoint?: Endpoint;
  /** While endpoints are staff-only: the address endpoint requests come from (the list's `egress`). */
  egress?: { ips: string[]; ipv4Only: boolean };
  foot: HTMLElement | null;
  onCancel: () => void;
  onCreated: (e: Endpoint, probeId: number | null, deferred: string | null) => void;
  onEdited: (e: Endpoint | undefined, probeId: number | null, retest: boolean, deferred: string | null) => void;
}) {
  const scope = useScope();
  const team = isTeam(scope);
  const providerMode = isProvider(scope);
  const { noun, ns } = scope;
  const editing = !!endpoint;
  // A scheme with no key stored behaves as "No key", so the form opens on what is in effect. A provider
  // endpoint always has a key (M4): its form never offers "No key".
  const savedAuth: EndpointAuthScheme = endpoint ? (endpoint.keyHint === null && !providerMode ? 'none' : endpoint.authScheme) : 'bearer';
  const authOptions = providerMode ? AUTH_OPTIONS.filter(o => o.id !== 'none') : AUTH_OPTIONS;
  const [name, setName] = useState(endpoint?.name ?? '');
  const [slug, setSlug] = useState(endpoint?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(editing);
  const [baseUrl, setBaseUrl] = useState(endpoint?.baseUrl ?? '');
  const [auth, setAuth] = useState<EndpointAuthScheme>(savedAuth);
  const [key, setKey] = useState('');
  const [ack, setAck] = useState(!!endpoint?.allowHttp);
  const [advanced, setAdvanced] = useState(false);
  const [timeoutSec, setTimeoutSec] = useState(String(Math.round((endpoint?.timeoutMs ?? 180_000) / 1000)));
  const [concurrency, setConcurrency] = useState(String(endpoint?.maxConcurrency ?? 8));
  const [cfId, setCfId] = useState('');
  const [cfSecret, setCfSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [stripped, setStripped] = useState(false);
  // R5, workspace servers: who can use it (the API's defaults for a new one: every project, members off).
  const savedShare = sharingOf(endpoint as TeamEndpoint | undefined);
  const [share, setShare] = useState<'all' | 'selected'>(savedShare.shareProjects);
  const [shareIds, setShareIds] = useState<number[]>(savedShare.projectIds);
  const [members, setMembers] = useState(savedShare.membersCanUse);
  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const failRef = useRef<HTMLDivElement>(null);

  // The API's refusal appears at the end of a long form: bring it into view.
  useEffect(() => { if (failure) failRef.current?.scrollIntoView({ block: 'nearest' }); }, [failure]);

  // The dialog focuses itself as it opens; the caret goes to the first field after it.
  useEffect(() => {
    const raf = requestAnimationFrame(() => (editing ? urlRef : nameRef).current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [editing]);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const parsed = parseBase(baseUrl);
  const isHttp = parsed.scheme === 'http:';
  const hasKeyNow = editing && savedAuth !== 'none';
  const keyless = auth === 'none' || (!key.trim() && !hasKeyNow);
  const egress = egressIn && Array.isArray(egressIn.ips) && egressIn.ips.length ? egressIn : null;
  const configChange = editing && (
    normalizeBase(baseUrl).url !== endpoint!.baseUrl || auth !== savedAuth || (auth !== 'none' && !!key.trim())
  );

  const clearError = (f: string) => { if (errors[f]) setErrors(({ [f]: _gone, ...rest }) => rest); if (failure) setFailure(null); };

  const applyPreset = (port: number) => {
    const { value, select } = withPreset(baseUrl, port);
    setBaseUrl(value);
    clearError('baseUrl');
    requestAnimationFrame(() => {
      const el = urlRef.current;
      if (!el) return;
      el.focus();
      if (select) el.setSelectionRange(select[0], select[1]);
    });
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const nm = name.trim();
    if (!nm || nm.length > 60 || /[\x00-\x1f\x7f]/.test(nm)) errs.name = codeMessage('name_required', {}, undefined, team)!;
    if (!editing && (!SLUG_RE.test(effectiveSlug) || RESERVED_SLUGS.has(effectiveSlug))) errs.slug = SLUG_RULE;
    const { url, stripped: cut } = normalizeBase(baseUrl);
    const p = parseBase(url);
    if (!url) errs.baseUrl = 'Enter the address of your server, for example https://gpu1.example.com/v1.';
    else if (p.error) errs.baseUrl = p.error;
    if (p.scheme === 'http:' && providerMode) errs.baseUrl = 'Provider endpoints must use https.';
    else if (p.scheme === 'http:' && !ack) errs.ack = codeMessage('http_not_acknowledged')!;
    const k = key.trim();
    if (providerMode && !editing && !k) errs.key = 'Enter the key we benchmark with: provider endpoints always have one.';
    if (auth !== 'none' && k && (!PRINTABLE.test(k) || k.length > 4096)) errs.key = codeMessage('key_invalid')!;
    if (editing && auth !== 'none' && !k && savedAuth === 'none') errs.key = 'Enter the key your server expects, or choose No key.';
    const sec = Number(timeoutSec);
    if (!Number.isInteger(sec) || sec < 10 || sec > 900) errs.timeout = codeMessage('timeout_invalid')!;
    const conc = Number(concurrency);
    if (!Number.isInteger(conc) || conc < 1 || conc > 64) errs.concurrency = 'Requests at a time must be a whole number from 1 to 64.';
    const cid = cfId.trim();
    const csec = cfSecret.trim();
    if (!editing && (cid || csec)) {
      if (!cid || !csec) errs.cf = 'Enter both the client ID and the secret, or neither.';
      else if (!PRINTABLE.test(cid) || cid.length > 200 || !PRINTABLE.test(csec) || csec.length > 4096) errs.cf = 'Both values can use printable ASCII characters only, without spaces.';
    }
    // A pasted /chat/completions comes off at once, and the hint under the field says so.
    if (cut) { setBaseUrl(url); setStripped(true); }
    if (Object.keys(errs).length) {
      setErrors(errs);
      if (errs.timeout || errs.concurrency || errs.cf) setAdvanced(true);
      // The first field with a problem comes into view, focused when it is a field.
      requestAnimationFrame(() => {
        const bad = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .ep-ack.is-error');
        if (!bad) return;
        bad.scrollIntoView({ block: 'center' });
        if (bad.matches('input, select')) bad.focus();
      });
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      if (!editing) {
        const body: EndpointCreate & EndpointSharing = {
          name: nm,
          slug: effectiveSlug,
          baseUrl: url,
          authScheme: keyless ? 'none' : auth,
          ...(keyless ? {} : { apiKey: k }),
          ...(p.scheme === 'http:' ? { allowHttp: true, acknowledgeUnencrypted: true } : {}),
          timeoutMs: sec * 1000,
          maxConcurrency: conc,
          ...(cid && csec ? { accessHeaders: { clientId: cid, clientSecret: csec } } : {}),
          // R5: who may use a workspace server (plan §3 R5: the body adds shareProjects, projectIds, membersCanUse).
          ...(scope.kind === 'workspace' ? { shareProjects: share, projectIds: share === 'selected' ? shareIds : [], membersCanUse: members } : {}),
        };
        const r = await scope.api.create(body);
        setKey('');
        if (!r?.endpoint?.id) {
          setFailure(`The ${noun} was added, but the answer did not describe it. Close this window and reload the page to see it.`);
          return;
        }
        onCreated(r.endpoint, typeof r.probeId === 'number' ? r.probeId : null, deferredText(r.probe, team));
      } else {
        const e = endpoint!;
        const patch: EndpointPatch & EndpointSharing = {};
        if (nm !== e.name) patch.name = nm;
        if (url !== e.baseUrl) patch.baseUrl = url;
        if (auth === 'none') {
          if (savedAuth !== 'none') { patch.authScheme = 'none'; patch.apiKey = null; }
        } else {
          if (auth !== e.authScheme) patch.authScheme = auth;
          // A provider endpoint's new key goes through "Replace key and re-test listed models" (below).
          if (k && !providerMode) patch.apiKey = k;
        }
        if (p.scheme === 'http:' && (!e.allowHttp || patch.baseUrl)) { patch.allowHttp = true; patch.acknowledgeUnencrypted = true; }
        if (p.scheme === 'https:' && e.allowHttp) patch.allowHttp = false;
        if (sec * 1000 !== e.timeoutMs) patch.timeoutMs = sec * 1000;
        if (conc !== e.maxConcurrency) patch.maxConcurrency = conc;
        if (scope.kind === 'workspace') {
          if (share !== savedShare.shareProjects) patch.shareProjects = share;
          if (share === 'selected' && (patch.shareProjects || !sameIds(shareIds, savedShare.projectIds))) patch.projectIds = shareIds;
          if (members !== savedShare.membersCanUse) patch.membersCanUse = members;
        }
        const replacing = providerMode && !!k && !!scope.api.replaceKey;
        if (Object.keys(patch).length === 0 && !replacing) { onEdited(undefined, null, false, null); return; }
        const retest = 'baseUrl' in patch || 'authScheme' in patch || 'apiKey' in patch || replacing;
        let r = Object.keys(patch).length ? await scope.api.update(e.id, patch) : undefined;
        if (replacing) r = await scope.api.replaceKey!(e.id, k);
        setKey('');
        onEdited(r?.endpoint, typeof r?.probeId === 'number' ? r.probeId : null, retest, deferredText(r?.probe, team));
      }
    } catch (err) {
      setFailure(errorText(err, hostPort(url), team));
    } finally {
      setBusy(false);
    }
  };

  const keyHint = providerMode
    ? (editing
      ? `Leave empty to keep the current key (ending ${endpoint!.keyHint ?? '…'}). A new key is saved, then the models you listed are tested with it again: a listing whose test passes stays listed. Encrypted; never shown again.`
      : 'This is the key we benchmark with once you start benchmarking, so your own provider account pays for those runs. Use a key on a normal paid account, not a free tier with special limits. It is encrypted and never shown again.')
    : editing && hasKeyNow
    ? `Leave empty to keep the current key (ending ${endpoint!.keyHint}). Encrypted with AES-256-GCM; never shown again or written to logs.`
    : 'Leave empty if your server has no key. Encrypted with AES-256-GCM; never shown again or written to logs.';

  return (
    <form className="ep-form" id="ep-conn-form" ref={formRef} onSubmit={submit} autoComplete="off" noValidate>
      <div className="ep-form-row">
        <div className="st-field">
          <label className="st-field-label" htmlFor="ep-name">Name</label>
          <input
            ref={nameRef} id="ep-name" className="st-input" value={name} maxLength={60} placeholder="GPU box A" disabled={busy}
            onChange={ev => { setName(ev.target.value); clearError('name'); if (!slugTouched) clearError('slug'); }}
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'ep-name-err' : undefined}
          />
          {errors.name && <p className="st-error" id="ep-name-err">{errors.name}</p>}
        </div>
        <div className="st-field">
          <label className="st-field-label" htmlFor="ep-slug">{providerMode ? 'Short name' : 'Model id prefix'}</label>
          {editing && providerMode ? (
            <p className="ep-fixed" id="ep-slug"><code className="ep-id">{endpoint!.slug}</code></p>
          ) : editing ? (
            <p className="ep-fixed" id="ep-slug"><code className="ep-id" title={`ep/${ns}${endpoint!.slug}/<model>`}>ep/{ns}{endpoint!.slug}/&lt;model&gt;</code></p>
          ) : (
            <input
              id="ep-slug" className="st-input" value={effectiveSlug} maxLength={32} placeholder="gpu-box-a" disabled={busy} spellCheck={false}
              onChange={ev => { setSlug(ev.target.value.toLowerCase()); setSlugTouched(true); clearError('slug'); }}
              aria-invalid={!!errors.slug} aria-describedby="ep-slug-hint"
            />
          )}
          <p className={errors.slug ? 'st-error' : 'st-hint'} id="ep-slug-hint">
            {errors.slug ?? (providerMode
              ? (editing ? `Set when the ${noun} was added; it cannot be changed.` : 'Lowercase letters, digits and hyphens; it cannot be changed later.')
              : editing
              ? `Set when the ${noun} was added; it cannot be changed.`
              : <>{team ? 'Its' : 'Your'} models will be called <code className="ep-id">ep/{ns}{effectiveSlug || 'gpu-box-a'}/&lt;model&gt;</code>. You cannot change this later.</>)}
          </p>
        </div>
      </div>

      <div className="st-field">
        <label className="st-field-label" htmlFor="ep-url">Base URL</label>
        <input
          ref={urlRef} id="ep-url" className="st-input" value={baseUrl} inputMode="url" spellCheck={false} disabled={busy}
          placeholder="https://gpu1.example.com/v1"
          onChange={ev => { setBaseUrl(ev.target.value); setStripped(false); clearError('baseUrl'); clearError('ack'); }}
          aria-invalid={!!errors.baseUrl} aria-describedby="ep-url-hint"
        />
        {!providerMode && <div className="ep-presets" role="group" aria-label="Default addresses">
          {PRESETS.map(pr => (
            <button key={pr.label} type="button" className="st-chip" onClick={() => applyPreset(pr.port)} disabled={busy}
              aria-label={`${pr.label}: port ${pr.port} and /v1`}>
              {pr.label} <span className="ep-preset-port">:{pr.port}/v1</span>
            </button>
          ))}
        </div>}
        <p className={errors.baseUrl ? 'st-error' : 'st-hint'} id="ep-url-hint">
          {errors.baseUrl ?? (stripped
            ? 'We removed /chat/completions from the end: the base URL is the part before it.'
            : providerMode
              ? (scope.hostRule === 'none'
                ? 'https only. We call /models and /chat/completions under this address.'
                : `https only, on one of your verified domains${scope.verifiedDomains && scope.verifiedDomains.length ? ` (${scope.verifiedDomains.join(', ')})` : ''}${scope.hostRule === 'verified_or_attested' ? ' or a host our staff attested' : ''}. We call /models and /chat/completions under this address.`)
              : 'We call /models and /chat/completions under this address.')}
        </p>
      </div>

      <div className="ep-form-row">
        <div className="st-field">
          <label className="st-field-label" htmlFor="ep-auth">Authentication</label>
          <select id="ep-auth" className="st-select" value={auth} disabled={busy}
            onChange={ev => { setAuth(ev.target.value as EndpointAuthScheme); clearError('key'); }}>
            {authOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        {auth !== 'none' && (
          <div className="st-field">
            <label className="st-field-label" htmlFor="ep-key">{editing && hasKeyNow ? 'New API key' : 'API key'}</label>
            <input
              id="ep-key" type="password" className="st-input" value={key} disabled={busy} spellCheck={false}
              autoComplete="new-password" placeholder={editing && hasKeyNow ? `…${endpoint!.keyHint}` : ''}
              onChange={ev => { setKey(ev.target.value); clearError('key'); }}
              aria-invalid={!!errors.key} aria-describedby="ep-key-hint"
            />
          </div>
        )}
      </div>
      {auth !== 'none' && <p className={errors.key ? 'st-error ep-under' : 'st-hint ep-under'} id="ep-key-hint">{errors.key ?? keyHint}</p>}
      {auth === 'none' && errors.key && <p className="st-error">{errors.key}</p>}

      {!providerMode && keyless && (auth === 'none' || baseUrl.trim()) && <Note tone="warn" title="Unprotected">{NO_KEY_NOTE}</Note>}

      {configChange && (
        <Note tone="warn">
          {providerMode
            ? 'Saving tests the endpoint again. A new key is tested on the models you listed; a listing whose test passes stays listed, the others pause.'
            : <>Changing the address, key or authentication turns every model off until the {noun} passes a new test.</>}
        </Note>
      )}

      {isHttp && !providerMode && (
        <label className={`st-toggle ep-ack${errors.ack ? ' is-error' : ''}`}>
          <input type="checkbox" className="st-check" checked={ack} disabled={busy} onChange={ev => { setAck(ev.target.checked); clearError('ack'); }} />
          <span>
            <b>I understand this is unencrypted</b>
            <span>
              {keyless
                ? 'Prompts and answers cross the internet in plain text.'
                : 'Prompts, answers and this key cross the internet in plain text.'}
              {' '}Required for an http:// address; the {noun} is tagged Unencrypted.
            </span>
            {errors.ack && <span className="st-error">{errors.ack}</span>}
          </span>
        </label>
      )}

      {scope.kind === 'workspace' && (
        <ShareFields
          share={share} ids={shareIds} members={members} slug={editing ? endpoint!.slug : effectiveSlug || 'gpu-box-a'} busy={busy}
          projects={scope.projects}
          onShare={v => { setShare(v); if (failure) setFailure(null); }}
          onIds={v => { setShareIds(v); if (failure) setFailure(null); }}
          onMembers={v => { setMembers(v); if (failure) setFailure(null); }}
        />
      )}

      <div className="ep-adv">
        <button type="button" className="ep-adv-btn" aria-expanded={advanced} aria-controls="ep-adv-body" onClick={() => setAdvanced(a => !a)}>
          <span>Advanced</span><i aria-hidden="true" />
        </button>
        {advanced && (
          <div className="ep-adv-body" id="ep-adv-body">
            <div className="ep-form-row">
              <div className="st-field">
                <label className="st-field-label" htmlFor="ep-timeout">Wait for the first byte <small>seconds</small></label>
                <input id="ep-timeout" className="st-input" inputMode="numeric" value={timeoutSec} disabled={busy}
                  onChange={ev => { setTimeoutSec(ev.target.value.replace(/[^0-9]/g, '')); clearError('timeout'); }} aria-invalid={!!errors.timeout} />
                <p className={errors.timeout ? 'st-error' : 'st-hint'}>{errors.timeout ?? '180 s unless you change it (10–900). A cold model load can take minutes.'}</p>
              </div>
              <div className="st-field">
                <label className="st-field-label" htmlFor="ep-conc">Requests at a time</label>
                <input id="ep-conc" className="st-input" inputMode="numeric" value={concurrency} disabled={busy}
                  onChange={ev => { setConcurrency(ev.target.value.replace(/[^0-9]/g, '')); clearError('concurrency'); }} aria-invalid={!!errors.concurrency} />
                <p className={errors.concurrency ? 'st-error' : 'st-hint'}>{errors.concurrency ?? '8 unless you change it (1–64).'}</p>
              </div>
            </div>
            {providerMode ? null : editing ? (
              endpoint!.hasAccessHeaders ? <p className="st-hint">A Cloudflare Access service token is stored for this {noun}.</p> : null
            ) : (
              <fieldset className="ep-cf">
                <legend className="st-field-label">Cloudflare Access service token <small>client ID and secret</small></legend>
                <div className="ep-form-row">
                  <input className="st-input" aria-label="Cloudflare Access client ID" placeholder="Client ID" value={cfId} disabled={busy} spellCheck={false}
                    onChange={ev => { setCfId(ev.target.value); clearError('cf'); }} />
                  <input className="st-input" type="password" aria-label="Cloudflare Access client secret" placeholder="Client secret" value={cfSecret} disabled={busy}
                    autoComplete="new-password" spellCheck={false} onChange={ev => { setCfSecret(ev.target.value); clearError('cf'); }} />
                </div>
                <p className={errors.cf ? 'st-error' : 'st-hint'}>{errors.cf ?? 'Only for a server behind Cloudflare Access. Printable ASCII without spaces, like the API key.'}</p>
              </fieldset>
            )}
          </div>
        )}
      </div>

      {!providerMode && (
        <p className="st-hint">
          Our servers cannot reach localhost or private addresses (192.168.x, 10.x, Tailscale 100.64.x). From a PC, start a tunnel
          (Cloudflare Tunnel, Tailscale Funnel or ngrok) and paste its https address.
        </p>
      )}

      {egress && (
        <Note title="Our address">
          Requests come from {egress.ips.join(' and ')}{egress.ipv4Only ? ' (IPv4)' : ''}. Allowlisting our {egress.ips.length === 1 ? 'IP' : 'IPs'} alone
          is not enough — every AI Stupid Level account sends from {egress.ips.length === 1 ? 'it' : 'them'}. Set an API key on your server.
        </Note>
      )}

      {failure && <div ref={failRef}><Note tone="bad" title={editing ? 'Not saved' : 'Not added'}>{failure}</Note></div>}

      <Foot el={foot}>
        <button type="button" className="st-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" form="ep-conn-form" className="st-btn is-primary" disabled={busy}>
          {busy ? (editing ? 'Saving…' : 'Adding…') : editing ? (configChange ? 'Save and test' : 'Save') : 'Add and test'}
        </button>
      </Foot>
    </form>
  );
}

/** The sharing a workspace server has (R5), with the API's defaults for a new one. */
function sharingOf(e: TeamEndpoint | undefined): { shareProjects: 'all' | 'selected'; projectIds: number[]; membersCanUse: boolean } {
  return {
    shareProjects: e?.shareProjects === 'selected' ? 'selected' : 'all',
    projectIds: Array.isArray(e?.projectIds) ? e!.projectIds!.filter(n => Number.isInteger(n)) : [],
    membersCanUse: !!e?.membersCanUse,
  };
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

/**
 * "Who can use it", for a workspace server (plan §6.4): every project or the projects chosen, and
 * whether members may also name it with their personal keys. One place to set both, beside what
 * they mean; the row shows the result.
 */
function ShareFields({ share, ids, members, slug, busy, projects, onShare, onIds, onMembers }: {
  share: 'all' | 'selected'; ids: number[]; members: boolean; slug: string; busy: boolean;
  projects: Array<{ id: number; name: string }>;
  onShare: (v: 'all' | 'selected') => void; onIds: (v: number[]) => void; onMembers: (v: boolean) => void;
}) {
  return (
    <fieldset className="ep-share">
      <legend className="st-field-label">Who can use it</legend>
      <div className="ep-share-opts" role="radiogroup" aria-label="Share with">
        <label className="st-toggle">
          <input type="radio" name="ep-share" className="st-check" checked={share === 'all'} disabled={busy} onChange={() => onShare('all')} />
          <span><b>Every project</b><span>The keys of every project in the workspace, including projects added later.</span></span>
        </label>
        <label className="st-toggle">
          <input type="radio" name="ep-share" className="st-check" checked={share === 'selected'} disabled={busy} onChange={() => onShare('selected')} />
          <span><b>Selected projects</b><span>Only the keys of the projects you tick.</span></span>
        </label>
      </div>
      {share === 'selected' && (
        projects.length === 0
          ? <p className="st-hint">The workspace has no projects yet. Until you choose some, no project&rsquo;s keys can use this server.</p>
          : (
            <div className="ep-share-projects">
              {projects.map(p => (
                <label key={p.id} className="st-toggle ep-pick">
                  <input type="checkbox" className="st-check" checked={ids.includes(p.id)} disabled={busy}
                    onChange={ev => onIds(ev.target.checked ? [...ids, p.id] : ids.filter(x => x !== p.id))} />
                  <b>{p.name}</b>
                </label>
              ))}
              {ids.length === 0 && <p className="st-hint">No project ticked: no project&rsquo;s keys can use this server.</p>}
            </div>
          )
      )}
      <label className="st-toggle ep-share-members">
        <input type="checkbox" className="st-check" checked={members} disabled={busy} onChange={ev => onMembers(ev.target.checked)} />
        <span>
          <b>Members may also use it with their personal keys</b>
          <span>
            A member&rsquo;s prompts go to this server only when they name it (<code className="ep-id">ep/team.{slug}/…</code>) or choose
            Prefer or Only my endpoints themselves.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

// ── tests: start one, follow one ──────────────────────────────────────────────────────────────────

/**
 * Start a test. `attach`: a test already running for this endpoint (409 probe_running) is followed
 * instead, when the API names it; the connection view wants any running test, a model test does not.
 */
async function startProbe(api: EndpointsApi, id: string, models?: string[], attach = false): Promise<number> {
  try {
    const r = await api.probe(id, models);
    return r.probeId;
  } catch (err) {
    if (attach && err instanceof ApiRequestError && err.status === 409) {
      const running = Number(err.body.probeId);
      if (Number.isInteger(running) && running > 0) return running;
    }
    throw err;
  }
}

/**
 * Poll a test every 1.5 s (4 s after the first two minutes) until it ends or `limitMs` passes.
 * `gone`: the test answered 404, which happens when the endpoint was removed while it ran (its
 * test rows go with it) or endpoints were switched off for this account.
 */
function useProbe(endpointId: string, probeId: number | null, limitMs: number) {
  const scope = useScope();
  const [probe, setProbe] = useState<EndpointProbe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [round, setRound] = useState(0);

  // A different test starts from nothing; "Check again" on the same one keeps the lines it has.
  useEffect(() => { setProbe(null); setGone(false); }, [endpointId, probeId]);

  useEffect(() => {
    setError(null);
    setTimedOut(false);
    if (probeId == null) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const started = Date.now();
    const tick = async () => {
      try {
        const p = await scope.api.getProbe(endpointId, probeId);
        if (stopped) return;
        failures = 0;
        setError(null);
        setProbe(p);
        if (!isRunning(p.status)) return;
      } catch (err) {
        if (stopped) return;
        failures += 1;
        // A missing test ends the polling at once; three failed reads in a row end it with the reason.
        if (err instanceof ApiRequestError && err.status === 404) { setGone(true); return; }
        if (failures >= 3) { setError(errorText(err, {}, isTeam(scope))); return; }
      }
      const elapsed = Date.now() - started;
      if (elapsed > limitMs) { setTimedOut(true); return; }
      timer = setTimeout(tick, elapsed < 120_000 ? POLL_MS : SLOW_POLL_MS);
    };
    void tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [endpointId, probeId, limitMs, round]);

  return { probe, error, gone, timedOut, again: () => setRound(r => r + 1) };
}

/**
 * A test the API deferred at create or an address change: its own sentence (R4 API 58add09), or null. A
 * probe limit is worded here, as a refused Test is (errorText): the wait in minutes, not "3431 s".
 */
function deferredText(p: DeferredProbe | null | undefined, team = false): string | null {
  if (!p || !p.deferred) return null;
  if (p.code === 'probe_rate_limited') {
    const wait = typeof p.retryAfterSec === 'number' && p.retryAfterSec > 0 ? ` Try again in ${fmtWait(Math.ceil(p.retryAfterSec))}.` : ' Try again later.';
    return `${probeLimitText((p as { limit?: unknown }).limit, {}, team)}${wait}`;
  }
  return (typeof p.message === 'string' && p.message) || codeMessage(p.code, {}, undefined, team) || 'The test did not start. Try again in a moment.';
}

const goneText = (noun: Noun) => noun === 'server'
  ? 'This server can no longer be found: it was removed while the test ran, or servers are no longer available to this workspace.'
  : 'This endpoint can no longer be found: it was removed while the test ran, or endpoints are no longer available to this account.';

/**
 * Why a test ended before its checks were done, from its status and its last line's code (the
 * API's probe.ts): the address, key or authentication changed and a new test replaced it
 * (`superseded`, status interrupted); it ran out of time (`probe_deadline`, status failed); or the
 * router restarted under it (status interrupted, no closing line). The lines themselves stay in view.
 */
function endNote(probe: EndpointProbe | null): { kind: 'superseded' | 'deadline' | 'restart'; title: string; text: string } | null {
  if (!probe || isRunning(probe.status)) return null;
  const code = probe.steps.length ? probe.steps[probe.steps.length - 1].code : null;
  if (code === 'superseded') {
    return { kind: 'superseded', title: 'Replaced by a newer test', text: 'A test of the new settings is running in its place, and every model stays off until it passes a test again.' };
  }
  if (code === 'probe_deadline') {
    return {
      kind: 'deadline', title: 'The test ran out of time',
      text: 'A test has one minute for the address and the model list, three minutes for each model it asks to answer, and 15 minutes in all. A model that is still loading, or a slow tunnel, can take longer: test again in a moment.',
    };
  }
  if (probe.status === 'interrupted') {
    // From R4 the kill switch stops a running test too (its last line, code 'paused', says so in the
    // API's words): nothing restarted, so the restart note would be untrue.
    if (code === 'paused') return null;
    return { kind: 'restart', title: 'The test was interrupted', text: 'The router restarted while it ran. Nothing is wrong with your server as far as we know; test again.' };
  }
  return null;
}

/** The test's state, in words: a test the kill switch stopped says why rather than "interrupted". */
function probeState(probe: EndpointProbe): string {
  const last = probe.steps.length ? probe.steps[probe.steps.length - 1] : null;
  if (probe.status === 'interrupted' && last?.code === 'paused') return 'Test stopped: private endpoints are paused';
  return PROBE_STATE[probe.status] ?? probe.status;
}

const STEP_LABEL: Record<string, string> = {
  address: 'Public address', models: 'Speaks the OpenAI format', context: 'Context size', chat: 'Answers', tools: 'Tool calls', stream: 'Streaming',
};

const PROBE_STATE: Record<EndpointProbeStatus, string> = {
  queued: 'Waiting for a free test slot…',
  running: 'Testing…',
  passed: 'Test passed',
  partial: 'Test finished: some checks failed',
  failed: 'Test failed',
  blocked: 'Test stopped: the address is not allowed',
  interrupted: 'Test interrupted',
};

function StepIcon({ kind }: { kind: 'ok' | 'warn' | 'fail' }) {
  return (
    <svg className={`ep-step-i is-${kind}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7.25" fill="currentColor" />
      {kind === 'ok' && <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
      {kind === 'fail' && <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />}
      {kind === 'warn' && <path d="M8 4.6v4.2M8 11.2v.2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

/** "Public address — gpu1.example.com resolves to 203.0.113.7": the label in ink, the rest after it. */
function StepLine({ s, at }: { s: EndpointProbeStep; at: Where }) {
  const text = s.message || `${STEP_LABEL[s.step] ?? s.step} — ${s.ok ? 'passed' : codeMessage(s.code, at) ?? 'failed'}`;
  const cut = text.indexOf(' — ');
  // A passing step that still carries a code is a caveat (models skipped, a context size assumed);
  // so is the line of a test the kill switch stopped (code 'paused'): the server did not fail it.
  const kind = s.code === 'paused' ? 'warn' : !s.ok ? 'fail' : s.code ? 'warn' : 'ok';
  return (
    <li className={`ep-step is-${kind}`}>
      <StepIcon kind={kind} />
      <span>{cut > 0 ? <><b>{text.slice(0, cut)}</b> — {text.slice(cut + 3)}</> : text}</span>
    </li>
  );
}

function ProbeView({ probe, at, showState = true, halted = false }: { probe: EndpointProbe | null; at: Where; showState?: boolean; halted?: boolean }) {
  const steps = probe?.steps ?? [];
  const general = steps.filter(s => !s.model);
  const order: string[] = [...(probe?.models ?? [])];
  for (const s of steps) if (s.model && !order.includes(s.model)) order.push(s.model);
  // halted: no longer followed (the endpoint is gone, or the reads failed), so nothing is "running".
  const running = !halted && (!probe || isRunning(probe.status));
  return (
    <div className="ep-probe" aria-live="polite">
      {showState && probe && !running && <p className={`ep-probe-state is-${probe.status}`}>{probeState(probe)}</p>}
      {general.length > 0 && <ul className="ep-steps">{general.map((s, i) => <StepLine key={i} s={s} at={at} />)}</ul>}
      {order.map(m => {
        const own = steps.filter(s => s.model === m);
        if (!own.length && !running) return null;
        return (
          <div key={m} className="ep-probe-model">
            <p className="ep-probe-mt">{m}</p>
            {own.length ? <ul className="ep-steps">{own.map((s, i) => <StepLine key={i} s={s} at={at} />)}</ul> : <p className="ep-step-wait">Waiting for its turn…</p>}
          </div>
        );
      })}
      {running && (
        <p className="ep-step-wait" role="status">
          <span className="st-bars" aria-hidden="true"><i /><i /><i /></span>
          {probe ? PROBE_STATE[probe.status] : 'Starting the test…'}
        </p>
      )}
    </div>
  );
}

// ── step 2: the connection test ──────────────────────────────────────────────────────────────────

function TestStep({ endpoint, probeId: given, deferred, foot, onTesting, onChanged, onModels, onEdit, onClose }: {
  endpoint: Endpoint; probeId: number | null; deferred?: string | null; foot: HTMLElement | null;
  onTesting: (on: boolean) => void; onChanged: () => void; onModels: () => void; onEdit: () => void; onClose: () => void;
}) {
  const scope = useScope();
  const team = isTeam(scope);
  const [probeId, setProbeId] = useState<number | null>(given);
  // A test the API deferred (create or address change under the kill switch) shows its sentence where a
  // refused Test would, and is not started on open: the API has already said it cannot run now.
  const [startError, setStartError] = useState<string | null>(given == null ? deferred ?? null : null);
  const [starting, setStarting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { probe, error, gone, timedOut, again } = useProbe(endpoint.id, probeId, CONNECTION_POLL_LIMIT_MS);
  const at = hostPort(endpoint.baseUrl);
  const running = probeId != null && !error && !gone && !timedOut && (!probe || isRunning(probe.status));
  const ended = !!probe && !isRunning(probe.status);
  const why = endNote(probe);

  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      setProbeId(await startProbe(scope.api, endpoint.id, undefined, true));
    } catch (err) {
      setStartError(errorText(err, at, team));
    } finally {
      setStarting(false);
    }
  }, [endpoint.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Test again" opens this view without a test: start one, once (React's development mode runs
  // mount effects twice, which sent two POSTs).
  const startedOnOpen = useRef(false);
  useEffect(() => {
    if (given != null || deferred || startedOnOpen.current) return;
    startedOnOpen.current = true;
    void start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onTesting(running); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onTesting(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ended || gone) onChanged(); }, [ended, gone]); // eslint-disable-line react-hooks/exhaustive-deps

  const adoptSuggested = async () => {
    if (!probe?.suggestedBaseUrl) return;
    setSwitching(true);
    setStartError(null);
    try {
      const r = await scope.api.update(endpoint.id, { baseUrl: probe.suggestedBaseUrl });
      onChanged();
      const later = deferredText(r?.probe, team);
      if (typeof r?.probeId === 'number') setProbeId(r.probeId);
      else if (later) { setProbeId(null); setStartError(later); }
      else setProbeId(await startProbe(scope.api, endpoint.id, undefined, true));
    } catch (err) {
      setStartError(errorText(err, at, team));
    } finally {
      setSwitching(false);
    }
  };

  /** A newer test replaced this one: follow it (the endpoint's newest test), or start one. */
  const followNewer = async () => {
    setStartError(null);
    try {
      const v = await scope.api.get(endpoint.id);
      const newest = v.lastProbe;
      if (newest && typeof newest.id === 'number' && newest.id !== probeId) setProbeId(newest.id);
      else await start();
    } catch (err) {
      setStartError(errorText(err, at, team));
    }
  };

  const passed = probe?.status === 'passed' || probe?.status === 'partial';

  return (
    <div className="ep-step-body">
      <p className="st-text">First we check the address and read the model list. No model is asked to answer yet.</p>

      {(probeId != null || starting) && <ProbeView probe={probe} at={at} halted={gone || !!error} />}

      {probe?.suggestedBaseUrl && ended && (
        <Note title="A better address">
          GET /models answered at <code className="ep-id">{probe.suggestedBaseUrl}</code>. Use that address?
          <div className="sk-note-act">
            <button type="button" className="st-btn is-sm is-primary" onClick={adoptSuggested} disabled={switching}>{switching ? 'Switching…' : 'Use it'}</button>
          </div>
        </Note>
      )}

      {startError && <Note tone="bad" title="The test did not start">{startError}</Note>}
      {error && <Note tone="bad" title="Lost track of the test">{error}</Note>}
      {gone && <Note tone="warn" title={team ? 'The server is gone' : 'The endpoint is gone'}>{goneText(scope.noun)}</Note>}
      {timedOut && (
        <Note tone="warn" title="Still testing">
          The test is taking longer than usual. It goes on without this window; check again in a moment.
          <div className="sk-note-act"><button type="button" className="st-btn is-sm" onClick={again}>Check again</button></div>
        </Note>
      )}
      {why && (
        <Note tone="warn" title={why.title}>
          {why.text}
          {why.kind === 'superseded' && (
            <div className="sk-note-act"><button type="button" className="st-btn is-sm" onClick={followNewer}>Show the new test</button></div>
          )}
        </Note>
      )}

      <Foot el={foot}>
        {ended && !passed && why?.kind !== 'superseded' && <button type="button" className="st-btn" onClick={onEdit}>Change the connection</button>}
        {!gone && (ended || startError || error || timedOut) && why?.kind !== 'superseded' && (
          <button type="button" className="st-btn" onClick={() => { setProbeId(null); void start(); }} disabled={starting || running}>
            {starting ? 'Starting…' : 'Test again'}
          </button>
        )}
        {!passed && <button type="button" className="st-btn is-quiet" onClick={onClose}>Close</button>}
        {passed && (
          <button type="button" className="st-btn is-primary" onClick={onModels}>
            Choose models <span className="st-ar" aria-hidden="true">→</span>
          </button>
        )}
      </Foot>
    </div>
  );
}

// ── step 3: the models ───────────────────────────────────────────────────────────────────────────

interface Draft { enabled: boolean; ctx: string; maxOut: string; pin: string; pout: string; roles: EndpointRole[] }

/**
 * "Use for" (plan §6.1 Models, §5.2 step 3): the roles that order an endpoint chain. auto-coding,
 * auto-reasoning and auto-tooling (and Match each request, per request) try tagged models first. The
 * API also takes `general`, which orders nothing, so it is not offered; a stored one is kept as it is.
 */
const ROLE_CHOICES: Array<{ id: EndpointRole; label: string }> = [
  { id: 'coding', label: 'Coding' }, { id: 'reasoning', label: 'Reasoning' }, { id: 'tooling', label: 'Tool use' },
];
const ROLE_ORDER: EndpointRole[] = ['coding', 'reasoning', 'tooling', 'general'];
const rolesOf = (v: unknown): EndpointRole[] => (Array.isArray(v) ? ROLE_ORDER.filter(r => v.includes(r)) : []);

const numText = (n: number | null | undefined) => (n == null ? '' : String(n));
const draftOf = (m: EndpointModel): Draft => ({
  enabled: !!m.enabled, ctx: numText(m.declaredContextTokens), maxOut: numText(m.maxOutputTokens), pin: numText(m.priceInPerMTok), pout: numText(m.priceOutPerMTok),
  roles: rolesOf(m.roles),
});
const sameDraft = (a: Draft, b: Draft) => a.enabled === b.enabled && a.ctx === b.ctx && a.maxOut === b.maxOut && a.pin === b.pin && a.pout === b.pout
  && a.roles.join() === b.roles.join();

/** The settings part of a draft as a PATCH body (enabled goes separately, after it), or what is wrong with it. */
function settingsPatch(m: EndpointModel, d: Draft): { patch: EndpointModelPatch; error?: string } {
  const patch: EndpointModelPatch = {};
  const int = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[,\s_]/g, '')));
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[$\s]/g, '')));
  const ctx = int(d.ctx);
  if (ctx !== null && (!Number.isInteger(ctx) || ctx < 512 || ctx > 10_000_000)) return { patch, error: 'Context: a whole number of tokens from 512 to 10,000,000.' };
  const maxOut = int(d.maxOut);
  if (maxOut !== null && (!Number.isInteger(maxOut) || maxOut < 16 || maxOut > 1_000_000)) return { patch, error: 'Max output: a whole number of tokens from 16 to 1,000,000.' };
  const pin = num(d.pin);
  const pout = num(d.pout);
  for (const p of [pin, pout]) if (p !== null && (!Number.isFinite(p) || p < 0 || p > 1000)) return { patch, error: 'Prices: from 0 to 1,000 US dollars per 1M tokens, or empty.' };
  if (ctx !== m.declaredContextTokens) patch.declaredContextTokens = ctx;
  if (maxOut !== m.maxOutputTokens) patch.maxOutputTokens = maxOut;
  if (pin !== m.priceInPerMTok) patch.priceInPerMTok = pin;
  if (pout !== m.priceOutPerMTok) patch.priceOutPerMTok = pout;
  if (d.roles.join() !== rolesOf(m.roles).join()) patch.roles = d.roles;
  return { patch };
}

const CONTEXT_SOURCE: Record<string, string> = {
  declared: 'entered by you', vllm: 'vLLM max_model_len', sglang: 'SGLang max_model_len', llamacpp: 'llama.cpp n_ctx',
  ollama_ps: 'Ollama /api/ps', ollama_assumed: 'Ollama default', lmstudio: 'LM Studio loaded_context_length',
  tgi: 'TGI max_total_tokens', listing: 'the model list', learned: 'learned from the server’s own error',
};

interface Line { label: string; text: ReactNode; tone?: 'warn' | 'bad' }

/** What the last test found (§6.1 "Per tested model"), from the stored results so it holds after a reload. */
/**
 * `pausedSince`: when the endpoint's crash pause began (healthChangedAt), or null when it is not paused. A
 * stored pass from before it is history: it says so, so no row claims a passed test next to a pause that
 * test cannot end (R6 review M4).
 */
function testedLines(m: EndpointModel, chat?: EndpointProbeStep, pausedSince: string | null = null): Line[] {
  const lines: Line[] = [];
  if (chat?.message) {
    const cut = chat.message.indexOf(' — ');
    lines.push({ label: cut > 0 ? chat.message.slice(0, cut) : 'Answers', text: cut > 0 ? chat.message.slice(cut + 3) : chat.message, tone: chat.ok ? undefined : 'bad' });
  } else {
    const beforePause = pausedSince !== null && (!m.lastProbeAt || !(Date.parse(m.lastProbeAt) > Date.parse(pausedSince)));
    lines.push(m.lastProbeOk
      ? { label: 'Answers', text: `passed the test${m.lastProbeAt ? ` on ${fmtDay(m.lastProbeAt)}` : ''}${beforePause ? ', before the router crash paused it' : ''}`, tone: beforePause ? 'warn' : undefined }
      : { label: 'Answers', text: 'did not pass the last test', tone: 'bad' });
  }
  if (m.supportsStream != null) {
    lines.push(m.streamUsage
      ? { label: 'Streaming with usage', text: 'yes' }
      : m.supportsStream
        ? { label: 'Streaming', text: 'without usage: token counts are estimated' }
        : { label: 'Streaming', text: 'no' });
  }
  if (m.supportsTools != null) {
    lines.push(m.supportsTools
      ? { label: 'Tool calls', text: 'native' }
      : { label: 'Tool calls', text: <>answered in prose; requests with tools skip this model. On vLLM, start it with <code className="st-ic">--enable-auto-tool-choice</code> <code className="st-ic">--tool-call-parser &lt;parser&gt;</code>.</>, tone: 'warn' });
  }
  if (m.forcedTools) {
    lines.push({ label: 'Forced tool choice', text: m.forcedTools === 'native' ? 'native' : 'by instruction (tool_choice=required is emulated and checked)' });
  }
  if (m.contextTokens != null && m.contextSource !== 'ollama_assumed') {
    lines.push({ label: 'Context', text: `${fmtInt(m.contextTokens)} tokens${m.contextSource ? ` (${CONTEXT_SOURCE[m.contextSource] ?? m.contextSource})` : ''}` });
  }
  if (m.thinkFormat === 'field') lines.push({ label: 'Reasoning', text: 'kept out of answers (reasoning_content)' });
  else if (m.thinkFormat === 'tags' || m.thinkFormat === 'leading_close') lines.push({ label: 'Reasoning', text: '<think> blocks are removed from answers' });
  else if (m.thinkFormat === 'harmony') lines.push({ label: 'Reasoning', text: 'gpt-oss channel markup found: only the final answer is returned' });
  return lines;
}

function ModelsStep({ endpoint, limits, foot, onTesting, onChanged, onClose, onSaved }: {
  endpoint: Endpoint; limits: EndpointLimits | null; foot: HTMLElement | null;
  onTesting: (on: boolean) => void; onChanged: () => void; onClose: () => void; onSaved: (exampleId: string | null) => void;
}) {
  const scope = useScope();
  const team = isTeam(scope);
  const [view, setView] = useState<EndpointView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [ticked, setTicked] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [probeId, setProbeId] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testBlockedUntil, setTestBlockedUntil] = useState(0);
  const [startingTest, setStartingTest] = useState(false);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [addingManual, setAddingManual] = useState(false);
  const [letGo, setLetGo] = useState<number | null>(null);
  // A finished test folds into one line: its results are under each model in the table.
  const [showRun, setShowRun] = useState(false);
  const saveErrRef = useRef<HTMLDivElement>(null);
  const { probe, error: probeError, gone: probeGone, timedOut, again } = useProbe(endpoint.id, probeId, MODEL_POLL_LIMIT_MS);
  const why = endNote(probe);
  const at = hostPort(endpoint.baseUrl);
  const perEndpoint = limits?.modelsPerEndpoint as unknown;
  const enabledCap = typeof perEndpoint === 'number' ? perEndpoint : (perEndpoint as { enabled?: number } | undefined)?.enabled ?? 20;

  const load = useCallback(async (keepEdits: boolean) => {
    try {
      const v = await scope.api.get(endpoint.id);
      setView(v);
      setLoadError(null);
      setDrafts(prev => {
        const next: Record<number, Draft> = {};
        for (const m of v.models) {
          const old = prev[m.id];
          // Keep what the person typed but has not saved; take everything else from the API.
          next[m.id] = keepEdits && old && !sameDraft(old, draftOf(m)) ? old : draftOf(m);
        }
        return next;
      });
      return v;
    } catch (err) {
      setLoadError(errorText(err, at, team));
      return null;
    }
  }, [endpoint.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load(false).then(v => {
      // A model test still running (the dialog was closed during it): follow it again.
      const lp = v?.lastProbe;
      if (lp && lp.id != null && isRunning(lp.status) && lp.models && lp.models.length) setProbeId(lp.id);
    });
  }, [load]);

  const testRunning = probeId != null && !probeError && !probeGone && !timedOut && (!probe || isRunning(probe.status));
  const testEnded = !!probe && !isRunning(probe.status);
  useEffect(() => { onTesting(testRunning); }, [testRunning]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onTesting(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!testEnded) return;
    setTicked([]);
    setShowRun(false);
    void load(true);
    onChanged();
  }, [testEnded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (saveError) saveErrRef.current?.scrollIntoView({ block: 'nearest' }); }, [saveError]);
  useEffect(() => { if (probeGone) onChanged(); }, [probeGone]); // eslint-disable-line react-hooks/exhaustive-deps

  // A 429 names how long to wait: the button comes back by itself then.
  useEffect(() => {
    if (!testBlockedUntil) return;
    const t = setTimeout(() => setTestBlockedUntil(0), Math.max(0, testBlockedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [testBlockedUntil]);

  const models = view?.models ?? [];
  const chatStep = (model: string) => (probe ?? view?.lastProbe)?.steps?.find(s => s.model === model && s.step === 'chat');
  const enabledCount = models.filter(m => drafts[m.id]?.enabled).length;
  const dirty = models.filter(m => drafts[m.id] && !sameDraft(drafts[m.id], draftOf(m)));

  const setDraft = (id: number, change: Partial<Draft>) => {
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...change } }));
    setRowErrors(({ [id]: _gone, ...rest }) => rest);
    setSaveError(null);
  };
  const toggleTick = (model: string) => setTicked(t => (t.includes(model) ? t.filter(x => x !== model) : t.length >= MAX_TEST ? t : [...t, model]));

  const runTest = async () => {
    if (!ticked.length || testRunning) return;
    setStartingTest(true);
    setTestError(null);
    try {
      setProbeId(await startProbe(scope.api, endpoint.id, ticked));
    } catch (err) {
      setTestError(errorText(err, at, team));
      if (err instanceof ApiRequestError && err.status === 429 && err.retryAfterSec) setTestBlockedUntil(Date.now() + err.retryAfterSec * 1000);
    } finally {
      setStartingTest(false);
    }
  };

  const addManual = async (ev: FormEvent) => {
    ev.preventDefault();
    const name = manual.trim();
    if (!name) return;
    if (!PRINTABLE.test(name) || name.length > 200) { setManualError(MODEL_ID_RULE); return; }
    setAddingManual(true);
    setManualError(null);
    try {
      await scope.api.addModel(endpoint.id, name);
      setManual('');
      await load(true);
      onChanged();
    } catch (err) {
      setManualError(errorText(err, at, team));
    } finally {
      setAddingManual(false);
    }
  };

  const releaseName = async (m: EndpointModel) => {
    setLetGo(m.id);
    try {
      await scope.api.updateModel(endpoint.id, m.id, { bareNameClaim: false });
      await load(true);
    } catch (err) {
      setRowErrors(r => ({ ...r, [m.id]: errorText(err, at, team) }));
    } finally {
      setLetGo(null);
    }
  };

  const save = async () => {
    if (saving) return;
    const errs: Record<number, string> = {};
    const work: Array<{ m: EndpointModel; settings: EndpointModelPatch; enable?: boolean }> = [];
    for (const m of dirty) {
      const d = drafts[m.id];
      const { patch, error } = settingsPatch(m, d);
      if (error) { errs[m.id] = error; continue; }
      work.push({ m, settings: patch, enable: d.enabled !== !!m.enabled ? d.enabled : undefined });
    }
    if (enabledCount > enabledCap) { setSaveError(`At most ${enabledCap} models of one ${scope.noun} can be on at once.`); return; }
    if (Object.keys(errs).length) { setRowErrors(errs); setSaveError('Some values are out of range; they are marked below.'); return; }
    setSaving(true);
    setSaveError(null);
    // Settings first, then the switch: a context size entered here is stored before turning the
    // model on depends on it. Turning off goes the same way; each model is reported on its own.
    for (const w of work) {
      try {
        if (Object.keys(w.settings).length) await scope.api.updateModel(endpoint.id, w.m.id, w.settings);
        if (w.enable !== undefined) await scope.api.updateModel(endpoint.id, w.m.id, { enabled: w.enable });
      } catch (err) {
        errs[w.m.id] = errorText(err, at, team);
      }
    }
    const fresh = await load(true);
    setSaving(false);
    onChanged();
    if (Object.keys(errs).length) {
      setRowErrors(errs);
      setSaveError(`${plural(Object.keys(errs).length, 'model')} not saved; the reason is next to each one.`);
      return;
    }
    const on = (fresh?.models ?? models).find(m => m.enabled);
    onSaved(on ? (on.modelId || epId(scope.ns, endpoint.slug, on.model)) : null);
  };

  if (!view) {
    return loadError
      ? <Note tone="bad" title="Could not load the models">{loadError}<div className="sk-note-act"><button type="button" className="st-btn is-sm" onClick={() => void load(false)}>Try again</button></div></Note>
      : <Loader label="Loading the models" minHeight={220} />;
  }

  const blocked = testBlockedUntil > Date.now();
  // A crash pause (R6): a first one ends with a passing model test of this step; an owner-only one only when
  // AI Stupid Level resumes it, so no test is offered (the API would refuse it, R6 review M4).
  // The detail this step loads (and reloads after each test) when it has the health, else the list's row.
  const health = view.health && typeof view.health.state === 'string'
    ? { state: view.health.state, error: view.health.lastError, since: view.health.since }
    : { state: endpoint.healthState, error: endpoint.healthError ?? null, since: endpoint.healthChangedAt ?? null };
  const paused = health.state === 'quarantined';
  const ownerOnly = isOwnerOnlyPause(health.state, health.error);
  const pausedSince = paused ? (health.since ?? endpoint.healthChangedAt ?? null) : null;
  // The test's summary line: a test whose lines name no model (an owner-only pause, a failed address step)
  // has no results under the models, so its own last failing line is said instead.
  const lastStep = probe && probe.steps.length ? probe.steps[probe.steps.length - 1] : null;
  const namesModels = !!probe && probe.steps.some(s => !!s.model);
  const lastFailed = probe ? [...probe.steps].reverse().find(s => !s.ok) : undefined;
  const doneText = !probe ? ''
    : lastStep && lastStep.code === 'paused' ? (lastStep.message ?? '')
    : why ? ''
    : namesModels && probe.models?.length ? `${plural(probe.models.length, 'model')}: the results are under each one below.`
    : lastFailed ? (lastFailed.message || codeMessage(lastFailed.code, at) || '')
    : '';

  return (
    <div className="ep-step-body ep-models">
      {/* "Test again" on a crash-paused endpoint opens this step: a passing model test resumes a first pause (R6). */}
      {paused && (ownerOnly
        ? <Note tone="bad" title="Paused until AI Stupid Level resumes it"><OwnerOnlyText noun={scope.noun} /></Note>
        : <Note tone="warn" title="Paused after a router crash">{quarantined(scope.noun)}</Note>)}
      <div className="ep-testbar">
        <p className="st-hint">
          Testing a model sends it six short requests, or three if it has no tool calling: about 430 prompt tokens and up to 2,304
          output tokens. Retries can raise that to about nine requests and 5,400 output tokens. Tick up to {MAX_TEST} models per test.
          Ollama and LM Studio load each model they test, which can unload another model from your GPU.
        </p>
        <button type="button" className="st-btn is-sm" onClick={runTest} disabled={!ticked.length || testRunning || startingTest || blocked || ownerOnly}
          title={ownerOnly ? OWNER_ONLY_NO_TEST : undefined}>
          {testRunning ? 'Testing…' : startingTest ? 'Starting…' : ticked.length ? `Test selected (${ticked.length})` : 'Test selected'}
        </button>
      </div>

      {testError && <Note tone="bad" title="The test did not start">{testError}</Note>}
      {probeId != null && (
        <div className="ep-testrun">
          {testEnded && probe ? (
            <div className="ep-testdone">
              <span className={`ep-probe-state is-${probe.status}`}>{probeState(probe)}</span>
              {/* A test the kill switch stopped, or one whose lines name no model, has no results to point at:
                  its own last line says why. */}
              <span className="st-faint">{doneText}</span>
              <button type="button" className="ep-linkbtn" aria-expanded={showRun} onClick={() => setShowRun(v => !v)}>
                {showRun ? 'Hide the test lines' : 'Show the test lines'}
              </button>
            </div>
          ) : null}
          {(!testEnded || showRun) && <ProbeView probe={probe} at={at} showState={!testEnded} halted={probeGone || !!probeError} />}
          {why && <Note tone="warn" title={why.title}>{why.text}</Note>}
          {probeGone && <Note tone="warn" title={team ? 'The server is gone' : 'The endpoint is gone'}>{goneText(scope.noun)}</Note>}
          {probeError && <Note tone="bad" title="Lost track of the test">{probeError}</Note>}
          {timedOut && (
            <Note tone="warn" title="Still testing">
              The test goes on without this window. Check again in a moment.
              <div className="sk-note-act"><button type="button" className="st-btn is-sm" onClick={again}>Check again</button></div>
            </Note>
          )}
        </div>
      )}

      {models.length === 0 ? (
        <p className="st-text ep-none">The server listed no models. Add one below by the id the server knows it by.</p>
      ) : (
        <div className="st-table-wrap ep-table-wrap">
          <table className="st-table is-stack ep-table">
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Use</th>
                <th scope="col">Model</th>
                <th scope="col">Context</th>
                <th scope="col">Max output</th>
                <th scope="col">Price per 1M <small>in / out</small></th>
                <th scope="col">Use for</th>
                <th scope="col"><span className="st-sr">Copy the model id</span></th>
              </tr>
            </thead>
            <tbody>
              {models.map(m => {
                const d = drafts[m.id] ?? draftOf(m);
                const tested = !!m.lastProbeOk;
                const ctxKnown = m.contextTokens != null || d.ctx.trim() !== '';
                const isTicked = ticked.includes(m.model);
                const turnOnBlock = !tested ? 'Test this model first: it can be turned on once it passes.' : !ctxKnown ? 'Enter its context size first.' : null;
                const capReached = !d.enabled && enabledCount >= enabledCap;
                const useDisabled = saving || (!d.enabled && (!!turnOnBlock || capReached));
                const lines = m.lastProbeAt || chatStep(m.model) ? testedLines(m, chatStep(m.model), pausedSince) : [];
                const vendor = m.bareNameConflict ? vendorName(m.bareNameConflict) : '';
                const id = m.modelId || epId(scope.ns, endpoint.slug, m.model);
                return (
                  <tr key={m.id} className={d.enabled ? 'is-on' : undefined}>
                    <td data-label="Test" className="ep-c-check">
                      <input type="checkbox" className="st-check" checked={isTicked} onChange={() => toggleTick(m.model)}
                        disabled={testRunning || (!isTicked && ticked.length >= MAX_TEST)}
                        aria-label={`Test ${m.model}`} title={!isTicked && ticked.length >= MAX_TEST ? `At most ${MAX_TEST} models per test` : undefined} />
                    </td>
                    <td data-label="Use" className="ep-c-check">
                      <input type="checkbox" className="st-check" checked={d.enabled} disabled={useDisabled}
                        onChange={ev => setDraft(m.id, { enabled: ev.target.checked })} aria-label={`Use ${m.model}`}
                        title={!d.enabled ? (turnOnBlock ?? (capReached ? `At most ${enabledCap} models can be on at once` : undefined)) : undefined} />
                    </td>
                    <td className="is-head ep-c-model">
                      <span className="ep-model">{m.model}</span>
                      {m.source === 'manual' && <Tag>added by hand</Tag>}
                      {m.listed === false && m.source !== 'manual' && <Tag tone="warn" title="The server's last model list did not include it">not listed now</Tag>}
                      {m.enabled && <span className="ep-idline"><code className="ep-id is-long">{id}</code></span>}
                      {!m.lastProbeAt && !chatStep(m.model) && <span className="ep-untested">Not tested yet</span>}
                      {lines.length > 0 && (
                        <ul className="ep-lines">
                          {lines.map((l, i) => <li key={i} className={l.tone ? `is-${l.tone}` : undefined}><b>{l.label}</b> — {l.text}</li>)}
                        </ul>
                      )}
                      {m.contextSource === 'ollama_assumed' && (
                        <p className="ep-mnote is-warn">
                          Ollama runs this model with a {fmtInt(m.contextTokens ?? 4096)}-token context and silently cuts longer prompts. Set
                          OLLAMA_CONTEXT_LENGTH (or num_ctx), then test again. The router uses {fmtInt(m.contextTokens ?? 4096)}.
                        </p>
                      )}
                      {tested && m.contextTokens == null && !d.ctx.trim() && (
                        <p className="ep-mnote is-warn">Context size unknown — enter it before you can turn this model on.</p>
                      )}
                      {/* R6 copy (plan R6 "Web", D43). Only a turned-on model's bare name resolves to it, so only then. */}
                      {/* §6.1's sentence for a name the router also sends to a cloud provider without a claim (R6
                          review S4: the name may have matched the provider's prefixes from the start, so no "now"). */}
                      {m.enabled && m.bareNameConflict && !m.bareNameClaim && (
                        <p className="ep-mnote">
                          {m.model} is also a name the router sends to {vendor}. Use <code className="ep-id is-long">{id}</code> in your requests; the bare name goes to {vendor}.
                        </p>
                      )}
                      {m.enabled && m.bareNameConflict && m.bareNameClaim && (
                        <div className="ep-mnote is-warn">
                          {articleFor(vendor, true)} {vendor} model named {m.model} now exists. Requests for the bare name {m.model} now fail with model_name_conflict, so
                          nothing goes to {vendor} by surprise. Use <code className="ep-id is-long">{id}</code>, or let the bare name go to {vendor}.
                          <div className="ep-mnote-act">
                            <button type="button" className="st-btn is-sm" onClick={() => releaseName(m)} disabled={letGo === m.id}>
                              {letGo === m.id ? 'Letting it go…' : `Let ${m.model} go to ${vendor}`}
                            </button>
                          </div>
                        </div>
                      )}
                      {m.enabled && m.bareNameClaim && !m.bareNameConflict && (
                        <p className="ep-mnote">
                          Requests for the bare name {m.model} go to this server. If a cloud model with the same name appears later, those
                          requests fail with model_name_conflict until you choose, so they never move to a cloud provider by surprise.
                        </p>
                      )}
                      {rowErrors[m.id] && <p className="st-error ep-rowerr" role="alert">{rowErrors[m.id]}</p>}
                    </td>
                    <td data-label="Context">
                      <input className="st-input ep-num" inputMode="numeric" value={d.ctx} disabled={saving}
                        placeholder={m.contextTokens != null && m.declaredContextTokens == null ? fmtInt(m.contextTokens) : 'tokens'}
                        onChange={ev => setDraft(m.id, { ctx: ev.target.value })} aria-label={`Context size of ${m.model}, tokens`} />
                    </td>
                    <td data-label="Max output">
                      <input className="st-input ep-num" inputMode="numeric" value={d.maxOut} disabled={saving} placeholder="tokens"
                        onChange={ev => setDraft(m.id, { maxOut: ev.target.value })} aria-label={`Max output of ${m.model}, tokens`} />
                    </td>
                    <td data-label="Price per 1M">
                      <span className="ep-prices">
                        <input className="st-input ep-num is-price" inputMode="decimal" value={d.pin} disabled={saving} placeholder="$ in"
                          onChange={ev => setDraft(m.id, { pin: ev.target.value })} aria-label={`Input price of ${m.model}, US dollars per 1M tokens`} />
                        <input className="st-input ep-num is-price" inputMode="decimal" value={d.pout} disabled={saving} placeholder="$ out"
                          onChange={ev => setDraft(m.id, { pout: ev.target.value })} aria-label={`Output price of ${m.model}, US dollars per 1M tokens`} />
                      </span>
                    </td>
                    <td data-label="Use for" className="ep-c-roles">
                      <span className="ep-roles" role="group" aria-label={`What ${m.model} is for`}>
                        {ROLE_CHOICES.map(r => {
                          const on = d.roles.includes(r.id);
                          return (
                            <label key={r.id} className={`st-chip ep-role${on ? ' is-on' : ''}`}>
                              <input type="checkbox" className="st-sr" checked={on} disabled={saving}
                                onChange={ev => setDraft(m.id, { roles: rolesOf(ev.target.checked ? [...d.roles, r.id] : d.roles.filter(x => x !== r.id)) })} />
                              {r.label}
                            </label>
                          );
                        })}
                      </span>
                    </td>
                    <td data-label="Model id" className="ep-c-id">
                      {m.enabled
                        ? <CopyButton text={id} label="Copy id" />
                        : <span className="st-faint">{d.enabled ? 'after saving' : '—'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="st-hint ep-under">
        Context is the model’s window in tokens, max output caps each answer, and a price left empty shows as “price not declared”
        and counts as $0 in budgets and reports. Leave it empty if you do not pay per token. Use for is your choice: when requests
        are routed to {scope.kind === 'personal' ? 'your endpoints' : 'these servers'}, auto-coding, auto-reasoning and auto-tooling try
        the healthy models you tagged for that first. It is not a benchmark score.
      </p>

      <form className="ep-manual" onSubmit={addManual}>
        <label className="st-field-label" htmlFor="ep-manual">Add a model the server does not list</label>
        <div className="ep-manual-row">
          <input id="ep-manual" className="st-input" value={manual} placeholder="Its id, exactly as the server names it" spellCheck={false} disabled={addingManual}
            onChange={ev => { setManual(ev.target.value); setManualError(null); }} aria-invalid={!!manualError} />
          <button type="submit" className="st-btn" disabled={!manual.trim() || addingManual}>{addingManual ? 'Adding…' : 'Add'}</button>
        </div>
        {manualError && <p className="st-error">{manualError}</p>}
      </form>

      {saveError && <div ref={saveErrRef}><Note tone="bad" title="Not saved">{saveError}</Note></div>}

      <Foot el={foot}>
        <span className="ep-foot-note">{plural(enabledCount, 'model')} on, of at most {enabledCap}{dirty.length ? ` · ${plural(dirty.length, 'unsaved change')}` : ''}</span>
        <button type="button" className="st-btn" onClick={onClose} disabled={saving}>{dirty.length ? 'Cancel' : 'Done'}</button>
        <button type="button" className="st-btn is-primary" onClick={save} disabled={saving || !dirty.length}>{saving ? 'Saving…' : 'Save models'}</button>
      </Foot>
    </div>
  );
}
