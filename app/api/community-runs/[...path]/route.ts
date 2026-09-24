import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * Proxy for community-funded runs (API: src/routes/community-runs.ts).
 *
 * Same trust model as the test-adapters and router proxies: the user id is read from the
 * session HERE, server-side, and vouched for to the API with ROUTER_INTERNAL_TOKEN. The API
 * has no public nginx location, so this is the only way in.
 *
 * The sponsor's provider key travels in the x-user-api-key header and is forwarded untouched.
 * It is not logged here, not stored, and never put in a URL.
 */
const PUBLIC_GET = ['model'];   // the model page's slot status, shown to signed-out visitors too

async function proxy(request: NextRequest, path: string[], method: 'GET' | 'POST') {
  const isPublic = method === 'GET' && PUBLIC_GET.includes(path[0]);
  const session = await auth();
  if (!isPublic && !session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Please sign in first.' }, { status: 401 });
  }
  const internalToken = process.env.ROUTER_INTERNAL_TOKEN;
  if (!internalToken) {
    console.error('[Community-Runs Proxy] ROUTER_INTERNAL_TOKEN is not set');
    return NextResponse.json({ success: false, error: 'Service misconfigured' }, { status: 503 });
  }
  try {
    const url = new URL(request.url);
    const backendUrl = `${API_URL}/community-runs/${path.map(encodeURIComponent).join('/')}${url.search}`;
    const headers: Record<string, string> = { 'x-internal-token': internalToken };
    if (session?.user?.id) headers['x-user-id'] = String(session.user.id);
    const providerKey = request.headers.get('x-user-api-key');
    if (providerKey && method === 'POST') headers['x-user-api-key'] = providerKey;
    let body: string | undefined;
    if (method === 'POST') {
      const text = await request.text();
      if (text) {
        body = text;
        headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(backendUrl, { method, headers, body, cache: 'no-store' });
    const payload = await res.json().catch(() => ({ success: false, error: 'Bad gateway response' }));
    return NextResponse.json(payload, { status: res.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Deliberately no error object in the log: it could carry request details.
    console.error('[Community-Runs Proxy] upstream request failed');
    return NextResponse.json({ success: false, error: 'Upstream request failed' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, 'GET');
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, 'POST');
}
