/**
 * The provider pages' side of the API (/account/provider/*, through the /api/account proxy that
 * signs each call for the signed-in account), with the types those pages read and the words they
 * use for states, roles and checklist rows. Client-safe: no server imports.
 *
 * Shapes: the API contract (v2, final). Copy comes from the Phase 3
 * plan (§2.2–§2.15); a field the API leaves out is simply not shown.
 */

export type ProviderRole = 'owner' | 'admin' | 'viewer';
export type ProviderKind = 'company' | 'individual';
export type ProviderState = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'refused' | 'closed';

export interface ProviderDTO {
  publicId: string;
  kind: ProviderKind;
  /** Individuals: the handle. */
  displayName: string;
  legalName?: string | null;
  tradingName?: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  country?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
  website?: string | null;
  /** Set once the account is approved; until then the address is held as `proposedSlug`. */
  slug?: string | null;
  proposedSlug?: string | null;
  state: ProviderState;
  standing?: 'good' | 'under_review' | 'suspended' | 'terminated' | string;
  testTier?: string;
  internal?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** When the account entered its current state ("In review since 5 Nov"). */
  stateSince?: string | null;
  restartAfter?: string | null;
  closedAt?: string | null;
  noticeEmail?: string | null;
  noticeEmailConfirmedAt?: string | null;
  counts?: { members: number; pendingInvites: number; verifiedDomains: number; pendingDomains: number };
  submitBlockedUntil?: string | null;
}

/** GET /account/provider/options: the forms' countries and regions. */
export interface ProviderOptions { countries: Array<{ code: string; name: string }>; regions: string[]; sanctionedCountries: string[] }

export type ChecklistState = 'done' | 'todo' | 'blocked' | 'not_applicable' | 'unavailable';
export interface ChecklistRow { key: string; state: ChecklistState; reason?: string | null }

export interface Membership { publicId: string; displayName: string; role: ProviderRole; state: ProviderState }

/** GET /account/provider. */
export interface ProviderSummary {
  provider: ProviderDTO | null;
  role: ProviderRole | null;
  memberships?: Membership[];
  emailConfirmed?: boolean;
  canCreate?: boolean;
  createBlocked?: { error: string; message: string } | null;
  checklist?: ChecklistRow[];
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** The API's code (`slug_taken`), when it sent one. */
  code: string | null;
  /** A sentence to show: the API's own message, else ours for its code. */
  error: string | null;
  message: string | null;
  /** Per-field sentences for a form. */
  fields: Record<string, string> | null;
}

