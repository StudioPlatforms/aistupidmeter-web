import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { planForPriceId } from '@/lib/stripe-plans';
import { markAssessmentPaid } from '@/lib/assessment';
import { applyCreditPurchase } from '@/lib/router-credits';
import { recordActivation } from '@/lib/activation';
import { sendPurchaseConfirmationEmail, sendTrialEndingEmail } from '@/lib/email-service';
import { PLANS, isPlan, ownPlanFor } from '@/lib/entitlements';
import { notifyCancelledUnpaid, notifyPaymentFailed } from '@/lib/billing-watch';
import { 
  updateStripeCustomerId,
  startUserTrial,
  activateSubscription,
  cancelSubscription,
  downgradeToFree,
  recordPayment,
  setSubscriptionStatus,
  findUserById,
  findUserByStripeCustomerId,
  type SubscriptionStatus,
} from '@/lib/db-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

import { syncDataApiTier } from '@/lib/data-api-tier';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;


/**
 * Which plan did this subscription actually buy?
 *
 * Read off the Price on the subscription's first line item. Falls back to the
 * plan recorded in checkout metadata, then to 'pro'. Getting this wrong means
 * selling someone Teams and granting them Pro, so it is resolved from the money
 * rather than from anything the browser sent.
 */
function planFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const fromPrice = planForPriceId(priceId);
  if (fromPrice) return fromPrice;
  const fromMetadata = subscription.metadata?.plan;
  if (fromMetadata) return fromMetadata;
  console.warn(`[stripe webhook] could not map price ${priceId} to a plan; defaulting to pro`);
  return 'pro';
}

/** Trial end as ISO, or null when the subscription has no trial. */
function trialEndIso(subscription: Stripe.Subscription): string | null {
  const t = (subscription as any).trial_end;
  return typeof t === 'number' && t > 0 ? new Date(t * 1000).toISOString() : null;
}

/**
 * Null when the subscription is not cancelled; otherwise when it ends (null if
 * Stripe gave no date). The customer portal cancels by setting `cancel_at`
 * and leaves `cancel_at_period_end` false, so reading only the flag missed every
 * portal cancellation. The period end has lived on the subscription item, not
 * the subscription, since Stripe's 2025 API versions.
 */
function cancellation(subscription: Stripe.Subscription): { endsAt: string | null } | null {
  const s = subscription as any;
  if (!s.cancel_at && !s.cancel_at_period_end) return null;
  const at = s.cancel_at || s.items?.data?.[0]?.current_period_end;
  return { endsAt: typeof at === 'number' && at > 0 ? new Date(at * 1000).toISOString() : null };
}

/** The Stripe state as the label stored in subscription_status (display only). */
function statusFor(subscription: Stripe.Subscription): SubscriptionStatus {
  if (cancellation(subscription)) return 'cancelled';
  switch (subscription.status) {
    case 'active': return 'active';
    case 'trialing': return 'trial';
    case 'canceled':
    case 'incomplete_expired': return 'free';
    default: return 'past_due'; // past_due, unpaid, incomplete, paused: a payment is owed
  }
}


/** Human-readable plan name and price for receipt emails. */
function planPresentation(plan: string, interval?: string | null) {
  const e = isPlan(plan) ? PLANS[plan] : null;
  const annual = interval === 'annual';
  const amount = !e || e.priceMonthly === null
    ? 'see your invoice'
    : annual && e.priceAnnual !== null ? `$${e.priceAnnual}` : `$${e.priceMonthly}`;
  return { label: e?.label ?? plan, amount, interval: annual ? 'year' : 'month' };
}

