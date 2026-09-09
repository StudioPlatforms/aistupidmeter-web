import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkSubscription } from '@/lib/db-client';
import { entitlementsFor, planFor } from '@/lib/entitlements';
import { findUserByEmail } from '@/lib/db-client';

/**
 * The caller's own subscription state.
 *
 * This used to take an arbitrary email in the POST body with no authentication,
 * so anyone could ask whether any address was a paying customer. It now answers
 * only for the signed-in session, and ignores any email the client sends.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const email = session.user.email;
    const subscriptionStatus = checkSubscription(email);
    const user = findUserByEmail(email);

    return NextResponse.json({
      success: true,
      data: {
        ...subscriptionStatus,
        plan: planFor(user as any),
        entitlements: entitlementsFor(user as any),
      },
    });
  } catch (error) {
    console.error('[Subscription Check] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}
