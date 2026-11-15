/**
 * The outbound guard: the one place that decides whether this server may open a connection to a
 * URL that a customer typed, and the one way such a connection is opened.
 *
 * WHO USES IT
 * -----------
 *   webhook delivery      lib/webhooks.ts (guardedRequest, discardBody)
 *   webhook save          routes/teams.ts (checkUrl + resolvePublic)
 *   SSO save              routes/teams.ts (issuer, discovery, token and key endpoints)
 *   SSO sign-in           web lib/sso.ts (discovery, JWKS, token)
 *   later releases        private endpoints: endpointPolicy, pinnedLookup, checkPinnedPeer,
 *                         isPortAllowed, localAddress
 *
 * THIS FILE EXISTS TWICE, BYTE FOR BYTE
 * -------------------------------------
 *   apps/api/src/lib/outbound-guard/core.ts and apps/web/lib/outbound-guard.ts. Both deploys run
 *   `cmp` on the pair. From R1 on, the frozen lib/webhooks.js requires this file, so it is frozen
 *   too: everything later releases need is already here, and a change is a reviewed exception.
 *   It imports only dns, net, http, https and os (no `node:` prefix, so Next's server bundle
 *   treats them as built-ins) and does nothing when it loads: no I/O, no timers, no listeners.
 *
 * WHAT IT REFUSES
 * ---------------
 *   URLs        anything but the policy's schemes, credentials, fragments, a query where the
 *               policy allows none, paths over 512 characters or with `..`, local and internal
 *               names, our own names, ports below 1024 (other than 80 and 443), a list of
 *               database and admin ports above it, and ASL_OUTBOUND_DENY_PORTS.
 *   addresses   every non-public IPv4 and IPv6 range, IPv6 forms that carry an IPv4 address
 *               (mapped, compatible, NAT64, 6to4, Teredo), this host's own addresses and the
 *               networks they sit on (eth0's /23 is shared with other tenants of the hosting
 *               network), the addresses of aistupidlevel.info, and ASL_OUTBOUND_DENY_CIDRS.
 *               No environment variable can relax any of it.
 *   DNS         a name is checked on every address it resolves to; one refused address refuses
 *               the name (a mixed answer is the rebinding signature). The checked address is
 *               then pinned: the socket connects to it and nowhere else, and the peer is
 *               re-checked when the socket connects.
 *   responses   redirects (never followed), compressed bodies (Accept-Encoding: identity is
 *               always sent), bodies over the caller's cap, headers over 32 KiB, and more bytes
 *               on the wire than the caps allow for (chunk framing and extensions, 1xx floods).
 *   until ready every address, until this host's own network interfaces have been read once.
 *
 * TESTS
 * -----
 * `guardDeps` takes an injected resolver and an allow-hook, so tests inside one process can reach
 * mocks on 127.0.0.1. Production never sets either; the release gate refuses any reference to
 * them outside __tests__ directories and the parity preloads.
 */
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as os from 'os';

/** Bumped with every reviewed change to this file; both copies must carry the same value. */
export const GUARD_VERSION = '1.0.0';

// ── Types ───────────────────────────────────────────────────────────────────────────────────────

export type GuardCode =
  | 'url_invalid' | 'url_too_long' | 'scheme_not_allowed' | 'url_credentials' | 'url_query_not_allowed'
  | 'url_fragment_not_allowed' | 'host_not_allowed' | 'own_host' | 'use_provider_key' | 'address_not_allowed'
  | 'port_not_allowed' | 'dns_failed' | 'dns_timeout' | 'too_many_addresses' | 'ipv6_unreachable'
  | 'redirect_refused' | 'pin_mismatch' | 'response_too_large' | 'headers_too_large' | 'compressed_response'
  | 'connect_timeout' | 'connect_refused' | 'tls_failed' | 'timeout'
  // The connection broke (reset, unreachable) before a response, or the server sent something
  // that is not a complete HTTP response (malformed chunking, early EOF, a reset mid-body).
  | 'connection_failed' | 'bad_response';

export interface GuardDetail {
  host?: string;
  address?: string;
  range?: string;
  port?: number;
  /** Only the host of a redirect's Location, never its path or query. */
  location?: string;
  status?: number;
}

export class OutboundBlockedError extends Error {
  code: GuardCode;
  /**
   * True when DNS, a redirect's Location or a pin mismatch revealed a refused address, as opposed
   * to a refusal of what the user typed. Only these count toward an endpoint lockout.
   */
  revealed: boolean;
  detail?: GuardDetail;

  constructor(code: GuardCode, message: string, revealed?: boolean, detail?: GuardDetail) {
    super(message);
    this.name = 'OutboundBlockedError';
    this.code = code;
    this.revealed = revealed === true;
    this.detail = detail;
  }
}

/**
 * Codes that mean the guard refused the destination or the answer by policy. The others mean the
 * destination could not be reached or answered badly; a caller that logs refusals logs these only.
 */
const REFUSAL_CODES = new Set<string>([
  'url_invalid', 'url_too_long', 'scheme_not_allowed', 'url_credentials', 'url_query_not_allowed',
  'url_fragment_not_allowed', 'host_not_allowed', 'own_host', 'use_provider_key', 'address_not_allowed',
  'port_not_allowed', 'too_many_addresses', 'redirect_refused', 'pin_mismatch', 'response_too_large',
  'headers_too_large', 'compressed_response',
]);

export function isRefusal(code: GuardCode): boolean {
  return REFUSAL_CODES.has(code);
}

export interface UrlPolicy {
  readonly schemes: ReadonlyArray<'https:' | 'http:'>;
  readonly allowQuery: boolean;
  readonly denyProviderHosts: boolean;
  readonly maxLength: 2048;
}

/** Webhook targets: https only, and they keep their query (many receivers put a token there). */
export const WEBHOOK_POLICY: UrlPolicy = Object.freeze({
  schemes: Object.freeze(['https:'] as const), allowQuery: true, denyProviderHosts: false, maxLength: 2048 as const,
});

/** An OIDC issuer (and so its discovery document): https, no query. */
export const SSO_ISSUER_POLICY: UrlPolicy = Object.freeze({
  schemes: Object.freeze(['https:'] as const), allowQuery: false, denyProviderHosts: false, maxLength: 2048 as const,
});

/** The token and JWKS endpoints a discovery document names: https, query allowed. */
export const SSO_ENDPOINT_POLICY: UrlPolicy = Object.freeze({
  schemes: Object.freeze(['https:'] as const), allowQuery: true, denyProviderHosts: false, maxLength: 2048 as const,
});

const ENDPOINT_POLICY_HTTPS: UrlPolicy = Object.freeze({
  schemes: Object.freeze(['https:'] as const), allowQuery: false, denyProviderHosts: true, maxLength: 2048 as const,
});
const ENDPOINT_POLICY_HTTP: UrlPolicy = Object.freeze({
  schemes: Object.freeze(['https:', 'http:'] as const), allowQuery: false, denyProviderHosts: true, maxLength: 2048 as const,
});

/**
 * A private endpoint's base URL. Plain http only when its owner ticked "I understand this is
 * unencrypted". The built-in providers' own API hosts are refused (`use_provider_key`).
 */
export function endpointPolicy(allowHttp: boolean): UrlPolicy {
  return allowHttp === true ? ENDPOINT_POLICY_HTTP : ENDPOINT_POLICY_HTTPS;
}

export type UrlCheck =
  | { ok: true; url: URL; host: string; port: number; ipLiteral: 0 | 4 | 6 }
  | { ok: false; code: GuardCode; message: string; detail?: GuardDetail };

export type AddressVerdict =
  | { allowed: true }
  | { allowed: false; range: string; label: string; embeddedV4?: string };

export interface ResolvedTarget {
  address: string;
  family: 4 | 6;
  addresses: string[];
  ttlMs: number;
}

export interface ResolverLike {
  resolve4(hostname: string, options: { ttl: true }): Promise<Array<{ address: string; ttl: number }>>;
  resolve6(hostname: string, options: { ttl: true }): Promise<Array<{ address: string; ttl: number }>>;
  cancel?(): void;
}

