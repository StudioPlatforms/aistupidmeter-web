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
 *
 * In the landing page's look (styles/landing.css + styles/pricing.css). The plan cards are the
 * landing page's own (components/landing/PricingPlans), so the two pages cannot drift apart.
 */

import { Fragment, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';
import { PLANS, SELLABLE_PLANS, DATA_API_LIMITS, ROUTER_CREDITS, isUnlimited, planMeets, type Plan } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { SAVINGS_PCT, SAVINGS_QUALIFIER } from '@/lib/savings-estimate';
import { money } from '@/lib/plan-highlights';
import PricingPlans, { type Interval } from '@/components/landing/PricingPlans';

const fmt = (n: number) => (isUnlimited(n) ? 'Unlimited' : n.toLocaleString());

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
    { label: 'Context rot (pilot)',   get: p => planMeets(p, REQUIRED_PLAN['context-rot']) ? 'Yes' : '—',
      note: 'Long-context accuracy from 8K to 1M tokens, by length and by position, tracked weekly. Pilot: DeepSeek, Kimi and GLM' },
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
    { label: 'Webhooks',              get: p => PLANS[p].webhooks ? 'Yes' : '—', note: 'Signed callbacks when a watched model regresses, or a project reaches a budget threshold or someone their cap' },
  ] },
  { title: 'Team', rows: [
    { label: 'Editor seats',          get: p => fmt(PLANS[p].seats), note: 'On Teams and Enterprise every editor gets the plan’s features and limits. Viewers are unlimited and read-only' },
    { label: 'Projects',              get: p => PLANS[p].projects === 0 ? '—' : fmt(PLANS[p].projects),
      note: 'One per client or product: its own people, watchlist and alerts, Smart Router keys, routing rules, provider keys, budget and per-person caps, and a report of what it spent and who spent it' },
    { label: 'Team watchlist',        get: p => PLANS[p].projects === 0 ? '—' : 'Yes', note: 'Models the whole workspace watches, with alerts to everyone in it, viewers included' },
    { label: 'SSO, SCIM & audit trail', get: p => planMeets(p, REQUIRED_PLAN.governance) ? 'Yes' : '—', note: 'OIDC or SAML, directory provisioning, exportable audit log' },
  ] },
];

/** The questions under the table: what the money pays for, and what it never does. */
const QA: Array<{ q: string; a: React.ReactNode }> = [
  { q: 'Four suites, on a fixed schedule',
    a: <>Coding runs every four hours on real repository defects, graded by the project&rsquo;s own test suite including tests the model never sees. Multi-turn reasoning and tool-calling run daily. A small probe runs hourly to catch a sudden change between full runs.</> },
  { q: 'Repeated, then taken as a median',
    a: <>Each coding task runs seven times and the median is scored, because one sample cannot tell a model getting worse from a model having a bad afternoon. That repetition is most of what the benchmark costs to run, and it is why an alert is worth believing.</> },
  { q: 'Gaps are shown, not filled',
    a: <>If a provider declines a task or a session does not finish, that task drops out rather than being scored zero. The row says how much of the set it covers, and a score measured over fewer tasks is never called tied with one measured over all of them.</> },
  { q: 'Free is a real tier',
    a: <>Every category ranking over the last 24 hours, 7 days and 30 days costs nothing with a free account, and model pages and the full methodology need no account at all. A benchmark nobody can check is not worth reading, so the evidence is not the paid part. The newest run as it lands, depth and workflow are.</> },
  { q: 'What happens at a limit',
    a: <>Nothing breaks silently, and nothing is ever billed after the fact. When a month&rsquo;s Smart Router allowance is used up, routing pauses with a clear message: top up with prepaid credits — from ${ROUTER_CREDITS.minimumUsd}, {ROUTER_CREDITS.requestsPerUsd.toLocaleString('en-US')} requests per $1, and they never expire — or move up a plan: on Developer and Teams a request costs less than a credit. Data API calls beyond the daily ceiling are refused with a clear error rather than throttled into a timeout.</> },
  { q: 'Why annual is cheaper',
    a: <>There is no discount code and no countdown. An annual plan is billed once instead of twelve times, which costs us less in payment fees and in churn, and we pass that back as two free months. You can still cancel; we do not hold you to the year.</> },
  { q: 'What we do not charge for',
    a: <>On every plan, provider inference. You connect your own OpenAI, Anthropic, Google, DeepSeek, Kimi or GLM keys, and those providers bill you directly at their rates. We charge for the software and the measurement, never a markup on tokens. Custom continuous benchmarking works the other way round and says so above: we run it on our accounts and the inference is in the price.</> },
  { q: 'Existing subscribers',
    a: <>If you already subscribe, you keep your current price and everything you already had for at least twelve months. Nothing about these plans reduces what you have today. Your plan only changes if you choose to change it, or if you cancel and come back later.</> },
  { q: 'Does routing save money?',
    a: <>In our own benchmark the cheapest model matching the top score cost about {SAVINGS_PCT}% less per request. {SAVINGS_QUALIFIER}</> },
];

