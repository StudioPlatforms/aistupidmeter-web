import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { buildOverview } from '@/lib/admin-overview';

// Per-request: the answer depends on who is signed in, and must never be prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/overview — everything on the admin dashboard: accounts and plans, Stripe
 * revenue and billing problems, Smart Router and Data API usage per account, engagement.
 * Admin session only (lib/admin-auth); it also answers the page's "may I see this" check.
 * `?fresh=1` skips the five-minute Stripe cache (the page's Refresh button).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  try {
    const data = await buildOverview({ freshStripe: request.nextUrl.searchParams.get('fresh') === '1' });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[admin] overview failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Could not build the overview' }, { status: 500 });
  }
}
