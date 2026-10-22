import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { searchAccounts } from '@/lib/admin-overview';

// Per-request: the answer depends on who is signed in, and must never be prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/accounts?q= — the admin page's account lookup: accounts whose email or name
 * contains the text, or whose id it is, newest first (25 at most). Admin session only.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 200);
  if (q.trim().length < 2) return NextResponse.json({ success: true, data: [] }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    return NextResponse.json({ success: true, data: searchAccounts(q) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[admin] account search failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
