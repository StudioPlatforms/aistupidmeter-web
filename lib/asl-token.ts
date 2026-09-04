/**
 * Attaches the site's short-lived origin token to its own data requests.
 *
 * Installed once, as a fetch wrapper, rather than threaded through the ~20
 * call sites that fetch benchmark data. Those call sites live in HomeClient,
 * ModelDetailClient and half a dozen components; editing each one would mean
 * every future fetch has to remember, and the one that forgets is the one that
 * breaks when enforcement is switched on.
 *
 * Scope is deliberately narrow: same-origin requests whose path starts with one
 * of GUARDED_PREFIXES. NextAuth, Stripe, the forum and every third-party call
 * are untouched.
 *
 * See apps/api/src/middleware/web-token.ts for what this is and is not worth.
 */

const GUARDED_PREFIXES = ['/dashboard/', '/api/dashboard/', '/api/drift/', '/visitors/stats'];

/** Refresh this long before expiry so a request never races the boundary. */
const REFRESH_MARGIN_MS = 60_000;

interface MintedToken {
  token: string | null;
  expires: number | null;
}

let inFlight: Promise<MintedToken> | null = null;
let current: MintedToken = { token: null, expires: null };
let installed = false;

function isFresh(t: MintedToken): boolean {
  return Boolean(t.token && t.expires && t.expires * 1000 - Date.now() > REFRESH_MARGIN_MS);
}

function mint(): Promise<MintedToken> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // Uses the untouched original fetch — going through the wrapper here
      // would be harmless (the path is not guarded) but the recursion is not
      // worth reasoning about later.
      const res = await originalFetch('/api/session-token', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return { token: null, expires: null };
      const data = await res.json();
      current = { token: data?.token ?? null, expires: data?.expires ?? null };
      return current;
    } catch {
      // A failed mint must never break the page. The API treats a missing
      // token as acceptable while the feature is in monitor mode.
      return { token: null, expires: null };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function tokenFor(): Promise<string | null> {
  if (isFresh(current)) return current.token;
  const minted = await mint();
  return minted.token;
}

function isGuarded(input: RequestInfo | URL): boolean {
  let path: string;
  try {
    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    // Relative URLs are same-origin by definition; absolute ones must match.
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    path = url.pathname;
  } catch {
    return false;
  }
  return GUARDED_PREFIXES.some((p) => path.startsWith(p));
}

let originalFetch: typeof fetch;

/**
 * Installs the wrapper. Called at module evaluation below rather than from a
 * useEffect: React runs child effects BEFORE parent effects, so installing from
 * Providers' effect let HomeClient's own effects fire their first data request
 * first — that request went out unwrapped. Module scope runs before any
 * component renders, which is the only ordering that covers the first paint.
 */
export function installAslToken() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  originalFetch = window.fetch.bind(window);

  // Warm the token immediately so the first data request rarely has to wait.
  void mint();

  window.fetch = async function aslFetch(input: RequestInfo | URL, init?: RequestInit) {
    if (!isGuarded(input)) return originalFetch(input, init);

    const token = await tokenFor();
    if (!token) return originalFetch(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('X-ASL-Token', token);

    return originalFetch(input, { ...init, headers });
  } as typeof fetch;
}

// Self-install on import. See the note on installAslToken above for why this is
// not done from a component effect.
if (typeof window !== 'undefined') {
  installAslToken();
}
