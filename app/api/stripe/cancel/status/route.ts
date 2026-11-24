import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findUserById } from '@/lib/db-client';

// Per account: never prerendered or cached.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Whether the billing page shows Cancel subscription: the account has a subscription of its own
 * that is not already set to end. Read from the account alone (no call to Stripe), so it never
 * holds the page up. A complimentary plan has no subscription to cancel, and one already
 * cancelled is managed from the portal (Manage billing), where it can be resumed.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const user = findUserById(Number(session.user.id));
  const cancellable = !!user && !!user.stripe_customer_id && !!user.stripe_subscription_id
    && user.subscription_tier !== 'free' && !user.subscription_canceled_at;
  return NextResponse.json({ success: true, data: { cancellable } }, { headers: NO_STORE });
}
