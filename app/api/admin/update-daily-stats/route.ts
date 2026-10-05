import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

/**
 * POST /api/admin/update-daily-stats — the admin page's "update daily stats" button. The API's
 * maintenance route requires the internal token since 2026-10-05; this route checks the admin
 * session and calls it over loopback with that token.
 */
export async function POST() {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
  try {
    const r = await fetch(`${API_URL}/visitors/update-daily-stats`, {
      method: 'POST',
      headers: { 'x-internal-token': token },
      cache: 'no-store',
    });
    const body = await r.json().catch(() => ({}));
    return NextResponse.json(body, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'The API did not answer' }, { status: 502 });
  }
}
