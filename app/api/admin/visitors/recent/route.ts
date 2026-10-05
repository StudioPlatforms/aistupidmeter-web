import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

// Per-request: the answer depends on who is signed in, and must never be prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/visitors/recent — the admin page's list of the last 100 visits (page, time,
 * referrer, city). The API route requires the internal token since 2026-10-05, when visits
 * started carrying a location; this route checks the admin session and calls it over loopback.
 */
export async function GET() {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  const token = process.env.ROUTER_INTERNAL_TOKEN;
  if (!token) return NextResponse.json({ error: 'Service misconfigured' }, { status: 503 });
  try {
    const r = await fetch(`${API_URL}/visitors/recent`, {
      headers: { 'x-internal-token': token },
      cache: 'no-store',
    });
    const body = await r.json().catch(() => ({}));
    return NextResponse.json(body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The API did not answer' }, { status: 502 });
  }
}
