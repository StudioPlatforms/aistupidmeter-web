import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findUserById } from '@/lib/db-client';
import { hasCancelButton } from '@/lib/stay-offer';

// Per account: never prerendered or cached.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Whether the billing page shows Cancel subscription (hasCancelButton, lib/stay-offer.ts): the
 * account has a subscription of its own that is not already set to end. Read from the account
 * alone (no call to Stripe), so it never holds the page up.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const cancellable = hasCancelButton(findUserById(Number(session.user.id)));
  return NextResponse.json({ success: true, data: { cancellable } }, { headers: NO_STORE });
}
