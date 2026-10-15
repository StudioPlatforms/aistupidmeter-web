'use client';

/**
 * Plan & billing — replaces the binary Free/Pro `/router/subscription`.
 *
 * The old page hard-coded $4.99 twice, could only express two plans, and told Pro
 * customers they had "Unlimited" API calls when the real limit was 10,000/day. It
 * also showed the free API limit as 100/day when it is 10. Every number here is
 * read from the entitlement table or measured usage instead.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { monthlyLong } from '@/lib/pricing-display';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PLANS, SELLABLE_PLANS, ROUTER_CREDITS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';
import { PITCH } from '@/lib/plan-highlights';
import type { SellablePlan } from '@/lib/stripe-plans';
import { PageHead, Pane, Loader, Meter as MeterBar } from '@/components/studio';
import { lpBody, lpDisplay } from '@/lib/fonts';
import '@/styles/landing.css';
import '@/styles/studio-account.css';

interface Meter { key: string; label: string; used: number; limit: number; period: string }
interface Credits {
  balance: number;
  usedThisMonth: number;
  includedThisMonth: number;
  requestsPerUsd: number;
  minimumUsd: number;
}

interface Usage {
  plan: Plan; label: string; priceMonthly: number | null;
  meters: Meter[];
  retention: { decisionLogDays: number; historyDays: number | null };
  seats: number; projects: number;
}

/**
 * Stripe's hosted portal login page.
 *
 * The in-app "Manage billing" button mints a portal session for the signed-in
 * customer, which is the better experience — no second sign-in. This is the
 * fallback for when that cannot work: an account with no Stripe customer
 * attached, or a portal call that failed. The customer enters their email and
 * Stripe sends them a one-time link.
 */
const PORTAL_LOGIN_URL = process.env.NEXT_PUBLIC_STRIPE_PORTAL_LOGIN_URL || '';

/**
 * /api/stripe/portal redirects BACK here with ?error= when it cannot open the
 * portal. Nothing rendered that, so every failure looked like a dead button —
 * the click navigated, bounced, and left the page looking untouched. To a
 * customer trying to cancel, a billing page that silently refuses is the worst
 * possible failure: it reads as being trapped in a subscription.
 */
const PORTAL_ERRORS: Record<string, { title: string; body: string; showFallback: boolean }> = {
  no_subscription: {
    title: 'We could not open your billing portal',
    body:
      'This account is not linked to a Stripe customer record, which usually means the ' +
      'subscription was set up under a different email address. Use the Stripe portal below ' +
      'with the address you paid from, and you will be able to cancel or update your card there.',
    showFallback: true,
  },
  portal_failed: {
    title: 'The billing portal did not open',
    body:
      'Something went wrong on our side rather than yours. You can reach the portal directly ' +
      'with the link below, or email us and we will sort it out.',
    showFallback: true,
  },
  user_not_found: {
    title: 'We could not find your account',
    body: 'Please sign out and back in, then try again. If it keeps happening, email us.',
    showFallback: true,
  },
};

/** The four ladder plans as the landing's pricing cards; Enterprise as the strip under them. */
const CARD_PLANS = SELLABLE_PLANS.filter(p => p !== 'enterprise');
const SELLS_ENTERPRISE = SELLABLE_PLANS.includes('enterprise');

