'use client';

/**
 * The pricing page.
 *
 * EVERY NUMBER HERE COMES FROM lib/entitlements.ts.
 *
 * Nothing on this page is typed out by hand. The previous site had $4.99
 * hard-coded in fourteen places and an entitlement story that contradicted what
 * the dashboard actually locked; rendering from the plan table makes that class
 * of drift impossible. If a limit looks wrong, fix the table, not this file.
 *
 * ANNUAL IS THE DEFAULT
 * ---------------------
 * Annual is ten months' money for twelve months' service, so it is both the
 * better deal for the customer and the better outcome for us — it collects a
 * year up front and takes a subscriber out of the monthly churn cycle that cost
 * this business more than half its payers. Showing it first is not a trick; the
 * monthly price stays one click away and every card states plainly what is
 * billed, how often, and what the monthly equivalent works out to.
 *
 * WHAT IS DELIBERATELY NOT SOLD HERE
 * ----------------------------------
 * The "Evaluation units" row was removed. The entitlement exists and the usage
 * meter reads it, but there is no ingestion path, no runner and no UI — so no
 * customer can spend one. Advertising an allowance nobody can consume is the
 * same mistake as the SOC 2 and peer-review claims that had to be walked back;
 * the row returns when the engine does.
 */

import { useState } from 'react';
import Link from 'next/link';
import { PLANS, SELLABLE_PLANS, DATA_API_LIMITS, isUnlimited, planMeets, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { SAVINGS_PCT, SAVINGS_QUALIFIER } from '@/lib/savings-estimate';
import { upgradeHref } from '@/lib/checkout-url';

type Interval = 'monthly' | 'annual';

const fmt = (n: number) => (isUnlimited(n) ? 'Unlimited' : n.toLocaleString());

/** Price to one decimal only when it needs one — "$7.50", but "$9". */
const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

const ROWS: Array<{ label: string; get: (p: Plan) => string; note?: string }> = [
  { label: 'Tracked models',        get: p => fmt(PLANS[p].watchedModels) },
  { label: 'Comparable history',    get: p => PLANS[p].historyDays === null ? 'Everything we hold' : `${PLANS[p].historyDays} days` },
  { label: 'Category rankings',     get: p => PLANS[p].categorySorts ? 'Yes' : 'No', note: 'Coding, reasoning, tool-calling and price sorts' },
  { label: 'Calibration & known-unknowns', get: p => planMeets(p, REQUIRED_PLAN.calibration) ? 'Yes' : '—',
    note: 'Per model: how often it invents an answer to a question that has none, and whether its stated confidence is worth anything' },
  { label: 'Cheaper substitutes',   get: p => planMeets(p, REQUIRED_PLAN.substitutes) ? 'Yes' : '—',
    note: 'Which cheaper models can do a given model’s work, and the measured share of working requests that would start failing if you switched' },
  { label: 'Data API',              get: p => { const t = DATA_API_LIMITS[PLANS[p].dataApiTier]; return `${fmt(t.daily)}/day · ${fmt(t.perMinute)}/min`; },
    note: 'Keyed JSON access to scores, history and drift. The free tier is for building against, not for running on' },
  { label: 'Routed requests / mo',  get: p => fmt(PLANS[p].routerRequestsPerMonth), note: 'You bring your own provider keys; providers bill you for inference directly' },
  { label: 'Decision-log history',  get: p => `${PLANS[p].routerDiagnosticDays} days` },
  { label: 'Editor seats',          get: p => fmt(PLANS[p].seats), note: 'Viewers are unlimited on plans with projects' },
  { label: 'Projects',              get: p => PLANS[p].projects === 0 ? '—' : fmt(PLANS[p].projects) },
  { label: 'Exports',               get: p => PLANS[p].exports ? 'Yes' : '—' },
  { label: 'Webhooks',              get: p => PLANS[p].webhooks ? 'Yes' : '—' },
  { label: 'Custom alert thresholds', get: p => PLANS[p].customAlerts ? 'Yes' : '—' },
  { label: 'SSO, SCIM & audit trail', get: p => (p === 'teams' || p === 'enterprise') ? 'Yes' : '—', note: 'OIDC or SAML, directory provisioning, exportable audit log' },
];

/** One-line summary of what a plan is for. */
const PITCH: Record<Plan, string> = {
  free: 'Track three models and get a weekly summary of what changed.',
  pro: 'Full history, the diagnosis behind every change, calibration data, exports and custom alerts.',
  developer: 'Production routing volume, 30-day decision logs and your own workspace.',
  teams: 'Five editors, shared watchlists, webhooks, SSO and the audit trail.',
  enterprise: 'Contracted scope, unlimited seats, 365-day retention and invoicing.',
  legacy_pro: '',
};

export default function PricingClient({ buyable = [] }: { buyable?: string[] }) {
  // Annual first. See the note at the top of this file.
  const [interval, setInterval] = useState<Interval>('annual');

  const annual = interval === 'annual';

  const cta = (p: Plan): { href: string | null; label: string } => {
    if (p === 'free') return { href: '/auth/signup', label: 'Create free account' };
    if (p === 'enterprise') return { href: upgradeHref('enterprise', interval), label: 'Talk to us' };
    // Not yet configured in Stripe: show it, do not sell it.
    if (!buyable.includes(p)) return { href: null, label: 'Available shortly' };
    return { href: upgradeHref(p, interval), label: 'Start free trial' };
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 70px' }}>
      <h1 style={{ fontSize: '1.6em', margin: '0 0 8px' }}>Know when your model decisions stop being right</h1>
      <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.6, maxWidth: 680, margin: '0 0 22px' }}>
        The evidence is free — current scores, every category ranking, seven days of history and the
        full methodology. Paid plans buy depth and workflow: longer comparable history, the diagnosis
        behind a change, more tracked models, routing and team features.
      </p>

      {/* Interval switch. Annual is pre-selected and carries the saving on its face. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 6, border: '1px solid var(--border-subtle, #2a2a2a)' }}>
          {(['annual', 'monthly'] as Interval[]).map(i => (
            <button key={i} onClick={() => setInterval(i)} className="md-ctrl-btn"
              style={{
                padding: '7px 16px', fontSize: '0.86em', borderRadius: 4, cursor: 'pointer',
                background: interval === i ? 'var(--accent, #1a73e8)' : 'transparent',
                color: interval === i ? '#fff' : 'inherit',
                borderColor: interval === i ? 'var(--accent, #1a73e8)' : 'transparent',
                fontWeight: interval === i ? 600 : 400,
              }}>
              {i === 'annual' ? 'Annual' : 'Monthly'}
            </button>
          ))}
        </div>
        <span style={{
          fontSize: '0.82em', padding: '5px 11px', borderRadius: 999,
          background: 'rgba(26,115,232,0.10)', color: 'var(--accent, #1a73e8)',
          border: '1px solid rgba(26,115,232,0.3)', fontWeight: 600,
        }}>
          Annual = 12 months for the price of 10
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 36 }}>
        {SELLABLE_PLANS.map(p => {
          const e = PLANS[p];
          const c = cta(p);
          const highlight = p === 'teams';

          // Three numbers, because they answer three different questions: what
          // it costs per month to compare against the monthly option, what will
          // actually be charged, and what the choice saves.
          const perMonth = e.priceMonthly === null ? null
            : annual && e.priceAnnual !== null ? e.priceAnnual / 12 : e.priceMonthly;
          const billed = e.priceMonthly === null ? null
            : annual && e.priceAnnual !== null ? e.priceAnnual : e.priceMonthly;
          const saving = annual && e.priceMonthly && e.priceAnnual !== null
            ? e.priceMonthly * 12 - e.priceAnnual
            : 0;

          return (
            <div key={p} style={{
              padding: '16px 15px', borderRadius: 6, position: 'relative',
              border: `1px solid ${highlight ? 'var(--accent, #1a73e8)' : 'var(--border-subtle, #2a2a2a)'}`,
              boxShadow: highlight ? '0 0 0 1px var(--accent, #1a73e8)' : 'none',
              background: highlight ? 'rgba(26,115,232,0.04)' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {highlight && (
                <span style={{
                  position: 'absolute', top: -9, left: 14, fontSize: '0.68em', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase', padding: '2px 8px',
                  borderRadius: 999, background: 'var(--accent, #1a73e8)', color: '#fff',
                }}>
                  Most complete
                </span>
              )}

              <div style={{ fontWeight: 700 }}>{e.label}</div>

              {e.priceMonthly === null ? (
                <div style={{ fontSize: '1.45em', fontWeight: 700 }}>Let&rsquo;s talk</div>
              ) : e.priceMonthly === 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '1.45em', fontWeight: 700 }}>$0</span>
                    <span style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>/mo</span>
                  </div>
                  <div style={{ fontSize: '0.76em', color: 'var(--phosphor-dim)' }}>Forever. No card required.</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: '1.45em', fontWeight: 700 }}>{money(perMonth!)}</span>
                    <span style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>/mo</span>
                  </div>
                  <div style={{ fontSize: '0.76em', color: 'var(--phosphor-dim)', lineHeight: 1.5 }}>
                    {annual ? (
                      <>
                        {money(billed!)} billed yearly
                        {saving > 0 && (
                          <>
                            <br />
                            <span style={{ color: 'var(--phosphor-green)', fontWeight: 600 }}>
                              Save {money(saving)} a year
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {money(billed!)} billed monthly
                        {e.priceAnnual !== null && (
                          <>
                            <br />
                            <span style={{ opacity: 0.85 }}>
                              {money(e.priceAnnual / 12)}/mo on annual
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              <div style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', lineHeight: 1.5, flex: 1, marginTop: 2 }}>
                {PITCH[p]}
              </div>

              {c.href ? (
                <Link href={c.href}
                  className={highlight ? 'vintage-btn vintage-btn--primary' : 'vintage-btn'}
                  style={{
                    padding: '9px 10px', textAlign: 'center', textDecoration: 'none',
                    fontSize: '0.85em', whiteSpace: 'normal', lineHeight: 1.3,
                  }}>
                  {c.label}
                </Link>
              ) : (
                <span
                  title="This plan is not open for sign-up yet"
                  style={{
                    padding: '9px 10px', textAlign: 'center', fontSize: '0.85em',
                    lineHeight: 1.3, border: '1px dashed var(--border-subtle, #2a2a2a)',
                    borderRadius: 3, color: 'var(--phosphor-dim)', cursor: 'default',
                  }}>
                  {c.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bespoke work sits outside the plan ladder on purpose: it is contracted and
          human-operated, so it has no entitlement row and nothing here is self-serve.
          Saying that plainly is the point — the evaluation-units row was removed from
          the table above for advertising an allowance no customer could spend, and a
          custom benchmark described as though it were a feature toggle would repeat it. */}
      <h2 style={{ fontSize: '1.05em', margin: '32px 0 4px' }}>Beyond the plans</h2>
      <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: '0 0 14px', maxWidth: 720 }}>
        The plans above measure the models everyone can see. These two measure <em>your</em> workload
        instead. Both are contracted and run by us rather than switched on in the product, and both
        start with a scoping conversation in which we will tell you if your workload is not one we
        can measure reliably.
      </p>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 34 }}>
        <div style={{
          padding: '18px 17px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10,
          border: '1px solid var(--accent, #1a73e8)', background: 'rgba(26,115,232,0.04)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.02em' }}>Custom continuous benchmarking</div>
            <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 3 }}>Contracted · priced on scope</div>
          </div>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            A public benchmark measures general capability. If you use a model for one specific job —
            triaging claims, reviewing code, pulling fields out of your own documents — a general
            score only tells you so much. We build a benchmark out of your workload and run it on the
            same schedule as the public suites, so you learn when a model gets worse at{' '}
            <em>your</em> job rather than at ours.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.83em', lineHeight: 1.75, color: 'var(--phosphor-dim)' }}>
            <li>A task set built from your real work, with the answer keys held out of the prompt</li>
            <li>Run repeatedly against the models you actually use, scored on the median of several trials</li>
            <li>The same change detection the public board runs, with a baseline for your suite alone</li>
            <li>Results reach you through the alerts, webhooks, exports and Data API your plan already has</li>
            <li>A scheduled review of what moved, and whether it is worth changing model</li>
            <li>Your tasks stay yours: never published, never folded into the public corpus</li>
          </ul>
          <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', lineHeight: 1.55, margin: 0, opacity: 0.85 }}>
            We run your suite on our own provider accounts. You do not share API keys with us, and you
            do not carry the inference bill — it is ours, and it is included in the contracted price.
            That is also what scope means here: how many tasks, how many models and how often they run
            is precisely what the measurement costs us to produce, so it is what sets the price.
          </p>
          <Link href="/contact?topic=custom-benchmark" className="vintage-btn vintage-btn--primary"
            style={{ padding: '9px 10px', textAlign: 'center', textDecoration: 'none', fontSize: '0.85em', marginTop: 'auto' }}>
            Talk to us about your workload
          </Link>
        </div>

        <div style={{
          padding: '18px 17px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10,
          border: '1px solid var(--border-subtle, #2a2a2a)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.02em' }}>Workload assessment</div>
            <div style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 3 }}>$490 · one-off, fixed scope</div>
          </div>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            The smaller first step, and the usual way into continuous benchmarking. One workload,
            measured once, against three candidate models — using your tasks rather than ours — with a
            decision report at the end. Including, where the evidence supports it, a recommendation to
            change nothing.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.83em', lineHeight: 1.75, color: 'var(--phosphor-dim)' }}>
            <li>Up to 20 tasks you supply, three candidate models</li>
            <li>A decision report within seven business days of us having what we need</li>
            <li>Credited in full against an annual plan bought within 30 days</li>
            <li>Refunded if we cannot deliver the agreed report</li>
          </ul>
          <Link href="/assessment" className="vintage-btn"
            style={{ padding: '9px 10px', textAlign: 'center', textDecoration: 'none', fontSize: '0.85em', marginTop: 'auto' }}>
            See what an assessment covers
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.05em', margin: '0 0 12px' }}>What each plan includes</h2>
        {/* On a phone the table is wider than the viewport and the paid columns sit
            off-screen. Without this the page silently hides the plans someone is
            most likely to buy. */}
        <span className="pricing-scroll-hint" style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)' }}>
          swipe to compare →
        </span>
      </div>
      <div className="pricing-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--phosphor-dim)' }}>
              <th className="pricing-row-label" style={{ padding: '8px 10px 8px 0' }}></th>
              {SELLABLE_PLANS.map(p => <th key={p} style={{ padding: '8px 10px' }}>{PLANS[p].label}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.label} style={{ borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
                <td className="pricing-row-label" style={{ padding: '9px 10px 9px 0', color: 'var(--phosphor-dim)' }}>
                  {r.label}
                  {r.note && <div style={{ fontSize: '0.85em', opacity: 0.7, lineHeight: 1.4 }}>{r.note}</div>}
                </td>
                {SELLABLE_PLANS.map(p => (
                  <td key={p} style={{ padding: '9px 10px' }}>{r.get(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cadence and trial counts only. No fleet size: the number of tracked models
          changes whenever a model is retired — seven went on one day — and a hard-coded
          count on a pricing page is the drift this file exists to prevent. */}
      <h2 style={{ fontSize: '1.05em', margin: '32px 0 4px' }}>What you are actually buying</h2>
      <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: '0 0 14px', maxWidth: 720 }}>
        Every plan reads the same measurement. What you pay for is how much of it you can see, how far
        back, and what you can wire it into.
      </p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 6 }}>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Four suites, on a fixed schedule</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            Coding runs every four hours on real repository defects, graded by the project&rsquo;s own test
            suite including tests the model never sees. Multi-turn reasoning and tool-calling run daily.
            A small probe runs hourly to catch a sudden change between full runs.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Repeated, then taken as a median</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            Each coding task runs seven times and the median is scored, because one sample cannot tell a
            model getting worse from a model having a bad afternoon. That repetition is most of what the
            benchmark costs to run, and it is why an alert is worth believing.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Gaps are shown, not filled</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            If a provider declines a task or a session does not finish, that task drops out rather than
            being scored zero. The row says how much of the set it covers, and a score measured over
            fewer tasks is never called tied with one measured over all of them.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Free is a real tier</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            Current scores, every category ranking, seven days of history and the full methodology cost
            nothing and need no account. A benchmark nobody can check is not worth reading, so the
            evidence is not the paid part. Depth and workflow are.
          </p>
        </section>
      </div>

      <div style={{ marginTop: 28, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>What happens at a limit</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            Nothing breaks silently. Routing stops at your monthly allowance unless you choose in billing
            settings to continue and be charged for the overage. Data API calls beyond the ceiling are
            refused with a clear error rather than throttled into a timeout.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Why annual is cheaper</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            There is no discount code and no countdown. An annual plan is billed once instead of
            twelve times, which costs us less in payment fees and in churn, and we pass that back as
            two free months. You can still cancel; we do not hold you to the year.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>What we do not charge for</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            On every plan above, provider inference. You connect your own OpenAI, Anthropic, Google,
            DeepSeek, Kimi or GLM keys, and those providers bill you directly at their rates. We charge
            for the software and the measurement, never a markup on tokens. Custom continuous
            benchmarking works the other way round and says so on its card: we run it on our accounts
            and the inference is in the price.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Existing subscribers</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            If you already subscribe, you keep your current price and everything you already had for
            at least twelve months. Nothing about these plans reduces what you have today. Your plan
            only changes if you choose to change it, or if you cancel and come back later.
          </p>
        </section>
        <section>
          <h3 style={{ fontSize: '0.95em', margin: '0 0 6px' }}>Does routing save money?</h3>
          <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
            In our own benchmark the cheapest model matching the top score cost about {SAVINGS_PCT}% less
            per request. {SAVINGS_QUALIFIER}
          </p>
        </section>
      </div>

      <p style={{ fontSize: '0.78em', color: 'var(--phosphor-dim)', marginTop: 26, lineHeight: 1.6 }}>
        Prices in USD, excluding any applicable tax. Every plan collects a payment method at checkout,
        including during a free trial, and you can cancel at any time from the billing portal.
        Questions about a plan? <Link href="/contact?topic=sales" style={{ color: 'var(--accent, #1a73e8)' }}>Talk to us</Link>.
      </p>
    </div>
  );
}
