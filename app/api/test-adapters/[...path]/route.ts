import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * Authenticated proxy for the adapter test-bench.
 *
 * These endpoints used to be called straight from the browser to the API
 * through nginx, and the API required no authentication for them — so anyone on
 * the internet could reach them. They spend the caller's own provider key rather
 * than ours, so the exposure was not billing: `findOrCreateModel` inserts into
 * the production `models` table from a request body.
 *
 * Same trust model as the account and router proxies: the user id is read from
 * the session here, server-side, and vouched for with ROUTER_INTERNAL_TOKEN.
 *
 * The caller's PROVIDER key travels in x-user-api-key and is forwarded
 * untouched — it belongs to them, we never store it, and it is what pays for
 * whatever the test runs.
 */
/**
 * Paths that are deliberately public.
 *
 * The community aggregate renders on the PUBLIC model detail pages, so requiring a session
 * for it would silently blank the panel for every signed-out visitor. It is anonymous
 * aggregate data — counts, median, range — with no key, no user and no prompt in it.
 * Everything else here spends or reveals something and stays behind the session.
 */
const PUBLIC_PREFIXES = ['community'];

async function proxy(request: NextRequest, path: string[], method: string) {
  const isPublic = method === 'GET' && PUBLIC_PREFIXES.includes(path[0]);

  const session = await auth();
  if (!isPublic && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const internalToken = process.env.ROUTER_INTERNAL_TOKEN;
  if (!internalToken) {
    console.error('[Test-Adapters Proxy] ROUTER_INTERNAL_TOKEN is not set');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const backendUrl = `${API_URL}/test-adapters/${path.join('/')}${url.search}`;

    const headers: Record<string, string> = { 'x-internal-token': internalToken };
    if (session?.user?.id) headers['x-user-id'] = session.user.id;
    const providerKey = request.headers.get('x-user-api-key');
    if (providerKey) headers['x-user-api-key'] = providerKey;

    let body: string | undefined;
    if (method !== 'GET') {
      const text = await request.text();
      if (text) {
        body = text;
        headers['Content-Type'] = 'application/json';
      }
    }

    const res = await fetch(backendUrl, { method, headers, body, cache: 'no-store' });
    const payload = await res.json().catch(() => ({ error: 'Bad gateway response' }));
    return NextResponse.json(payload, { status: res.status });
  } catch (error) {
    console.error('[Test-Adapters Proxy] failed:', error);
    return NextResponse.json({ error: 'Upstream request failed' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, 'GET');
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, 'POST');
}