/** Fallback sentences for the API's codes; the API's own `message` always wins. */
export const ERROR_TEXT: Record<string, string> = {
  not_found: 'This is not available for your account.',
  name_protected: 'That name belongs to a brand that has to verify its own domain first. If it is yours, verify the domain, then ask for a review.',
  slug_taken: 'That address is taken. Choose another one.',
  slug_reserved: 'That address is reserved. Choose another one.',
  limit_reached: 'You have reached the limit for this.',
  email_unconfirmed: 'Confirm your email first.',
  account_too_new: 'Your account is too new for this step.',
  country_refused: 'We cannot accept provider accounts registered in that country.',
  public_mailbox_domain: 'That is a public mailbox domain. Add your own company domain.',
  domain_taken: 'This domain is verified by another provider account. If it is yours, contact us.',
  invalid_domain: 'Enter a domain such as example.com, without https:// or a path.',
  rate_limited: 'Too many attempts. Please wait a little and try again.',
  invalid_field: 'Some fields need attention.',
  role_required: 'Your role in this provider account does not allow that.',
  not_editable: 'This cannot be changed while the account is in review or published.',
  companies_only: 'Only company accounts verify domains.',
  domain_exists: 'That domain is already on this provider account.',
  domain_recently_released: 'That domain was released recently and cannot be added again yet.',
  already_member: 'That person is already a member.',
  already_invited: 'That address already has an invitation.',
  owner_role: 'The owner cannot do that. Hand the account over first.',
  transfer_pending: 'A transfer of ownership is already waiting for an answer.',
  not_active_member: 'Only a member who has joined can take over.',
  transfer_not_allowed: 'A refused account cannot change owner. Start again after the wait, or close it.',
  no_transfer: 'There is no transfer of ownership to cancel.',
  transfer_expired: 'This offer has expired.',
  invite_expired: 'This invitation has expired.',
  email_mismatch: 'This invitation is for another email address.',
  confirm_mismatch: 'That does not match. Type it exactly as shown.',
  already_closed: 'This provider account is already closed.',
  not_refused: 'Only a refused application can start again.',
  wait_not_over: 'You cannot start again yet.',
  appeal_only: 'This refusal can only be changed by an appeal.',
  marketplace_unavailable: 'Provider accounts are unavailable for a moment. Try again in a minute.',
  // The logo upload's answers (Phase 3 plan §3.2; the API names what it found in its own sentence).
  format_not_accepted: 'Upload an SVG file.',
  file_too_large: 'SVG files can be up to 16 KB.',
  svg_doctype: 'Remove the DOCTYPE and entity declarations: export a plain SVG.',
  svg_unsafe: 'Export a plain SVG without scripts, links, embedded images, fonts or animation.',
  queue_full: 'Too many files are waiting to be checked. Try again in an hour.',
  // Endpoints and listings (M4).
  host_not_verified: 'That host is not on one of your verified domains. Verify the domain first.',
  https_required: 'Provider endpoints must use https.',
  key_required: 'Provider endpoints always have a key.',
  endpoint_plain_http: 'Only https endpoints can be listed.',
  endpoint_keyless: 'Only endpoints with a key can be listed.',
  listing_exists: 'You already list this model at this precision.',
  readiness_running: 'A readiness check is already queued or running for this listing.',
  readiness_not_allowed: 'A readiness check cannot run for this listing now.',
  needs_review: 'After submission this changes through a review.',
  not_a_draft: 'Only a draft can be removed.',
  use_replace_key: 'This endpoint has listed models: use Replace key and re-test.',
  endpoint_held: 'This endpoint is paused for a security check.',
  endpoints_unavailable: 'Endpoints are unavailable for a moment. Try again in a minute.',
};

const PICK_KEY = 'asl-provider-current';

/**
 * The provider account chosen on this browser, for people in more than one. Only a well-formed
 * public id counts: the API answers 404 to a malformed ?provider= rather than using the default
 * account (contract v3.2 §1), so anything else is dropped here and the default account is used.
 */
export function chosenProvider(): string | null {
  try {
    const pick = localStorage.getItem(PICK_KEY);
    if (pick !== null && !/^[a-z2-7]{10}$/.test(pick)) { localStorage.removeItem(PICK_KEY); return null; }
    return pick;
  } catch { return null; }
}

export function chooseProvider(publicId: string | null): void {
  try {
    if (publicId) localStorage.setItem(PICK_KEY, publicId);
    else localStorage.removeItem(PICK_KEY);
  } catch { /* private window: the API's default account is used */ }
}

/**
 * Call /api/account/provider{path}. Never throws: a network failure comes back as ok:false. The
 * chosen provider account rides along as ?provider= unless `provider: null` is passed (an
 * invitation names its own account).
 */