const asDate = (unixSeconds: unknown): string | null =>
  typeof unixSeconds === 'number' && unixSeconds > 0
    ? new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // One-off workload assessment (mode: payment): no subscription, no userId required.
        if (session.metadata?.kind === 'assessment') {
          await markAssessmentPaid(session);
          break;
        }
        // Smart Router top-up (mode: payment).
        if (session.metadata?.kind === 'router_credits') {
          applyCreditPurchase(session);
          break;
        }
        const userId = session.metadata?.userId;
        
        if (!userId) {
          console.error('No userId in checkout session metadata');
          break;
        }

        // Store Stripe customer ID
        if (session.customer) {
          updateStripeCustomerId(
            parseInt(userId),
            session.customer as string
          );
        }

        console.log(`Checkout completed for user ${userId}`);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

        const createdPlan = planFromSubscription(subscription);
        startUserTrial(
          parseInt(userId),
          subscription.customer as string,
          subscription.id,
          createdPlan,
          trialEndIso(subscription),
          statusFor(subscription),
        );

        recordActivation(parseInt(userId), 'subscription_started', createdPlan,
          { trialEnd: trialEndIso(subscription) });
        const pres = planPresentation(createdPlan, subscription.metadata?.interval);
        const buyerEmail = (subscription as any).metadata?.email
          || (findUserByStripeCustomerId(subscription.customer as string)?.email ?? null);
        if (buyerEmail) {
          void sendPurchaseConfirmationEmail(buyerEmail, {
            planLabel: pres.label, amount: pres.amount, interval: pres.interval,
            trialEnds: asDate((subscription as any).trial_end),
          }).catch(() => {});
        }
        console.log(`Subscription created for user ${userId} on plan ${createdPlan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const metaUserId = subscription.metadata?.userId;
        const user = metaUserId
          ? findUserById(parseInt(metaUserId))
          : findUserByStripeCustomerId(subscription.customer as string);
        if (!user) {
          console.error('Could not find user for subscription update');
          break;
        }

        // As with deletion: a leftover subscription on the same customer must not
        // cancel or relabel the one this account is paying for.
        const current = !user.stripe_subscription_id || user.stripe_subscription_id === subscription.id;
        const cancelled = cancellation(subscription);
        if (cancelled) {
          if (!current) break;
          cancelSubscription(user.id, cancelled.endsAt);
          console.log(`Subscription canceled for user ${user.id}, ends at ${cancelled.endsAt ?? 'unknown'}`);
        } else if (subscription.status === 'active') {
          const plan = planFromSubscription(subscription);
          activateSubscription(user.id, subscription.id, plan);
          syncDataApiTier(user.id);
          console.log(`Subscription activated for user ${user.id} on plan ${plan}`);
        } else if (current) {
          // Trialing or a failed renewal: the label, no cancellation Stripe no
          // longer has, and during a trial the plan, since a plan switch made
          // mid-trial (change-plan or the portal) only ever arrives here.
          const trialing = subscription.status === 'trialing';
          setSubscriptionStatus(user.id, statusFor(subscription), {
            clearCancellation: true,
            ...(trialing ? { plan: planFromSubscription(subscription) } : {}),
          });
          if (trialing) syncDataApiTier(user.id);
          console.log(`Subscription for user ${user.id} is ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find user by customer ID
        const user = findUserByStripeCustomerId(subscription.customer as string);
        if (!user) {
          console.error('Could not find user for subscription deletion');
          break;
        }

        // Only downgrade if this is the subscription we currently grant access
        // from. A customer can have more than one on their Stripe record — an
        // abandoned trial, or the leftover of a plan change made before
        // /api/stripe/change-plan existed. Cancelling one of those must not
        // revoke the plan they are actively paying for.
        if (user.stripe_subscription_id && user.stripe_subscription_id !== subscription.id) {
          console.log(
            `[stripe] ignoring deletion of ${subscription.id} for user ${user.id}; ` +
            `active subscription is ${user.stripe_subscription_id}`
          );
          break;
        }

        // Downgrade to free tier
        const planBefore = ownPlanFor(user);
        downgradeToFree(user.id);
        // Data API keys carry their own tier column and would otherwise keep a
        // paid quota indefinitely — a cancelled Teams key stays at 100,000/day
        // until the owner happens to open the keys page.
        syncDataApiTier(user.id);
        recordActivation(user.id, 'subscription_cancelled', null, { subscriptionId: subscription.id });
        console.log(`User ${user.id} downgraded to free tier`);
        // Ended because the payments failed: tell them there is a billing problem (once; the
        // billing watch would otherwise send it on its next run).
        if ((subscription as any).cancellation_details?.reason === 'payment_failed' && planBefore !== 'free') {
          void notifyCancelledUnpaid(user, subscription.id, planBefore).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe fires this three days out. A card is always collected at
        // checkout, so this is not a dunning hook — it is the moment to tell
        // someone what their trial actually showed them, which is the only
        // honest reason to email before a first charge.
        const subscription = event.data.object as Stripe.Subscription;
        const user = findUserByStripeCustomerId(subscription.customer as string);
        const endingPlan = planFromSubscription(subscription);
        const endPres = planPresentation(endingPlan, subscription.metadata?.interval);
        const chargeDate = asDate((subscription as any).trial_end);
        if (user?.email && chargeDate) {
          void sendTrialEndingEmail(user.email, {
            planLabel: endPres.label, amount: `${endPres.amount}/${endPres.interval}`, chargeDate,
          }).catch(() => {});
        }
        console.log(
          `Trial ending soon for ${user ? `user ${user.id}` : `customer ${subscription.customer}`}` +
          ` on plan ${endingPlan}`
        );
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // Since Stripe's 2025 API versions the subscription is under
        // parent.subscription_details; invoice.subscription no longer exists, so
        // this case never ran. It records the payment only. The plan comes from
        // the subscription events, which read the Price; this used to call
        // activateSubscription with its default plan, which would have reset a
        // Developer or Teams customer to Pro on every renewal.
        const ref = (invoice as any).parent?.subscription_details?.subscription ?? (invoice as any).subscription;
        const subscriptionId = typeof ref === 'string' ? ref : ref?.id;
        // Every trial opens with a $0 invoice; only money received is a payment.
        if (!subscriptionId || !(invoice.amount_paid > 0)) break;
        const user = findUserByStripeCustomerId(invoice.customer as string);
        if (user && user.stripe_subscription_id === subscriptionId) {
          const paidAt = (invoice as any).status_transitions?.paid_at;
          recordPayment(user.id, new Date(typeof paidAt === 'number' ? paidAt * 1000 : Date.now()).toISOString());
          console.log(`Payment succeeded for user ${user.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(`Payment failed for customer ${invoice.customer}`);
        // Tell the customer the subscription will be cancelled if this keeps failing: once per
        // invoice, so Stripe's retries do not each send another (lib/billing-watch.ts).
        const failedRef = (invoice as any).parent?.subscription_details?.subscription ?? (invoice as any).subscription;
        const failedSub = typeof failedRef === 'string' ? failedRef : failedRef?.id;
        const payer = findUserByStripeCustomerId(invoice.customer as string);
        if (payer && failedSub && payer.stripe_subscription_id === failedSub && (invoice.amount_due ?? 0) > 0 && invoice.id) {
          const next = (invoice as any).next_payment_attempt;
          void notifyPaymentFailed(
            { id: payer.id, email: payer.email, plan: ownPlanFor(payer) },
            { id: invoice.id, amountDue: invoice.amount_due, nextAttemptAt: typeof next === 'number' && next > 0 ? new Date(next * 1000).toISOString() : null },
          ).catch(() => {});
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
