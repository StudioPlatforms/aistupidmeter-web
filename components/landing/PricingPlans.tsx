'use client';

import { useState } from 'react';
import { PLANS, ROUTER_CREDITS, DATA_API_LIMITS, type Plan } from '@/lib/entitlements';
import { PITCH, highlights, money } from '@/lib/plan-highlights';
import { upgradeHref } from '@/lib/checkout-url';
import { planName } from '@/lib/pricing-display';

type Interval = 'monthly' | 'annual';
const CARDS: Plan[] = ['free', 'pro', 'developer', 'teams'];
/** The plan /pricing features ("Most complete"); the two pages say the same thing. */
const FEATURED: Plan = 'teams';

const Check = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The plan cards, read from the plan table (lib/entitlements.ts) and the shared card text
 * (lib/plan-highlights.ts), so they always match /pricing. Annual first, as there. A paid plan
 * links to checkout only when its Stripe price exists (`buyable`), otherwise to /pricing.
 */
export default function PricingPlans({ buyable, signUpHref }: { buyable: string[]; signUpHref: string }) {
  const [interval, setInterval] = useState<Interval>('annual');
  const annual = interval === 'annual';
  const ent = PLANS.enterprise;

  return (
    <>
      <div className="lp-pricing-top lp-up">
        <div className="lp-head">
          <p className="lp-kicker">Pricing</p>
          <h2 className="lp-h2">Start free. Pay when the router earns it.</h2>
        </div>
        <div className="lp-bill" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={annual} onClick={() => setInterval('annual')}>Annual <em>2 months free</em></button>
          <button type="button" aria-pressed={!annual} onClick={() => setInterval('monthly')}>Monthly</button>
        </div>
      </div>
      <div className="lp-plans lp-up">
        {CARDS.map(p => {
          const e = PLANS[p];
          const h = highlights(p);
          let price: React.ReactNode, sub: React.ReactNode;
          if (!e.priceMonthly) {
            price = <>$0<small>forever</small></>;
            sub = 'No card required';
          } else if (annual && e.priceAnnual !== null) {
            price = <>{money(e.priceAnnual)}<small>/ year</small></>;
            const saving = e.priceMonthly * 12 - e.priceAnnual;
            sub = <>{money(e.priceAnnual / 12)} a month{saving > 0 && <> · <em>save {money(saving)}</em></>}</>;
          } else {
            price = <>{money(e.priceMonthly)}<small>/ month</small></>;
            sub = e.priceAnnual !== null ? <>or {money(e.priceAnnual)} a year — two months free</> : null;
          }
          const paid = p !== 'free';
          const href = !paid ? signUpHref : buyable.includes(p) ? upgradeHref(p, interval) : '/pricing';
          const label = !paid ? 'Create free account' : buyable.includes(p) ? 'Start free trial' : 'See plan details';
          return (
            <div key={p} className={`lp-plan${p === FEATURED ? ' is-pop' : ''}`}>
              <p className="lp-plan-n">{planName(p)}{p === FEATURED && <span className="lp-badge">Most complete</span>}</p>
              <p className="lp-plan-p">{price}</p>
              <p className="lp-plan-sub">{sub}</p>
              <p className="lp-plan-pitch">{PITCH[p]}</p>
              <a className={`lp-btn ${p === FEATURED ? 'lp-btn-primary' : 'lp-btn-ghost'}`} href={href}>{label}</a>
              <p className="lp-plan-l">{h.lead ?? 'Includes'}</p>
              <ul>{h.items.map(i => <li key={i}><Check /><span>{i}</span></li>)}</ul>
            </div>
          );
        })}
      </div>
      <div className="lp-ent lp-up">
        <p><b>Enterprise</b><span>{PITCH.enterprise} {DATA_API_LIMITS[ent.dataApiTier].daily.toLocaleString('en-US')} Data API calls a day.</span></p>
        <a className="lp-btn lp-btn-ghost" href={upgradeHref('enterprise', interval)}>Talk to us</a>
      </div>
      <p className="lp-credits lp-up">
        Past your router allowance? Top up credits from ${ROUTER_CREDITS.minimumUsd} — {ROUTER_CREDITS.requestsPerUsd.toLocaleString('en-US')} requests per $1, no expiry.
        Providers bill your tokens directly; we never add to them. <a className="lp-more" href="/pricing">Compare every plan</a>
      </p>
    </>
  );
}