const Check = () => (
  <svg className="pr-check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cell = ({ v }: { v: string }) =>
  v === 'Yes' ? <><Check /><span className="lp-sr">Included</span></>
  : v === '—' ? <span className="pr-dash" aria-label="Not included">—</span>
  : <>{v}</>;

const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

export default function PricingClient({ buyable = [] }: { buyable?: string[] }) {
  // Annual first. See the note at the top of this file. One switch drives the cards and the table.
  const [interval, setInterval] = useState<Interval>('annual');
  const annual = interval === 'annual';

  const shortPrice = (p: Plan): string => {
    const e = PLANS[p];
    if (e.priceMonthly === null) return 'Custom';
    if (e.priceMonthly === 0) return 'Free';
    return annual && e.priceAnnual !== null ? `${money(e.priceAnnual)}/yr` : `${money(e.priceMonthly)}/mo`;
  };

  return (
    <>
      <header className="lp-hero lp-textured">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap">
          <div className="lp-hero-row">
            <div>
              <p className="lp-kicker lp-intro" style={intro('.04s')}>Pricing</p>
              <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                Know when your model decisions <span className="lp-b">stop being right</span>
              </h1>
              <p className="lp-lead lp-intro" style={intro('.18s')}>
                The evidence is free — every category ranking over the last 24 hours, 7 days and 30 days, and the full
                methodology. Paid plans buy freshness, depth and workflow: the newest run the moment it lands, full
                comparable history, the diagnosis behind a change, more tracked models, routing and team features.
              </p>
              <div className="lp-cta lp-intro" style={intro('.26s')}>
                <a className="lp-btn lp-btn-primary lp-btn-lg" href="#plans">See the plans <span className="lp-ar" aria-hidden="true">→</span></a>
                <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#compare">Compare every feature</a>
              </div>
            </div>
            <dl className="lp-facts lp-intro" style={intro('.34s')}>
              <div><dt>$0</dt><dd>for every ranking over 24 hours, 7 days and 30 days, with a free account</dd></div>
              <div><dt>2 mo</dt><dd>free on every annual plan: billed once instead of twelve times</dd></div>
              <div><dt>0%</dt><dd>markup on provider tokens on every plan: your provider bills you directly</dd></div>
            </dl>
          </div>
        </div>
      </header>

      <section className="lp-sec lp-A" id="plans">
        <div className="lp-wrap">
          <PricingPlans
            buyable={buyable}
            signUpHref="/auth/signup"
            interval={interval}
            onIntervalChange={setInterval}
            onPricingPage
            heading={(
              <div className="lp-head">
                <p className="lp-kicker">Plans</p>
                <h2 className="lp-h2">Free evidence, paid diagnosis</h2>
              </div>
            )}
          />
          <p className="pr-fine lp-up">
            Prices in USD, excluding any applicable tax. Free trials collect a payment method; cancel any time from the
            billing portal. Provider inference is billed by your provider, never marked up by us.
          </p>
        </div>
      </section>

      {/* Bespoke work sits outside the plan ladder on purpose: it is contracted and
          human-operated, so it has no entitlement row and nothing here is self-serve.
          Saying that plainly is the point — the evaluation-units row was removed from
          the table for advertising an allowance no customer could spend, and a custom
          benchmark described as though it were a feature toggle would repeat it. */}
      <section className="lp-sec lp-B">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Run by us</p>
            <h2 className="lp-h2">Beyond the plans</h2>
            <p className="lp-lead">
              The plans measure the models everyone can see. These two measure <em>your</em> workload instead. Both are
              run by us rather than switched on in the product, and we will tell you if your workload is not one we can
              measure reliably.
            </p>
          </div>
          <div className="pr-offers">
            <article {...up(undefined, 'pr-offer')}>
              <h3>Workload assessment</h3>
              <p className="pr-offer-price"><b>{ASSESSMENT_PRICE_LABEL}</b><span>one-off, fixed scope</span></p>
              <p>
                The smaller first step, and the usual way into continuous benchmarking. One workload, measured once,
                against three candidate models — using your tasks rather than ours — with a decision report at the end.
                Including, where the evidence supports it, a recommendation to change nothing.
              </p>
              <ul className="pr-list">
                <li><Check />Up to 20 tasks you supply, three candidate models</li>
                <li><Check />A decision report within seven business days of us having what we need</li>
                <li><Check />Scope confirmed within two business days — or a full refund if we cannot measure your workload</li>
                <li><Check />Credited against an annual plan bought within 30 days, up to that plan’s price</li>
                <li><Check />Refunded if we cannot deliver the agreed report</li>
              </ul>
              <Link href="/assessment" className="lp-btn lp-btn-primary">Book an assessment <span className="lp-ar" aria-hidden="true">→</span></Link>
            </article>
            <article {...up('.08s', 'pr-offer')}>
              <h3>Custom continuous benchmarking</h3>
              <p className="pr-offer-price"><b>Contracted</b><span>priced on scope</span></p>
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
              <ul className="pr-list">
                <li><Check />A task set built from your real work, with the answer keys held out of the prompt</li>
                <li><Check />Run repeatedly against every model worth considering for your work, scored on the median of several trials</li>
                <li><Check />The same change detection the public board runs, with a baseline for your suite alone</li>
                <li><Check />Results through the alerts, webhooks, exports and Data API your plan already has</li>
                <li><Check />A scheduled review of what moved, and whether it is worth changing model</li>
                <li><Check />Your tasks stay yours: never published, never folded into the public corpus</li>
              </ul>
              <p className="pr-offer-note">
                We run your suite on our own provider accounts: you do not share API keys with us, and the inference
                bill is ours, included in the contracted price. How many tasks, how many models and how often they run
                is what the measurement costs us to produce, so it is what sets the price.
              </p>
              <Link href="/contact?topic=custom-benchmark" className="lp-btn lp-btn-ghost">Talk to us about your workload</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-A" id="compare">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Compare</p>
            <h2 className="lp-h2">Compare plans</h2>
            <p className="lp-lead">
              Every plan reads the same measurement. What you pay for is how much of it you can see, how far back, and
              what you can wire it into.
            </p>
          </div>
          {/* On a phone the table is wider than the viewport and the paid columns sit
              off-screen. Without this the page silently hides the plans someone is
              most likely to buy. */}
          <p className="pr-swipe">Swipe to compare <span aria-hidden="true">→</span></p>
          <div className="pr-table-wrap lp-up">
            <table className="pr-table">
              <thead>
                <tr>
                  <th scope="col"><span className="lp-sr">Feature</span></th>
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
                    <tr className="pr-group">
                      <th scope="colgroup" colSpan={SELLABLE_PLANS.length + 1}>{g.title}</th>
                    </tr>
                    {g.rows.map(r => (
                      <tr key={r.label}>
                        <th scope="row" className="pr-row-label">{r.label}{r.note && <small>{r.note}</small>}</th>
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
          <p className="pr-fine">
            Prices in USD, excluding any applicable tax. Every plan collects a payment method at checkout, including
            during a free trial, and you can cancel at any time from the billing portal.
          </p>
        </div>
      </section>

      {/* Cadence and trial counts only. No fleet size: the number of tracked models
          changes whenever a model is retired — seven went on one day — and a hard-coded
          count on a pricing page is the drift this file exists to prevent. */}
      <section className="lp-sec lp-C" aria-labelledby="pr-qa">
        <div className="lp-wrap">
          <div className="lp-head lp-up">
            <p className="lp-kicker">Questions</p>
            <h2 className="lp-h2" id="pr-qa">What you are actually buying</h2>
          </div>
          <div className="pr-qa">
            {QA.map((x, i) => (
              <div key={x.q} {...up(`${(i % 3) * 0.06}s`)}>
                <h3>{x.q}</h3>
                <p>{x.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-final lp-textured">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap">
          <h2 className="lp-h2 lp-up">Questions about a plan?</h2>
          <p className="lp-lead lp-up">
            We are a small team and we answer our own email. Or start on the free tier: every ranking over 24 hours,
            7 days and 30 days, no card required.
          </p>
          <div className="lp-cta lp-up">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/contact?topic=sales">Talk to us <span className="lp-ar" aria-hidden="true">→</span></Link>
            <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/auth/signup">Create free account</Link>
          </div>
        </div>
      </section>
    </>
  );
}
