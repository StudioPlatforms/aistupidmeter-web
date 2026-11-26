import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { buildSnapshot } from '@/components/seo/rankings/rankings-data';
import { isMonth, monthEndedBefore, monthPath, readMonth, writeMonth } from '@/lib/rankings-archive';
import { getBoards } from '@/lib/seo-data';

// Never prerendered or cached: every call reads the boards as they stand.
export const dynamic = 'force-dynamic';

function tokenOk(given: string | null): boolean {
  const want = process.env.ROUTER_INTERNAL_TOKEN;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A record of month M may be written on the first two days after M ends (UTC), so it is the month's last 30 days. */
const FREEZE_DAYS = 2;

/**
 * POST /api/internal/rankings-freeze?month=YYYY-MM — writes the month's record of the rankings archive
 * (lib/rankings-archive.ts) from the 30-day boards as they stand, once. Called over loopback with the
 * internal token by the monthly job; a request that came through nginx (which always sets X-Real-IP) is
 * refused even with the token, as the other /api/internal routes do. `?dry=1` returns the record
 * without writing it, at any time.
 *
 * Answers: 200 written | 200 dry | 409 the month already has a record (never replaced) | 409 outside the
 * two days after the month ended | 400 a month that is not YYYY-MM | 503 the boards are not answering.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get('x-real-ip') || !tokenOk(request.headers.get('x-internal-token'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const q = request.nextUrl.searchParams;
  const now = new Date();
  const month = q.get('month') || monthEndedBefore(now);
  const dry = q.get('dry') === '1';
  const noStore = { headers: { 'Cache-Control': 'no-store' } };
  if (!isMonth(month)) return NextResponse.json({ success: false, error: 'invalid_month' }, { status: 400, ...noStore });

  if (!dry) {
    const [y, m] = month.split('-').map(Number);
    const opens = Date.UTC(y, m, 1); // the first instant after the month (m is 1-based, so this is the next month)
    const closes = opens + FREEZE_DAYS * 86_400_000;
    if (now.getTime() < opens || now.getTime() >= closes) {
      return NextResponse.json({ success: false, error: 'outside_freeze_days', month }, { status: 409, ...noStore });
    }
    if (readMonth(month)) return NextResponse.json({ success: false, error: 'already_frozen', month }, { status: 409, ...noStore });
  }

  const boards = await getBoards('1m');
  const snapshot = boards ? buildSnapshot(boards, month, now) : null;
  if (!snapshot) return NextResponse.json({ success: false, error: 'boards_unavailable' }, { status: 503, ...noStore });
  if (dry) return NextResponse.json({ success: true, dry: true, data: snapshot }, noStore);

  try {
    if (writeMonth(snapshot) === 'exists') {
      return NextResponse.json({ success: false, error: 'already_frozen', month }, { status: 409, ...noStore });
    }
  } catch (error) {
    console.error('[rankings-freeze] write failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'write_failed' }, { status: 500, ...noStore });
  }
  // The month's page, the index, the leaderboard's link to the archive and the sitemap all read the folder.
  for (const p of [monthPath(month), '/rankings', '/leaderboard', '/sitemap.xml']) revalidatePath(p);
  console.log(`[rankings-freeze] ${month} frozen at ${snapshot.frozenAt}`);
  return NextResponse.json({ success: true, data: { month, path: monthPath(month), frozenAt: snapshot.frozenAt } }, noStore);
}
