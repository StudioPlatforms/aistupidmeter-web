import type { Metadata } from 'next';
import AccountShell from '@/components/AccountShell';
import BillingClient from './BillingClient';
import { priceIdFor, type SellablePlan } from '@/lib/stripe-plans';

export const metadata: Metadata = {
  title: 'Plan & billing',
  description: 'Your plan, what it includes, how much of it you are using, and how to change it.',
  robots: { index: false, follow: false },
};

/**
 * Per-user page — never statically prerendered.
 *
 * Also what makes useSearchParams safe here: Next requires a Suspense boundary
 * around it during static generation, and a page that is always dynamic has no
 * static generation to bail out of.
 */
export const dynamic = 'force-dynamic';

export default function BillingPage() {
  // Same rule as /pricing: never offer a switch we cannot complete.
  const buyable = (['pro', 'developer', 'teams'] as SellablePlan[])
    .filter(p => priceIdFor(p, 'monthly') || priceIdFor(p, 'annual'));

  return (
    <AccountShell>
      <BillingClient buyable={buyable} />
    </AccountShell>
  );
}
