/**
 * Enterprise single sign-on: OIDC and SAML, routed by email domain.
 *
 * WHY IT IS SHAPED THIS WAY
 * -------------------------
 * NextAuth's provider list is static — it is built once at module load, so a
 * per-organisation identity provider cannot simply be added to it. Instead the
 * whole IdP conversation happens in ordinary route handlers here, and the result
 * is handed to NextAuth through a one-use ticket that the `sso-ticket`
 * credentials provider redeems. That keeps session issuance in exactly one place
 * (NextAuth) while letting the number of identity providers be a database
 * question rather than a deployment one.
 *
 * SECURITY NOTES
 * --------------
 * - **A domain must be verified before it routes.** Without that check anyone
 *   could register a connection for `gmail.com` and every Gmail user who tried
 *   SSO would be sent to the attacker's IdP. `domain_verified` is set by an
 *   operator, not by the customer.
 * - **State is a signed, expiring JWT**, not a random string in a cookie we then
 *   have to store. It carries the connection id and the nonce, so the callback
 *   can verify both without trusting anything the browser sent separately.
 * - **The OIDC nonce is checked against the ID token.** Skipping that is what
 *   makes token-replay possible.
 * - **Tickets are single-use and short-lived.** A ticket that could be replayed
 *   is a session that can be stolen from a browser history entry.
 * - **JIT provisioning defaults to `viewer`.** Editor seats cost money; letting
 *   an IdP mint them would let a customer's directory silently raise their bill.
 */
import crypto from 'crypto';
import { SignJWT, jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose';
import { openIdentityDb } from '@/lib/identity-db';

export type Protocol = 'oidc' | 'saml';

export interface SsoConnection {
  id: number;
  org_id: number;
  protocol: Protocol;
  domain: string;
  domain_verified: number;
  issuer: string | null;
  client_id: string | null;
  client_secret: string | null;
  sso_url: string | null;
  idp_cert: string | null;
  jit_provisioning: number;
  default_role: string;
  enabled: number;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aistupidlevel.info';
const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'insecure-development-secret'
);

export const oidcRedirectUri = () => `${APP_URL}/api/sso/callback/oidc`;
export const samlAcsUrl = () => `${APP_URL}/api/sso/callback/saml`;
export const samlEntityId = () => `${APP_URL}/saml/metadata`;

// ── Connection lookup ────────────────────────────────────────────────────────

export function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * The connection that should handle this address, or null.
 *
 * Returns nothing for an unverified or disabled connection — deliberately with
 * the same "no SSO here" answer as an unknown domain, so probing cannot tell a
 * pending configuration from an absent one.
 */
export function connectionForEmail(email: string): SsoConnection | null {
  const domain = domainOf(email);
  if (!domain) return null;
  try {
    const row = openIdentityDb()
      .prepare('SELECT * FROM sso_connections WHERE domain = ? AND enabled = 1 AND domain_verified = 1')
      .get(domain) as SsoConnection | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

export function connectionById(id: number): SsoConnection | null {
  try {
    return (openIdentityDb()
      .prepare('SELECT * FROM sso_connections WHERE id = ?')
      .get(id) as SsoConnection | undefined) ?? null;
  } catch {
    return null;
  }
}

// ── Signed state ─────────────────────────────────────────────────────────────

interface StatePayload extends Record<string, unknown> {
  cid: number;
  nonce: string;
  returnTo: string;
}

export async function signState(payload: StatePayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(SECRET);
}

export async function verifyState(token: string): Promise<StatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (typeof payload.cid !== 'number' || typeof payload.nonce !== 'string') return null;
    return payload as unknown as StatePayload;
  } catch {
    return null;
  }
}

/** Only ever redirect within this site. */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/account';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/account';
  return raw;
}

// ── OIDC ─────────────────────────────────────────────────────────────────────

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

const discoveryCache = new Map<string, { doc: Discovery; at: number }>();
const DISCOVERY_TTL_MS = 10 * 60_000;

export async function discover(issuer: string): Promise<Discovery> {
  const hit = discoveryCache.get(issuer);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) return hit.doc;

  const url = `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OIDC discovery failed for ${issuer}: ${res.status}`);
  const doc = (await res.json()) as Discovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error(`OIDC discovery for ${issuer} is missing required endpoints`);
  }
  discoveryCache.set(issuer, { doc, at: Date.now() });
  return doc;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwksFor(uri: string) {
  let set = jwksCache.get(uri);
  if (!set) {
    set = createRemoteJWKSet(new URL(uri));
    jwksCache.set(uri, set);
  }
  return set;
}

export async function buildOidcAuthorizeUrl(conn: SsoConnection, returnTo: string): Promise<string> {
  if (!conn.issuer || !conn.client_id) throw new Error('OIDC connection is incomplete');
  const doc = await discover(conn.issuer);
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = await signState({ cid: conn.id, nonce, returnTo });

  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', conn.client_id);
  url.searchParams.set('redirect_uri', oidcRedirectUri());
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  return url.toString();
}

