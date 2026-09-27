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

import { Fragment, useState } from 'react';
import { ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';
import Link from 'next/link';
import { PLANS, SELLABLE_PLANS, DATA_API_LIMITS, ROUTER_CREDITS, isUnlimited, planMeets, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { SAVINGS_PCT, SAVINGS_QUALIFIER } from '@/lib/savings-estimate';
import { upgradeHref } from '@/lib/checkout-url';
import '../../styles/pricing.css';

type Interval = 'monthly' | 'annual';

const fmt = (n: number) => (isUnlimited(n) ? 'Unlimited' : n.toLocaleString());

/** Price to one decimal only when it needs one — "$7.50", but "$9". */
const money = (n: number) => (Number.isInteger(n)
  ? `$${n.toLocaleString('en-US')}`   // "$1,290", not "$1290"
  : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

type Row = { label: string; get: (p: Plan) => string; note?: string };

/** The comparison table, in three groups. Every value is read from the plan table. */
const GROUPS: Array<{ title: string; rows: Row[] }> = [
  { title: 'Monitoring', rows: [
    { label: 'Tracked models',        get: p => fmt(PLANS[p].watchedModels), note: 'Email alerts when one drops, and a weekly summary' },
    { label: 'Comparable history',    get: p => PLANS[p].historyDays === null ? 'Full history' : `${PLANS[p].historyDays} days` },
    { label: 'Category rankings',     get: p => PLANS[p].categorySorts ? 'Yes' : '—', note: 'Coding, reasoning, tool-calling and price sorts' },
    { label: 'Calibration & known-unknowns', get: p => planMeets(p, REQUIRED_PLAN.calibration) ? 'Yes' : '—',
      note: 'Per model: how often it invents an answer to a question that has none, and whether its stated confidence is worth anything' },
    { label: 'Cheaper substitutes',   get: p => planMeets(p, REQUIRED_PLAN.substitutes) ? 'Yes' : '—',
      note: 'Which cheaper models can do a given model’s work, and the measured share of working requests that would start failing if you switched' },
    { label: 'Custom alert thresholds', get: p => PLANS[p].customAlerts ? 'Yes' : '—' },
    { label: 'Exports',               get: p => PLANS[p].exports ? 'Yes' : '—', note: 'Model reports and routing analytics as CSV or JSON' },
  ] },
  { title: 'Smart Router and Data API', rows: [
    { label: 'Smart Router requests / month', get: p => fmt(PLANS[p].routerRequestsPerMonth),
      note: `The router picks the best model for each request and sends it with your own provider keys, so providers bill the tokens to you directly. Past the allowance, top up from $${ROUTER_CREDITS.minimumUsd} (${ROUTER_CREDITS.requestsPerUsd.toLocaleString('en-US')} requests per $1) or move up a plan` },
    { label: 'Routing analytics',     get: p => planMeets(p, REQUIRED_PLAN['routing-analytics']) ? 'Yes' : '—', note: 'What each request cost, which model served it, and the trend' },
    { label: 'API monitoring',        get: p => planMeets(p, REQUIRED_PLAN['api-monitoring']) ? 'Yes' : '—',
      note: 'Per-key request logs, cost dashboard, prompt auditing with secret scrubbing, and budget limits per key' },
    { label: 'Decision-log history',  get: p => `${PLANS[p].routerDiagnosticDays} days`, note: 'How far back you can see why each request went to the model it did' },
    { label: 'Data API',              get: p => { const t = DATA_API_LIMITS[PLANS[p].dataApiTier]; return `${fmt(t.daily)}/day · ${fmt(t.perMinute)}/min`; },
      note: 'Keyed JSON access to scores, history and drift. The free tier is for building against, not for running on' },
    { label: 'Webhooks',              get: p => PLANS[p].webhooks ? 'Yes' : '—', note: 'Signed callbacks when a model you watch regresses' },
  ] },
  { title: 'Team', rows: [
    { label: 'Editor seats',          get: p => fmt(PLANS[p].seats), note: 'On Teams and Enterprise every editor gets the plan’s features and limits. Viewers are unlimited and read-only' },
    { label: 'SSO, SCIM & audit trail', get: p => planMeets(p, REQUIRED_PLAN.governance) ? 'Yes' : '—', note: 'OIDC or SAML, directory provisioning, exportable audit log' },
  ] },
];

/** One-line summary of what a plan is for. */
const PITCH: Record<Plan, string> = {
  free: 'The public evidence, plus a watchlist of three models with email alerts and a weekly summary.',
  pro: 'Full history, the diagnosis behind every change, calibration and substitute analysis, exports and custom alerts.',
  developer: 'For running the Smart Router in production: ten times the requests, API monitoring and 30-day decision logs.',
  teams: 'Five editors, each with the full Teams plan, plus webhooks, single sign-on and an audit trail.',
  enterprise: 'Contracted scope, unlimited seats and requests, 365-day decision logs and invoicing.',
  legacy_pro: '',
};

/** What each card lists, derived from the plan table so a changed limit shows up here too. */
function highlights(p: Plan): { lead?: string; items: string[] } {
  const e = PLANS[p];
  const api = DATA_API_LIMITS[e.dataApiTier];
  const router = isUnlimited(e.routerRequestsPerMonth) ? 'Unlimited Smart Router requests' : `Smart Router: ${fmt(e.routerRequestsPerMonth)} requests a month`;
  const dataApi = `Data API: ${fmt(api.daily)} requests a day`;
  switch (p) {
    case 'free': return { items: [
      `${fmt(e.watchedModels)} tracked models, with email alerts`, `${e.historyDays} days of history`, 'Every category ranking', router, dataApi,
    ] };
    case 'pro': return { lead: 'Everything in Free, plus', items: [
      `${fmt(e.watchedModels)} tracked models and custom alert thresholds`, 'Full history and the drift diagnosis behind every change',
      'Calibration and cheaper-substitute analysis', 'Routing analytics and CSV/JSON exports', router, dataApi,
    ] };
    case 'developer': return { lead: 'Everything in Pro, plus', items: [
      router, 'API monitoring: per-key logs, costs, prompt auditing and budget limits', `${e.routerDiagnosticDays}-day decision logs`, dataApi,
    ] };
    case 'teams': return { lead: 'Everything in Developer, plus', items: [
      `${fmt(e.seats)} editors, each with the full Teams plan`, router, `${e.routerDiagnosticDays}-day decision logs`, dataApi,
      'Webhooks when a watched model regresses', 'Single sign-on (OIDC or SAML), SCIM and an audit trail',
    ] };
    case 'enterprise': return { items: [
      'Unlimited editor seats', router, dataApi, `${e.routerDiagnosticDays}-day decision logs`, 'Contract and invoicing',
    ] };
    default: return { items: [] };
  }
}

const Check = () => (
  <svg className="prc-check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cell = ({ v }: { v: string }) =>
  v === 'Yes' ? <><Check /><span className="sr-only">Included</span></>
  : v === '—' ? <span className="prc-dash" aria-label="Not included">—</span>
  : <>{v}</>;

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

  /** Headline price, its period, and the line under it. Annual shows the yearly amount actually billed. */
  const price = (p: Plan): { amount: string; period: string; sub: React.ReactNode } | null => {
    const e = PLANS[p];
    if (e.priceMonthly === null) return null;
    if (e.priceMonthly === 0) return { amount: '$0', period: 'forever', sub: 'No card required' };
    if (annual && e.priceAnnual !== null) {
      const saving = e.priceMonthly * 12 - e.priceAnnual;
      return { amount: money(e.priceAnnual), period: '/ year',
        sub: <>{money(e.priceAnnual / 12)} a month{saving > 0 && <> · <em>save {money(saving)}</em></>}</> };
    }
    return { amount: money(e.priceMonthly), period: '/ month',
      sub: e.priceAnnual !== null ? <>or {money(e.priceAnnual)} a year — two months free</> : null };
  };

  const shortPrice = (p: Plan): string => {
    const e = PLANS[p];
    if (e.priceMonthly === null) return 'Custom';
    if (e.priceMonthly === 0) return 'Free';
    return annual && e.priceAnnual !== null ? `${money(e.priceAnnual)}/yr` : `${money(e.priceMonthly)}/mo`;
  };

  const CARD_PLANS = SELLABLE_PLANS.filter(p => p !== 'enterprise');
  const ent = cta('enterprise');

  return (
    <div className="prc">
      <header className="prc-hero">
        <div className="prc-kicker">Pricing</div>
        <h1>Know when your model decisions stop being right</h1>
        <p>
          The evidence is free — current scores, every category ranking, seven days of history and the full
          methodology. Paid plans buy depth and workflow: longer comparable history, the diagnosis behind a
          change, more tracked models, routing and team features.
        </p>
      </header>

      {/* Interval switch. Annual is pre-selected and carries the saving on its face. */}
      <div className="prc-toggle" role="group" aria-label="Billing interval">
        <div className="prc-toggle-inner">
          <button className={annual ? 'is-on' : ''} aria-pressed={annual} onClick={() => setInterval('annual')}>
            Annual <span className="prc-toggle-save">2 months free</span>
          </button>
          <button className={!annual ? 'is-on' : ''} aria-pressed={!annual} onClick={() => setInterval('monthly')}>
            Monthly
          </button>
        </div>
      </div>

      <div className="prc-plans">
        {CARD_PLANS.map(p => {
          const e = PLANS[p];
          const c = cta(p);
          const featured = p === 'teams';
          const pr = price(p)!;
          const h = highlights(p);
          return (
            <div key={p} className={`prc-card${featured ? ' is-featured' : ''}`}>
              <div className="prc-card-head">
                <h2>{e.label}</h2>
                {featured && <span className="prc-badge">Most complete</span>}
              </div>
              <p className="prc-pitch">{PITCH[p]}</p>
              <div className="prc-price"><b>{pr.amount}</b><span>{pr.period}</span></div>
              <div className="prc-sub">{pr.sub}</div>
              <div className="prc-cta">
                {c.href
                  ? <Link href={c.href} className={`prc-btn${featured ? ' is-primary' : ''}`}>{c.label}</Link>
                  : <span className="prc-btn is-off" title="This plan is not open for sign-up yet">{c.label}</span>}
              </div>
              <ul className="prc-list">
                {h.lead && <li className="is-lead"><span />{h.lead}</li>}
                {h.items.map(i => <li key={i}><Check />{i}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="prc-ent">
        <div>
          <h2>{PLANS.enterprise.label}</h2>
          <p>{PITCH.enterprise}</p>
        </div>
        <ul>{highlights('enterprise').items.map(i => <li key={i}><Check />{i}</li>)}</ul>
        <div>{ent.href && <Link href={ent.href} className="prc-btn is-auto">{ent.label}</Link>}</div>
      </div>

      <p className="prc-fine">
        Prices in USD, excluding any applicable tax. Free trials collect a payment method; cancel any time from the
        billing portal. Provider inference is billed by your provider, never marked up by us.
      </p>

      {/* Bespoke work sits outside the plan ladder on purpose: it is contracted and
          human-operated, so it has no entitlement row and nothing here is self-serve.
          Saying that plainly is the point — the evaluation-units row was removed from
          the table for advertising an allowance no customer could spend, and a custom
          benchmark described as though it were a feature toggle would repeat it. */}
      <section className="prc-section">
        <div className="prc-section-head">
          <h2>Beyond the plans</h2>
          <p>
            The plans measure the models everyone can see. These two measure <em>your</em> workload instead. Both are
            run by us rather than switched on in the product, and we will tell you if your workload is not one we can
            measure reliably.
          </p>
        </div>
        <div className="prc-offers">
          <div className="prc-offer">
            <h3>Workload assessment</h3>
            <div className="prc-offer-price"><b>{ASSESSMENT_PRICE_LABEL}</b>one-off, fixed scope</div>
            <p>
              The smaller first step, and the usual way into continuous benchmarking. One workload, measured once,
              against three candidate models — using your tasks rather than ours — with a decision report at the end.
              Including, where the evidence supports it, a recommendation to change nothing.
            </p>
            <ul className="prc-list">
              <li><Check />Up to 20 tasks you supply, three candidate models</li>
              <li><Check />A decision report within seven business days of us having what we need</li>
              <li><Check />Scope confirmed within two business days — or a full refund if we cannot measure your workload</li>
              <li><Check />Credited against an annual plan bought within 30 days, up to that plan’s price</li>
              <li><Check />Refunded if we cannot deliver the agreed report</li>
            </ul>
            <Link href="/assessment" className="prc-btn is-primary is-auto">Book an assessment</Link>
          </div>
          <div className="prc-offer">
            <h3>Custom continuous benchmarking</h3>
            <div className="prc-offer-price">Contracted · priced on scope</div>
            <p>
              Public benchmarks measure general ability, and your work is rarely general. You might use AI to design
              wind-turbine components in CAD, to analyse data for research at a neurology clinic, or to draft filings
              in a narrow area of law — and the model at the top of a public leaderboard is not necessarily the best
              at <em>that</em>. We build a benchmark from your own work and run it on the same schedule as our public
              suites, against every AI model available — from OpenAI, Anthropic, Google, DeepSeek, Kimi and GLM to
              any other provider or open-source release your work calls for, with new models added as they launch.
              So you always know which of the world&apos;s AI models does your job best, and you hear about it when
              that changes — a new release that does it better, or an update that makes yours worse.
            </p>
            <ul className="prc-list">
              <li><Check />A task set built from your real work, with the answer keys held out of the prompt</li>
              <li><Check />Run repeatedly against every model worth considering for your work, scored on the median of several trials</li>
              <li><Check />The same change detection the public board runs, with a baseline for your suite alone</li>
              <li><Check />Results through the alerts, webhooks, exports and Data API your plan already has</li>
              <li><Check />A scheduled review of what moved, and whether it is worth changing model</li>
              <li><Check />Your tasks stay yours: never published, never folded into the public corpus</li>
            </ul>
            <p className="prc-offer-note">
              We run your suite on our own provider accounts: you do not share API keys with us, and the inference
              bill is ours, included in the contracted price. How many tasks, how many models and how often they run
              is what the measurement costs us to produce, so it is what sets the price.
            </p>
            <Link href="/contact?topic=custom-benchmark" className="prc-btn is-auto">Talk to us about your workload</Link>
          </div>
        </div>
      </section>

      <section className="prc-section">
        <div className="prc-section-head">
          <h2>Compare plans</h2>
          <p>Every plan reads the same measurement. What you pay for is how much of it you can see, how far back, and what you can wire it into.</p>
        </div>
        {/* On a phone the table is wider than the viewport and the paid columns sit
            off-screen. Without this the page silently hides the plans someone is
            most likely to buy. */}
        <div className="prc-swipe">Swipe to compare →</div>
        <div className="prc-table-wrap">
          <table className="prc-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Feature</span></th>
                {SELLABLE_PLANS.map(p => (
                  <th key={p} scope="col" className={p === 'teams' ? 'is-featured' : ''}>
                    <b>{PLANS[p].label}</b><span>{shortPrice(p)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(g => (
                <Fragment key={g.title}>
                  <tr className="prc-group">
                    <td>{g.title}</td>
                    {SELLABLE_PLANS.map(p => <td key={p} className={p === 'teams' ? 'is-featured' : ''} />)}
                  </tr>
                  {g.rows.map(r => (
                    <tr key={r.label}>
                      <td className="prc-row-label">{r.label}{r.note && <small>{r.note}</small>}</td>
                      {SELLABLE_PLANS.map(p => (
                        <td key={p} className={p === 'teams' ? 'is-featured' : ''}><Cell v={r.get(p)} /></td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cadence and trial counts only. No fleet size: the number of tracked models
          changes whenever a model is retired — seven went on one day — and a hard-coded
          count on a pricing page is the drift this file exists to prevent. */}
      <section className="prc-section">
        <div className="prc-section-head">
          <h2>What you are actually buying</h2>
        </div>
        <div className="prc-qa">
          <section>
            <h3>Four suites, on a fixed schedule</h3>
            <p>Coding runs every four hours on real repository defects, graded by the project&rsquo;s own test suite including tests the model never sees. Multi-turn reasoning and tool-calling run daily. A small probe runs hourly to catch a sudden change between full runs.</p>
          </section>
          <section>
            <h3>Repeated, then taken as a median</h3>
            <p>Each coding task runs seven times and the median is scored, because one sample cannot tell a model getting worse from a model having a bad afternoon. That repetition is most of what the benchmark costs to run, and it is why an alert is worth believing.</p>
          </section>
          <section>
            <h3>Gaps are shown, not filled</h3>
            <p>If a provider declines a task or a session does not finish, that task drops out rather than being scored zero. The row says how much of the set it covers, and a score measured over fewer tasks is never called tied with one measured over all of them.</p>
          </section>
          <section>
            <h3>Free is a real tier</h3>
            <p>Current scores, every category ranking, seven days of history and the full methodology cost nothing and need no account. A benchmark nobody can check is not worth reading, so the evidence is not the paid part. Depth and workflow are.</p>
          </section>
          <section>
            <h3>What happens at a limit</h3>
            <p>Nothing breaks silently, and nothing is ever billed after the fact. When a month&rsquo;s Smart Router allowance is used up, routing pauses with a clear message: top up with prepaid credits — from ${ROUTER_CREDITS.minimumUsd}, {ROUTER_CREDITS.requestsPerUsd.toLocaleString('en-US')} requests per $1, and they never expire — or move up a plan: on Developer and Teams a request costs less than a credit. Data API calls beyond the daily ceiling are refused with a clear error rather than throttled into a timeout.</p>
          </section>
          <section>
            <h3>Why annual is cheaper</h3>
            <p>There is no discount code and no countdown. An annual plan is billed once instead of twelve times, which costs us less in payment fees and in churn, and we pass that back as two free months. You can still cancel; we do not hold you to the year.</p>
          </section>
          <section>
            <h3>What we do not charge for</h3>
            <p>On every plan, provider inference. You connect your own OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM keys, and those providers bill you directly at their rates. We charge for the software and the measurement, never a markup on tokens. Custom continuous benchmarking works the other way round and says so above: we run it on our accounts and the inference is in the price.</p>
          </section>
          <section>
            <h3>Existing subscribers</h3>
            <p>If you already subscribe, you keep your current price and everything you already had for at least twelve months. Nothing about these plans reduces what you have today. Your plan only changes if you choose to change it, or if you cancel and come back later.</p>
          </section>
          <section>
            <h3>Does routing save money?</h3>
            <p>In our own benchmark the cheapest model matching the top score cost about {SAVINGS_PCT}% less per request. {SAVINGS_QUALIFIER}</p>
          </section>
        </div>
        <p className="prc-foot">
          Prices in USD, excluding any applicable tax. Every plan collects a payment method at checkout, including
          during a free trial, and you can cancel at any time from the billing portal.
          Questions about a plan? <Link href="/contact?topic=sales">Talk to us</Link>.
        </p>
      </section>
    </div>
  );
}
