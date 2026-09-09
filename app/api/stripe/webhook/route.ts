import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { planForPriceId } from '@/lib/stripe-plans';
import { recordActivation } from '@/lib/activation';
import { sendPurchaseConfirmationEmail, sendTrialEndingEmail } from '@/lib/email-service';
import { PLANS, isPlan } from '@/lib/entitlements';
import { 
  updateStripeCustomerId,
  startUserTrial,
  activateSubscription,
  cancelSubscription,
  downgradeToFree,
  findUserByStripeCustomerId
} from '@/lib/db-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

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
        const userId = subscription.metadata?.userId;
        
        if (!userId) {
          // Try to find user by customer ID
          const user = findUserByStripeCustomerId(subscription.customer as string);
          if (!user) {
            console.error('Could not find user for subscription update');
            break;
          }
          
          // Handle subscription status changes
          if (subscription.status === 'active' && !(subscription as any).cancel_at_period_end) {
            activateSubscription(user.id, subscription.id, planFromSubscription(subscription));
            console.log(`Subscription activated for user ${user.id} on plan ${planFromSubscription(subscription)}`);
          } else if ((subscription as any).cancel_at_period_end) {
            const endsAt = new Date((subscription as any).current_period_end * 1000).toISOString();
            cancelSubscription(user.id, endsAt);
            console.log(`Subscription canceled for user ${user.id}, ends at ${endsAt}`);
          }
        } else {
          const userIdInt = parseInt(userId);
          
          if (subscription.status === 'active' && !(subscription as any).cancel_at_period_end) {
            activateSubscription(userIdInt, subscription.id, planFromSubscription(subscription));
            console.log(`Subscription activated for user ${userIdInt} on plan ${planFromSubscription(subscription)}`);
          } else if ((subscription as any).cancel_at_period_end) {
            const endsAt = new Date((subscription as any).current_period_end * 1000).toISOString();
            cancelSubscription(userIdInt, endsAt);
            console.log(`Subscription canceled for user ${userIdInt}, ends at ${endsAt}`);
          }
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

        // Downgrade to free tier
        downgradeToFree(user.id);
        recordActivation(user.id, 'subscription_cancelled', null, { subscriptionId: subscription.id });
        console.log(`User ${user.id} downgraded to free tier`);
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
        
        if ((invoice as any).subscription) {
          // Find user by customer ID
          const user = findUserByStripeCustomerId(invoice.customer as string);
          if (user && (invoice as any).subscription) {
            activateSubscription(user.id, (invoice as any).subscription as string);
            console.log(`Payment succeeded for user ${user.id}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.error(`Payment failed for customer ${invoice.customer}`);
        // Could send email notification here
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