/** Exchange the code and return the verified subject's email and name. */
export async function completeOidc(
  conn: SsoConnection, code: string, expectedNonce: string
): Promise<{ email: string; name: string | null }> {
  if (!conn.issuer || !conn.client_id || !conn.client_secret) {
    throw new Error('OIDC connection is incomplete');
  }
  const doc = await discover(conn.issuer);

  const res = await fetch(doc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oidcRedirectUri(),
      client_id: conn.client_id,
      client_secret: conn.client_secret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error('Identity provider returned no id_token');

  const { payload } = await jwtVerify(tokens.id_token, jwksFor(doc.jwks_uri), {
    issuer: doc.issuer,
    audience: conn.client_id,
  });

  // Replay protection. An id_token whose nonce does not match the one we put in
  // the authorize request was not minted for this sign-in attempt.
  if (payload.nonce !== expectedNonce) throw new Error('Nonce mismatch');

  const email = String(payload.email ?? '').trim().toLowerCase();
  if (!email) throw new Error('Identity provider returned no email claim');
  if (payload.email_verified === false) throw new Error('Identity provider reports the address as unverified');

  return { email, name: (payload.name as string) ?? null };
}

/** Decode without verifying — only for logging a failure. Never for trust. */
export function peekIdToken(idToken: string): unknown {
  try { return decodeJwt(idToken); } catch { return null; }
}

// ── Provisioning ─────────────────────────────────────────────────────────────

/**
 * Find or create the account behind a verified SSO identity, and make sure it
 * belongs to the connection's organisation.
 *
 * The email domain is re-checked against the connection here even though the
 * lookup already matched: the IdP is free to assert any address it likes, and an
 * IdP for `acme.com` must not be able to log someone in as `ceo@rival.com`.
 */
export function provisionSsoUser(
  conn: SsoConnection, email: string, name: string | null
): { userId: number; created: boolean } {
  if (domainOf(email) !== conn.domain) {
    throw new Error(`Identity provider asserted ${email}, outside its ${conn.domain} domain`);
  }

  const db = openIdentityDb();
  let user = db.prepare('SELECT id FROM router_users WHERE email = ?').get(email) as { id: number } | undefined;
  let created = false;

  if (!user) {
    if (!conn.jit_provisioning) {
      throw new Error('No account for this address, and this connection does not create them automatically');
    }
    // No password hash: this account can only ever be entered through its IdP,
    // which is the point of enforcing SSO.
    const info = db.prepare(`
      INSERT INTO router_users (email, name, email_verified, oauth_provider, subscription_tier, created_at, updated_at)
      VALUES (?, ?, 1, 'sso', 'free',
              strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(email, name);
    user = { id: Number(info.lastInsertRowid) };
    created = true;
  }

  const member = db.prepare('SELECT id, active FROM organization_members WHERE org_id = ? AND user_id = ?')
    .get(conn.org_id, user.id) as { id: number; active: number } | undefined;

  if (!member) {
    db.prepare(`
      INSERT INTO organization_members (org_id, user_id, invite_email, role, joined_at, provisioned_by, active)
      VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'sso', 1)
    `).run(conn.org_id, user.id, email, conn.default_role);
  } else if (!member.active) {
    // A member deactivated through SCIM must not be silently revived by an IdP
    // that still knows about them — that is precisely the offboarding hole SCIM
    // exists to close.
    throw new Error('This account has been deactivated in your directory');
  }

  db.prepare(`UPDATE sso_connections SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(conn.id);

  return { userId: user.id, created };
}

// ── One-use tickets ──────────────────────────────────────────────────────────

const TICKET_TTL_MS = 2 * 60_000;

export function mintTicket(userId: number): string {
  const id = crypto.randomBytes(32).toString('hex');
  openIdentityDb()
    .prepare('INSERT INTO sso_tickets (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(id, userId, new Date(Date.now() + TICKET_TTL_MS).toISOString());
  return id;
}

/**
 * Redeem a ticket exactly once.
 *
 * The update is the check: marking it used in the same statement that requires
 * it to be unused means two simultaneous redemptions cannot both succeed.
 */
export function consumeTicket(id: string): number | null {
  try {
    const db = openIdentityDb();
    const info = db
      .prepare(`UPDATE sso_tickets SET used = 1 WHERE id = ? AND used = 0 AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run(id);
    if (info.changes === 0) return null;

    const row = db.prepare('SELECT user_id FROM sso_tickets WHERE id = ?').get(id) as { user_id: number } | undefined;

    // Opportunistic cleanup; the table should never grow.
    db.prepare(`DELETE FROM sso_tickets WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now', '-1 day')`).run();

    return row?.user_id ?? null;
  } catch {
    return null;
  }
}
