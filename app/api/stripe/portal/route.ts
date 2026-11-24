import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Stripe from 'stripe';
import { findUserById } from '@/lib/db-client';
import { hasCancelButton } from '@/lib/stay-offer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

/**
 * Manage billing (GET): opens the Stripe portal for the signed-in account (its payment method,
 * invoices and billing details) and redirects there.
 *
 * Cancelling has its own button on the billing page, which opens Stripe's cancel page with the
 * stay offer (app/api/stripe/cancel, lib/stay-offer.ts). While the page shows that button it asks
 * for the portal without a cancel of its own (?without=cancel), so cancelling starts in one place
 * and the offer is not missed by taking the other door. That portal is a second portal
 * configuration in Stripe, named by STRIPE_PORTAL_WITHOUT_CANCEL.
 *
 * It is used only while the account still has the button: a subscription already set to end
 * needs the whole portal, where it can be resumed. Without the request, without the setting, or
 * when Stripe will not open the portal that way, the whole portal opens as it always did: the way
 * to the portal never depends on this.
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    
    console.log('[Portal] Session:', session?.user);
    
    if (!session?.user?.id) {
      console.error('[Portal] No user ID in session');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/auth/signin`);
    }

    // Get user from database to access Stripe customer ID
    const user = findUserById(parseInt(session.user.id));
    
    console.log('[Portal] User from DB:', user ? { id: user.id, email: user.email, stripe_customer_id: user.stripe_customer_id } : 'null');
    
    if (!user) {
      console.error('[Portal] User not found in database');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account/billing?error=user_not_found`);
    }
    
    if (!user.stripe_customer_id) {
      console.error('[Portal] User has no Stripe customer ID');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account/billing?error=no_subscription`);
    }

    console.log('[Portal] Creating portal session for customer:', user.stripe_customer_id);

    // Create Stripe billing portal session
    const customer = user.stripe_customer_id;
    const withoutCancel = request.nextUrl.searchParams.get('without') === 'cancel' && hasCancelButton(user)
      ? process.env.STRIPE_PORTAL_WITHOUT_CANCEL || null
      : null;
    const open = (configuration: string | null) => stripe.billingPortal.sessions.create({
      customer,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`,
      ...(configuration ? { configuration } : {}),
    });
    let portalSession: Stripe.BillingPortal.Session;
    try {
      portalSession = await open(withoutCancel);
    } catch (err) {
      if (!withoutCancel) throw err;
      console.warn(`[Portal] the portal would not open without its own cancel for user ${user.id}; opening the whole portal:`, err instanceof Error ? err.message : err);
      portalSession = await open(null);
    }

    console.log('[Portal] Portal session created, redirecting to:', portalSession.url);

    // Redirect to Stripe portal
    return NextResponse.redirect(portalSession.url);

  } catch (error: any) {
    console.error('[Portal] Error:', error);
    console.error('[Portal] Error stack:', error.stack);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account/billing?error=portal_failed&message=${encodeURIComponent(error.message || 'Unknown error')}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database to access Stripe customer ID
    const user = findUserById(parseInt(session.user.id));
    
    if (!user || !user.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Create Stripe billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/router/billing`,
    });

    return NextResponse.json({ 
      url: portalSession.url 
    });

  } catch (error: any) {
    console.error('Stripe portal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
