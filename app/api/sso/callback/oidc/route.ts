import { NextRequest, NextResponse } from 'next/server';
import { redirectToPath } from '@/lib/safe-redirect';
import {
  verifyState, connectionById, completeOidc, provisionSsoUser, mintTicket, safeReturnTo,
} from '@/lib/sso';
import { recordSsoAudit } from '@/lib/sso-audit';

export const dynamic = 'force-dynamic';

/**
 * OIDC authorization-code callback.
 *
 * Every failure lands on /auth/sso with a generic reason. The detail goes to the
 * server log: an error page that explains exactly which check failed is a
 * debugging aid for whoever is attacking the flow.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;

  const idpError = params.get('error');
  if (idpError) {
    console.error('[sso] identity provider returned error:', idpError, params.get('error_description'));
    return redirectToPath(request, '/auth/sso?error=denied');
  }

  const code = params.get('code');
  const stateRaw = params.get('state');
  if (!code || !stateRaw) return redirectToPath(request, '/auth/sso?error=bad_callback');

  const state = await verifyState(stateRaw);
  if (!state) return redirectToPath(request, '/auth/sso?error=expired');

  const conn = connectionById(state.cid);
  if (!conn || !conn.enabled) return redirectToPath(request, '/auth/sso?error=no_connection');

  try {
    const { email, name } = await completeOidc(conn, code, state.nonce);
    const { userId, created } = provisionSsoUser(conn, email, name);

    recordSsoAudit(conn, userId, email, created, request);

    const ticket = mintTicket(userId);
    const to = `/auth/sso/complete?ticket=${encodeURIComponent(ticket)}&returnTo=${encodeURIComponent(safeReturnTo(state.returnTo))}`;
    return redirectToPath(request, to);
  } catch (err) {
    console.error('[sso] oidc callback failed:', (err as Error).message);
    return redirectToPath(request, '/auth/sso?error=rejected');
  }
}
