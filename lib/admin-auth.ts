import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireRole } from '@/lib/forum-auth';

/**
 * For admin-only API routes: the signed-in user must hold the admin role (the same roles the
 * forum administration uses, lib/forum-auth). Returns the user id, or the response to send.
 *
 * Until 2026-10-05 /api/admin/users answered anyone — user totals, paying users, sign-ups per
 * day — and the admin page's daily-stats button called the API's maintenance route straight
 * from the browser, so that route had to be public too.
 */
export async function requireAdminSession(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  try {
    requireRole(userId, 'admin');
  } catch {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }
  return { userId };
}
