import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import PricingClient from './PricingClient';
import { priceIdFor, type SellablePlan } from '@/lib/stripe-plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free public benchmarks and seven-day history. Paid plans add longer comparable history, diagnosis, more tracked models, routing and team workflows. Provider inference is billed by your provider, not by us.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing | AI Stupid Level',
    description: 'Know when your model decisions stop being right. Free evidence, paid diagnosis.',
    url: 'https://aistupidlevel.info/pricing',
    type: 'website',
  },
};

export default function PricingPage() {
  // Which plans can actually be bought right now. A plan whose Stripe Price is
  // not configured must not show a working buy button: the alternative is a
  // customer clicking "Start free trial" and landing on an error, or worse being
  // charged a price the page never displayed.
  const buyable = (['pro', 'developer', 'teams'] as SellablePlan[])
    .filter(p => priceIdFor(p, 'monthly') || priceIdFor(p, 'annual'));

  return (
    <SubpageLayout>
      <PricingClient buyable={buyable} />
    </SubpageLayout>
  );
}
