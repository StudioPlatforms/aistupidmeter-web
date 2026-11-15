/**
 * Next's instrumentation hook: runs once when the server starts, before any page or route is loaded, and so
 * before Next patches fetch for its cache. The Node server's fetch then retries a refused GET or HEAD to the
 * API once (lib/api-retry.ts), which is what an API restart looks like from here.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { installApiRetry } = await import('./lib/api-retry');
  installApiRetry();
}
