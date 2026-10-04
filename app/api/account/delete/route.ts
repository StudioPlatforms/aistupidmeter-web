import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findUserById } from '@/lib/db-client';
import { verifyPassword } from '@/lib/password';
import { sendAccountDeletedEmail } from '@/lib/email-service';
import { clientIp, limited } from '@/lib/ip-rate-limit';
import { deletionBlockers, deletedUserPlaceholderId, deleteIdentityAccount } from '@/lib/account-deletion';

/**
 * Delete the signed-in account (Settings → Delete account).
 *
 * GET says what deleting would need: any blockers (a subscription that will renew, a
 * team workspace with other members) and whether a password is asked for.
 *
 * POST deletes, in this order, and stops at the first failure:
 *   1. the person types their account email; password accounts also give the password
 *   2. the API erases the Smart Router and Data API records in the benchmark database
 *      (POST /api/account-purge) — if that fails nothing has been deleted yet
 *   3. the identity database deletes the account (lib/account-deletion.ts)
 *   4. a confirmation email goes to the address
 * The session dies on the next request: auth.ts drops tokens whose user no longer exists.
 */
export const dynamic = 'force-dynamic';

async function signedInUser() {
  const session = await auth();
  const id = Number((session?.user as any)?.id);
  if (!session?.user || !Number.isInteger(id)) return null;
  return findUserById(id);
}

export async function GET() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
  return NextResponse.json({
    success: true,
    email: user.email,
    needsPassword: !!user.password_hash,
    blockers: deletionBlockers(user),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: NextRequest) {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });

  // Password guesses against a signed-in session are still guesses.
  if (limited(`delete-account:${user.id}`, 5, 15 * 60_000) || limited(`delete-account-ip:${clientIp(request)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  let body: any = {};
  try { body = await request.json(); } catch { /* handled below */ }
  const confirmEmail = String(body?.confirmEmail ?? '').trim().toLowerCase();
  if (confirmEmail !== user.email.trim().toLowerCase()) {
    return NextResponse.json({ success: false, error: 'Type your account email exactly to confirm.' }, { status: 400 });
  }
  if (user.password_hash) {
    const ok = await verifyPassword(String(body?.password ?? ''), user.password_hash);
    if (!ok) return NextResponse.json({ success: false, error: 'That password is not correct.' }, { status: 403 });
  }

  const blockers = deletionBlockers(user);
  if (blockers.length) {
    return NextResponse.json({ success: false, error: blockers[0].message, blockers }, { status: 409 });
  }

  const token = process.env.PRO_API_TOKEN;
  if (!token) {
    console.error('[account/delete] PRO_API_TOKEN is not configured');
    return NextResponse.json({ success: false, error: 'Account deletion is unavailable right now. Please contact us.' }, { status: 503 });
  }

  const placeholderId = deletedUserPlaceholderId();
  const apiBase = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const r = await fetch(`${apiBase}/api/account-purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pro-token': token },
      body: JSON.stringify({ userId: user.id, placeholderId }),
      cache: 'no-store',
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) throw new Error(j?.error || `purge returned ${r.status}`);
    console.log(`[account/delete] user ${user.id}: benchmark database purged`, j.counts);
  } catch (err) {
    console.error(`[account/delete] user ${user.id}: purge failed, nothing deleted:`, err);
    return NextResponse.json({ success: false, error: 'We could not delete your account just now. Nothing was deleted; please try again in a few minutes.' }, { status: 502 });
  }

  try {
    const counts = deleteIdentityAccount(user.id, placeholderId);
    console.log(`[account/delete] user ${user.id}: identity database deleted`, counts);
  } catch (err) {
    console.error(`[account/delete] user ${user.id}: identity delete failed after purge:`, err);
    return NextResponse.json({ success: false, error: 'Part of your data was deleted but your account was not. Please try again, or contact us.' }, { status: 500 });
  }

  void sendAccountDeletedEmail(user.email).catch(() => {});
  return NextResponse.json({ success: true });
}
