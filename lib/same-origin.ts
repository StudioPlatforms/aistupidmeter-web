import type { NextRequest } from 'next/server';

/**
 * Whether a state-changing request came from our own pages: its Origin header must be the
 * origin of NEXT_PUBLIC_APP_URL (https://aistupidlevel.info). Browsers send Origin on every
 * cross-origin request and on same-origin POSTs, so a form or script on another site is refused
 * even if the session cookie went with it. No Origin, or no configured app URL, is refused too:
 * the only callers are the billing page's own fetches.
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !app) return false;
  try {
    return origin === new URL(app).origin;
  } catch {
    return false;
  }
}
