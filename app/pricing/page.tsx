import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';
import { PLANS } from '@/lib/entitlements';
import { PITCH } from '@/lib/plan-highlights';
import { ENTRY_PAID_PLAN, fromMonthly, planName, priceNumber } from '@/lib/pricing-display';
import { ORG_ID, SITE, breadcrumbLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { lpBody, lpDisplay } from '@/lib/fonts';
import PricingClient from './PricingClient';
import { priceIdFor, type SellablePlan } from '@/lib/stripe-plans';
import '@/styles/landing.css';
import '@/styles/pricing.css';

const n = (x: number) => x.toLocaleString('en-US');

// Every number in the description comes from the plan table (lib/entitlements.ts) through
// lib/pricing-display.ts; change a limit or a price there and this text follows.
const DESCRIPTION = `Free: rankings over 24 hours, 7 days and ${PLANS.free.historyDays} days, a ${PLANS.free.watchedModels}-model watchlist, ${n(PLANS.free.routerRequestsPerMonth)} routed requests a month. Paid plans ${fromMonthly(ENTRY_PAID_PLAN)}: the newest run and diagnosis.`;

export const metadata: Metadata = pageMeta({
  title: 'Pricing: free benchmarks, paid diagnosis',
  description: DESCRIPTION,
  path: '/pricing',
});

/** One Product per sold plan, its monthly and annual Offers read from the plan table. */
const PRODUCTS: SellablePlan[] = ['pro', 'developer', 'teams'];
const productLd = (plan: SellablePlan): object => {
  const name = `AI Stupid Level ${planName(plan)}`;
  const annual = PLANS[plan].priceAnnual;
  const offer = (label: string, price: string, unitCode: 'MON' | 'ANN') => ({
    '@type': 'Offer',
    name: `${planName(plan)}, ${label}`,
    price,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `${SITE}/pricing`,
    seller: { '@id': ORG_ID },
    priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'USD', billingDuration: 1, billingIncrement: 1, unitCode },
  });
  return {
    '@type': 'Product',
    '@id': `${SITE}/pricing#${plan}`,
    name,
    description: PITCH[plan],
    brand: { '@id': ORG_ID },
    url: `${SITE}/pricing`,
    offers: [
      offer('monthly', priceNumber(plan), 'MON'),
      ...(annual ? [offer('annual', String(annual), 'ANN')] : []),
    ],
  };
};

const PRICING_LD = graphLd([
  breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]),
  webPageLd({ path: '/pricing', name: 'Pricing: free benchmarks, paid diagnosis', description: DESCRIPTION }),
  ...PRODUCTS.map(productLd),
]);

export default function PricingPage() {
  // Which plans can actually be bought right now. A plan whose Stripe Price is
  // not configured must not show a working buy button: the alternative is a
  // customer clicking "Start free trial" and landing on an error, or worse being
  // charged a price the page never displayed.
  const buyable = (['pro', 'developer', 'teams'] as SellablePlan[])
    .filter(p => priceIdFor(p, 'monthly') || priceIdFor(p, 'annual'));

  return (
    <SubpageLayout>
      <JsonLd data={PRICING_LD} />
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
