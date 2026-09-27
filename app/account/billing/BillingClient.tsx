'use client';

/**
 * Plan & billing — replaces the binary Free/Pro `/router/subscription`.
 *
 * The old page hard-coded $4.99 twice, could only express two plans, and told Pro
 * customers they had "Unlimited" API calls when the real limit was 10,000/day. It
 * also showed the free API limit as 100/day when it is 10. Every number here is
 * read from the entitlement table or measured usage instead.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { monthlyLong } from '@/lib/pricing-display';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PLANS, SELLABLE_PLANS, ROUTER_CREDITS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';
import type { SellablePlan } from '@/lib/stripe-plans';

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

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6,
  padding: '18px 20px',
};

function Bar({ used, limit }: { used: number; limit: number }) {
  if (isUnlimited(limit)) {
    return <div style={{ fontSize: '0.8em', color: 'var(--phosphor-green)' }}>No limit on your plan</div>;
  }
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const colour = pct >= 90 ? 'var(--red-alert, #d93025)' : pct >= 70 ? 'var(--amber-warning)' : 'var(--phosphor-green)';
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'rgba(128,128,128,0.18)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width .3s ease' }} />
    </div>
  );
}

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

  if (status === 'unauthenticated') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.3em', marginBottom: 12 }}>Plan &amp; billing</h1>
        <p style={{ color: 'var(--phosphor-dim)', marginBottom: 22 }}>Sign in to see your plan.</p>
        <Link href="/auth/signin" className="vintage-btn" style={{ padding: '11px 22px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <div data-page-loading style={{ padding: 50, textAlign: 'center', color: 'var(--phosphor-dim)' }}>Loading…</div>;

  const plan: Plan = usage && isPlan(usage.plan) ? usage.plan : 'free';
  const e = PLANS[plan];
  const isLegacy = plan === 'legacy_pro';
  // Never shown as "legacy" — see uiplan.md §5.1.
  const planLabel = isLegacy ? 'Pro' : e.label;
  const price = e.priceMonthly === null ? 'Contracted' : e.priceMonthly === 0 ? 'Free' : `$${e.priceMonthly}/month`;

  return (
    <div className="acct-page">
      <h1 style={{ fontSize: '1.4em', margin: '0 0 20px' }}>Plan &amp; billing</h1>

      {portalProblem && (
        <div style={{
          marginBottom: 18, padding: '14px 16px', borderRadius: 6, lineHeight: 1.6,
          border: '1px solid var(--amber-warning, #f9ab00)', background: 'rgba(249,171,0,0.07)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{portalProblem.title}</div>
          <div style={{ fontSize: '0.88em', color: 'var(--phosphor-dim)' }}>{portalProblem.body}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {portalProblem.showFallback && PORTAL_LOGIN_URL && (
              <a href={PORTAL_LOGIN_URL} target="_blank" rel="noopener noreferrer"
                className="vintage-btn vintage-btn--primary"
                style={{ padding: '8px 16px', textDecoration: 'none', fontSize: '0.86em' }}>
                Open the Stripe portal
              </a>
            )}
            <Link href="/contact?topic=support" className="vintage-btn"
              style={{ padding: '8px 16px', textDecoration: 'none', fontSize: '0.86em' }}>
              Email us instead
            </Link>
          </div>
        </div>
      )}

      <div className="acct-grid">
      {/* Current plan */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Current plan</div>
            <div style={{ fontSize: '1.6em', fontWeight: 700, margin: '4px 0' }}>{planLabel}</div>
            <div style={{ fontSize: '0.95em', color: 'var(--phosphor-dim)' }}>{price}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plan === 'free'
              ? <Link href="/pricing" className="vintage-btn" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>See plans</Link>
              : <a href="/api/stripe/portal" className="md-ctrl-btn" style={{ padding: '9px 16px', textDecoration: 'none', fontSize: '0.86em' }}>Manage billing</a>}
          </div>
        </div>

        {/* A second route to the portal, always present for a paying customer.
            "Manage billing" mints a session for them and needs no second
            sign-in, but if it ever fails the customer must not be left without
            a way to cancel — being unable to stop paying is the one failure
            that is never acceptable on a billing page. */}
        {plan !== 'free' && PORTAL_LOGIN_URL && (
          <p style={{ margin: '12px 0 0', fontSize: '0.8em', color: 'var(--phosphor-dim)', lineHeight: 1.6 }}>
            Cancel, change your card or download invoices from the billing portal. If the button
            above does not open it,{' '}
            <a href={PORTAL_LOGIN_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent, #1a73e8)' }}>
              sign in to Stripe directly
            </a>{' '}
            with the email you pay from.
          </p>
        )}

        {isLegacy && (
          <p style={{
            marginTop: 16, marginBottom: 0, padding: '11px 13px', borderRadius: 4,
            background: 'rgba(26,115,232,0.06)', border: '1px solid rgba(26,115,232,0.25)',
            fontSize: '0.85em', lineHeight: 1.6,
          }}>
            You are on our original Pro plan — routing and Data API access included, at your
            original <strong>{monthlyLong('legacy_pro')}</strong>, held until September 2027. Nothing in our
            current pricing reduces what you have; you only move if you choose to.
          </p>
        )}
      </section>

      {/* Allowances */}
      <section style={card}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Your allowances</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 18px', lineHeight: 1.6 }}>
          What you are using against what your plan includes. Provider inference is billed by
          your own providers and never appears here.
        </p>
        {(usage?.meters ?? []).map(m => (
          <div key={m.key} style={{ marginBottom: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86em', marginBottom: 6 }}>
              <span>{m.label} <span style={{ color: 'var(--phosphor-dim)' }}>· {m.period}</span></span>
              <span style={{ color: 'var(--phosphor-dim)' }}>
                {m.used.toLocaleString()} / {isUnlimited(m.limit) ? '∞' : m.limit.toLocaleString()}
              </span>
            </div>
            <Bar used={m.used} limit={m.limit} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: '0.82em', color: 'var(--phosphor-dim)', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
          <span>History: {usage?.retention.historyDays === null ? 'everything we hold' : `${usage?.retention.historyDays} days`}</span>
          <span>Decision logs: {usage?.retention.decisionLogDays} days</span>
          <span>Seats: {isUnlimited(usage?.seats ?? 1) ? '∞' : usage?.seats}</span>
        </div>
      </section>

      {/* Smart Router credits: what happens when the monthly allowance runs out */}
      <section style={card}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Smart Router credits</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Your plan includes {credits ? (isUnlimited(credits.includedThisMonth) ? 'unlimited' : credits.includedThisMonth.toLocaleString()) : '…'} Smart
          Router requests a month. When they are used up, routing pauses — unless you hold credits, which are used
          one per successful request until the month resets. Nothing is ever billed after the fact: credits are
          bought in advance, from ${ROUTER_CREDITS.minimumUsd}, at {(credits?.requestsPerUsd ?? ROUTER_CREDITS.requestsPerUsd).toLocaleString()} requests per $1, and they do not expire.
        </p>

        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>This month</div>
            <div style={{ fontSize: '1.15em', fontWeight: 600 }}>
              {credits ? `${credits.usedThisMonth.toLocaleString()} / ${isUnlimited(credits.includedThisMonth) ? '∞' : credits.includedThisMonth.toLocaleString()}` : '…'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>Credits</div>
            <div style={{ fontSize: '1.15em', fontWeight: 600 }}>{credits ? `${credits.balance.toLocaleString()} requests` : '…'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[5, 25, 100].map(v => (
            <button key={v} type="button" onClick={() => setTopup(String(v))} aria-pressed={Number(topup) === v}
              style={{
                height: 36, padding: '0 14px', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.88em',
                fontWeight: Number(topup) === v ? 600 : 400,
                border: `1px solid ${Number(topup) === v ? 'var(--accent)' : 'var(--metal-silver)'}`,
                background: Number(topup) === v ? 'var(--accent-bg)' : 'var(--terminal-dark)',
                color: Number(topup) === v ? 'var(--accent)' : 'var(--phosphor-green)',
              }}>${v}</button>
          ))}
          <span style={{ fontSize: '0.9em', marginLeft: 6 }}>$</span>
          <input
            type="number" min={ROUTER_CREDITS.minimumUsd} step={1} value={topup} aria-label="Top-up amount in US dollars"
            onChange={e => setTopup(e.target.value)}
            style={{
              width: 110, height: 36, padding: '0 10px', font: 'inherit', fontSize: '0.9em',
              background: 'var(--terminal-dark)', border: '1px solid var(--metal-silver)', borderRadius: 6, color: 'inherit',
            }}
          />
          <button type="button" className="vintage-btn vintage-btn--primary" disabled={buying || !(Number(topup) >= ROUTER_CREDITS.minimumUsd)}
            onClick={buyCredits} style={{ padding: '8px 16px', fontSize: '0.88em' }}>
            {buying ? 'Opening checkout…' : `Buy ${Number(topup) >= ROUTER_CREDITS.minimumUsd ? Math.floor(Number(topup) * (credits?.requestsPerUsd ?? ROUTER_CREDITS.requestsPerUsd)).toLocaleString() : '…'} requests`}
          </button>
        </div>
        <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 10, marginBottom: 0, lineHeight: 1.55 }}>
          Minimum ${ROUTER_CREDITS.minimumUsd}, no maximum. Paid by card through Stripe, with an invoice. Topping up
          every month? On Developer and Teams a request costs less than a credit.
        </p>
        {topupNote && <p style={{ fontSize: '0.85em', color: 'var(--phosphor-green)', marginTop: 10, marginBottom: 0 }}>{topupNote}</p>}
      </section>

      {/* Change plan */}
      {/* spans: the plan cards below need the full row */}
      <section className="acct-wide" style={card}>
        <h2 style={{ fontSize: '1.02em', margin: '0 0 4px', fontWeight: 600 }}>Change plan</h2>
        <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
          {isLegacy
            ? `Moving to a current plan ends your held ${monthlyLong('legacy_pro')} price. Compare carefully before switching — your plan already includes routing and Data API access.`
            : 'Every plan collects a payment method at checkout, including during a free trial, and you can cancel any time.'}
        </p>
        {msg && <p role="status" style={{ fontSize: '0.85em', color: 'var(--phosphor-green)', margin: '0 0 12px' }}>{msg}</p>}
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {SELLABLE_PLANS.map(p => {
            const pe = PLANS[p];
            const current = p === plan || (isLegacy && p === 'pro');
            return (
              <div key={p} style={{
                border: `1px solid ${current ? 'var(--phosphor-green)' : 'var(--border-subtle, #2a2a2a)'}`,
                borderRadius: 5, padding: '12px 13px',
              }}>
                <div style={{ fontSize: '0.86em', fontWeight: 600 }}>{pe.label}</div>
                <div style={{ fontSize: '1.05em', fontWeight: 700, margin: '3px 0 8px' }}>
                  {pe.priceMonthly === null ? 'Talk to us' : pe.priceMonthly === 0 ? 'Free' : `$${pe.priceMonthly}/mo`}
                </div>
                {current ? (
                  <div style={{ fontSize: '0.78em', color: 'var(--phosphor-green)' }}>Your plan</div>
                ) : p === 'free' || p === 'enterprise' ? (
                  <Link href={p === 'free' ? '/pricing' : '/assessment'} style={{ fontSize: '0.8em', color: 'var(--phosphor-green)' }}>
                    {p === 'enterprise' ? 'Talk to us →' : 'Compare →'}
                  </Link>
                ) : buyable.includes(p) ? (
                  <button
                    onClick={() => switchTo(p as SellablePlan)}
                    disabled={switching !== null}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontSize: '0.8em', color: 'var(--phosphor-green)', fontFamily: 'inherit',
                      opacity: switching !== null ? 0.5 : 1,
                    }}>
                    {switching === p ? 'Switching…' : 'Switch →'}
                  </button>
                ) : (
                  <span style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>Available shortly</span>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 16, marginBottom: 0 }}>
          Full comparison on the <Link href="/pricing" style={{ color: 'var(--phosphor-green)' }}>pricing page</Link>.
        </p>
      </section>
      </div>
    </div>
  );
}
