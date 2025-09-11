import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Track page visits by making an async call to the API
  // Don't await this to avoid blocking the response
  trackVisit(request);
  
  return NextResponse.next();
}

async function trackVisit(request: NextRequest) {
  try {
    // Skip tracking for static assets, API routes, and admin pages
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Skip static assets and Next.js internals
    if (pathname.startsWith('/_next') || 
        pathname.startsWith('/static') ||
        pathname.includes('.') ||
        pathname.startsWith('/api/') ||
        pathname === '/favicon.ico') {
      return;
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
              request.headers.get('x-real-ip') || 
              request.ip || 
              'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || null;
    
    // Call API to record the visit
    const response = await fetch('http://localhost:4000/track-visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ip,
        userAgent,
        referer,
        path: pathname,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to track visit:', response.statusText);
    }
  } catch (error) {
    console.warn('Error tracking visit:', error);
    // Don't fail the request if tracking fails
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
