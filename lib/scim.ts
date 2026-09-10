/**
 * SCIM 2.0 provisioning (RFC 7643 / 7644), scoped to one organisation.
 *
 * WHAT THIS IS FOR
 * ----------------
 * The reason enterprises ask for SCIM is offboarding. SSO controls who can get
 * in *today*; SCIM is what makes a leaver lose access the moment HR closes their
 * directory record, without anyone remembering to log into a vendor dashboard.
 * So the deactivation path is the one that matters most here, and it is
 * deliberately soft: a directory sets `active: false`, we mark the membership
 * inactive, and `provisionSsoUser` refuses to sign them in again. Nothing is
 * deleted, because a re-hire, a mistaken sync or a misconfigured filter should
 * be recoverable.
 *
 * SCOPE
 * -----
 * Users only, with the `active` attribute and basic name/email mapping. Groups
 * are not implemented and `ServiceProviderConfig` says so, rather than
 * advertising a capability that would silently do nothing — an IdP that thinks
 * it is managing group membership when it is not is worse than one that knows
 * it must manage roles by hand.
 *
 * IDENTIFIERS
 * -----------
 * The SCIM `id` is the organisation_members row id, not the user id. A person
 * can exist in several workspaces; what a directory provisions and deprovisions
 * is the membership, not the human.
 */
import crypto from 'crypto';
import { openIdentityDb } from '@/lib/identity-db';

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

export const SCIM_CONTENT_TYPE = 'application/scim+json';

// ── Tokens ───────────────────────────────────────────────────────────────────

export function generateScimToken(): string {
  return `scim_${crypto.randomBytes(32).toString('hex')}`;
}

export function hashScimToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface ScimAuth {
  tokenId: number;
  orgId: number;
}

/**
 * Resolve a bearer token to the organisation it provisions.
 *
 * Constant-ish work regardless of outcome — the hash is computed either way, and
 * the lookup is a single indexed read on a UNIQUE column.
 */
