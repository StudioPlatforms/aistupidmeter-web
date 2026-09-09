import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import BillingClient from './BillingClient';
import { priceIdFor, type SellablePlan } from '@/lib/stripe-plans';

export const metadata: Metadata = {
  title: 'Plan & billing | AI Stupid Level',
  description: 'Your plan, what it includes, how much of it you are using, and how to change it.',
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  // Same rule as /pricing: never offer a switch we cannot complete.
  const buyable = (['pro', 'developer', 'teams'] as SellablePlan[])
    .filter(p => priceIdFor(p, 'monthly') || priceIdFor(p, 'annual'));

  return (
    <SubpageLayout>
      <BillingClient buyable={buyable} />
    </SubpageLayout>
  );
}
