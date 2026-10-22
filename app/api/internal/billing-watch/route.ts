import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runBillingWatch } from '@/lib/billing-watch';

// Never prerendered or cached: every call acts on live billing state.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function tokenOk(given: string | null): boolean {
  const want = process.env.ROUTER_INTERNAL_TOKEN;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/internal/billing-watch — runs lib/billing-watch.ts. Called every six hours by the
 * API worker over loopback with the internal token. A request that came through nginx (which
 * always sets X-Real-IP) is refused even with the token: this is not a public endpoint.
 * `?dry=1` describes what would be done without doing it.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('x-real-ip') || !tokenOk(request.headers.get('x-internal-token'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const report = await runBillingWatch({ dryRun: request.nextUrl.searchParams.get('dry') === '1' });
    const failed = report.actions.filter(a => !a.done && a.error);
    if (!report.dryRun && report.actions.length) {
      console.log(`[billing-watch] ${report.actions.filter(a => a.done).length} done, ${failed.length} failed: ` +
        report.actions.map(a => `${a.kind}${a.userId ? `#${a.userId}` : ''}${a.done ? '' : '(failed)'}`).join(', '));
    }
    return NextResponse.json({ success: true, data: report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[billing-watch] failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Billing watch failed' }, { status: 500 });
  }
}