export function authenticateScim(header: string | null): ScimAuth | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    const row = openIdentityDb()
      .prepare('SELECT id, org_id, revoked FROM scim_tokens WHERE token_hash = ?')
      .get(hashScimToken(token)) as { id: number; org_id: number; revoked: number } | undefined;
    if (!row || row.revoked) return null;

    openIdentityDb()
      .prepare(`UPDATE scim_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(row.id);

    return { tokenId: row.id, orgId: row.org_id };
  } catch {
    return null;
  }
}

// ── Representation ───────────────────────────────────────────────────────────

export interface MemberRow {
  id: number;
  org_id: number;
  user_id: number | null;
  invite_email: string | null;
  role: string;
  active: number;
  external_id: string | null;
  provisioned_by: string;
  joined_at: string | null;
  invited_at: string;
  email?: string | null;
  name?: string | null;
}

export function toScimUser(m: MemberRow, baseUrl: string) {
  const email = m.email ?? m.invite_email ?? '';
  const parts = (m.name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: String(m.id),
    externalId: m.external_id ?? undefined,
    userName: email,
    name: m.name
      ? {
          formatted: m.name,
          givenName: parts[0] ?? undefined,
          familyName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
        }
      : undefined,
    displayName: m.name ?? email,
    emails: email ? [{ value: email, primary: true, type: 'work' }] : [],
    active: m.active === 1,
    // Role is not managed through SCIM — see the note at the top of the file.
    // Exposed read-only so a directory admin can see what it is.
    roles: [{ value: m.role, primary: true }],
    meta: {
      resourceType: 'User',
      created: m.joined_at ?? m.invited_at,
      location: `${baseUrl}/api/scim/v2/Users/${m.id}`,
    },
  };
}

export function scimError(status: number, detail: string, scimType?: string) {
  return {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(status),
    ...(scimType ? { scimType } : {}),
    detail,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

const MEMBER_SELECT = `
  SELECT m.id, m.org_id, m.user_id, m.invite_email, m.role, m.active,
         m.external_id, m.provisioned_by, m.joined_at, m.invited_at,
         u.email AS email, u.name AS name
    FROM organization_members m
    LEFT JOIN router_users u ON u.id = m.user_id
`;

export function getMember(orgId: number, memberId: number): MemberRow | null {
  return (openIdentityDb()
    .prepare(`${MEMBER_SELECT} WHERE m.id = ? AND m.org_id = ?`)
    .get(memberId, orgId) as MemberRow | undefined) ?? null;
}

export function findMemberByEmail(orgId: number, email: string): MemberRow | null {
  return (openIdentityDb()
    .prepare(`${MEMBER_SELECT} WHERE m.org_id = ? AND lower(COALESCE(u.email, m.invite_email)) = lower(?)`)
    .get(orgId, email) as MemberRow | undefined) ?? null;
}

/**
 * Parse the sliver of SCIM filter syntax that directories actually send for
 * users: `userName eq "someone@example.com"`.
 *
 * Anything else returns null and the caller lists everything, which is a
 * correct-if-inefficient answer rather than a wrong one.
 */
export function parseUserNameFilter(filter: string | null): string | null {
  if (!filter) return null;
  const m = /^\s*userName\s+eq\s+"([^"]+)"\s*$/i.exec(filter);
  return m ? m[1] : null;
}

export function listMembers(orgId: number, opts: { filterEmail?: string | null; startIndex?: number; count?: number }) {
  const db = openIdentityDb();
  const start = Math.max(1, opts.startIndex ?? 1);
  const count = Math.min(Math.max(opts.count ?? 100, 1), 200);

  if (opts.filterEmail) {
    const one = findMemberByEmail(orgId, opts.filterEmail);
    return { rows: one ? [one] : [], total: one ? 1 : 0, startIndex: start };
  }

  const total = (db.prepare('SELECT COUNT(*) c FROM organization_members WHERE org_id = ?')
    .get(orgId) as { c: number }).c;
  const rows = db
    .prepare(`${MEMBER_SELECT} WHERE m.org_id = ? ORDER BY m.id LIMIT ? OFFSET ?`)
    .all(orgId, count, start - 1) as MemberRow[];

  return { rows, total, startIndex: start };
}

/** Flip a membership's active flag. Returns the updated row, or null. */
export function setMemberActive(orgId: number, memberId: number, active: boolean): MemberRow | null {
  const db = openIdentityDb();
  const existing = getMember(orgId, memberId);
  if (!existing) return null;
  // The owner cannot be deprovisioned by a directory: locking the only person
  // who can administer the workspace out of it is not a recoverable state.
  if (existing.role === 'owner' && !active) return existing;

  db.prepare('UPDATE organization_members SET active = ? WHERE id = ? AND org_id = ?')
    .run(active ? 1 : 0, memberId, orgId);
  return getMember(orgId, memberId);
}

/**
 * Create a membership from a directory push.
 *
 * If the person already has an account here, it is linked rather than
 * duplicated — a directory and this app can legitimately both know the same
 * human, and creating a second account for them would split their watchlist.
 */
export function createMember(
  orgId: number, email: string, name: string | null, externalId: string | null, active: boolean
): MemberRow {
  const db = openIdentityDb();
  const normalised = email.trim().toLowerCase();

  let user = db.prepare('SELECT id FROM router_users WHERE email = ?').get(normalised) as { id: number } | undefined;
  if (!user) {
    const info = db.prepare(`
      INSERT INTO router_users (email, name, email_verified, oauth_provider, subscription_tier, created_at, updated_at)
      VALUES (?, ?, 1, 'sso', 'free',
              strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(normalised, name);
    user = { id: Number(info.lastInsertRowid) };
  }

  const info = db.prepare(`
    INSERT INTO organization_members
      (org_id, user_id, invite_email, role, joined_at, provisioned_by, external_id, active)
    VALUES (?, ?, ?, 'viewer', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'scim', ?, ?)
  `).run(orgId, user.id, normalised, externalId, active ? 1 : 0);

  return getMember(orgId, Number(info.lastInsertRowid))!;
}

/** Append an audit entry for a directory action. Never throws. */
export function auditScim(orgId: number, action: string, targetLabel: string, detail?: Record<string, unknown>) {
  try {
    openIdentityDb().prepare(`
      INSERT INTO audit_events (org_id, actor_kind, actor_label, action, target_type, target_label, detail)
      VALUES (?, 'scim', 'Directory sync', ?, 'member', ?, ?)
    `).run(orgId, action, targetLabel, detail ? JSON.stringify(detail) : null);
  } catch (err) {
    console.error('[scim] audit write failed:', (err as Error).message);
  }
}
