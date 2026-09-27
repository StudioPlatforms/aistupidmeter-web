import Stripe from 'stripe';
import { openIdentityDb } from '@/lib/identity-db';
import { ROUTER_CREDITS } from '@/lib/entitlements';
import { sendRouterCreditsConfirmation } from '@/lib/email-service';

/**
 * Smart Router top-up credits.
 *
 * When a plan's monthly allowance is spent, routing continues only on prepaid credits
 * (the API draws one per successful request, api lib/allowance.ts). The customer chooses
 * the amount — at least ROUTER_CREDITS.minimumUsd, no upper limit of ours — and pays it
 * through Stripe Checkout as a one-off card payment with an invoice. The amount is set per
 * session (price_data on one Product) because a fixed Price cannot take an arbitrary sum.
 *
 * Crediting happens once per paid session: the webhook and the return page both call
 * `applyCreditPurchase`, and the UNIQUE session id on router_credit_purchases makes the
 * second call a no-op. The number of requests is computed from what Stripe says was paid,
 * never from anything the browser sent.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

/** Stripe's ceiling for a single line item: $999,999.99. */
export const MAX_TOPUP_USD = 999_999;

export const requestsFor = (usd: number) => Math.floor(usd * ROUTER_CREDITS.requestsPerUsd);

export function creditsProductId(): string | null {
  const id = process.env.STRIPE_PRODUCT_ROUTER_CREDITS;
  return id && id.trim() ? id.trim() : null;
}

/** Whole dollars and cents only; returns null for anything below the minimum or not a number. */
export function parseTopupUsd(raw: unknown): number | null {
  const n = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(n) || n < ROUTER_CREDITS.minimumUsd || n > MAX_TOPUP_USD) return null;
  return n;
}

export async function startCreditCheckout(opts: {
  userId: number; email: string; amountUsd: number; stripeCustomerId?: string | null;
}): Promise<string> {
  const product = creditsProductId();
  if (!product) throw Object.assign(new Error('STRIPE_PRODUCT_ROUTER_CREDITS is not configured'), { code: 'unconfigured' });

  const cents = Math.round(opts.amountUsd * 100);
  const requests = requestsFor(opts.amountUsd);
  const meta = { kind: 'router_credits', userId: String(opts.userId), requests: String(requests) };
  const app = process.env.NEXT_PUBLIC_APP_URL;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        product,
        unit_amount: cents,
      },
    }],
    ...(opts.stripeCustomerId
      ? { customer: opts.stripeCustomerId }
      : { customer_email: opts.email, customer_creation: 'always' as const }),
    client_reference_id: String(opts.userId),
    metadata: meta,
    // Cards only, so "completed" always means "paid".
    payment_method_types: ['card'],
    payment_intent_data: {
      description: `Smart Router credits: ${requests.toLocaleString('en-US')} requests`,
      metadata: meta,
    },
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
    invoice_creation: {
      enabled: true,
      invoice_data: { description: `AI Stupid Level Smart Router credits — ${requests.toLocaleString('en-US')} requests`, metadata: meta },
    },
    success_url: `${app}/account/billing?topup=done&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${app}/account/billing?topup=cancelled`,
  });
  if (!session.url) throw new Error('Stripe returned no Checkout URL');
  return session.url;
}

/**
 * Add the requests a paid top-up bought. Idempotent. Returns what was credited (or had
 * already been), or null when the session is not a paid top-up.
 */
export function applyCreditPurchase(session: Stripe.Checkout.Session): { userId: number; requests: number; newlyCredited: boolean } | null {
  if (session.metadata?.kind !== 'router_credits') return null;
  if (session.status !== 'complete' || session.payment_status !== 'paid') return null;
  const userId = Number(session.metadata.userId);
  const cents = session.amount_subtotal ?? session.amount_total ?? 0;
  if (!Number.isInteger(userId) || userId <= 0 || cents <= 0) return null;
  const requests = requestsFor(cents / 100);

  const db = openIdentityDb();
  let newlyCredited = false;
  let email: string | null = null;
  try {
    db.transaction(() => {
      const ins = db.prepare(`
        INSERT OR IGNORE INTO router_credit_purchases (user_id, stripe_session_id, amount_cents, requests)
        VALUES (?, ?, ?, ?)
      `).run(userId, session.id, cents, requests);
      if (ins.changes !== 1) return;
      db.prepare(`
        INSERT INTO router_credits (user_id, requests_remaining) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          requests_remaining = requests_remaining + excluded.requests_remaining,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      `).run(userId, requests);
      newlyCredited = true;
    })();
    if (newlyCredited) {
      email = (db.prepare('SELECT email FROM router_users WHERE id = ?').get(userId) as { email?: string } | undefined)?.email ?? null;
    }
  } finally {
    db.close();
  }

  if (newlyCredited) {
    console.log(`[credits] user ${userId}: +${requests} requests ($${(cents / 100).toFixed(2)})`);
    const to = email || session.customer_details?.email || null;
    if (to) {
      void sendRouterCreditsConfirmation(to, { requests, amountCents: cents })
        .then((r) => { if (!r.success) console.error(`[credits] user ${userId} credited but NOT emailed:`, r.error); });
    }
  }
  return { userId, requests, newlyCredited };
}

/** For the return page: look the session up at Stripe and credit it if it is paid. */
export async function confirmCreditSession(sessionId: string, userId: number) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.userId !== String(userId)) return null;   // only your own top-up
  return applyCreditPurchase(session);
}