export async function mpApi<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; provider?: string | null } = {},
): Promise<ApiResult<T>> {
  try {
    const pick = opts.provider !== undefined ? opts.provider : chosenProvider();
    const url = new URL(`/api/account/provider${path}`, window.location.origin);
    if (pick) url.searchParams.set('provider', pick);
    const r = await fetch(url.pathname + url.search, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    const j = await r.json().catch(() => null);
    const ok = r.ok && !!j?.success;
    const code = ok ? null : (typeof j?.error === 'string' ? j.error : null);
    const message = typeof j?.message === 'string' ? j.message : null;
    return {
      ok,
      status: r.status,
      data: (j?.data ?? null) as T | null,
      code,
      message,
      error: ok ? null : (message || (code && ERROR_TEXT[code]) || code || `Request failed (${r.status})`),
      fields: !ok && j?.fields && typeof j.fields === 'object' ? j.fields as Record<string, string> : null,
    };
  } catch {
    return { ok: false, status: 0, data: null, code: null, message: null, fields: null, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

export const KIND_LABEL: Record<ProviderKind, string> = { company: 'Company', individual: 'Individual' };

export const ROLE_LABEL: Record<ProviderRole, string> = { owner: 'Owner', admin: 'Admin', viewer: 'Viewer' };

export const STATE_LABEL: Record<ProviderState, string> = {
  draft: 'Draft',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  refused: 'Refused',
  closed: 'Closed',
};

const shortDay = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

/** The page head's pill: "Draft", "In review since 5 Nov". */
export function stateText(p: Pick<ProviderDTO, 'state' | 'stateSince'>): string {
  const label = STATE_LABEL[p.state] ?? p.state;
  return p.state === 'in_review' && p.stateSince ? `${label} since ${shortDay(p.stateSince)}` : label;
}

export function stateTone(state: ProviderState): 'good' | 'warn' | 'bad' | undefined {
  return state === 'approved' ? 'good' : state === 'changes_requested' || state === 'in_review' ? 'warn' : state === 'refused' ? 'bad' : undefined;
}

/**
 * The overview checklist's rows in the plan's order (§2.3), with the page that does each one
 * where that page exists. Rows the API does not send are not shown.
 */
export const CHECKLIST: Array<{ key: string; label: string; href?: string; action?: string }> = [
  { key: 'domains', label: 'Domains verified', href: '/account/provider/domains', action: 'Domains' },
  { key: 'profile', label: 'Profile', href: '/account/provider/profile', action: 'Profile' },
  { key: 'logo', label: 'Logo', href: '/account/provider/logo', action: 'Logo' },
  { key: 'data', label: 'Data handling', href: '/account/provider/data', action: 'Data handling' },
  { key: 'endpoint', label: 'Endpoint tested', href: '/account/provider/endpoints', action: 'Endpoints' },
  { key: 'models', label: 'Models listed', href: '/account/provider/models', action: 'Models' },
  { key: 'readiness', label: 'Readiness check', href: '/account/provider/models', action: 'Models' },
  { key: 'agreement', label: 'Agreement signed', href: '/account/provider/agreement', action: 'Agreement' },
  { key: 'notice_email', label: 'Notice email confirmed', href: '/account/provider/agreement#notice', action: 'Notice email' },
  { key: 'submit', label: 'Submit for review' },
  { key: 'benchmarking', label: 'Start benchmarking' },
  { key: 'router', label: 'Add to the Smart Router' },
  // F4 (phase4-plan revision 4 §R2.3): consented calibration, per listing on the Models page.
  { key: 'fresh_versions', label: 'Fresh task versions', href: '/account/provider/models', action: 'Models' },
];

/** Regions a provider can serve (§4.1); the API's own list wins when it sends one. */
export const REGIONS = [
  'US East', 'US West', 'Canada', 'EU West', 'EU Central', 'UK', 'Asia Pacific', 'Japan', 'Singapore', 'India',
  'Middle East', 'Latin America',
];

/** The address a provider page will have, as the URL preview shows it. */
export const PAGE_BASE = 'aistupidlevel.info/inference-providers/';

/** Provider slugs (§4.3): lowercase letters, digits and inner hyphens, 1–32 characters. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** Second-level labels that sit under a country code ("co.uk"), for the slug proposal only. */
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'ac', 'gov', 'ltd', 'plc', 'ne', 'or', 'go']);

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '');
}

/**
 * The slug proposed from a website: its domain's own label (together.ai → together,
 * www.acme.co.uk → acme). The API checks the result against its rules and reserved names.
 */
export function slugFromWebsite(website: string): string {
  let host = '';
  try { host = new URL(/^[a-z]+:\/\//i.test(website) ? website : `https://${website}`).hostname; } catch { return ''; }
  const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (labels.length < 2) return slugify(labels[0] ?? '');
  const last = labels.length - 1;
  const label = labels.length >= 3 && labels[last].length === 2 && SECOND_LEVEL.has(labels[last - 1]) ? labels[last - 2] : labels[last - 1];
  return slugify(label);
}

/** The host of a URL a person typed, or '' when it is not one. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}
