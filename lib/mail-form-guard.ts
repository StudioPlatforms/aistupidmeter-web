import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/ip-rate-limit';

/**
 * Who may use the public forms that email an address typed into them: sign-up, resending a
 * confirmation link and password reset.
 *
 * From 15 October 2026 a script used the sign-up form to mail strangers ("subscription bombing":
 * signing someone's address up on many sites at once to bury their inbox). Every request came
 * through a Tor exit with a User-Agent wrapped in quote marks, which no browser sends, and none
 * of the genuine sign-ups in the same logs came through Tor. Mail nobody asked for gets marked
 * as spam, and that costs the reputation our users' confirmation links depend on. Google and
 * GitHub sign-in stay open from anywhere: they never email an address we were merely told.
 */
const EXIT_LIST = 'https://check.torproject.org/torbulkexitlist';
const FRESH_MS = 60 * 60_000;   // the list is regenerated about hourly
const RETRY_MS = 5 * 60_000;

let exits = new Set<string>();
let fetchedAt = 0;
let triedAt = 0;

async function refresh(): Promise<void> {
  try {
    const res = await fetch(EXIT_LIST, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ips = (await res.text()).split('\n').map(s => s.trim()).filter(s => /^[0-9a-f.:]+$/i.test(s));
    // A short answer is an error page or a cut-off download, not the list: keep the last one.
    if (ips.length < 200) throw new Error(`only ${ips.length} addresses`);
    exits = new Set(ips);
    fetchedAt = Date.now();
  } catch (err) {
    console.warn(`[mail-form-guard] Tor exit list not refreshed (keeping ${exits.size}):`, (err as Error).message);
  }
}

/** True when `ip` is a current Tor exit. Fails open: until a list has loaded, nobody is refused. */
async function isTorExit(ip: string): Promise<boolean> {
  const now = Date.now();
  if (now - fetchedAt > FRESH_MS && now - triedAt > RETRY_MS) {
    triedAt = now;
    const loading = refresh();
    // Only the first request after a restart waits for the list, and never for long.
    if (!exits.size) await Promise.race([loading, new Promise(r => setTimeout(r, 3_000))]);
  }
  return exits.has(ip);
}

const REFUSED = 'We can’t accept this from your network. Please try another connection, or continue with Google or GitHub.';

/** A 403 for a request these forms will not serve, or null to carry on. Call it before anything else. */
export async function refuseMailForm(request: NextRequest, form: string): Promise<NextResponse | null> {
  const ip = clientIp(request);
  const agent = request.headers.get('user-agent');
  const why = !agent || agent.includes('"') ? 'scripted user agent' : (await isTorExit(ip)) ? 'Tor exit' : null;
  if (!why) return null;
  console.warn(`[mail-form-guard] refused ${form} from ${ip}: ${why}`);
  return NextResponse.json({ success: false, error: REFUSED, message: REFUSED }, { status: 403 });
}
