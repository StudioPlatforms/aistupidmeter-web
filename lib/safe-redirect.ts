import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Redirect to a path on this same site, from middleware or a route handler.
 *
 * WHY THIS EXISTS
 * ---------------
 * The obvious spelling is wrong behind a reverse proxy:
 *
 *     NextResponse.redirect(new URL('/auth/signin', request.url))
 *
 * `request.url` is the URL Next.js was reached on *internally*, which here is
 * http://localhost:3000/... because nginx proxies to that port. It is not the
 * address the browser used, even though nginx forwards `Host` correctly. So the
 * line above emitted an absolute Location pointing at localhost, and a
 * signed-out visitor clicking "Pro" was sent to
 * https://localhost:3000/auth/signin - a dead link on every machine except this
 * server. (`https`, despite the internal origin being `http`, because nginx
 * rewrites the scheme of proxied Location headers on the way out.)
 *
 * A site-relative Location would sidestep the question entirely and is valid per
 * RFC 7231 §7.1.2, but it cannot be used here: Next.js parses the Location
 * header of a middleware response with `new URL()` and throws ERR_INVALID_URL on
 * anything relative. The Location must be absolute, so the public origin has to
 * be reconstructed.
 *
 * ORIGIN PRECEDENCE
 * -----------------
 * The configured origin wins over the request's `Host` header. Deriving a
 * redirect target from a client-supplied header is the host-header injection
 * pattern: an attacker who can set `Host` chooses where our redirect points, and
 * a sign-in page on a look-alike domain is a ready-made phishing page.
 * NEXT_PUBLIC_APP_URL is inlined at build time, so it is available in the Edge
 * middleware bundle, and it is already the source of truth for the Stripe
 * success/cancel URLs. The header path remains only as a fallback for
 * deployments that have not set it.
 */
export function siteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }

  // Last resort. Correct when running without a proxy, wrong behind one - which
  // is exactly the bug above, so it is only reached when nothing better exists.
  return request.nextUrl.origin;
}

/**
 * @param path Absolute path on this site, e.g. `/auth/signin`. Must start with a
 *             single `/` - a value beginning `//` parses as a protocol-relative
 *             URL and would redirect off-site.
 */
export function redirectToPath(
  request: NextRequest,
  path: string,
  status: 307 | 308 = 307,
): NextResponse {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`redirectToPath expects a site-relative path, received: ${path}`);
  }
  return NextResponse.redirect(new URL(path, siteOrigin(request)), status);
}

/**
 * Build the sign-in path, preserving where the visitor was trying to go.
 *
 * Note that most sign-in routes currently ignore this and land on /router
 * regardless (SignInForm hard-codes it, and the auth.config.ts redirect callback
 * returns `${baseUrl}/router`). It is still passed through because the sign-in
 * page reads it for visitors who turn out to be authenticated already.
 */
export function signInPath(callbackUrl: string): string {
  return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