/**
 * Test seam. Tests set `resolver` (answers instead of DNS) and `extraAllow` (lets a refused
 * address through, for mocks on 127.0.0.1) inside their own process. Production never sets either.
 * Both are own properties of a sealed object, so neither can come from Object.prototype.
 */
export const guardDeps: { resolver: ResolverLike | null; extraAllow: ((ip: string) => boolean) | undefined } = Object.seal({
  resolver: null,
  extraAllow: undefined,
});

// ── Static tables ───────────────────────────────────────────────────────────────────────────────

const MAX_PATH_CHARS = 512;
const MAX_HOST_CHARS = 253;
const MAX_LABEL_CHARS = 63;
const MAX_HEADER_BYTES = 32 * 1024;
const MAX_DNS_RECORDS = 32;
const DNS_TIMEOUT_MS = 2500;
const DNS_TRIES = 2;
const DNS_OVERALL_MS = 3000;
const DNS_MIN_TTL_S = 30;
const DNS_MAX_TTL_S = 300;
const DNS_CACHE_MAX = 512;
/** A read that saw a network interface other than loopback stands for an hour. */
const INTERFACE_REFRESH_MS = 60 * 60 * 1000;
/** A failed refresh, or a read that saw only loopback, is tried again after a minute. */
const INTERFACE_RETRY_MS = 60 * 1000;
/** Until one read has succeeded every address is refused, and the read is tried again after a second. */
const INTERFACE_FIRST_READ_RETRY_MS = 1000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
/** setTimeout fires at once (TimeoutOverflowWarning) for anything longer. */
const MAX_TIMER_MS = 2147483647;
/**
 * What Node's fetch sent, so a call site moved from fetch keeps its User-Agent. A request with
 * none is blocked by common WAF rules (AWS WAF NoUserAgent_HEADER, Cloudflare Browser Integrity Check).
 */
const DEFAULT_USER_AGENT = 'node';

/** Our own names, and every name under them. */
const OWN_DOMAINS = Object.freeze(['aistupidlevel.info', 'asl.info']);
/** Names whose A and AAAA records are refused as addresses. */
const OWN_RECORD_NAMES = Object.freeze(['aistupidlevel.info', 'www.aistupidlevel.info']);

const BLOCKED_NAMES = new Set<string>([
  'localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback', 'metadata',
  'metadata.google.internal', 'instance-data', 'kubernetes.default',
]);

const BLOCKED_SUFFIXES = Object.freeze([
  '.localhost', '.local', '.localdomain', '.internal', '.intranet', '.lan', '.home', '.home.arpa',
  '.corp', '.arpa', '.svc', '.cluster.local', '.onion', '.test', '.invalid', '.example',
]);

/** The built-in providers' API hosts. An endpoint pointing at one should be a provider key. */
const PROVIDER_HOSTS = new Set<string>([
  'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'api.deepseek.com',
  'api.moonshot.ai', 'api.moonshot.cn', 'api.z.ai', 'open.bigmodel.cn', 'api.x.ai',
]);

/** Database, cache, queue, admin and chat ports above 1024. Every port below 1024 except 80 and 443 is refused too. */
const DENIED_PORTS = new Set<number>([
  1080, 1433, 1521, 1719, 1720, 1723, 2049, 2375, 2376, 2379, 2380, 3128, 3306, 3389, 3659, 4045,
  4190, 4369, 5060, 5061, 5432, 5433, 5672, 5900, 5984, 6000, 6379, 6443, 6566, 6665, 6666, 6667,
  6668, 6669, 6679, 6697, 9042, 9092, 9200, 9300, 10080, 10250, 10255, 11211, 15672, 27017, 27018,
  27019,
]);

/** Request headers a caller may not set: the guard owns the framing, the encoding and the Host. */
const STRIPPED_REQUEST_HEADERS = new Set<string>([
  'host', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'upgrade', 'te',
  'trailer', 'expect', 'proxy-connection', 'accept-encoding',
]);

/** [CIDR, what it is]. Checked before anything else; no IPv4 address in these is ever reachable. */
const V4_REFUSED = Object.freeze([
  ['0.0.0.0/8', '"this network"'],
  ['10.0.0.0/8', 'a private network'],
  ['100.64.0.0/10', 'carrier-grade NAT (also Tailscale and cloud metadata)'],
  ['127.0.0.0/8', 'loopback'],
  ['169.254.0.0/16', 'link-local (cloud metadata)'],
  ['172.16.0.0/12', 'a private network'],
  ['192.0.0.0/24', 'IETF protocol assignments'],
  ['192.0.2.0/24', 'documentation'],
  ['192.31.196.0/24', 'AS112'],
  ['192.52.193.0/24', 'AMT'],
  ['192.88.99.0/24', '6to4 relay anycast'],
  ['192.168.0.0/16', 'a private network'],
  ['192.175.48.0/24', 'AS112'],
  ['198.18.0.0/15', 'benchmarking'],
  ['198.51.100.0/24', 'documentation'],
  ['203.0.113.0/24', 'documentation'],
  ['224.0.0.0/4', 'multicast'],
  ['240.0.0.0/4', 'reserved'],
  ['168.63.129.16/32', 'the Azure host address'],
] as const);

/** IPv6 outside 2000::/3, named so the message can say what it is. `embed` says where an IPv4 sits. */
const V6_SPECIAL = Object.freeze([
  ['::/128', 'the unspecified address', ''],
  ['::1/128', 'loopback', ''],
  ['::ffff:0:0/96', 'IPv4-mapped', 'low32'],
  ['::ffff:0:0:0/96', 'IPv4-translated', 'low32'],
  ['::/96', 'IPv4-compatible', 'low32'],
  ['64:ff9b::/96', 'NAT64', 'low32'],
  ['64:ff9b:1::/48', 'local-use NAT64', ''],
  ['100::/64', 'discard-only', ''],
  ['5f00::/16', 'segment routing', ''],
  ['fc00::/7', 'unique local (private)', ''],
  ['fe80::/10', 'link-local', ''],
  ['fec0::/10', 'site-local', ''],
  ['ff00::/8', 'multicast', ''],
] as const);

/** Inside 2000::/3, still refused. */
const V6_GLOBAL_REFUSED = Object.freeze([
  ['2001::/32', 'Teredo', 'teredo'],
  ['2001::/23', 'IETF protocol assignments', ''],
  ['2001:db8::/32', 'documentation', ''],
  ['2002::/16', '6to4', 'sixtofour'],
  ['3fff::/20', 'documentation', ''],
] as const);

const OWN_NETWORK_LABEL = "an address on AI Stupid Level's own hosting network";
const OWN_ADDRESS_LABEL = "this server's own address";
const UNREAD_LABEL = 'an address this server cannot check yet: its own network interfaces could not be read';

// ── Small helpers (no state) ────────────────────────────────────────────────────────────────────

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

