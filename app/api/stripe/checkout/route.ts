import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Stripe from 'stripe';
import { redirectToPath } from '@/lib/safe-redirect';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

// Handle GET requests - create checkout session and redirect
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    
    if (!session?.user?.id || !session?.user?.email) {
      // request.url carries the internal localhost origin behind nginx, so an
      // absolute URL built from it points nowhere the browser can reach.
      // See lib/safe-redirect.ts. Stripe's success/cancel URLs below must stay
      // absolute - Stripe resolves those from outside this site.
      return redirectToPath(request, '/auth/signin');
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/router?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      metadata: {
        userId: userId,
      },
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          userId: userId,
        },
      },
      allow_promotion_codes: true,
    });

    // Redirect to Stripe checkout
    return NextResponse.redirect(checkoutSession.url!);

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    // Redirect to home page with error (same origin problem as above)
    return redirectToPath(request, '/?error=checkout_failed');
  }
}

// Handle POST requests - return checkout session data
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!, // Price ID from Stripe dashboard
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/router?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        userId: userId, // Store our database user ID
      },
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
        metadata: {
          userId: userId, // Also store in subscription metadata
        },
      },
      allow_promotion_codes: true, // Allow discount codes
    });

    return NextResponse.json({ 
      sessionId: checkoutSession.id,
      url: checkoutSession.url 
    });

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
