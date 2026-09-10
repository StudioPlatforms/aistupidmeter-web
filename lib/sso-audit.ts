/**
 * Audit hook for SSO sign-ins.
 *
 * The audit table lives in the identity database, which this app can open, so
 * this writes directly rather than going through the API — a sign-in should not
 * depend on a second service being reachable.
 *
 * Never throws: an audit failure must not stop someone signing in.
 */
import type { NextRequest } from 'next/server';
import { openIdentityDb } from '@/lib/identity-db';
import type { SsoConnection } from '@/lib/sso';

export function recordSsoAudit(
  conn: SsoConnection,
  userId: number,
  email: string,
  created: boolean,
  request: NextRequest,
): void {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null;

    openIdentityDb().prepare(`
      INSERT INTO audit_events
        (org_id, actor_user_id, actor_kind, actor_label, action,
         target_type, target_id, target_label, detail, ip, user_agent)
      VALUES (?, ?, 'user', ?, ?, 'connection', ?, ?, ?, ?, ?)
    `).run(
      conn.org_id,
      userId,
      email,
      created ? 'sso.user_provisioned' : 'sso.signed_in',
      String(conn.id),
      conn.domain,
      JSON.stringify({ protocol: conn.protocol, jit: created }),
      ip,
      (request.headers.get('user-agent') ?? '').slice(0, 400) || null,
    );
  } catch (err) {
    console.error('[sso] audit write failed:', (err as Error).message);
  }
}
