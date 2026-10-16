import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Stripe from 'stripe';
import { redirectToPath } from '@/lib/safe-redirect';
import { withReturn } from '@/lib/return-path';
import { recordActivation } from '@/lib/activation';
import { findUserById } from '@/lib/db-client';
import {
  isSellablePlan, isInterval, priceIdFor,
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

/** Which upgrade prompt sent this buyer (e.g. "board-insights"); recorded with checkout_started, never trusted for anything else. */
function sourceOf(searchParams: URLSearchParams): string | null {
  const v = searchParams.get('from');
  return v && /^[a-z0-9-]{1,40}$/.test(v) ? v : null;
}

async function buildSession(
  plan: SellablePlan, interval: Interval, userId: string, userEmail: string, cancelPath: string,
  existingCustomerId?: string | null, from?: string | null,
) {
  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    throw Object.assign(new Error(`No Stripe price configured for ${plan}/${interval}`), { code: 'unconfigured' });
  }

  const trialDays = await trialDaysFor(priceId);
  recordActivation(Number(userId), 'checkout_started', plan, { interval, trialDays, ...(from ? { from } : {}) });

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    // One or the other — Stripe rejects both together. Reusing the known
    // customer keeps a returning buyer's invoices, cards and history on one
    // record instead of creating a parallel one keyed off the same address.
    ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: userEmail }),
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

/**
 * Next.js fetches a link's target before it is clicked (prefetch) and fetches it again as React
 * Server Component data on a client-side navigation. Neither is someone asking to pay, but each
 * used to open a Stripe Checkout Session — three at a time for a page showing three plans (90 on
 * /pricing on 2026-10-15 alone), which also inflated the checkout_started count. Answered empty,
 * the router falls back to a normal page load of this URL, and that request opens the session.
 */
function isRouterFetch(request: NextRequest): boolean {
  const h = request.headers;
  return h.get('rsc') === '1' || h.get('next-router-prefetch') === '1'
    || /prefetch/i.test(h.get('purpose') ?? h.get('sec-purpose') ?? '');
}

/** GET — create a session and redirect straight to Stripe. */
export async function GET(request: NextRequest) {
  if (isRouterFetch(request)) return new NextResponse(null, { status: 204 });
  try {
    const params = new URL(request.url).searchParams;
    const sel = resolveSelection(params);
    if ('error' in sel) return redirectToPath(request, '/pricing?error=unknown_plan');
    const from = sourceOf(params);

    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      // Someone who picked a plan before having an account (every "Start free trial" on the
      // landing page and /pricing for a visitor) makes one, then comes straight back here with
      // the same plan. Sign-up, the confirmation email and sign-in all carry callbackUrl. This
      // used to send them to /auth/signin with nothing, so after signing up they landed on the
      // leaderboard and the plan they chose was lost.
      // request.url carries the internal localhost origin behind nginx, so an absolute URL built
      // from it points nowhere the browser can reach — see lib/safe-redirect.ts. Stripe's
      // success/cancel URLs below must stay absolute; Stripe resolves those from outside.
      return redirectToPath(request, withReturn('/auth/signup', `/api/stripe/checkout?plan=${sel.plan}&interval=${sel.interval}${from ? `&from=${from}` : ''}`));
    }

    const buyer = findUserById(Number(session.user.id));
    const checkoutSession = await buildSession(
      sel.plan, sel.interval, session.user.id, session.user.email, '/pricing',
      buyer?.stripe_customer_id, from
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

    const buyer = findUserById(Number(session.user.id));
    const checkoutSession = await buildSession(
      sel.plan, sel.interval, session.user.id, session.user.email, '/pricing',
      buyer?.stripe_customer_id
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