function errnoOf(err: unknown): string {
  if (err && typeof err === 'object') {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return '';
}

function logFailure(label: string, err: unknown): void {
  try { console.error(`[outbound-guard] ${label} failed: ${messageOf(err)}`); } catch { /* never throw from a log */ }
}

/**
 * A timer or background callback that can never throw: a synchronous throw and a rejected promise
 * are both logged. (The endpoint modules have their own `detached` in router/endpoints/safe.ts;
 * this file may import only the five built-ins.)
 */
function detached(label: string, fn: () => unknown): () => void {
  return function () {
    try {
      const out = fn();
      if (out && typeof (out as { then?: unknown }).then === 'function') {
        Promise.resolve(out).catch(function (err) { logFailure(label, err); });
      }
    } catch (err) {
      logFailure(label, err);
    }
  };
}

function noop(): void { /* an 'error' listener that only stops a late error from becoming uncaught */ }

// ── IP parsing and matching ─────────────────────────────────────────────────────────────────────

interface ParsedIp { family: 4 | 6; v4: number; g: number[]; text: string }

function v4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (let i = 0; i < 4; i++) {
    if (!/^[0-9]{1,3}$/.test(parts[i])) return null;
    const v = Number(parts[i]);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function intToV4(n: number): string {
  return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join('.');
}

function groupsToV4(hi: number, lo: number): string {
  return intToV4(hi * 65536 + lo);
}

/** Eight 16-bit groups, or null. Expects a string net.isIPv6 accepted (zone and brackets stripped). */
function v6Groups(text: string): number[] | null {
  const dbl = text.indexOf('::');
  if (dbl >= 0 && text.indexOf('::', dbl + 1) >= 0) return null;
  const headText = dbl >= 0 ? text.slice(0, dbl) : text;
  const tailText = dbl >= 0 ? text.slice(dbl + 2) : '';
  const head = headText ? headText.split(':') : [];
  const tail = tailText ? tailText.split(':') : [];
  const last = dbl >= 0 ? tail : head;
  if (last.length && last[last.length - 1].indexOf('.') >= 0) {
    const v4 = v4ToInt(last[last.length - 1]);
    if (v4 === null) return null;
    last.splice(last.length - 1, 1, Math.floor(v4 / 65536).toString(16), (v4 % 65536).toString(16));
  }
  const parse = function (list: string[]): number[] | null {
    const out: number[] = [];
    for (let i = 0; i < list.length; i++) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(list[i])) return null;
      out.push(parseInt(list[i], 16));
    }
    return out;
  };
  const h = parse(head);
  const t = parse(tail);
  if (!h || !t) return null;
  if (dbl < 0) return h.length === 8 ? h : null;
  const fill = 8 - h.length - t.length;
  if (fill < 1) return null;
  const zeros: number[] = [];
  for (let i = 0; i < fill; i++) zeros.push(0);
  return h.concat(zeros, t);
}

/** Parse an IP literal (brackets and an IPv6 zone are stripped). */
function parseIp(raw: string): ParsedIp | null {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  if (text.charAt(0) === '[' && text.charAt(text.length - 1) === ']') text = text.slice(1, -1);
  const pct = text.indexOf('%');
  if (pct >= 0) text = text.slice(0, pct);
  const fam = net.isIP(text);
  if (fam === 4) {
    const v4 = v4ToInt(text);
    return v4 === null ? null : { family: 4, v4: v4, g: [], text: text };
  }
  if (fam === 6) {
    const g = v6Groups(text);
    return g === null ? null : { family: 6, v4: 0, g: g, text: text.toLowerCase() };
  }
  return null;
}

function v4InPrefix(ip: number, netInt: number, prefix: number): boolean {
  if (prefix <= 0) return true;
  const size = Math.pow(2, 32 - prefix);
  return Math.floor(ip / size) === Math.floor(netInt / size);
}

function v6InPrefix(g: number[], netG: number[], prefix: number): boolean {
  let bits = prefix;
  for (let i = 0; i < 8 && bits > 0; i++) {
    if (bits >= 16) {
      if (g[i] !== netG[i]) return false;
      bits -= 16;
    } else {
      const size = Math.pow(2, 16 - bits);
      if (Math.floor(g[i] / size) !== Math.floor(netG[i] / size)) return false;
      bits = 0;
    }
  }
  return true;
}

interface CidrEntry { family: 4 | 6; v4: number; g: number[]; prefix: number; range: string; label: string; embed: string }

function parseCidr(cidr: string, label: string, embed: string): CidrEntry | null {
  const slash = cidr.indexOf('/');
  const addr = slash >= 0 ? cidr.slice(0, slash) : cidr;
  const p = parseIp(addr);
  if (!p) return null;
  const max = p.family === 4 ? 32 : 128;
  let prefix = max;
  if (slash >= 0) {
    const ps = cidr.slice(slash + 1);
    if (!/^[0-9]{1,3}$/.test(ps)) return null;
    prefix = Number(ps);
    if (prefix > max) return null;
  }
  return { family: p.family, v4: p.v4, g: p.g, prefix: prefix, range: networkText(p, prefix), label: label, embed: embed };
}

function networkText(p: ParsedIp, prefix: number): string {
  if (p.family === 4) {
    const size = Math.pow(2, 32 - prefix);
    return `${intToV4(Math.floor(p.v4 / size) * size)}/${prefix}`;
  }
  const out: string[] = [];
  let bits = prefix;
  for (let i = 0; i < 8; i++) {
    let v = p.g[i];
    if (bits >= 16) bits -= 16;
    else if (bits > 0) { const size = Math.pow(2, 16 - bits); v = Math.floor(v / size) * size; bits = 0; }
    else v = 0;
    out.push(v.toString(16));
  }
  return `${compressV6(out)}/${prefix}`;
}

function compressV6(groups: string[]): string {
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8;) {
    if (groups[i] !== '0') { i++; continue; }
    let j = i;
    while (j < 8 && groups[j] === '0') j++;
    if (j - i > bestLen && j - i > 1) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  if (bestStart < 0) return groups.join(':');
  return `${groups.slice(0, bestStart).join(':')}::${groups.slice(bestStart + bestLen).join(':')}`;
}

function inEntry(p: ParsedIp, e: CidrEntry): boolean {
  if (p.family !== e.family) return false;
  return p.family === 4 ? v4InPrefix(p.v4, e.v4, e.prefix) : v6InPrefix(p.g, e.g, e.prefix);
}

/** Two addresses are the same host address (an IPv4-mapped IPv6 form equals its IPv4). */
function sameAddress(a: string, b: string): boolean {
  const pa = parseIp(a);
  const pb = parseIp(b);
  if (!pa || !pb) return false;
  const v4of = function (p: ParsedIp): number | null {
    if (p.family === 4) return p.v4;
    const g = p.g;
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) return g[6] * 65536 + g[7];
    return null;
  };
  const a4 = v4of(pa);
  const b4 = v4of(pb);
  if (a4 !== null || b4 !== null) return a4 === b4;
  for (let i = 0; i < 8; i++) if (pa.g[i] !== pb.g[i]) return false;
  return true;
}

// ── Lazily built tables and host state (module state, created on first use) ───────────────────

let staticTables: { v4: CidrEntry[]; v6Special: CidrEntry[]; v6Global: CidrEntry[]; global: CidrEntry } | null = null;

function tables(): { v4: CidrEntry[]; v6Special: CidrEntry[]; v6Global: CidrEntry[]; global: CidrEntry } {
  if (staticTables) return staticTables;
  const build = function (rows: ReadonlyArray<ReadonlyArray<string>>): CidrEntry[] {
    const out: CidrEntry[] = [];
    for (let i = 0; i < rows.length; i++) {
      const e = parseCidr(rows[i][0], rows[i][1], rows[i][2] || '');
      if (e) out.push(e);
    }
    return out;
  };
  const global = parseCidr('2000::/3', 'outside the global unicast range', '');
  staticTables = {
    v4: build(V4_REFUSED),
    v6Special: build(V6_SPECIAL),
    v6Global: build(V6_GLOBAL_REFUSED),
    global: global as CidrEntry,
  };
  return staticTables;
}

interface HostState {
  at: number;
  /** Every address and network seen on an interface since this process started. */
  entries: CidrEntry[];
  globalV6: boolean;
  /** At least one read of the interfaces has succeeded. Until then every address is refused. */
  read: boolean;
  /** The latest read succeeded and saw an interface other than loopback. */
  complete: boolean;
}
let hostState: HostState | null = null;
/**
 * The set only grows. libuv leaves out an interface that is down at the moment of a read (eth0
 * losing its link for a second, say), so a read that lacks one must not take its /23 off the list.
 */
const seenHostEntries = new Map<string, CidrEntry>();

function rememberHostEntry(e: CidrEntry | null): void {
  if (e) seenHostEntries.set(`${e.range}|${e.label}`, e);
}

/**
 * This host's interface addresses and the networks they sit on: refreshed hourly, again after a
 * minute when a read fails or sees only loopback, and never shrinking. A failed read is never
 * cached as an answer, and until one read succeeds every address is refused.
 */
