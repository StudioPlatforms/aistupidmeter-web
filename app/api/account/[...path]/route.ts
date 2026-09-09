import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * This route is the ONLY authenticated way into the /account/* API.
 *
 * Identical trust model to app/api/router/[...path]/route.ts: the user id is
 * read from the NextAuth session HERE, server-side, and vouched for to the API
 * with ROUTER_INTERNAL_TOKEN. The API refuses any x-user-id that arrives
 * without that token, so a browser cannot claim to be another user.
 *
 * ⚠️ nginx must NOT have an /api/account/ location. If it proxies straight to
 * port 4000 it bypasses this route, and the API then sees a browser-supplied
 * x-user-id with no internal token and rejects it — every request 401s.
 */
async function proxyRequest(request: NextRequest, path: string[], method: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Sign in to manage your watchlist' },
      { status: 401 }
    );
  }

  const internalToken = process.env.ROUTER_INTERNAL_TOKEN;
  if (!internalToken) {
    console.error('[Account Proxy] ROUTER_INTERNAL_TOKEN is not set');
    return NextResponse.json({ success: false, error: 'Service misconfigured' }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const backendUrl = `${API_URL}/account/${path.join('/')}${url.search}`;

    const headers: Record<string, string> = {
      'x-user-id': session.user.id,
      'x-internal-token': internalToken,
    };

    let body: string | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      const text = await request.text();
      if (text) {
        body = text;
        headers['Content-Type'] = 'application/json';
      }
    }

    const res = await fetch(backendUrl, { method, headers, body, cache: 'no-store' });
    const payload = await res.json().catch(() => ({ success: false, error: 'Bad gateway response' }));
    return NextResponse.json(payload, { status: res.status });
  } catch (error) {
    console.error('[Account Proxy] Request failed:', error);
    return NextResponse.json({ success: false, error: 'Upstream request failed' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'GET');
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'POST');
}
export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PUT');
}
export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PATCH');
}
export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'DELETE');
}
