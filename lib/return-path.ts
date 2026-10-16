/**
 * Where to send someone after they sign up, confirm their email or sign in: the page (or checkout)
 * they were on when we asked them to make an account.
 *
 * Only a same-site path is honoured. "//host" and "/\host" are other origins to a browser, and a
 * browser strips tabs and newlines from URLs, so "/\t/host" becomes "//host" — any whitespace,
 * control character or backslash rejects the value. Anything else falls back to the home page.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw || raw.length > 512 || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return /[\\\s\x00-\x1f\x7f]/.test(raw) ? '/' : raw;
}

/** The email-confirmation link, carrying the return path along (`next`) when there is one. */
export function verificationLink(base: string, token: string, returnTo?: string | null): string {
  const next = safeReturnPath(returnTo);
  return `${base}/api/auth/verify?token=${token}${next === '/' ? '' : `&next=${encodeURIComponent(next)}`}`;
}

/** A sign-in or sign-up page URL that brings the visitor back to `returnTo` afterwards. */
export function withReturn(page: '/auth/signin' | '/auth/signup', returnTo?: string | null): string {
  const next = safeReturnPath(returnTo);
  return next === '/' ? page : `${page}?callbackUrl=${encodeURIComponent(next)}`;
}
