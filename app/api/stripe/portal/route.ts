import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Stripe from 'stripe';
import { findUserById } from '@/lib/db-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

// Handle GET requests - create portal session and redirect
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
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/router/subscription?error=user_not_found`);
    }
    
    if (!user.stripe_customer_id) {
      console.error('[Portal] User has no Stripe customer ID');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/router/subscription?error=no_subscription`);
    }

    console.log('[Portal] Creating portal session for customer:', user.stripe_customer_id);

    // Create Stripe billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/router/subscription`,
    });

    console.log('[Portal] Portal session created, redirecting to:', portalSession.url);

    // Redirect to Stripe portal
    return NextResponse.redirect(portalSession.url);

  } catch (error: any) {
    console.error('[Portal] Error:', error);
    console.error('[Portal] Error stack:', error.stack);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/router/subscription?error=portal_failed&message=${encodeURIComponent(error.message || 'Unknown error')}`);
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