function hostNetworks(): HostState {
  const now = Date.now();
  if (hostState && now >= hostState.at) {
    const ttl = !hostState.read ? INTERFACE_FIRST_READ_RETRY_MS : hostState.complete ? INTERFACE_REFRESH_MS : INTERFACE_RETRY_MS;
    if (now - hostState.at < ttl) return hostState;
  }
  let read = false;
  let external = false;
  let globalV6 = false;
  try {
    const ifaces = os.networkInterfaces();
    const names = Object.keys(ifaces);
    for (let i = 0; i < names.length; i++) {
      const list = ifaces[names[i]] || [];
      for (let j = 0; j < list.length; j++) {
        const info = list[j];
        const p = parseIp(String(info.address));
        if (!p) continue;
        rememberHostEntry(parseCidr(p.text, OWN_ADDRESS_LABEL, ''));
        const cidr = typeof info.cidr === 'string' ? info.cidr : '';
        const slash = cidr.indexOf('/');
        if (slash > 0) {
          const sub = parseCidr(`${p.text}/${cidr.slice(slash + 1)}`, OWN_NETWORK_LABEL, '');
          if (sub && sub.prefix > 0) rememberHostEntry(sub);
        }
        if (!info.internal) external = true;
        if (p.family === 6 && !info.internal && staticRefusal(p) === null) globalV6 = true;
      }
    }
    read = true;
  } catch (err) {
    logFailure('reading network interfaces', err);
  }
  const egress = process.env.ASL_ENDPOINT_EGRESS_IP;
  if (egress) {
    const e = parseCidr(egress.trim(), OWN_ADDRESS_LABEL, '');
    if (e && (e.prefix === 32 || e.prefix === 128)) rememberHostEntry(e);
  }
  hostState = {
    at: now,
    entries: Array.from(seenHostEntries.values()),
    globalV6: read ? globalV6 : (hostState !== null && hostState.globalV6),
    read: read || (hostState !== null && hostState.read),
    complete: read && external,
  };
  return hostState;
}

let configuredDenials: { raw: string; entries: CidrEntry[] } | null = null;

/** ASL_OUTBOUND_DENY_CIDRS: comma- or space-separated addresses and CIDRs. It can only add denials. */
function configuredDenied(): CidrEntry[] {
  const raw = process.env.ASL_OUTBOUND_DENY_CIDRS || '';
  if (configuredDenials && configuredDenials.raw === raw) return configuredDenials.entries;
  const entries: CidrEntry[] = [];
  const bad: string[] = [];
  const parts = raw.split(/[\s,]+/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const e = parseCidr(parts[i], 'refused by ASL_OUTBOUND_DENY_CIDRS', '');
    if (e) entries.push(e); else bad.push(parts[i]);
  }
  if (bad.length) logFailure('ASL_OUTBOUND_DENY_CIDRS', new Error(`ignored entries that are not addresses or CIDRs: ${bad.join(', ')}`));
  configuredDenials = { raw: raw, entries: entries };
  return entries;
}

let configuredPortDenials: { raw: string; ports: Set<number> } | null = null;

/**
 * ASL_OUTBOUND_DENY_PORTS: comma- or space-separated ports from 1024 to 65535, refused like the
 * built-in list. It can only add denials (443, and 80 for http, cannot be taken away).
 */
function configuredDeniedPorts(): Set<number> {
  const raw = process.env.ASL_OUTBOUND_DENY_PORTS || '';
  if (configuredPortDenials && configuredPortDenials.raw === raw) return configuredPortDenials.ports;
  const ports = new Set<number>();
  const bad: string[] = [];
  const parts = raw.split(/[\s,]+/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const n = /^[0-9]{1,5}$/.test(parts[i]) ? Number(parts[i]) : NaN;
    if (n >= 1024 && n <= 65535) ports.add(n); else bad.push(parts[i]);
  }
  if (bad.length) logFailure('ASL_OUTBOUND_DENY_PORTS', new Error(`ignored entries that are not ports from 1024 to 65535: ${bad.join(', ')}`));
  configuredPortDenials = { raw: raw, ports: ports };
  return ports;
}

/** The last known A and AAAA records of our own names (refreshed by resolvePublic). */
let ownRecordAddresses: string[] = [];

function embeddedV4(p: ParsedIp, how: string): string {
  if (how === 'low32') return groupsToV4(p.g[6], p.g[7]);
  if (how === 'sixtofour') return groupsToV4(p.g[1], p.g[2]);
  if (how === 'teredo') return groupsToV4(p.g[6] ^ 0xffff, p.g[7] ^ 0xffff);
  return '';
}

function verdictFor(p: ParsedIp, e: CidrEntry): AddressVerdict {
  const v4 = e.embed ? embeddedV4(p, e.embed) : '';
  if (v4) return { allowed: false, range: e.range, label: `${e.label} ${v4}`, embeddedV4: v4 };
  return { allowed: false, range: e.range, label: e.label };
}

/** The static rules: reserved IPv4 and everything in IPv6 but public unicast. */
function staticRefusal(p: ParsedIp): AddressVerdict | null {
  const t = tables();
  if (p.family === 4) {
    for (let i = 0; i < t.v4.length; i++) if (inEntry(p, t.v4[i])) return verdictFor(p, t.v4[i]);
    return null;
  }
  for (let i = 0; i < t.v6Special.length; i++) if (inEntry(p, t.v6Special[i])) return verdictFor(p, t.v6Special[i]);
  if (!inEntry(p, t.global)) return { allowed: false, range: t.global.range, label: t.global.label };
  for (let i = 0; i < t.v6Global.length; i++) if (inEntry(p, t.v6Global[i])) return verdictFor(p, t.v6Global[i]);
  return null;
}

function refusalOf(p: ParsedIp): AddressVerdict | null {
  const s = staticRefusal(p);
  if (s) return s;
  const host = hostNetworks();
  if (!host.read) return { allowed: false, range: 'unchecked', label: UNREAD_LABEL };
  const own = host.entries;
  // Exact interface addresses first, so the message says "own address" rather than "network".
  for (let i = 0; i < own.length; i++) if (own[i].label === OWN_ADDRESS_LABEL && inEntry(p, own[i])) return verdictFor(p, own[i]);
  for (let i = 0; i < own.length; i++) if (inEntry(p, own[i])) return verdictFor(p, own[i]);
  const denied = configuredDenied();
  for (let i = 0; i < denied.length; i++) if (inEntry(p, denied[i])) return verdictFor(p, denied[i]);
  for (let i = 0; i < ownRecordAddresses.length; i++) {
    if (sameAddress(p.text, ownRecordAddresses[i])) {
      return { allowed: false, range: ownRecordAddresses[i], label: 'an address of aistupidlevel.info' };
    }
  }
  return null;
}

function allowedByHook(text: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(guardDeps, 'extraAllow')) return false;
  const hook = guardDeps.extraAllow;
  if (typeof hook !== 'function') return false;
  try { return hook(text) === true; } catch { return false; }
}

/**
 * May a connection go to this address? Every resolved address and every IP literal goes through
 * this. Refuses the reserved ranges, IPv6 forms carrying an IPv4 address, this host's addresses and
 * networks, ASL_OUTBOUND_DENY_CIDRS and the last known addresses of aistupidlevel.info.
 */
export function classifyAddress(ip: string): AddressVerdict {
  const p = parseIp(ip);
  if (!p) return { allowed: false, range: 'none', label: 'not an IP address' };
  const refusal = refusalOf(p);
  if (refusal === null) return { allowed: true };
  if (allowedByHook(p.text)) return { allowed: true };
  return refusal;
}

/** Ports: 443; 80 with http only; 1024–65535 except the database and admin list and ASL_OUTBOUND_DENY_PORTS. */
export function isPortAllowed(port: number, protocol: string): boolean {
  if (typeof port !== 'number' || port !== Math.floor(port) || port < 0 || port > 65535) return false;
  if (port === 443) return true;
  if (port === 80) return protocol === 'http:';
  return port >= 1024 && !DENIED_PORTS.has(port) && !configuredDeniedPorts().has(port);
}

// ── URL rules (no network) ──────────────────────────────────────────────────────────────────────

function normalizeName(host: string): string {
  let h = host.toLowerCase();
  if (h.charAt(0) === '[' && h.charAt(h.length - 1) === ']') return h.slice(1, -1);
  if (h.length > 1 && h.charAt(h.length - 1) === '.') h = h.slice(0, -1);
  return h;
}

