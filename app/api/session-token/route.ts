import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

/**
 * Mints the short-lived token the site's own data fetches carry.
 *
 * This is not a security boundary and is not sold as one — the page is public,
 * so the mint endpoint has to be reachable by anyone who can load the page.
 * What it does is make the website's traffic distinguishable from a bare
 * scraper, and give us a secret we can rotate to invalidate every copied token
 * at once. See apps/api/src/middleware/web-token.ts for the full reasoning.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fifteen minutes: long enough to outlive a page visit, short enough that a
 *  scraped token is not worth caching. */
const TTL_SECONDS = 15 * 60;

const ALLOWED_HOSTS = new Set([
  'aistupidlevel.info',
  'www.aistupidlevel.info',
  'localhost:3000',
  '127.0.0.1:3000',
]);

function hostAllowed(header: string | null): boolean | null {
  if (!header) return null; // absent — the caller decides what that means
  try {
    return ALLOWED_HOSTS.has(new URL(header).host);
  } catch {
    return false;
  }
}

function originAllowed(request: NextRequest): boolean {
  const origin = hostAllowed(request.headers.get('origin'));
  if (origin === false) return false;

  const referer = hostAllowed(request.headers.get('referer'));
  if (referer === false) return false;

  // Every browser shipped since ~2020 sends Sec-Fetch-Site on a fetch(), and a
  // page-initiated fetch to its own origin always sends 'same-origin'. Requiring
  // it costs real visitors nothing and makes a bare `curl /api/session-token`
  // fail, which is the cheapest bump available.
  //
  // 'none' means a direct navigation (someone opened the URL in a tab) — that
  // is not the site asking, so it does not get a token either.
  const site = request.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'same-site') return true;
  if (site) return false;

  // No Sec-Fetch-Site at all: an old browser, or a script that did not bother.
  // Accept it only when a Referer proves the request came from one of our pages.
  return referer === true;
}

export async function GET(request: NextRequest) {
  const secret = process.env.ASL_WEB_TOKEN_SECRET;

  // Unconfigured is not an error: the API treats a missing token as fine while
  // the feature is off, so returning null keeps the client code on one path.
  if (!secret) {
    return NextResponse.json({ token: null, expires: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!originAllowed(request)) {
    return NextResponse.json(
      {
        error: 'forbidden_origin',
        message:
          'Tokens are only issued to the aistupidlevel.info site. For programmatic access use the ' +
          'Data API at /api/v1 — a key is free.',
        docs: 'https://aistupidlevel.info/api-docs',
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const mac = createHmac('sha256', secret).update(String(exp)).digest('hex').slice(0, 32);

  return NextResponse.json(
    { token: `1.${exp}.${mac}`, expires: exp },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
