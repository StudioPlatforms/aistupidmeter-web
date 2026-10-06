/**
 * SAML 2.0, via @node-saml/node-saml.
 *
 * WHY A LIBRARY AND NOT HAND-ROLLED XML
 * -------------------------------------
 * SAML security rests on XML signature verification, and XML signature
 * verification is a minefield: signature wrapping, entity expansion, canonical-
 * isation differences and comment-splitting attacks have all produced complete
 * authentication bypasses in implementations that looked correct. This is not a
 * place to be clever with a regular expression, so the assertion handling is
 * delegated to a maintained implementation and this module only configures it.
 *
 * The settings below are the ones that matter:
 *   - `wantAssertionsSigned` — an unsigned assertion is just XML someone posted.
 *   - `audience` pinned to our entity id, so an assertion minted for a different
 *     service provider cannot be replayed against us.
 *   - `acceptedClockSkewMs` at 60s, because IdP clocks drift and a 30-second
 *     skew should not look like an attack.
 */
import { SAML } from '@node-saml/node-saml';
import { createHash } from 'crypto';
import type { SsoConnection } from '@/lib/sso';
import { samlAcsUrl, samlEntityId } from '@/lib/sso';

/**
 * Responses already used to sign in, by hash. An assertion stays valid for its NotOnOrAfter
 * window (typically five minutes, plus our 60 s clock skew), and within it the same POSTed
 * response would otherwise sign in again. Kept for 15 minutes, in this process — the web app
 * runs as one, and a restart only reopens the window for responses already in flight.
 */
const usedResponses = new Map<string, number>();
const USED_TTL_MS = 15 * 60_000;

function seenBefore(samlResponse: string): boolean {
  const now = Date.now();
  if (usedResponses.size > 10_000) {
    usedResponses.forEach((until, k) => { if (until < now) usedResponses.delete(k); });
  }
  const key = createHash('sha256').update(samlResponse).digest('hex');
  const until = usedResponses.get(key);
  if (until !== undefined && until > now) return true;
  usedResponses.set(key, now + USED_TTL_MS);
  return false;
}

function samlFor(conn: SsoConnection): SAML {
  if (!conn.sso_url || !conn.idp_cert) {
    throw new Error('SAML connection is missing its sign-on URL or certificate');
  }
  return new SAML({
    entryPoint: conn.sso_url,
    issuer: samlEntityId(),
    callbackUrl: samlAcsUrl(),
    idpCert: conn.idp_cert,
    audience: samlEntityId(),
    wantAssertionsSigned: true,
    // We do not sign our own AuthnRequests: that requires an SP key pair, and
    // every IdP we target accepts unsigned requests over TLS. Assertion
    // signatures — the direction that actually carries the claim — are required.
    wantAuthnResponseSigned: false,
    acceptedClockSkewMs: 60_000,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    disableRequestedAuthnContext: true,
  });
}

/** The IdP URL to send the browser to, carrying our signed RelayState. */
export async function buildSamlRedirect(conn: SsoConnection, relayState: string): Promise<string> {
  return samlFor(conn).getAuthorizeUrlAsync(relayState, undefined, {});
}

/**
 * Validate a POSTed SAMLResponse and extract the subject.
 *
 * Different identity providers put the address in different places, so several
 * common claim URIs are checked — but only after the signature has been
 * verified, never before.
 */
export async function completeSaml(
  conn: SsoConnection, samlResponse: string
): Promise<{ email: string; name: string | null }> {
  const { profile } = await samlFor(conn).validatePostResponseAsync({ SAMLResponse: samlResponse });
  if (!profile) throw new Error('SAML response carried no profile');
  // Only after the signature checked out: a response that has already signed someone in
  // is refused, so one copied from a browser or a log cannot be posted again.
  if (seenBefore(samlResponse)) throw new Error('SAML response was already used');

  const p = profile as Record<string, unknown>;
  const raw =
    p.email ??
    p.nameID ??
    p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ??
    p['urn:oid:0.9.2342.19200300.100.1.3'];

  const email = String(raw ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('SAML response carried no email address');

  const name =
    (p.displayName as string) ??
    (p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string) ??
    [p.firstName, p.lastName].filter(Boolean).join(' ').trim() ??
    null;

  return { email, name: name || null };
}
