import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findUserById } from '@/lib/db-client';
import { verifyPassword } from '@/lib/password';
import { sendAccountDeletedEmail } from '@/lib/email-service';
import { clientIp, limited } from '@/lib/ip-rate-limit';
import {
  deletionBlockers, deletedUserPlaceholderId, deleteIdentityAccount, ownedWorkspaceIds, ProviderOwnerError,
  type DeletionBlocker,
} from '@/lib/account-deletion';
import { END_COMMENT, endCustomerBilling } from '@/lib/billing-end';
import { recordNotice } from '@/lib/billing-notices';
import { readProviderSummary } from '@/lib/provider-membership';

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

/**
 * A provider blocker sends its owner to /account/provider to close the account or transfer it.
 * When the API no longer lets this account in there (its access was switched off), that page is a
 * 404 for them, so the blocker points to us instead. Asked only of provider owners.
 */
async function reachableBlockers(userId: number, blockers: DeletionBlocker[]): Promise<DeletionBlocker[]> {
  if (!blockers.some(b => b.code === 'provider')) return blockers;
  const { status } = await readProviderSummary(userId, 1500);
  if (status === 200) return blockers;
  return blockers.map(b => (b.code === 'provider'
    ? { ...b, message: `${b.message} Contact us and we will do it with you.`, href: '/contact?topic=support' }
    : b));
}

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
    blockers: await reachableBlockers(user.id, deletionBlockers(user)),
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

  const found = deletionBlockers(user);
  if (found.length) {
    const blockers = await reachableBlockers(user.id, found);
    return NextResponse.json({ success: false, error: blockers[0].message, blockers }, { status: 409 });
  }

  const token = process.env.PRO_API_TOKEN;
  if (!token) {
    console.error('[account/delete] PRO_API_TOKEN is not configured');
    return NextResponse.json({ success: false, error: 'Account deletion is unavailable right now. Please contact us.' }, { status: 503 });
  }

  // Nothing may be collected for an account that is gone, so its billing ends first: every
  // subscription it still has is cancelled now, its open invoices are voided and the saved
  // payment methods removed (lib/billing-end.ts). A subscription the customer had cancelled can
  // still have an unpaid invoice that Stripe is retrying. If Stripe cannot be reached or is too
  // slow, the deletion is refused with nothing deleted: an account must not go while something
  // of it can still be charged. Trying again is safe.
  let billing: Awaited<ReturnType<typeof endCustomerBilling>> | null = null;
  if (user.stripe_customer_id) {
    try {
      billing = await Promise.race([
        endCustomerBilling(user.stripe_customer_id, END_COMMENT.account_deleted),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Stripe did not answer in time')), 25_000)),
      ]);
      console.log(`[account/delete] user ${user.id}: billing ended (${billing.subscriptions.length} subscription(s), ${billing.voided.length} invoice(s) voided, ${billing.paymentMethodsRemoved} payment method(s) removed)`);
    } catch (err) {
      console.error(`[account/delete] user ${user.id}: billing could not be ended, nothing deleted:`, err instanceof Error ? err.message : err);
      return NextResponse.json({ success: false, error: 'We could not delete your account just now. Nothing was deleted; please try again in a few minutes.' }, { status: 502 });
    }
  }

  // What a later failure must add to its message: the billing above has ended whatever follows.
  const billingNote = billing && (billing.subscriptions.length || billing.paymentMethodsRemoved)
    ? ' Your subscription has been ended and your saved payment method removed.' : '';

  const placeholderId = deletedUserPlaceholderId();
  const apiBase = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const r = await fetch(`${apiBase}/api/account-purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pro-token': token },
      body: JSON.stringify({ userId: user.id, placeholderId, ...(() => {
        const w = ownedWorkspaceIds(user.id);
        return { ownedOrgIds: w.orgIds, ownedProjectIds: w.projectIds };
      })() }),
      cache: 'no-store',
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) throw new Error(j?.error || `purge returned ${r.status}`);
    console.log(`[account/delete] user ${user.id}: benchmark database purged`, j.counts);
  } catch (err) {
    console.error(`[account/delete] user ${user.id}: purge failed, nothing deleted:`, err);
    return NextResponse.json({ success: false, error: `We could not delete your account just now. None of your data was deleted; please try again in a few minutes.${billingNote}` }, { status: 502 });
  }

  try {
    const counts = deleteIdentityAccount(user.id, placeholderId);
    console.log(`[account/delete] user ${user.id}: identity database deleted`, counts);
  } catch (err) {
    // Ownership of a provider account arrived while the purge ran (a transfer accepted in another
    // tab): the identity transaction refused, so the account and its provider memberships are
    // intact, but the Smart Router and Data API records are already gone. Say exactly that.
    if (err instanceof ProviderOwnerError) {
      console.warn(`[account/delete] user ${user.id}: refused after purge, now owns a provider account`);
      return NextResponse.json({
        success: false,
        error: `${err.message} Your account was not deleted, but its Smart Router and Data API records already were.`,
      }, { status: 409 });
    }
    console.error(`[account/delete] user ${user.id}: identity delete failed after purge:`, err);
    return NextResponse.json({ success: false, error: 'Part of your data was deleted but your account was not. Please try again, or contact us.' }, { status: 500 });
  }

  // The record of the deletion, kept with no account: the billing watch ends a subscription
  // for a deleted account only on it (a missing row alone ends nothing).
  try {
    recordNotice(null, 'account_deleted', `user:${user.id}`, `Account ${user.id} deleted by its owner`);
    for (const id of billing?.subscriptions ?? []) {
      recordNotice(null, 'ended_no_account', id, `Account ${user.id} was deleted: ${id} cancelled, its open invoices voided, the saved payment methods removed`);
    }
  } catch (err) {
    // The account is deleted and its billing ended; only this record is missing.
    console.error(`[account/delete] user ${user.id}: deleted, but its deletion record was not written:`, err instanceof Error ? err.message : err);
  }

  void sendAccountDeletedEmail(user.email).catch(() => {});
  return NextResponse.json({ success: true });
}
