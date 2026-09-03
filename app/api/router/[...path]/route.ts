import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// Use internal backend URL for server-side requests
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * This route is the ONLY authenticated way into the /router/* API.
 *
 * The user id is taken from the NextAuth session here, server-side, and vouched
 * for to the API with ROUTER_INTERNAL_TOKEN. The API refuses any x-user-id that
 * does not arrive with that token, so a browser cannot claim to be another user.
 *
 * nginx must NOT have an /api/router/ location — if it proxies straight to
 * port 4000 it bypasses this route, and the API sees a browser-supplied
 * x-user-id with no token and rejects it.
 */
async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'User authentication required' },
      { status: 401 }
    );
  }

  const internalToken = process.env.ROUTER_INTERNAL_TOKEN;
  if (!internalToken) {
    console.error('[API Proxy] ROUTER_INTERNAL_TOKEN is not set');
    return NextResponse.json(
      { error: 'Service misconfigured', message: 'Router API is unavailable' },
      { status: 503 }
    );
  }

  try {
    const url = new URL(request.url);
    const backendUrl = `${API_URL}/router/${path.join('/')}${url.search}`;

    console.log('[API Proxy] Request:', {
      method,
      backendUrl,
      userId: session.user.id,
      path: path.join('/')
    });

    const headers: Record<string, string> = {
      'x-user-id': session.user.id,
      'x-internal-token': internalToken,
    };

    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(await request.json());
      }
    }

    const response = await fetch(backendUrl, {
      method,
      headers,
      body,
    });

    console.log('[API Proxy] Response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    const contentType = response.headers.get('content-type');

    // Pass non-JSON bodies straight through — the CSV activity export at
    // /router/monitoring/export/activity is one, and turning it into a 502 here
    // would break the download.
    if (!contentType || !contentType.includes('application/json')) {
      const passthroughHeaders = new Headers();
      if (contentType) passthroughHeaders.set('content-type', contentType);
      const disposition = response.headers.get('content-disposition');
      if (disposition) passthroughHeaders.set('content-disposition', disposition);

      return new NextResponse(await response.arrayBuffer(), {
        status: response.status,
        headers: passthroughHeaders,
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    console.error('[API Proxy] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Failed to proxy request',
        details: 'Check server logs for more information'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PATCH');
}
