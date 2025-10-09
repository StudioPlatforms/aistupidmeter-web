import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
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

        // Start trial period
        startUserTrial(
          parseInt(userId),
          subscription.customer as string,
          subscription.id
        );

        console.log(`Trial started for user ${userId}`);
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
            activateSubscription(user.id, subscription.id);
            console.log(`Subscription activated for user ${user.id}`);
          } else if ((subscription as any).cancel_at_period_end) {
            const endsAt = new Date((subscription as any).current_period_end * 1000).toISOString();
            cancelSubscription(user.id, endsAt);
            console.log(`Subscription canceled for user ${user.id}, ends at ${endsAt}`);
          }
        } else {
          const userIdInt = parseInt(userId);
          
          if (subscription.status === 'active' && !(subscription as any).cancel_at_period_end) {
            activateSubscription(userIdInt, subscription.id);
            console.log(`Subscription activated for user ${userIdInt}`);
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
        console.log(`User ${user.id} downgraded to free tier`);
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
