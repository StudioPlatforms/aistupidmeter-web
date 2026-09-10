import { NextRequest, NextResponse } from 'next/server';
import { redirectToPath } from '@/lib/safe-redirect';
import {
  verifyState, connectionById, provisionSsoUser, mintTicket, safeReturnTo,
} from '@/lib/sso';
import { completeSaml } from '@/lib/saml';
import { recordSsoAudit } from '@/lib/sso-audit';

export const dynamic = 'force-dynamic';

/**
 * SAML assertion consumer service.
 *
 * The IdP POSTs here as a form, so this is a POST handler that reads
 * form-encoded fields rather than JSON. RelayState is our own signed state token
 * round-tripped by the IdP — it is verified, not trusted.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const samlResponse = String(form.get('SAMLResponse') ?? '');
    const relayState = String(form.get('RelayState') ?? '');

    if (!samlResponse) return redirectToPath(request, '/auth/sso?error=bad_callback');

    const state = await verifyState(relayState);
    if (!state) return redirectToPath(request, '/auth/sso?error=expired');

    const conn = connectionById(state.cid);
    if (!conn || !conn.enabled || conn.protocol !== 'saml') {
      return redirectToPath(request, '/auth/sso?error=no_connection');
    }

    const { email, name } = await completeSaml(conn, samlResponse);
    const { userId, created } = provisionSsoUser(conn, email, name);

    recordSsoAudit(conn, userId, email, created, request);

    const ticket = mintTicket(userId);
    const to = `/auth/sso/complete?ticket=${encodeURIComponent(ticket)}&returnTo=${encodeURIComponent(safeReturnTo(state.returnTo))}`;
    return redirectToPath(request, to);
  } catch (err) {
    console.error('[sso] saml callback failed:', (err as Error).message);
    return redirectToPath(request, '/auth/sso?error=rejected');
  }
}
