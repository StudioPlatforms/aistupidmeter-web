/**
 * The provider account (the inference-provider listings) an account belongs to, for navigation:
 * the session carries it as `provider`, and the sidebar shows its Provider group to members only.
 *
 * Written like workspaceFor (lib/workspace-plan.ts): read from the identity database, cached for
 * a short while, guarded, and null whenever anything fails. An identity file that the provider
 * tables have not reached yet reads as null ("no such table" is caught), so the session callback
 * can never fail a sign-in over it.
 *
 * A membership row alone does not show the group. Provider accounts are switched on for a few
 * accounts at a time, and that decision is the API's (it answers 404 to every account they are
 * not on for), so a member is confirmed with GET /account/provider before the group appears, and
 * it disappears again if the API stops answering for that account. Only members are asked: for
 * everyone else this costs one indexed local read a minute and no request.
 */
import { openIdentityDb } from '@/lib/identity-db';
import { backendUrlFor } from '@/lib/proxy-path';

export type ProviderRole = 'owner' | 'admin' | 'viewer';

/** The session's `provider` (M2 API contract §7). */
export interface ProviderMembership {
  /** The provider account's public id (10 characters). */
  publicId: string;
  name: string;
  kind: 'company' | 'individual';
  role: ProviderRole;
  state: string;
  /** One of AI Stupid Level's own test accounts. */
  internal: boolean;
  /** How many provider accounts (not closed) this person is an active member of. */
  memberships: number;
}

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const TTL_MS = 60_000;
/** A failed confirmation is retried sooner than a definite answer. */
const RETRY_MS = 15_000;
/**
 * How long a member's session read may wait for the API's confirmation (once a minute at most):
 * short, so a stalled API costs a member a moment once a minute and never stalls a page.
 */
const CONFIRM_TIMEOUT_MS = 300;

const memberCache = new Map<number, { value: ProviderMembership | null; at: number }>();
const confirmCache = new Map<number, { ok: boolean; at: number; ttl: number }>();
const inFlight = new Map<number, Promise<boolean>>();

function userIdOf(userId: number | string | null | undefined): number | null {
  const id = Number(userId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The account's provider membership as the identity database records it, with no API call: the
 * provider it owns if it owns one that is not closed, else the one it joined first (the API's own
 * default-provider rule, M2 contract §7). Pending invitations and removed members do not count.
 */
export function providerMembershipFor(userId: number | string | null | undefined): ProviderMembership | null {
  const id = userIdOf(userId);
  if (id === null) return null;
  const hit = memberCache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value: ProviderMembership | null = null;
  let db: ReturnType<typeof openIdentityDb> | null = null;
  try {
    db = openIdentityDb();
    const active = `
        FROM marketplace_provider_members m JOIN marketplace_providers p ON p.id = m.provider_id
       WHERE m.user_id = ? AND m.removed_at IS NULL AND m.joined_at IS NOT NULL AND p.state <> 'closed'`;
    const row = db.prepare(`
      SELECT p.public_id AS publicId, p.display_name AS name, p.kind, p.state, p.internal, m.role ${active}
       ORDER BY (m.role = 'owner') DESC, m.joined_at, m.id
       LIMIT 1
    `).get(id) as { publicId: string; name: string; kind: string; state: string; internal: number; role: string } | undefined;
    if (row && (row.role === 'owner' || row.role === 'admin' || row.role === 'viewer')) {
      const count = db.prepare(`SELECT COUNT(*) AS n ${active}`).get(id) as { n: number };
      value = {
        publicId: row.publicId,
        name: row.name,
        kind: row.kind === 'individual' ? 'individual' : 'company',
        role: row.role,
        state: row.state,
        internal: row.internal === 1,
        memberships: count.n,
      };
    }
  } catch {
    value = null;   // no provider tables in this file yet, or the file could not be read
  } finally {
    db?.close();
  }
  if (memberCache.size > 5_000) memberCache.clear();
  memberCache.set(id, { value, at: Date.now() });
  return value;
}

/**
 * The API's own summary of the account as a provider: GET /account/provider, asked over
 * loopback with the internal token, exactly as the /api/account proxy asks it for the browser.
 * `null` when the API does not answer 200 (404: provider accounts are not on for this account).
 * Never throws.
 */
export async function readProviderSummary<T = unknown>(userId: number | string, timeoutMs = 4000): Promise<{ status: number; data: T | null }> {
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) return { status: 0, data: null };
  try {
    const r = await fetch(`${API_URL}/account/provider`, {
      headers: { 'x-user-id': String(userId), 'x-internal-token': token },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (r.status !== 200) return { status: r.status, data: null };
    const j = await r.json().catch(() => null);
    return { status: 200, data: j?.success ? (j.data as T) : null };
  } catch {
    return { status: 0, data: null };
  }
}

/**
 * Whether `token` is a provider-account invitation this account may open (GET
 * /account/provider/invites/:token answers 200). The invitation page decides its kind with this,
 * never from the URL: 404 covers an unknown or used token and an account provider accounts are
 * not switched on for. Never throws; anything but 200 is false.
 */
export async function isProviderInvitation(userId: number | string, token: string, timeoutMs = 1500): Promise<boolean> {
  const internal = process.env.ROUTER_INTERNAL_TOKEN;
  const url = backendUrlFor(API_URL, 'account/provider/invites', [token], '');
  if (!internal || !url) return false;
  try {
    const r = await fetch(url, {
      headers: { 'x-user-id': String(userId), 'x-internal-token': internal },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (r.status !== 200) return false;
    const j = await r.json().catch(() => null);
    return j?.success === true;
  } catch {
    return false;
  }
}

/** Whether the API says provider accounts are on for this account, cached per account. */
async function confirmed(id: number): Promise<boolean> {
  const hit = confirmCache.get(id);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.ok;
  const running = inFlight.get(id);
  if (running) return running;
  const ask = (async () => {
    const { status } = await readProviderSummary(id, CONFIRM_TIMEOUT_MS);
    // 200 and 404 are answers; anything else (the API restarting, a timeout) is asked again soon.
    const ok = status === 200;
    if (confirmCache.size > 5_000) confirmCache.clear();
    confirmCache.set(id, { ok, at: Date.now(), ttl: status === 200 || status === 404 ? TTL_MS : RETRY_MS });
    return ok;
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, ask);
  return ask;
}

/**
 * For the session: the account's provider membership, or null. Members are confirmed with the
 * API (see the header); everyone else is answered from the identity database alone.
 */
export async function providerFor(userId: number | string | null | undefined): Promise<ProviderMembership | null> {
  const id = userIdOf(userId);
  if (id === null) return null;
  const membership = providerMembershipFor(id);
  if (!membership) return null;
  return (await confirmed(id)) ? membership : null;
}

/**
 * Forget what is cached for this account, so its next session read sees a change at once: the
 * /api/account proxy calls this after every change it forwards to /account/provider/* (an
 * account created, an invitation accepted, a member leaving).
 */
export function forgetProviderFor(userId: number | string | null | undefined): void {
  const id = userIdOf(userId);
  if (id === null) return;
  memberCache.delete(id);
  confirmCache.delete(id);
}
