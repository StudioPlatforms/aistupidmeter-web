import { NextRequest, NextResponse } from 'next/server';
import { redirectToPath } from '@/lib/safe-redirect';
import {
  connectionForEmail, buildOidcAuthorizeUrl, safeReturnTo, signState,
} from '@/lib/sso';
import { buildSamlRedirect } from '@/lib/saml';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Begin an SSO sign-in.
 *
 * Takes an email address, finds the identity provider that owns its domain, and
 * redirects to it. Deliberately gives the same answer for "no connection" and
 * "connection not yet verified": telling an anonymous caller which domains have
 * SSO pending is free reconnaissance for a phishing campaign.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const email = (params.get('email') ?? '').trim().toLowerCase();
  const returnTo = safeReturnTo(params.get('returnTo'));

  if (!email.includes('@')) {
    return redirectToPath(request, '/auth/sso?error=invalid_email');
  }

  const conn = connectionForEmail(email);
  if (!conn) {
    return redirectToPath(request, '/auth/sso?error=no_connection');
  }

  try {
    if (conn.protocol === 'oidc') {
      const url = await buildOidcAuthorizeUrl(conn, returnTo);
      return NextResponse.redirect(url);
    }
    if (conn.protocol === 'saml') {
      const nonce = crypto.randomBytes(16).toString('hex');
      const relayState = await signState({ cid: conn.id, nonce, returnTo });
      const url = await buildSamlRedirect(conn, relayState);
      return NextResponse.redirect(url);
    }
    return redirectToPath(request, '/auth/sso?error=unsupported');
  } catch (err) {
    console.error('[sso] start failed:', (err as Error).message);
    return redirectToPath(request, '/auth/sso?error=idp_unreachable');
  }
}
