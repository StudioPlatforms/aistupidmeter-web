import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Stripe from 'stripe';
import { redirectToPath } from '@/lib/safe-redirect';
import { recordActivation } from '@/lib/activation';
import {
  isSellablePlan, isInterval, priceIdWithLegacyFallback,
  type SellablePlan, type Interval,
} from '@/lib/stripe-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

/**
 * Trial length comes from the Stripe Price, not from this file.
 *
 * `Price.recurring.trial_period_days` is set in the Stripe dashboard, so the
 * trial can be changed — or given a different length per plan — without a
 * deploy. We read it and pass it through explicitly rather than assuming
 * Checkout inherits it, which makes the behaviour identical either way.
 *
 * Cached briefly: checkout is not hot, but there is no reason to re-fetch the
 * same Price on every click.
 */
const trialCache = new Map<string, { days: number | null; at: number }>();
const TRIAL_TTL_MS = 5 * 60_000;

async function trialDaysFor(priceId: string): Promise<number | null> {
  const hit = trialCache.get(priceId);
  if (hit && Date.now() - hit.at < TRIAL_TTL_MS) return hit.days;
  try {
    const price = await stripe.prices.retrieve(priceId);
    const days = price.recurring?.trial_period_days ?? null;
    trialCache.set(priceId, { days, at: Date.now() });
    return days;
  } catch (err) {
    console.error('[Stripe checkout] could not read trial from price', priceId, err);
    return null; // No trial rather than a wrong one.
  }
}

function resolveSelection(searchParams: URLSearchParams, body?: Record<string, unknown>) {
  const rawPlan = body?.plan ?? searchParams.get('plan') ?? 'pro';
  const rawInterval = body?.interval ?? searchParams.get('interval') ?? 'monthly';
  if (!isSellablePlan(rawPlan)) return { error: `Unknown plan: ${String(rawPlan)}` } as const;
  if (!isInterval(rawInterval)) return { error: `Unknown interval: ${String(rawInterval)}` } as const;
  return { plan: rawPlan as SellablePlan, interval: rawInterval as Interval } as const;
}

async function buildSession(
  plan: SellablePlan, interval: Interval, userId: string, userEmail: string, cancelPath: string
) {
  const priceId = priceIdWithLegacyFallback(plan, interval);
  if (!priceId) {
    throw Object.assign(new Error(`No Stripe price configured for ${plan}/${interval}`), { code: 'unconfigured' });
  }

  const trialDays = await trialDaysFor(priceId);
  recordActivation(Number(userId), 'checkout_started', plan, { interval, trialDays });

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/router?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}${cancelPath}`,
    metadata: { userId, plan, interval },
    subscription_data: {
      // Only send a trial when the Price actually defines one.
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { userId, plan, interval },
      trial_settings: {
        end_behavior: {
          // A card is always collected (we never pass payment_method_collection,
          // and Stripe's default is to collect), so this should never fire. It
          // is set so the failure mode is defined rather than undefined.
          missing_payment_method: 'cancel',
        },
      },
    },
    allow_promotion_codes: true,
  });
}

/** GET — create a session and redirect straight to Stripe. */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      // request.url carries the internal localhost origin behind nginx, so an
      // absolute URL built from it points nowhere the browser can reach.
      // See lib/safe-redirect.ts. Stripe's success/cancel URLs below must stay
      // absolute - Stripe resolves those from outside this site.
      return redirectToPath(request, '/auth/signin');
    }

    const sel = resolveSelection(new URL(request.url).searchParams);
    if ('error' in sel) return redirectToPath(request, '/pricing?error=unknown_plan');

    const checkoutSession = await buildSession(
      sel.plan, sel.interval, session.user.id, session.user.email, '/pricing'
    );
    return NextResponse.redirect(checkoutSession.url!);
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    if (error?.code === 'unconfigured') {
      return redirectToPath(request, '/pricing?error=plan_unavailable');
    }
    return redirectToPath(request, '/?error=checkout_failed');
  }
}

/** POST — return the session so the client can redirect itself. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sel = resolveSelection(new URL(request.url).searchParams, body);
    if ('error' in sel) return NextResponse.json({ error: sel.error }, { status: 400 });

    const checkoutSession = await buildSession(
      sel.plan, sel.interval, session.user.id, session.user.email, '/pricing'
    );
    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    const status = error?.code === 'unconfigured' ? 400 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status }
    );
  }
}
