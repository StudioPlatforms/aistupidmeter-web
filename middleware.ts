import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { redirectToPath, signInPath } from '@/lib/safe-redirect';
import { SESSION_HINT_COOKIE } from '@/lib/session-hint';

/**
 * Simple cookie-based middleware for NextAuth v5
 * Edge Runtime compatible - no database access
 */
export function middleware(request: NextRequest) {
  // Get NextAuth v5 (Auth.js) session token from cookies
  // Note: v5 renamed cookies from 'next-auth.*' to 'authjs.*'
  const sessionToken = request.cookies.get('authjs.session-token') ||
                       request.cookies.get('__Secure-authjs.session-token');

  const isLoggedIn = !!sessionToken;
  return withSessionHint(request, route(request, isLoggedIn), isLoggedIn);
}

/**
 * The theme boot script must know before first paint whether this browser is signed in: signed
 * out, the site opens in Dark as the landing page does; signed in, in the app's Light default
 * (lib/theme-config.ts). The session cookie is httpOnly, so its presence is mirrored here in one
 * the page can read. Written only when that changes, so almost no response carries it.
 */
function withSessionHint(request: NextRequest, response: NextResponse, isLoggedIn: boolean): NextResponse {
  const hinted = request.cookies.get(SESSION_HINT_COOKIE)?.value === '1';
  if (isLoggedIn && !hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, '1', {
      path: '/',
      sameSite: 'lax',
      // nginx reaches Next.js over plain http, so the visitor's scheme is in the forwarded header.
      secure: request.headers.get('x-forwarded-proto') === 'https',
      maxAge: 30 * 86_400,
    });
  } else if (!isLoggedIn && hinted) {
    response.cookies.delete(SESSION_HINT_COOKIE);
  }
  return response;
}

function route(request: NextRequest, isLoggedIn: boolean): NextResponse {
  const { pathname } = request.nextUrl;

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
  
  // Allow unauthenticated access to forum (read-only)
  if (pathname.startsWith('/router/forum')) {
    return NextResponse.next();
  }

  // Documentation is a pre-purchase surface. Making a developer create an
  // account before they can read what the API does costs more integrations than
  // it protects, and none of this is secret — it describes a public interface.
  if (pathname === '/router/docs' || pathname === '/router/help') {
    return NextResponse.next();
  }

  // /router itself is the Smart Router's public landing page, and the per-tool
  // guides under /router/integrations are pre-purchase reading like the docs.
  // Redirecting a signed-out visitor here sent every crawler to sign-in, so the
  // router's only marketing URL was never indexed. app/router/page.tsx decides
  // what /router shows: the dashboard for a session, the landing without one.
  // Only the exact path is open; every other /router/* page is still an
  // account surface and keeps the redirect below.
  if (pathname === '/router' || pathname.startsWith('/router/integrations')) {
    return NextResponse.next();
  }

  // Protect /router routes - require authentication.
  //
  // The previous spelling, `new URL('/auth/signin', request.url)`, resolved
  // against the URL Next.js was reached on *internally* - http://localhost:3000,
  // because nginx proxies to that port - rather than the address the browser
  // used. Signed-out visitors clicking "Pro" were therefore sent to
  // https://localhost:3000/auth/signin, a dead link everywhere but this server.
  // See lib/safe-redirect.ts for why the origin is rebuilt from config.
  if (pathname.startsWith('/router') && !isLoggedIn) {
    return redirectToPath(request, signInPath(pathname));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
