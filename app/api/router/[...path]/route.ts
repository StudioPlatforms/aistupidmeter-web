import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// Use internal backend URL for server-side requests
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:4000';

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

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[API Proxy] Non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { 
          error: 'Backend Error', 
          message: 'Backend returned non-JSON response',
          details: `Status: ${response.status}, Content-Type: ${contentType}`
        },
        { status: 502 }
      );
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