export default function BillingClient({ buyable = [] }: { buyable?: string[] }) {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [topup, setTopup] = useState<string>('25');
  const [buying, setBuying] = useState(false);
  const [topupNote, setTopupNote] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<SellablePlan | null>(null);
  const params = useSearchParams();
  const portalError = params.get('error');
  const portalProblem = portalError ? (PORTAL_ERRORS[portalError] ?? PORTAL_ERRORS.portal_failed) : null;

  /**
   * Change an existing subscription rather than starting a second one.
   *
   * Someone with no subscription has nothing to update, so the API answers 409
   * with the checkout URL to use instead — that is the normal first-purchase
   * path, not an error worth showing.
   */
  const switchTo = async (target: SellablePlan) => {
    setSwitching(target);
    setMsg(null);
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: target, interval: 'annual' }),
      });
      const payload = await res.json().catch(() => null);

      if (res.status === 409 && payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }
      if (!payload?.success) {
        setMsg(payload?.message || payload?.error || 'Could not change your plan.');
        setSwitching(null);
        return;
      }
      setMsg('Plan updated. Your next invoice reflects the change, prorated from today.');
      // The tier is written by Stripe's webhook, which lands a moment later.
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setMsg('Could not reach billing. Please try again.');
      setSwitching(null);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') { if (status === 'unauthenticated') setLoading(false); return; }
    Promise.all([
      fetch('/api/account/usage', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/account/credits', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([u, c]) => {
      if (u?.success) setUsage(u.data);
      if (c?.success) setCredits(c.data);
    }).finally(() => setLoading(false));
  }, [status]);

  // Back from Stripe: credit the top-up now (the webhook does the same; whichever is first
  // wins), then refresh the balance.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const t = params.get('topup');
    if (t === 'cancelled') { setTopupNote('The top-up was cancelled — nothing was charged.'); return; }
    const sid = params.get('session_id');
    if (t !== 'done' || !sid) return;
    fetch(`/api/stripe/credits?session_id=${encodeURIComponent(sid)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setTopupNote(d?.success
          ? `Thank you — ${Number(d.data.requests).toLocaleString()} requests were added to your credits.`
          : 'Payment received. Your credits will appear here within a minute.');
        return fetch('/api/account/credits', { cache: 'no-store' }).then(r => r.json());
      })
      .then(c => { if (c?.success) setCredits(c.data); })
      .catch(() => setTopupNote('Payment received. Your credits will appear here within a minute.'));
  }, [status, params]);

  const buyCredits = async () => {
    setBuying(true); setTopupNote(null);
    try {
      const r = await fetch('/api/stripe/credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: Number(topup) }),
      });
      const d = await r.json().catch(() => null);
      if (d?.success && d.data?.url) { window.location.href = d.data.url; return; }
      setTopupNote(d?.error ?? 'Could not start checkout.');
    } catch { setTopupNote('Could not reach billing. Please try again.'); }
    setBuying(false);
  };

  // Signed out, AccountShell renders this page without the app shell: the landing scope carries the look.
  const guest = `lp ${lpBody.variable} ${lpDisplay.variable} sc-guest`;

  if (status === 'unauthenticated') {
    return (
      <div className={guest}>
        <section className="lp-hero lp-textured sc-guest-hero">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap sc-guest-mini">
            <p className="lp-kicker lp-intro">Account</p>
            <h1 className="sc-guest-t lp-intro" style={{ ['--d' as string]: '.06s' }}>Plan &amp; billing</h1>
            <p className="lp-lead lp-intro" style={{ ['--d' as string]: '.12s' }}>Sign in to see your plan.</p>
            <div className="lp-cta lp-intro" style={{ ['--d' as string]: '.18s' }}>
              <Link href="/auth/signin" className="lp-btn lp-btn-primary lp-btn-lg">Sign in <span className="lp-ar" aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>
      </div>
    );
  }
  if (loading) {
    return (
      status === 'authenticated'
        ? <div data-page-loading><Loader label="Loading your plan" minHeight={420} /></div>
        // Session still resolving: the public chrome is up and studio.css may not be, so no shared Loader.
        : <div data-page-loading className={guest}><div className="sc-guest-load" role="status"><span className="sc-bars" aria-hidden="true"><i /><i /><i /></span>Loading…</div></div>
    );
  }

  const plan: Plan = usage && isPlan(usage.plan) ? usage.plan : 'free';
  const e = PLANS[plan];
  const isLegacy = plan === 'legacy_pro';
  // Never shown as "legacy" — see uiplan.md §5.1.
  const planLabel = isLegacy ? 'Pro' : e.label;
  const price = e.priceMonthly === null ? 'Contracted' : e.priceMonthly === 0 ? 'Free' : `$${e.priceMonthly}/month`;
  const presetOn = (v: number) => Number(topup) === v;
  const topupOk = Number(topup) >= ROUTER_CREDITS.minimumUsd;

  /** What a plan card offers: the same four outcomes as before, in the card's button slot. */
  const planAction = (p: Plan, current: boolean): ReactNode => {
    if (current) return <p className="sc-plan-here">Your plan</p>;
    if (p === 'free' || p === 'enterprise') {
      return (
        <Link href={p === 'free' ? '/pricing' : '/assessment'} className="st-btn">
          {p === 'enterprise' ? 'Talk to us' : 'Compare'} <span className="st-ar" aria-hidden="true">→</span>
        </Link>
      );
    }
    if (buyable.includes(p)) {
      return (
        <button type="button" className="st-btn" onClick={() => switchTo(p as SellablePlan)} disabled={switching !== null}>
          {switching === p ? 'Switching…' : <>Switch <span className="st-ar" aria-hidden="true">→</span></>}
        </button>
      );
    }
    return <p className="sc-plan-soon">Available shortly</p>;
  };
  const cardPrice = (n: number | null): ReactNode =>
    n === null ? 'Talk to us' : n === 0 ? 'Free' : <>${n}<small>/mo</small></>;

  return (
    <>
      <PageHead
        kicker="Account"
        title="Plan & billing"
        lead="Your plan, what it includes, how much of it you are using, and how to change it."
      />

      <div className="st-body">
        {portalProblem && (
          <div className="st-note is-warn st-up">
            <div>
              <b className="st-note-t">{portalProblem.title}</b>
              {portalProblem.body}
              <div className="st-actions" style={{ marginTop: 12 }}>
                {portalProblem.showFallback && PORTAL_LOGIN_URL && (
                  <a href={PORTAL_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="st-btn is-primary is-sm">
                    Open the Stripe portal
                  </a>
                )}
                <Link href="/contact?topic=support" className="st-btn is-sm">Email us instead</Link>
              </div>
            </div>
          </div>
        )}

        {/* Current plan */}
        <section className="st-pane is-accent sc-plan st-up" aria-labelledby="sc-plan-name">
          <div className="sc-plan-body">
            <div className="sc-plan-main">
              <p className="st-label">Current plan</p>
              <h2 className="sc-plan-name" id="sc-plan-name">{planLabel}</h2>
              <div className="st-actions">
                {plan === 'free'
                  ? <Link href="/pricing" className="st-btn is-primary">See plans <span className="st-ar" aria-hidden="true">→</span></Link>
                  : <a href="/api/stripe/portal" className="st-btn is-primary">Manage billing</a>}
                <a href="#change-plan" className="st-btn">Change plan</a>
              </div>

              {/* A second route to the portal, always present for a paying customer.
                  "Manage billing" mints a session for them and needs no second
                  sign-in, but if it ever fails the customer must not be left without
                  a way to cancel — being unable to stop paying is the one failure
                  that is never acceptable on a billing page. */}
              {plan !== 'free' && PORTAL_LOGIN_URL && (
                <p className="sc-plan-fine">
                  Cancel, change your card or download invoices from the billing portal. If the button
                  above does not open it,{' '}
                  <a href={PORTAL_LOGIN_URL} target="_blank" rel="noopener noreferrer">sign in to Stripe directly</a>{' '}
                  with the email you pay from.
                </p>
              )}
            </div>

            <dl className="st-kv sc-plan-kv">
              <div><dt>Price</dt><dd><b>{price}</b></dd></div>
              <div><dt>History</dt><dd>{usage?.retention.historyDays === null ? 'everything we hold' : `${usage?.retention.historyDays} days`}</dd></div>
              <div><dt>Decision logs</dt><dd>{usage?.retention.decisionLogDays} days</dd></div>
              <div><dt>Seats</dt><dd>{isUnlimited(usage?.seats ?? 1) ? '∞' : usage?.seats}</dd></div>
            </dl>

            {isLegacy && (
              <div className="st-note sc-plan-legacy">
                <div>
                  You are on our original Pro plan — routing and Data API access included, at your
                  original <strong>{monthlyLong('legacy_pro')}</strong>, held until September 2027. Nothing in our
                  current pricing reduces what you have; you only move if you choose to.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Allowances */}
        <Pane
          title="Your allowances"
          sub="What you are using against what your plan includes. Provider inference is billed by your own providers and never appears here."
          ruled
          delay={0.06}
        >
          <div className="sc-meters">
            {(usage?.meters ?? []).map(m => (
              <div key={m.key} className="sc-meter">
                <div className="sc-meter-l">{m.label} <span className="st-faint">· {m.period}</span></div>
                <div className="sc-meter-v">
                  <b>{m.used.toLocaleString()}</b> / {isUnlimited(m.limit) ? '∞' : m.limit.toLocaleString()}
                </div>
                {isUnlimited(m.limit)
                  ? <div className="sc-meter-free">No limit on your plan</div>
                  : <MeterBar used={m.used} limit={m.limit} />}
              </div>
            ))}
          </div>
        </Pane>

        {/* Smart Router credits: what happens when the monthly allowance runs out */}
        <Pane title="Smart Router credits" sub="What happens when your monthly routing allowance runs out." ruled>
          <div className="sc-credits">
            <div>
              <p className="st-text">
                Your plan includes {credits ? (isUnlimited(credits.includedThisMonth) ? 'unlimited' : credits.includedThisMonth.toLocaleString()) : '…'} Smart
                Router requests a month. When they are used up, routing pauses — unless you hold credits, which are used
                one per successful request until the month resets. Nothing is ever billed after the fact: credits are
                bought in advance, from ${ROUTER_CREDITS.minimumUsd}, at {(credits?.requestsPerUsd ?? ROUTER_CREDITS.requestsPerUsd).toLocaleString()} requests per $1, and they do not expire.
              </p>
              <div className="sc-figs">
                <div>
                  <div className="sc-fig-v">
                    {credits ? `${credits.usedThisMonth.toLocaleString()} / ${isUnlimited(credits.includedThisMonth) ? '∞' : credits.includedThisMonth.toLocaleString()}` : '…'}
                  </div>
                  <div className="sc-fig-l">This month</div>
                </div>
                <div>
                  <div className="sc-fig-v">{credits ? `${credits.balance.toLocaleString()} requests` : '…'}</div>
                  <div className="sc-fig-l">Credits</div>
                </div>
              </div>
            </div>

            <div className="sc-topup">
              <p className="st-label">Top up</p>
              <div className="sc-topup-row">
                <div className="st-seg" role="group" aria-label="Top-up amount">
                  {[5, 25, 100].map(v => (
                    <button key={v} type="button" onClick={() => setTopup(String(v))} aria-pressed={presetOn(v)}>${v}</button>
                  ))}
                </div>
                <span className="sc-amount">
                  <span aria-hidden="true">$</span>
                  <input
                    type="number" min={ROUTER_CREDITS.minimumUsd} step={1} value={topup} aria-label="Top-up amount in US dollars"
                    onChange={e => setTopup(e.target.value)}
                    className="st-input"
                  />
                </span>
              </div>
              <button type="button" className="st-btn is-primary is-block" disabled={buying || !topupOk} onClick={buyCredits}>
                {buying ? 'Opening checkout…' : `Buy ${topupOk ? Math.floor(Number(topup) * (credits?.requestsPerUsd ?? ROUTER_CREDITS.requestsPerUsd)).toLocaleString() : '…'} requests`}
              </button>
              <p className="st-hint">
                Minimum ${ROUTER_CREDITS.minimumUsd}, no maximum. Paid by card through Stripe, with an invoice. Topping up
                every month? On Developer and Teams a request costs less than a credit.
              </p>
              {topupNote && <p className="sc-topup-note" role="status">{topupNote}</p>}
            </div>
          </div>
        </Pane>

        {/* Change plan: the landing's pricing cards */}
        <section className="sc-sec sc-anchor st-up" id="change-plan" aria-labelledby="sc-change-t">
          <div className="sc-sec-head">
            <div>
              <p className="st-kicker">Plans</p>
              <h2 className="sc-sec-t" id="sc-change-t">Change plan</h2>
              <p className="sc-sec-sub">
                {isLegacy
                  ? `Moving to a current plan ends your held ${monthlyLong('legacy_pro')} price. Compare carefully before switching — your plan already includes routing and Data API access.`
                  : 'Every plan collects a payment method at checkout, including during a free trial, and you can cancel any time.'}
              </p>
            </div>
          </div>
          {msg && <div className="st-note" role="status"><div>{msg}</div></div>}
          <div className="lp-plans sc-plans">
            {CARD_PLANS.map(p => {
              const pe = PLANS[p];
              const current = p === plan || (isLegacy && p === 'pro');
              return (
                <div key={p} className={`lp-plan${current ? ' is-pop' : ''}`}>
                  <p className="lp-plan-n">{pe.label}</p>
                  <p className="lp-plan-p">{cardPrice(pe.priceMonthly)}</p>
                  <p className="lp-plan-pitch">{PITCH[p]}</p>
                  {planAction(p, current)}
                </div>
              );
            })}
          </div>
          {SELLS_ENTERPRISE && (
            <div className="lp-ent sc-ent">
              <p><b>{PLANS.enterprise.label}</b><span>{PITCH.enterprise}</span></p>
              {planAction('enterprise', plan === 'enterprise')}
            </div>
          )}
          <p className="st-hint">
            Full comparison on the <Link href="/pricing" className="st-link-inline">pricing page</Link>.
          </p>
        </section>
      </div>
    </>
  );
}
