/**
 * One retry for this server's own GET and HEAD reads of the API when the connection is refused.
 *
 * Each API restart (a deploy, a crash restart) leaves the API's port closed for about a second. A
 * server-side read that landed in that window failed with ECONNREFUSED and was logged: by our own call
 * sites, and by Next's background revalidation of a cached fetch (`pendingRevalidate.catch(console.error)`
 * in Next's patch-fetch, which no call site can catch). installApiRetry() wraps the process's fetch once,
 * from instrumentation.ts, before Next patches fetch for its cache, so every server-side read of the API
 * and every revalidation of one gets the same rule:
 *
 * - only requests to the API's own origin (API_INTERNAL_URL, else http://127.0.0.1:4000);
 * - only GET and HEAD: a POST, PUT, PATCH or DELETE is never sent twice;
 * - only a refused connection, where nothing reached the API: a timeout, a reset or an HTTP error status
 *   is returned or thrown exactly as before;
 * - once, after RETRY_DELAY_MS, and not at all once the caller's signal has fired, so the caller's own
 *   timeout still bounds the whole call.
 *
 * The web app does not know the API's read replica, so there is no fallback to it here.
 */

type Fetch = typeof fetch;

export const RETRY_DELAY_MS = 300;
const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const INSTALLED = Symbol.for('asl.api-retry');

/** A refused connection, as Node's fetch reports it: TypeError "fetch failed" with cause.code ECONNREFUSED. */
export function isConnRefused(err: unknown): boolean {
  const cause = (err as { cause?: { code?: unknown; errors?: unknown } } | null)?.cause;
  if (!cause) return false;
  if (cause.code === 'ECONNREFUSED') return true;
  // A host name with several addresses (localhost: ::1, then 127.0.0.1) fails with every refusal at once.
  return Array.isArray(cause.errors) && cause.errors.length > 0
    && cause.errors.every((e) => (e as { code?: unknown } | null)?.code === 'ECONNREFUSED');
}

const isRequest = (input: unknown): input is Request => typeof Request !== 'undefined' && input instanceof Request;

function originOf(input: RequestInfo | URL): string | null {
  try {
    return new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).origin;
  } catch {
    return null;
  }
}

/** Resolves after `ms`, or as soon as the signal fires. */
function pause(ms: number, signal: AbortSignal | null | undefined): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** `base`, with one retry of a refused GET or HEAD to one of `origins` (see above). */
export function withApiRetry(base: Fetch, origins: string[], delayMs = RETRY_DELAY_MS): Fetch {
  const allowed = new Set(origins.map((o) => originOf(o)).filter((o): o is string => o !== null));
  return async function apiRetryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      return await base(input, init);
    } catch (err) {
      const method = (init?.method ?? (isRequest(input) ? input.method : 'GET')).toUpperCase();
      if ((method !== 'GET' && method !== 'HEAD') || !isConnRefused(err)) throw err;
      const origin = originOf(input);
      if (!origin || !allowed.has(origin)) throw err;
      const signal = init?.signal ?? (isRequest(input) ? input.signal : undefined);
      if (signal?.aborted) throw err;
      await pause(delayMs, signal);
      if (signal?.aborted) throw err;
      return base(input, init);
    }
  };
}

/** Wraps globalThis.fetch once per process (Node server only; called by instrumentation.ts). */
export function installApiRetry(): void {
  const g = globalThis as typeof globalThis & { [INSTALLED]?: true };
  if (g[INSTALLED]) return;
  g[INSTALLED] = true;
  globalThis.fetch = withApiRetry(globalThis.fetch, [API_URL]);
}