function ownHostname(): string {
  try { return normalizeName(os.hostname()); } catch { return ''; }
}

/** The name rules shared by checkUrl and the redirect check. `null` means the name may be resolved. */
function nameRefusal(host: string, denyProviderHosts: boolean): { code: GuardCode; message: string } | null {
  if (!host || host.length > MAX_HOST_CHARS) return { code: 'url_invalid', message: 'The host name is not valid.' };
  const labels = host.split('.');
  for (let i = 0; i < labels.length; i++) {
    if (labels[i].length === 0 || labels[i].length > MAX_LABEL_CHARS) return { code: 'url_invalid', message: 'The host name is not valid.' };
  }
  for (let i = 0; i < OWN_DOMAINS.length; i++) {
    const d = OWN_DOMAINS[i];
    if (host === d || host.slice(-(d.length + 1)) === `.${d}`) return { code: 'own_host', message: `${host} is AI Stupid Level itself.` };
  }
  const self = ownHostname();
  if (self && host === self) return { code: 'own_host', message: `${host} is this server's own name.` };
  if (BLOCKED_NAMES.has(host)) return { code: 'host_not_allowed', message: `${host} is a local name and is not reachable from our servers.` };
  for (let i = 0; i < BLOCKED_SUFFIXES.length; i++) {
    const s = BLOCKED_SUFFIXES[i];
    if (host.length > s.length && host.slice(-s.length) === s) {
      return { code: 'host_not_allowed', message: `Names ending in ${s} are local or internal and are not reachable from our servers.` };
    }
  }
  if (labels.length < 2) return { code: 'host_not_allowed', message: `${host} is a single-label name and is not reachable from our servers.` };
  if (denyProviderHosts && PROVIDER_HOSTS.has(host)) {
    return { code: 'use_provider_key', message: `${host} is a built-in provider. Add your key for it under Providers instead.` };
  }
  return null;
}

