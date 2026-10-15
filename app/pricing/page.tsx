import type { Metadata } from 'next';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { lpBody, lpDisplay } from '@/lib/fonts';
import PricingClient from './PricingClient';
import { priceIdFor, type SellablePlan } from '@/lib/stripe-plans';
import '@/styles/landing.css';
import '@/styles/pricing.css';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free public benchmarks and 30 days of history. Paid plans add the newest run as it lands, full comparable history, diagnosis, more tracked models, routing and team workflows. Provider inference is billed by your provider, not by us.',
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
      {/* The landing page's look inside the site's own top bar, like /status and /contact. */}
      <div className={`lp lp-sub lp-pricing ${lpBody.variable} ${lpDisplay.variable}`}>
        {/* Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />
        <PricingClient buyable={buyable} />
      </div>
    </SubpageLayout>
  );
}
