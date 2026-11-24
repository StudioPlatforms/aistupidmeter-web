import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { planForSubscription } from '@/lib/stripe-plans';
import { markAssessmentPaid } from '@/lib/assessment';
import { applyCreditPurchase } from '@/lib/router-credits';
import { recordActivation } from '@/lib/activation';
import { sendPurchaseConfirmationEmail, sendTrialEndingEmail } from '@/lib/email-service';
import { PLANS, isPlan, ownPlanFor, type Plan } from '@/lib/entitlements';
import {
  cancelEmailsOn, isInternal, notifyCancellationConfirmed, notifyCancelledNow, notifyCancelledUnpaid, notifyPaymentFailed, notifySubscriptionEnded,
} from '@/lib/billing-watch';
import { stayCouponOn } from '@/lib/stay-offer';
import { hasFinishedNotice, hasNotice, once, recordNotice } from '@/lib/billing-notices';
import { END_COMMENT, MAX_PAYMENT_ATTEMPTS, endBillingNow, isOwnEnding, isUnpaid } from '@/lib/billing-end';
import { activatePaidStart, formatMoney, isPaidStart, refundRequested } from '@/lib/paid-start';
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

        // Paid start: the first period is paid, so the plan starts now. customer.subscription.created
        // does the same a moment apart; activatePaidStart grants once and emails once.
        const subRef = session.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (session.mode === 'subscription' && subId
          && (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')) {
          try {
            const sub = await stripe.subscriptions.retrieve(subId);
            if (sub.status === 'active' && isPaidStart(sub)) await activatePaidStart(parseInt(userId), sub);
          } catch (err) {
            // subscription.created carries the subscription itself, and the billing watch catches
            // anything both miss, so this event is not failed for it.
            console.error(`[stripe webhook] paid start for ${subId} not activated from checkout:`, err instanceof Error ? err.message : err);
          }
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

        // Not paid yet: 3D Secure is pending, or Checkout showed a decline and the customer may try
        // another card. Nothing is written, not even the customer id: a free or complimentary
        // account must not change for a checkout that never paid.
        if (subscription.status === 'incomplete') {
          console.warn(`[stripe webhook] ${subscription.id} created incomplete for user ${userId}; waiting for payment`);
          break;
        }

        // Paid start (every Checkout since 2026-11-13): active means the first period is paid.
        if (isPaidStart(subscription) && subscription.status === 'active') {
          await activatePaidStart(parseInt(userId), subscription);
          break;
        }
        // Checkout passes no trial, so a paid start should never arrive trialing. If one does (a
        // Price's own trial applied after all), the customer still gets the plan, as a trial.
        if (isPaidStart(subscription)) {
          console.error(`[stripe webhook] paid start ${subscription.id} created ${subscription.status}, not active; handled as a trial`);
        }

        // A subscription that began with a trial (a Checkout session opened before the paid
        // start), or one created by hand: as before.
        const createdPlan = planForSubscription(subscription);
        startUserTrial(
          parseInt(userId),
          subscription.customer as string,
          subscription.id,
          createdPlan,
          trialEndIso(subscription),
          statusFor(subscription),
        );
        // The plan's Data API quota: the other subscription paths already reconcile it.
        syncDataApiTier(parseInt(userId));

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

        // A subscription this code ended (lib/billing-end.ts) is not touched by any event about it
        // again: one from before the ending, delivered or retried late, would grant the plan back.
        // (A finished ending only: a claim a stopped server left behind must not silence the
        // subscription for good.)
        if (hasFinishedNotice('ended_cancel_unpaid', subscription.id) || hasFinishedNotice('ended_unpaid', subscription.id)) {
          console.warn(`[stripe webhook] ignoring an update of ${subscription.id}: it was ended for a payment owed`);
          break;
        }

        // Cancelled while a payment is owed: the period the cancellation would run to was never
        // paid for, and Stripe would go on retrying its invoice. It ends now and nothing more is
        // collected. Only a subscription our checkout made for an account (or the one an account
        // uses), and only if this still holds on a fresh reading: the event may be late, and one
        // paid in the meantime must stay. Before the account check: it holds for a subscription
        // whose account is gone too. The deletion event that follows moves the account to Free.
        const oursToEnd = !!metaUserId || (!!user && user.stripe_subscription_id === subscription.id);
        if (cancellation(subscription) && isUnpaid(subscription.status) && oursToEnd
          && !refundRequested(subscription) && !(user && isInternal(user))) {
          let stale: string | undefined;
          // The account is told when this is the subscription it uses and it had a plan from it;
          // the record carries the account exactly then, which is how the billing watch finds
          // an email that did not send.
          const planWas = user && user.stripe_subscription_id === subscription.id ? ownPlanFor(user) : 'free';
          const told = !!user && planWas !== 'free';
          const done = await once(
            {
              kind: 'ended_cancel_unpaid', userId: told ? user!.id : null, email: user?.email ?? null, ref: subscription.id,
              detail: `Cancelled by the customer with a payment unpaid: ${subscription.id} ended now, its open invoice voided${user && !told ? ` (account ${user.id})` : ''}`,
            },
            async () => {
              const out = await endBillingNow(subscription.id, END_COMMENT.cancelled_unpaid, 'cancelled_unpaid');
              if (out.skipped) { stale = out.skipped; return { success: false, error: out.skipped }; }
              if (out.notVoided.length) console.error(`[stripe webhook] ${subscription.id} ended, an invoice not voided yet (the billing watch voids it): ${out.notVoided[0].error}`);
            },
            false,
          );
          // Ended, or already being ended elsewhere: nothing more for this event. A late event
          // (it no longer holds) or a refusal by Stripe is handled as any update; the billing
          // watch ends the subscription on its next run if it still should be.
          if (stale) console.warn(`[stripe webhook] ${subscription.id} not ended at its cancellation: ${stale}`);
          else if (done?.error) console.error(`[stripe webhook] ${subscription.id} could not be ended at its cancellation: ${done.error}`);
          else {
            // Tell the customer it ended at once and nothing more is charged (the account's plan
            // as it was: the deletion event moves it to Free in a moment).
            if (done?.done && told) void notifyCancelledNow(user!, subscription.id, planWas).catch(() => {});
            break;
          }
        }

        if (!user) {
          console.error('Could not find user for subscription update');
          break;
        }

        // A checkout that never paid (3D Secure abandoned, a decline nobody retried) must not
        // relabel a free account past_due or clear a complimentary plan's dates.
        if ((subscription.status === 'incomplete' || subscription.status === 'incomplete_expired')
          && user.stripe_subscription_id !== subscription.id) {
          break;
        }
        // Cancel and refund has been asked for or done (lib/paid-start.ts): the plan is ending or
        // has ended. No event about it may grant it again, whether sent after the request (it
        // carries the marker) or from before it and delivered or retried late (only our own
        // record of the refund tells).
        if (refundRequested(subscription)) {
          console.warn(`[stripe webhook] ignoring an update of ${subscription.id}: a refund was requested`);
          break;
        }

        // As with deletion: a leftover subscription on the same customer must not
        // cancel or relabel the one this account is paying for.
        const current = !user.stripe_subscription_id || user.stripe_subscription_id === subscription.id;
        const cancelled = cancellation(subscription);
        if (cancelled && !current) {
          // A leftover subscription's cancellation: nothing of the account changes.
        } else if (cancelled) {
          cancelSubscription(user.id, cancelled.endsAt);
          console.log(`Subscription canceled for user ${user.id}, ends at ${cancelled.endsAt ?? 'unknown'}`);
          // Confirm it to the customer: until when the plan runs, and that nothing more is charged.
          // Not while a payment is owed: that one ends at once, above, and says so.
          const planNow = ownPlanFor(user);
          if (planNow !== 'free' && (subscription.status === 'active' || subscription.status === 'trialing')) {
            const at = (subscription as any).canceled_at;
            void notifyCancellationConfirmed(user,
              { id: subscription.id, canceledAt: typeof at === 'number' ? at : null, endsAt: cancelled.endsAt, trial: subscription.status === 'trialing' }, planNow).catch(() => {});
          }
        } else if (subscription.status === 'active') {
          const plan = planForSubscription(subscription);
          activateSubscription(user.id, subscription.id, plan);
          syncDataApiTier(user.id);
          // A paid start completed after 3D Secure arrives here (incomplete → active). The guard
          // on asl_start keeps every older subscription out: no confirmation on their next update.
          if (isPaidStart(subscription)) await activatePaidStart(user.id, subscription);
          console.log(`Subscription activated for user ${user.id} on plan ${plan}`);
        } else if (current) {
          // Trialing or a failed renewal: the label, no cancellation Stripe no
          // longer has, and during a trial the plan, since a plan switch made
          // mid-trial (change-plan or the portal) only ever arrives here.
          const trialing = subscription.status === 'trialing';
          setSubscriptionStatus(user.id, statusFor(subscription), {
            clearCancellation: true,
            ...(trialing ? { plan: planForSubscription(subscription) } : {}),
          });
          if (trialing) syncDataApiTier(user.id);
          console.log(`Subscription for user ${user.id} is ${subscription.status}`);
        }

        // The stay offer of the cancel page, accepted: its coupon is on the subscription now.
        // Recorded once per subscription; an account is offered it once (lib/stay-offer.ts). After
        // everything above, so a reading that fails never holds the account's state back; it does
        // fail the event, so Stripe sends it again and an acceptance is not lost. Read only when
        // the event says the discounts changed (or does not say what changed).
        const discounts = (subscription as any).discounts;
        const before = (event.data as any).previous_attributes;
        if (Array.isArray(discounts) && discounts.length > 0 && (!before || 'discounts' in before)
          && !hasNotice('stay_offer_accepted', subscription.id)) {
          const coupon = stayCouponOn(await stripe.subscriptions.retrieve(subscription.id, { expand: ['discounts'] }));
          if (coupon) recordNotice(user.id, 'stay_offer_accepted', subscription.id, `Took the stay offer on the cancel page (${coupon})`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        // Never paid, so it never granted anything: an abandoned checkout expiring must not
        // move a free, complimentary or paying account anywhere.
        if (subscription.status === 'incomplete_expired') break;
        
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
        // Nor an account with no subscription linked: its plan, if it has one, does not come from
        // this subscription (a complimentary plan), or it was moved to Free already when this
        // subscription was ended for a payment owed.
        if (!user.stripe_subscription_id) {
          console.log(`[stripe] ignoring deletion of ${subscription.id} for user ${user.id}: no subscription is linked to the account`);
          break;
        }

        // Downgrade to free tier
        const planBefore = ownPlanFor(user);
        // The plan this subscription was giving, for the "has ended" email: ownPlanFor already
        // reads Free once a cancelled period has run out, which is exactly when this event comes,
        // so the stored tier is read then.
        const endedPlan: Plan = planBefore !== 'free' ? planBefore : (isPlan(user.subscription_tier) ? user.subscription_tier : 'free');
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
        } else if (endedPlan !== 'free' && cancelEmailsOn() && !refundRequested(subscription)
          && !isOwnEnding((subscription as any).cancellation_details?.comment)
          && !hasNotice('ended_cancel_unpaid', subscription.id) && !hasNotice('ended_unpaid', subscription.id)) {
          // Reached its end some other way (the customer's cancellation, usually): say so. Never
          // for an ending made here (its comment says so, before any record of it exists): one
          // ended for a payment owed has had its own email, and an account being deleted is not
          // "on the free plan". The record is what the email is owed on, should it not send now.
          recordNotice(user.id, 'ended_cancelled', subscription.id, `${PLANS[endedPlan].label} ended after its cancellation`);
          void notifySubscriptionEnded(user, subscription.id, endedPlan).catch(() => {});
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
        const endingPlan = planForSubscription(subscription);
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
        // An unpaid plan change (change-plan, pending_if_incomplete) leaves the subscription active
        // with the change pending: it is not at risk, so "will be cancelled" would be false; the
        // billing page tells the customer instead. Only a change that left the subscription past
        // due is a failed payment to warn about (the billing watch's rule 2 checks that too).
        if (invoice.billing_reason === 'subscription_update' && failedSub) {
          let atRisk = false;
          try {
            const s = await stripe.subscriptions.retrieve(failedSub);
            atRisk = s.status === 'past_due' || s.status === 'unpaid';
          } catch { /* unknown: the watch emails if it is past due */ }
          if (!atRisk) break;
        }
        const payer = findUserByStripeCustomerId(invoice.customer as string);

        // The second failed attempt (the first charge and one retry) ends the subscription: it is
        // cancelled now, its invoice voided, and nothing more is collected (lib/billing-end.ts).
        // Only a subscription our checkout made for an account (or the one an account uses), and
        // only if it still holds on a fresh reading: the subscription unpaid, this invoice open
        // and tried twice. A plan change waiting for its payment leaves the subscription active
        // and is not ended. The deletion event that follows moves the account to Free; the
        // customer is emailed once, and the billing watch sends that email if it did not go (the
        // record carries the account exactly when one is due).
        const madeFor = (invoice as any).parent?.subscription_details?.metadata?.userId;
        const uses = !!payer && !!failedSub && payer.stripe_subscription_id === failedSub;
        if (failedSub && (uses || !!madeFor) && (invoice.attempt_count ?? 0) >= MAX_PAYMENT_ATTEMPTS
          && (invoice.amount_due ?? 0) > 0 && !(payer && isInternal(payer))) {
          const planBefore = uses ? ownPlanFor(payer) : 'free';
          const tell = uses && planBefore !== 'free';
          let stale: string | undefined;
          const done = await once(
            {
              kind: 'ended_unpaid', userId: tell ? payer!.id : null, email: payer?.email ?? null, ref: failedSub,
              detail: `${formatMoney(invoice.amount_due, invoice.currency)} failed ${invoice.attempt_count} times: ${failedSub} cancelled, its invoice voided`,
            },
            async () => {
              const out = await endBillingNow(failedSub, END_COMMENT.failed_twice, 'failed_twice');
              if (out.skipped) { stale = out.skipped; return { success: false, error: out.skipped }; }
              if (out.notVoided.length) console.error(`[stripe webhook] ${failedSub} ended, an invoice not voided yet (the billing watch voids it): ${out.notVoided[0].error}`);
            },
            false,
          );
          if (!stale) {
            if (done?.error) console.error(`[stripe webhook] ${failedSub} could not be ended after ${invoice.attempt_count} failed attempts: ${done.error}`);
            if (done?.done && tell) void notifyCancelledUnpaid(payer!, failedSub, planBefore).catch(() => {});
            break;
          }
          // It no longer holds (paid in the meantime, or the subscription is not the unpaid one):
          // handled as any failed payment, below.
          console.warn(`[stripe webhook] ${failedSub} not ended after a failed payment: ${stale}`);
        }

        if (payer && failedSub && payer.stripe_subscription_id === failedSub && (invoice.amount_due ?? 0) > 0 && invoice.id) {
          const next = (invoice as any).next_payment_attempt;
          void notifyPaymentFailed(
            { id: payer.id, email: payer.email, plan: ownPlanFor(payer) },
            { id: invoice.id, amountDue: invoice.amount_due, nextAttemptAt: typeof next === 'number' && next > 0 ? new Date(next * 1000).toISOString() : null },
          ).catch(() => {});
        }
        break;
      }

      case 'refund.failed': {
        // A Cancel-and-refund refund the bank sent back (lib/paid-start.ts): for a person to do by
        // hand. The admin dashboard lists it.
        const refund = event.data.object as Stripe.Refund;
        if (refund.metadata?.asl_reason !== 'refund_window') break;
        const owner = Number(refund.metadata?.userId);
        const known = Number.isInteger(owner) && owner > 0 && !!findUserById(owner);
        console.error(`[stripe webhook] refund ${refund.id} failed: ${refund.failure_reason ?? 'no reason given'}`);
        recordNotice(known ? owner : null, 'refund_failed', refund.id,
          `${formatMoney(refund.amount, refund.currency)} refund for ${refund.metadata?.subscriptionId ?? 'a subscription'} failed ` +
          `(${refund.failure_reason ?? 'no reason given'}); refund it by hand in Stripe and tell the customer, who was emailed that it is on its way`);
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
