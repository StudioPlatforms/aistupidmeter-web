import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Simple cookie-based middleware for NextAuth v5
 * Edge Runtime compatible - no database access
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get NextAuth v5 (Auth.js) session token from cookies
  // Note: v5 renamed cookies from 'next-auth.*' to 'authjs.*'
  const sessionToken = request.cookies.get('authjs.session-token') || 
                       request.cookies.get('__Secure-authjs.session-token');
  
  const isLoggedIn = !!sessionToken;
  
  // Skip middleware for:
  // - API routes (handled by NextAuth)
  // - Static files
  // - Auth pages (let NextAuth handle)
  // - Home page
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/auth') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }
  
  // Protect /router routes - require authentication
  if (pathname.startsWith('/router') && !isLoggedIn) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