function rawPathHasDotSegment(raw: string): boolean {
  const m = /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:[\/\\]{2}[^\/\\?#]*)?/.exec(raw);
  let rest = m ? raw.slice(m[0].length) : raw;
  const end = rest.search(/[?#]/);
  if (end >= 0) rest = rest.slice(0, end);
  return /\.\.|\.%2e|%2e\.|%2e%2e/i.test(rest);
}

function addressMessage(host: string, address: string, v: { range: string; label: string }): string {
  const what = `${v.label} (${v.range})`;
  return host && host !== address
    ? `${host} resolves to ${address}, ${what}. Only public addresses are allowed.`
    : `${address} is ${what}. Only public addresses are allowed.`;
}

/**
 * The static checks, before any DNS: scheme, credentials, fragment, query, path, host name and
 * port, and the address rules for an IP literal. Never touches the network.
 */
export function checkUrl(raw: string, policy: UrlPolicy): UrlCheck {
  if (typeof raw !== 'string' || !policy) return { ok: false, code: 'url_invalid', message: 'That is not a valid URL.' };
  if (raw.length > policy.maxLength) {
    return { ok: false, code: 'url_too_long', message: `The URL is longer than ${policy.maxLength} characters.` };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    const pm = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\/?#\\]*:([0-9]+)(?:[\/?#\\]|$)/.exec(raw);
    if (pm && Number(pm[1]) > 65535) {
      return { ok: false, code: 'port_not_allowed', message: `Port ${pm[1]} does not exist.`, detail: { port: Number(pm[1]) } };
    }
    return { ok: false, code: 'url_invalid', message: 'That is not a valid URL.' };
  }
  const scheme = url.protocol;
  const host = normalizeName(url.hostname);
  const at = { host: host };
  if (policy.schemes.indexOf(scheme as 'https:' | 'http:') < 0) {
    const allowed = policy.schemes.map(function (s) { return `${s}//`; }).join(' and ');
    return { ok: false, code: 'scheme_not_allowed', message: `Only ${allowed} URLs are allowed here.`, detail: at };
  }
  if (url.username || url.password) {
    return { ok: false, code: 'url_credentials', message: 'The URL may not contain a user name or password.', detail: at };
  }
  if (raw.indexOf('#') >= 0) {
    return { ok: false, code: 'url_fragment_not_allowed', message: 'The URL may not contain a #fragment.', detail: at };
  }
  if (!policy.allowQuery && (url.search !== '' || raw.indexOf('?') >= 0)) {
    return { ok: false, code: 'url_query_not_allowed', message: 'The URL may not contain a ?query.', detail: at };
  }
  if (url.pathname.length > MAX_PATH_CHARS) {
    return { ok: false, code: 'url_invalid', message: `The URL path is longer than ${MAX_PATH_CHARS} characters.`, detail: at };
  }
  if (rawPathHasDotSegment(raw) || url.pathname.indexOf('..') >= 0) {
    return { ok: false, code: 'url_invalid', message: "The URL path may not contain '..'.", detail: at };
  }

  const literal = net.isIP(host);
  const port = url.port ? Number(url.port) : (scheme === 'https:' ? 443 : 80);
  if (literal === 0) {
    const refusal = nameRefusal(host, policy.denyProviderHosts);
    if (refusal) return { ok: false, code: refusal.code, message: refusal.message, detail: { host: host } };
  }
  if (!isPortAllowed(port, scheme)) {
    return {
      ok: false, code: 'port_not_allowed', detail: { host: host, port: port },
      message: `Port ${port} is not allowed. Use 443, 80 for http, or a port from 1024 to 65535 that is not a database or admin port.`,
    };
  }
  if (literal !== 0) {
    const v = classifyAddress(host);
    if (!v.allowed) {
      return {
        ok: false, code: 'address_not_allowed', message: addressMessage('', host, v),
        detail: { host: host, address: host, range: v.range },
      };
    }
  }
  return { ok: true, url: url, host: host, port: port, ipLiteral: literal === 4 ? 4 : literal === 6 ? 6 : 0 };
}

// ── DNS ─────────────────────────────────────────────────────────────────────────────────────────

interface RawRecords {
  a4: Array<{ address: string; ttl: number }>;
  a6: Array<{ address: string; ttl: number }>;
  timedOut4: boolean;
  timedOut6: boolean;
}

const dnsCache = new Map<string, { at: number; expires: number; records: RawRecords }>();
const dnsInflight = new Map<string, Promise<RawRecords>>();
let dnsCacheOwner: ResolverLike | null = null;

function activeResolver(): ResolverLike {
  if (guardDeps.resolver) return guardDeps.resolver;
  // One per lookup, so cancelling a timed-out lookup cannot cancel anyone else's.
  return new dns.promises.Resolver({ timeout: DNS_TIMEOUT_MS, tries: DNS_TRIES }) as unknown as ResolverLike;
}

function syncCacheOwner(): void {
  if (guardDeps.resolver !== dnsCacheOwner) {
    dnsCache.clear();
    dnsInflight.clear();
    dnsCacheOwner = guardDeps.resolver;
  }
}

function recordList(value: unknown): Array<{ address: string; ttl: number }> {
  const out: Array<{ address: string; ttl: number }> = [];
  if (!Array.isArray(value)) return out;
  for (let i = 0; i < value.length; i++) {
    const r = value[i] as { address?: unknown; ttl?: unknown } | string;
    if (typeof r === 'string') out.push({ address: r, ttl: DNS_MIN_TTL_S });
    else if (r && typeof r.address === 'string') out.push({ address: r.address, ttl: typeof r.ttl === 'number' ? r.ttl : DNS_MIN_TTL_S });
    else out.push({ address: '', ttl: 0 });
  }
  return out;
}

/**
 * A and AAAA in parallel through c-ares (never the libuv thread pool), 3 s overall. When the A
 * answer is in and only AAAA is still missing at 3 s, and this host has no public IPv6 (so AAAA
 * could not be used anyway), the A answer stands: some name servers never answer AAAA queries.
 */
function queryDns(host: string): Promise<RawRecords> {
  return new Promise<RawRecords>(function (resolve, reject) {
    let settled = false;
    let pending = 2;
    let answered4 = false;
    let resolver: ResolverLike;
    const out: RawRecords = { a4: [], a6: [], timedOut4: false, timedOut6: false };
    try {
      resolver = activeResolver();
    } catch (err) {
      reject(new OutboundBlockedError('dns_failed', `${host} could not be looked up.`, false, { host: host }));
      return;
    }
    const timer: any = setTimeout(detached('dns timeout', function () {
      if (settled) return;
      settled = true;
      if (resolver !== guardDeps.resolver && typeof resolver.cancel === 'function') {
        try { resolver.cancel(); } catch { /* the lookup is abandoned either way */ }
      }
      if (answered4 && out.a4.length > 0 && !hasGlobalIPv6()) {
        out.timedOut6 = true;
        resolve(out);
        return;
      }
      reject(new OutboundBlockedError('dns_timeout', `Looking up ${host} took longer than ${DNS_OVERALL_MS / 1000} s.`, false, { host: host }));
    }), DNS_OVERALL_MS);
    const done = function () {
      pending--;
      if (settled || pending > 0) return;
      settled = true;
      clearTimeout(timer);
      resolve(out);
    };
    const run = function (family: 4 | 6) {
      let p: Promise<unknown>;
      try {
        p = family === 4 ? resolver.resolve4(host, { ttl: true }) : resolver.resolve6(host, { ttl: true });
      } catch (err) {
        done();
        return;
      }
      Promise.resolve(p).then(function (value) {
        // A late answer never changes a result that was already handed out (and maybe cached).
        if (settled) return;
        if (family === 4) { out.a4 = recordList(value); answered4 = true; } else out.a6 = recordList(value);
        done();
      }, function (err) {
        if (settled) return;
        // NXDOMAIN and NODATA leave the list empty; a timeout is remembered for the message.
        if (errnoOf(err) === 'ETIMEOUT') { if (family === 4) out.timedOut4 = true; else out.timedOut6 = true; }
        done();
      }).catch(function (err) { logFailure('dns answer', err); });
    };
    run(4);
    run(6);
  });
}

function minTtlMs(r: RawRecords): number {
  let min = DNS_MAX_TTL_S;
  const all = r.a4.concat(r.a6);
  for (let i = 0; i < all.length; i++) {
    const t = all[i].ttl;
    if (typeof t === 'number' && isFinite(t) && t < min) min = t;
  }
  if (min < DNS_MIN_TTL_S) min = DNS_MIN_TTL_S;
  return min * 1000;
}

/**
 * Cached for the answer's TTL (clamped to 30–300 s); concurrent lookups of one name share one
 * query. An answer with more records than resolvePublic accepts is never cached.
 */
function lookupRecords(host: string): Promise<RawRecords> {
  syncCacheOwner();
  const now = Date.now();
  const hit = dnsCache.get(host);
  if (hit && hit.expires > now && hit.at <= now) return Promise.resolve(hit.records);
  const running = dnsInflight.get(host);
  if (running) return running;
  const owner = dnsCacheOwner;
  const p = queryDns(host).then(function (records) {
    const count = records.a4.length + records.a6.length;
    if (owner === dnsCacheOwner && count > 0 && count <= MAX_DNS_RECORDS) {
      if (dnsCache.size >= DNS_CACHE_MAX) {
        const oldest = dnsCache.keys().next();
        if (!oldest.done) dnsCache.delete(oldest.value);
      }
      const at = Date.now();
      dnsCache.set(host, { at: at, expires: at + minTtlMs(records), records: records });
    }
    return records;
  });
  dnsInflight.set(host, p);
  const clear = function () { if (dnsInflight.get(host) === p) dnsInflight.delete(host); };
  p.then(clear, clear).catch(function (err) { logFailure('dns cache', err); });
  return p;
}

/** Refresh the addresses of our own names. Never rejects; a failed lookup keeps the last answer. */
function refreshOwnRecords(): Promise<void> {
  const lookups: Array<Promise<RawRecords | null>> = [];
  for (let i = 0; i < OWN_RECORD_NAMES.length; i++) {
    lookups.push(lookupRecords(OWN_RECORD_NAMES[i]).then(function (r) { return r; }, function () { return null; }));
  }
  return Promise.all(lookups).then(function (results) {
    const found: string[] = [];
    let any = false;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      any = true;
      const all = r.a4.concat(r.a6);
      for (let j = 0; j < all.length; j++) if (parseIp(all[j].address)) found.push(all[j].address);
    }
    if (any && found.length) ownRecordAddresses = found;
  }, function (err) { logFailure('own records', err); });
}

function hasGlobalIPv6(): boolean {
  return hostNetworks().globalV6;
}

/**
 * Resolve a host name (or accept an IP literal) and check every address it resolves to. Returns
 * the address to pin: the first A record, or the first AAAA when this host has public IPv6.
 * Throws OutboundBlockedError; a refusal that DNS revealed carries `revealed: true`.
 */
export async function resolvePublic(rawHost: string): Promise<ResolvedTarget> {
  const host = normalizeName(String(rawHost == null ? '' : rawHost));
  const own = refreshOwnRecords();
  const literal = net.isIP(host);
  if (literal !== 0) {
    await own;
    const v = classifyAddress(host);
    if (!v.allowed) {
      throw new OutboundBlockedError('address_not_allowed', addressMessage('', host, v), false, { host: host, address: host, range: v.range });
    }
    if (literal === 6 && !hasGlobalIPv6()) {
      throw new OutboundBlockedError('ipv6_unreachable', `${host} is an IPv6 address, and our servers reach IPv4 only.`, false, { host: host });
    }
    return { address: host, family: literal === 6 ? 6 : 4, addresses: [host], ttlMs: DNS_MAX_TTL_S * 1000 };
  }
  if (!host || host.length > MAX_HOST_CHARS) {
    throw new OutboundBlockedError('dns_failed', 'The host name is not valid.', false, { host: host });
  }
  const records = await lookupRecords(host);
  await own;
  // The count first: a TCP answer can carry thousands of records, and checking each would block.
  if (records.a4.length + records.a6.length > MAX_DNS_RECORDS) {
    throw new OutboundBlockedError('too_many_addresses', `${host} resolves to more than ${MAX_DNS_RECORDS} addresses.`, false, { host: host });
  }
  const all = records.a4.concat(records.a6);
  for (let i = 0; i < all.length; i++) {
    if (!parseIp(all[i].address)) {
      throw new OutboundBlockedError('dns_failed', `${host} returned an answer that is not an address.`, false, { host: host });
    }
  }
  for (let i = 0; i < all.length; i++) {
    const v = classifyAddress(all[i].address);
    if (!v.allowed) {
      throw new OutboundBlockedError('address_not_allowed', addressMessage(host, all[i].address, v), true,
        { host: host, address: all[i].address, range: v.range });
    }
  }
  if (all.length === 0) {
    if (records.timedOut4 || records.timedOut6) {
      throw new OutboundBlockedError('dns_timeout', `Looking up ${host} timed out.`, false, { host: host });
    }
    throw new OutboundBlockedError('dns_failed', `${host} does not resolve.`, false, { host: host });
  }
  const ttlMs = minTtlMs(records);
  const addresses = all.map(function (r) { return r.address; });
  if (records.a4.length) return { address: records.a4[0].address, family: 4, addresses: addresses, ttlMs: ttlMs };
  if (hasGlobalIPv6()) return { address: records.a6[0].address, family: 6, addresses: addresses, ttlMs: ttlMs };
  if (records.timedOut4) {
    throw new OutboundBlockedError('dns_timeout', `Looking up the IPv4 address of ${host} timed out.`, false, { host: host });
  }
  throw new OutboundBlockedError('ipv6_unreachable', `${host} has only IPv6 addresses, and our servers reach IPv4 only.`, false, { host: host });
}

// ── Pinning ─────────────────────────────────────────────────────────────────────────────────────

/**
 * A `lookup` for net/tls/http that always answers the address that was checked, whatever name it is
 * asked about. Answers the 2- and 3-argument forms and `{ all: true }`, asynchronously like dns.lookup.
 */
export function pinnedLookup(address: string, family: 4 | 6): net.LookupFunction {
  const lookup = function (hostname: string, options: unknown, callback?: unknown): void {
    let cb = callback;
    let opts = options;
    if (typeof opts === 'function') { cb = opts; opts = undefined; }
    if (typeof cb !== 'function') return;
    const all = !!(opts && typeof opts === 'object' && (opts as { all?: unknown }).all);
    const reply = cb as (err: Error | null, address: unknown, family?: number) => void;
    process.nextTick(detached('pinned lookup', function () {
      if (all) reply(null, [{ address: address, family: family }]);
      else reply(null, address, family);
    }));
  };
  return lookup as unknown as net.LookupFunction;
}

/**
 * Call when a socket connects: it must have reached the pinned address. On a mismatch the socket
 * is destroyed (without an error event) and the returned error is `pin_mismatch`, revealed. Never throws.
 */
export function checkPinnedPeer(socket: net.Socket, expected: string): OutboundBlockedError | null {
  let remote = '';
  try { remote = socket.remoteAddress || ''; } catch { remote = ''; }
  if (remote && sameAddress(remote, expected)) return null;
  try { socket.destroy(); } catch { /* already gone */ }
  return new OutboundBlockedError('pin_mismatch', 'The connection reached a different address than the one that was checked.', true,
    { address: remote || undefined });
}

// ── Requests ────────────────────────────────────────────────────────────────────────────────────

export interface GuardedRequestOptions {
  method: string;
  headers?: { [name: string]: string };
  body?: string | Uint8Array;
  policy: UrlPolicy;
  /** Everything, DNS included. */
  timeoutMs: number;
  connectTimeoutMs?: number;
  maxBytes: number;
  signal?: AbortSignal;
  /** Source address (an IP literal on this host). Unset, the system chooses, as today. */
  localAddress?: string;
  /**
   * Settle with the status and headers as soon as they arrive and close the connection without
   * reading or decoding the body (webhook delivery). Nothing that needs a body may use it.
   */
  discardBody?: boolean;
}

export interface GuardedResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  /** The address the connection was pinned to. */
  address: string;
}

const TLS_ERROR_CODES = new Set<string>([
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID',
  'CERT_SIGNATURE_FAILURE', 'CERT_REVOKED', 'CERT_UNTRUSTED', 'CERT_REJECTED', 'HOSTNAME_MISMATCH',
  'INVALID_CA', 'PATH_LENGTH_EXCEEDED', 'INVALID_PURPOSE', 'EPROTO',
]);

function isTlsError(err: unknown): boolean {
  const code = errnoOf(err);
  if (TLS_ERROR_CODES.has(code)) return true;
  if (code.indexOf('ERR_SSL_') === 0 || code.indexOf('ERR_TLS_') === 0 || code.indexOf('SSL_') === 0) return true;
  const lib = err && typeof err === 'object' ? (err as { library?: unknown }).library : undefined;
  return typeof lib === 'string' && lib.indexOf('SSL') >= 0;
}

function abortReasonOf(signal: AbortSignal | undefined): unknown {
  const reason = signal ? (signal as { reason?: unknown }).reason : undefined;
  if (reason !== undefined) return reason;
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

function locationHostRefused(location: URL): boolean {
  const h = normalizeName(location.hostname);
  if (!h) return false;
  if (net.isIP(h) !== 0) return !classifyAddress(h).allowed;
  return nameRefusal(h, false) !== null;
}

/**
 * One request over node:http/https to a checked, resolved and pinned address: no agent, no
 * redirects, `Accept-Encoding: identity`, response headers capped at 32 KiB, the body at
 * `maxBytes` (and at 64 + maxBytes/64 pieces), and everything read from the socket at
 * maxBytes + 32 KiB + max(64 KiB, maxBytes). `User-Agent: node` unless the caller sets one.
 * Every path settles the promise exactly once; every emitter has an 'error' listener before it
 * can emit; timeouts and caps destroy the request and settle, and never throw.
 */
export function guardedRequest(rawUrl: string, opts: GuardedRequestOptions): Promise<GuardedResponse> {
  return new Promise<GuardedResponse>(function (resolve, reject) {
    if (!opts || typeof opts !== 'object' || !opts.policy) {
      reject(new TypeError('guardedRequest needs options with a policy'));
      return;
    }
    const timeoutMs = opts.timeoutMs;
    const maxBytes = opts.maxBytes;
    const connectTimeoutMs = opts.connectTimeoutMs === undefined ? DEFAULT_CONNECT_TIMEOUT_MS : opts.connectTimeoutMs;
    if (typeof timeoutMs !== 'number' || !(timeoutMs > 0) || !(timeoutMs <= MAX_TIMER_MS)
      || typeof maxBytes !== 'number' || !(maxBytes >= 0) || !isFinite(maxBytes)
      || typeof connectTimeoutMs !== 'number' || !(connectTimeoutMs > 0) || !(connectTimeoutMs <= MAX_TIMER_MS)) {
      reject(new TypeError(`guardedRequest needs a timeoutMs and connectTimeoutMs from 1 to ${MAX_TIMER_MS} ms and a maxBytes`));
      return;
    }
    const method = typeof opts.method === 'string' ? opts.method.toUpperCase() : '';
    if (!/^[A-Z]{1,16}$/.test(method)) {
      reject(new TypeError('guardedRequest needs an HTTP method'));
      return;
    }
    if (opts.localAddress !== undefined && net.isIP(String(opts.localAddress)) === 0) {
      reject(new TypeError('localAddress must be an IP literal'));
      return;
    }

    const started = Date.now();
    const signal = opts.signal;
    let settled = false;
    let phase: 'dns' | 'connect' | 'waiting' | 'response' | 'body' = 'dns';
    let host = '';
    let overallTimer: any = null;
    let connectTimer: any = null;
    let req: http.ClientRequest | null = null;
    let res: http.IncomingMessage | null = null;
    let sock: net.Socket | null = null;

    const clearConnect = function () {
      if (connectTimer !== null) { clearTimeout(connectTimer); connectTimer = null; }
    };
    // Connected (TCP for http, the TLS handshake for https): from here a stall is a `timeout`.
    const connected = function () {
      clearConnect();
      if (phase === 'connect') phase = 'waiting';
    };
    const cleanup = function () {
      if (overallTimer !== null) { clearTimeout(overallTimer); overallTimer = null; }
      clearConnect();
      if (signal) {
        try { signal.removeEventListener('abort', onAbort); } catch { /* nothing to remove */ }
      }
    };
    const teardown = function () {
      try { if (res) res.destroy(); } catch { /* already closed */ }
      try { if (req) req.destroy(); } catch { /* already closed */ }
      try { if (sock) sock.destroy(); } catch { /* already closed */ }
    };
    const fail = function (err: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      teardown();
      reject(err);
    };
    const finish = function (value: GuardedResponse) {
      if (settled) return;
      settled = true;
      cleanup();
      teardown();
      resolve(value);
    };
    // Every event callback goes through this: a throw inside one fails the request instead of the process.
    const guard = function <A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
      return function (...args: A) {
        try { fn.apply(null, args); } catch (err) { fail(err); }
      };
    };
    const blocked = function (code: GuardCode, message: string, detail?: GuardDetail, revealed?: boolean) {
      return new OutboundBlockedError(code, message, revealed === true, detail || { host: host });
    };
    const mapError = function (err: unknown): unknown {
      if (err instanceof OutboundBlockedError) return err;
      const code = errnoOf(err);
      const what = code || 'error';
      if (code === 'HPE_HEADER_OVERFLOW') return blocked('headers_too_large', `${host} sent response headers larger than ${MAX_HEADER_BYTES / 1024} KiB.`);
      if (code.indexOf('HPE_') === 0) return blocked('bad_response', `${host} sent a malformed HTTP response (${what}).`);
      if (isTlsError(err)) return blocked('tls_failed', `The TLS connection to ${host} failed (${what}).`);
      if (phase === 'response' || phase === 'body') return blocked('bad_response', `${host} broke off the response (${what}).`);
      if (code === 'ECONNREFUSED') return blocked('connect_refused', `${host} refused the connection.`);
      if (code === 'ETIMEDOUT') return blocked('connect_timeout', `Connecting to ${host} timed out.`);
      return blocked('connection_failed', `The connection to ${host} failed (${what}).`);
    };
    function onAbort() {
      fail(abortReasonOf(signal));
    }

    if (signal) {
      if (signal.aborted) { fail(abortReasonOf(signal)); return; }
      signal.addEventListener('abort', onAbort);
    }
    overallTimer = setTimeout(detached('request timeout', function () {
      if (phase === 'dns') fail(blocked('dns_timeout', `Looking up ${host || 'the host'} took too long.`));
      else if (phase === 'connect') fail(blocked('connect_timeout', `Connecting to ${host} timed out.`));
      else fail(blocked('timeout', `${host} did not answer within ${Math.round(timeoutMs / 100) / 10} s.`));
    }), timeoutMs);

    const checked = checkUrl(rawUrl, opts.policy);
    if (!checked.ok) {
      fail(new OutboundBlockedError(checked.code, checked.message, false, checked.detail));
      return;
    }
    host = checked.host;

    const start = function (target: ResolvedTarget) {
      phase = 'connect';
      const url = checked.url;
      const isHttps = url.protocol === 'https:';
      const headers: { [name: string]: string } = {};
      const given = opts.headers || {};
      const names = Object.keys(given);
      let userAgent = false;
      for (let i = 0; i < names.length; i++) {
        const value = given[names[i]];
        const lower = names[i].toLowerCase();
        if (typeof value !== 'string' || STRIPPED_REQUEST_HEADERS.has(lower)) continue;
        if (lower === 'user-agent') userAgent = true;
        headers[names[i]] = value;
      }
      if (!userAgent) headers['User-Agent'] = DEFAULT_USER_AGENT;
      headers['Accept-Encoding'] = 'identity';
      const body = opts.body;
      if (body !== undefined) headers['Content-Length'] = String(typeof body === 'string' ? Buffer.byteLength(body) : body.length);

      const reqOpts: https.RequestOptions = {
        protocol: url.protocol,
        hostname: checked.host,
        port: checked.port,
        path: (url.pathname || '/') + url.search,
        method: method,
        headers: headers,
        agent: false,
        lookup: pinnedLookup(target.address, target.family),
        maxHeaderSize: MAX_HEADER_BYTES,
      };
      if (opts.localAddress !== undefined) reqOpts.localAddress = String(opts.localAddress);
      if (isHttps && checked.ipLiteral === 0) reqOpts.servername = checked.host;

      let r: http.ClientRequest;
      try {
        r = isHttps ? https.request(reqOpts) : http.request(reqOpts);
      } catch (err) {
        fail(err);
        return;
      }
      req = r;
      r.on('error', guard(function (err: unknown) { fail(mapError(err)); }));
      // Node ends some exchanges with nothing but a 'close': a 101 Upgrade that no one takes over,
      // for one. Without this the request would wait for its timeout.
      r.on('close', guard(function () {
        if (!settled && res === null) fail(blocked('bad_response', `${host} closed the connection without an answer.`));
      }));
      // Every byte the HTTP parser reads counts against one budget: headers, chunk framing and
      // chunk extensions, 1xx answers and trailers. The body cap alone counts body bytes only.
      const wireBudget = maxBytes + MAX_HEADER_BYTES + Math.max(65536, maxBytes);
      let wire = 0;
      r.on('socket', guard(function (s: net.Socket) {
        sock = s;
        s.on('error', noop);
        s.on('data', guard(function (d: Buffer) {
          if (settled) return;
          wire += d.length;
          if (wire > wireBudget) fail(blocked('response_too_large', `${host} sent more than ${wireBudget} bytes.`));
        }));
        // Registered before the request is flushed, so it runs before any request byte is written.
        const onConnect = guard(function () {
          const mismatch = checkPinnedPeer(s, target.address);
          if (mismatch) { fail(mismatch); return; }
          if (!isHttps) connected();
        });
        // A socket that is neither connecting nor destroyed is already connected; a destroyed one
        // (a failed bind on localAddress, say) brings its own error event, which settles the request.
        if ((s as unknown as { connecting?: boolean }).connecting) s.once('connect', onConnect);
        else if (!s.destroyed) onConnect();
        if (isHttps) s.once('secureConnect', guard(connected));
      }));
      r.on('response', guard(function (incoming: http.IncomingMessage) {
        res = incoming;
        incoming.on('error', guard(function (err: unknown) { fail(mapError(err)); }));
        connected();
        phase = 'response';
        const status = incoming.statusCode || 0;
        if (status >= 300 && status < 400) {
          let locHost = '';
          let revealed = false;
          const loc = incoming.headers.location;
          if (typeof loc === 'string' && loc) {
            try {
              const u = new URL(loc, url.href);
              locHost = normalizeName(u.hostname);
              revealed = locationHostRefused(u);
            } catch { locHost = ''; }
          }
          fail(blocked('redirect_refused',
            `${host} answered ${status} with a redirect${locHost ? ` to ${locHost}` : ''}; redirects are not followed.`,
            { host: host, status: status, location: locHost || undefined }, revealed));
          return;
        }
        if (opts.discardBody === true) {
          finish({ status: status, headers: incoming.headers, body: Buffer.alloc(0), address: target.address });
          return;
        }
        const enc = String(incoming.headers['content-encoding'] || '').trim().toLowerCase();
        if (enc && enc !== 'identity') {
          fail(blocked('compressed_response', `${host} answered with Content-Encoding: ${enc.slice(0, 40)}; only uncompressed answers are accepted.`));
          return;
        }
        const declared = Number(incoming.headers['content-length']);
        if (incoming.headers['content-length'] !== undefined && isFinite(declared) && declared > maxBytes) {
          fail(blocked('response_too_large', `${host} answered with more than ${maxBytes} bytes.`));
          return;
        }
        phase = 'body';
        // The body is copied into one growing buffer, never kept as the parser's own pieces: a
        // body sent in 1-byte chunks would otherwise hold one Buffer object per byte. The number
        // of pieces is capped too, so tiny chunks cannot buy unbounded work.
        const maxPieces = 64 + Math.ceil(maxBytes / 64);
        let acc: Buffer | null = null;
        let total = 0;
        let pieces = 0;
        incoming.on('data', guard(function (chunk: Buffer) {
          if (settled) return;
          pieces++;
          const next = total + chunk.length;
          if (next > maxBytes) { fail(blocked('response_too_large', `${host} answered with more than ${maxBytes} bytes.`)); return; }
          if (pieces > maxPieces) { fail(blocked('response_too_large', `${host} sent its answer in more than ${maxPieces} pieces.`)); return; }
          if (chunk.length === 0) return;
          if (acc === null || next > acc.length) {
            const grown = Buffer.alloc(Math.min(maxBytes, Math.max(next, 16384, acc === null ? 0 : acc.length * 2)));
            if (acc !== null) acc.copy(grown, 0, 0, total);
            acc = grown;
          }
          chunk.copy(acc, total);
          total = next;
        }));
        incoming.on('end', guard(function () {
          if (settled) return;
          if (!incoming.complete) { fail(blocked('bad_response', `${host} ended the response early.`)); return; }
          const body = Buffer.alloc(total);
          if (acc !== null && total > 0) acc.copy(body, 0, 0, total);
          finish({ status: status, headers: incoming.headers, body: body, address: target.address });
        }));
        incoming.on('close', guard(function () {
          if (!settled) fail(blocked('bad_response', `${host} closed the connection before the response was complete.`));
        }));
      }));

      const left = timeoutMs - (Date.now() - started);
      connectTimer = setTimeout(detached('connect timeout', function () {
        fail(blocked('connect_timeout', `Connecting to ${host} took longer than ${Math.round(connectTimeoutMs / 100) / 10} s.`));
      }), Math.max(1, Math.min(connectTimeoutMs, left)));

      try {
        if (body !== undefined) r.end(body); else r.end();
      } catch (err) {
        fail(err);
      }
    };

    resolvePublic(checked.host).then(function (target) {
      if (!settled) start(target);
    }).catch(fail);
  });
}
