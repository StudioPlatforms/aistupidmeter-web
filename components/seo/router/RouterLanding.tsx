import Link from 'next/link';
import type { ReactNode } from 'react';
import { ReadingPage, RdSection, RdProse, RdFacts, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import RouterDemo, { type DemoScenario } from '@/components/landing/RouterDemo';
import RouterExplorer from '@/components/landing/RouterExplorer';
import type { LandingSnapshot } from '@/components/landing/types';
import { CtaRow, LeaderboardCta, RouterCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { ClusterTags } from '@/components/seo/routers/RouterBlocks';
import { PLANS, ROUTER_CREDITS, type Plan } from '@/lib/entitlements';
import { monthly, planName, priceNumber } from '@/lib/pricing-display';
import { ORG_ID, SITE, breadcrumbLd, faqLd, graphLd, isoDay, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, getProviders, getRoster, modelsOfVendor, vendorMention, type Vendor } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-router.css';
import SiteFooter from '@/components/SiteFooter';

/**
 * /router for a signed-out visitor, and for every crawler: the Smart Router's public landing
 * page, server-rendered in the reading pages' look. app/router/page.tsx renders it when auth()
 * finds no session, and the signed-in dashboard otherwise.
 *
 * Every number on the page is read at render time: plan allowances and prices from the plan
 * table (lib/entitlements, lib/pricing-display), the probe interval from /providers/status, the
 * roster counts from /api/models, and the live picks from /dashboard/landing — the router's own
 * decisions for an example caller with keys for every provider. The static copy names provider
 * families only, never a model or a place.
 *
 * The routing rules are described from the API's router (apps/api/src/router: selector/index.ts,
 * selector/drift-flags.ts, selector/task-match.ts, lib/circuit-breaker.ts, proxy/index.ts). The
 * constants that live there and not in this repo are copied below with their source named, so a
 * change there has one place to follow here.
 */

export const ROUTER_PATH = '/router';
/** ≤ 42 characters before the " | AI Stupid Level" suffix pageMeta() appends. */
export const ROUTER_TITLE = 'Smart Router: benchmark-driven LLM router';
/** 120–155 characters. */
export const ROUTER_DESCRIPTION = 'One OpenAI-compatible endpoint sending each request to the model scoring best for it: coding, reasoning, tool use, value or speed. Your keys, no markup.';
export const ROUTER_KEYWORDS = [
  'AI router', 'smart router', 'LLM router', 'AI model router', 'Smart Router', 'AI aggregator', 'LLM aggregator',
  'OpenRouter alternative', 'best AI router', 'benchmark-driven LLM router', 'OpenAI compatible proxy',
  'one API key all AI models', 'AI gateway with your own keys', 'route requests to best LLM', 'automatic model selection LLM',
  'LLM cost optimization routing', 'Claude Code custom API endpoint', 'Cursor custom OpenAI endpoint', 'AI failover routing',
];

const H1 = 'Smart Router: an LLM router that picks the model';
const H1_ACCENT = 'from live benchmark results';
const H1_FULL = `${H1} ${H1_ACCENT}`;
const APP_ID = `${SITE}${ROUTER_PATH}#software`;
const BASE_URL = `${SITE}/v1`;

const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';

/* ── constants copied from the API's router, each with its source ── */
/** apps/api/src/router/selector/index.ts: the fallback chain stops at `fallbacks.length >= 5`. */
const MAX_FALLBACKS = 5;
/** apps/api/src/router/selector/index.ts: parseList(...).slice(0, 10) caps a caller's own fallback order and traffic split. */
const MAX_OWN_LIST = 10;
/** apps/api/src/router/selector/index.ts: after the split and the caller's own order, at most 2 automatic fallbacks (`added >= 2`), preferring providers not yet in the chain. */
const MAX_AUTO_FALLBACKS = 2;
/** apps/api/src/router/selector/index.ts VALUE_FLOOR_POINTS: the near-top bar for the value, consistency and fastest-quality modes. */
const VALUE_FLOOR_POINTS = 5;
/** apps/api/src/router/lib/circuit-breaker.ts FAILURE_THRESHOLD and COOLDOWN_MS. */
const CIRCUIT_FAILURES = 5;
const CIRCUIT_COOLDOWN_S = 60;
/** apps/api/src/router/selector/estimates.ts RUNS: a quality mode ranks on the mean of a model’s last five scored runs (a tie needs MIN_RUNS_FOR_TIE = 3 of them). */
const RUNS_AVERAGED = 5;
/** apps/api/src/router/selector/index.ts addLatencyData: the median of the last 7 days of benchmark runs. */
const LATENCY_WINDOW_DAYS = 7;
/** apps/api/src/router/selector/index.ts: best_consistent's spread is read over the last 14 days. */
const SPREAD_WINDOW_DAYS = 14;
/** apps/api/src/router/selector/index.ts: a value mode's cost is the mean of one run's cost over 30 days. */
const COST_WINDOW_DAYS = 30;
/** apps/api/src/router/selector/production-signals.ts SIGNAL_WINDOW_DAYS. */
const FEEDBACK_DAYS = 14;
/** apps/api/src/router/proxy/index.ts ROUTER_BODY_LIMIT. */
const BODY_LIMIT_MB = 32;
/** apps/api/src/router/proxy/tool-turns.ts TTL_MS: a model's own turn is kept for its agent loop. */
const TURN_MEMORY_HOURS = 24;
/** apps/api/src/router/keys/encryption.ts ALGORITHM. */
const KEY_CIPHER = 'AES-256-GCM';

const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (x: number): string => WORDS[x] ?? n(x);

/**
 * The router's own reasoning strings (apps/api/src/router/selector/index.ts generateReasoningMessage)
 * say "Ranked #1 of N", "over its last 5 measured runs" and "per measured task". The owner's copy
 * rules keep "#1" and "measured" (of scores) off the marketing pages, so the live block shows the
 * same facts in the boards' words. The API text is unchanged; only this page's rendering of it.
 */
const scrubReasoning = (t: string): string => t
  .replace(/Ranked #1 of/g, 'Ranked first of')
  .replace(/\bmeasured runs\b/g, 'scored runs')
  .replace(/\bper measured task\b/g, 'per task')
  .replace(/\bper measured dollar\b/g, 'per dollar')
  .replace(/\bLast measured\b/g, 'Last run');

function scrubSnapshot(snapshot: LandingSnapshot): LandingSnapshot {
  const strategies: LandingSnapshot['strategies'] = {};
  for (const k of Object.keys(snapshot.strategies)) {
    const st = snapshot.strategies[k];
    strategies[k] = st
      ? { ...st, primary: { ...st.primary, reasoning: scrubReasoning(st.primary.reasoning) }, rows: st.rows.map((r) => (r.note ? { ...r, note: scrubReasoning(r.note) } : r)) }
      : st;
  }
  return { ...snapshot, strategies };
}
/** The owner's free-tier sentence, with every number read from the plan table. */
const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${n(FREE.routerRequestsPerMonth)} routed requests a month and a Data API key. No card.`;

/**
 * The auto-* modes GET /v1/models publishes (apps/api/src/router/proxy/index.ts, listModelsHandler),
 * each with the suite and rule it ranks on (selector/index.ts SCORE_MODE_FOR_STRATEGY, orderForCaller,
 * task-match.ts) and the public page that shows that board. `auto` alone is the caller's saved preference.
 */
interface Mode { id: string; ranks: ReactNode; more: { label: string; href: string } }
const DOCS_MODES = { label: 'Router docs', href: '/router/docs#strategies' };
const MODES: Mode[] = [
  { id: 'auto-best', ranks: 'The Combined board: coding 50%, reasoning 25%, tool use 25%.', more: { label: 'Best AI model', href: '/best-ai-model' } },
  { id: 'auto-coding', ranks: 'The Coding board: repository bug fixes graded by running the project’s own tests, every four hours.', more: { label: 'Best LLM for coding', href: '/best-llm-for-coding' } },
  { id: 'auto-reasoning', ranks: 'The Reasoning board: long, multi-turn working sessions, daily.', more: { label: 'Best LLM for reasoning', href: '/best-llm-for-reasoning' } },
  { id: 'auto-tooling', ranks: 'The Tool use board: sandboxed agent tasks with real tools, daily.', more: { label: 'Best AI model for agents', href: '/best-ai-model-for-agents' } },
  { id: 'auto-value', ranks: `Among models within ${VALUE_FLOOR_POINTS} points of the best Combined score, the most points per dollar of one coding run, averaged over ${COST_WINDOW_DAYS} days. Not list price: what the run cost that model.`, more: { label: 'Best value AI model', href: '/best-value-ai-model' } },
  { id: 'auto-value-coding', ranks: `The same rule on the Coding board: within ${VALUE_FLOOR_POINTS} points of the best, then points per dollar of one coding run.`, more: DOCS_MODES },
  { id: 'auto-value-reasoning', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Reasoning score, then points per dollar of one reasoning session.`, more: DOCS_MODES },
  { id: 'auto-value-tooling', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Tool use score, then points per dollar of one tool-use session.`, more: DOCS_MODES },
  { id: 'auto-fastest-quality', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best Combined score, then the lowest median response time over the last ${LATENCY_WINDOW_DAYS} days of benchmark runs.`, more: { label: 'Fastest AI model', href: '/fastest-ai-model' } },
  { id: 'auto-fastest', ranks: `The lowest response time outright: the ${LATENCY_WINDOW_DAYS}-day median of benchmark runs, blended with what production observed.`, more: DOCS_MODES },
  { id: 'auto-cheapest', ranks: 'The lowest list price per token, input and output averaged.', more: DOCS_MODES },
  { id: 'auto-consistent', ranks: `Within ${VALUE_FLOOR_POINTS} points of the best, then the smallest run-to-run spread of the coding score over the last ${SPREAD_WINDOW_DAYS} days.`, more: DOCS_MODES },
  { id: 'auto-task', ranks: 'Decided per request from what it contains: code worked on through tools goes to coding and tool use together; other tools to tool use; design, planning or a long session to reasoning; large or demanding code to coding; other code to value for coding; long text to best overall; everything else to best value.', more: DOCS_MODES },
  { id: 'auto-split', ranks: `Your own weighted split across up to ${MAX_OWN_LIST} models. Each request draws its primary by weight; the rest of the split become its fallbacks.`, more: DOCS_MODES },
];
const MODE_COUNT = MODES.length;

/** The demo's requests are examples; each one's ranking and pick come from the live router (as on the landing page). */
const DEMO: Array<{ id: string; q: string; meta: string; key: string }> = [
  { id: 'auto-coding', q: 'Fix the race condition in checkout.ts', meta: 'stream', key: 'best_coding' },
  { id: 'auto-cheapest', q: 'Tag 2,000 support tickets by intent', meta: 'batch', key: 'cheapest' },
  { id: 'auto-task', q: 'Design the event schema for multi-tenant billing', meta: 'match_task', key: 'match_task_design' },
  { id: 'auto-tooling', q: 'Move Tuesday’s design review and email the team', meta: '3 tools', key: 'best_tooling' },
  { id: 'auto-fastest', q: 'Suggest a subject line for this email', meta: 'short', key: 'fastest' },
  { id: 'auto-value-coding', q: 'Write unit tests for parseDate()', meta: 'code', key: 'best_value_coding' },
];

/** The per-tool guides at /router/integrations/<slug>, in the order people ask for them. */
const TOOLS: Array<{ slug: string; name: string }> = [
  { slug: 'claude-code', name: 'Claude Code' },
  { slug: 'cursor', name: 'Cursor' },
  { slug: 'cline', name: 'Cline' },
  { slug: 'continue', name: 'Continue' },
  { slug: 'aider', name: 'Aider' },
  { slug: 'opencode', name: 'OpenCode' },
  { slug: 'zed', name: 'Zed' },
  { slug: 'open-webui', name: 'Open WebUI' },
  { slug: 'librechat', name: 'LibreChat' },
  { slug: 'n8n', name: 'n8n' },
  { slug: 'langchain', name: 'LangChain' },
];
const toolNames = (): string => TOOLS.map((t) => t.name).join(', ');

/** The plans the landing quotes, in ladder order; Enterprise is contracted and sends people to /pricing. */
const SHOWN_PLANS: Plan[] = ['free', 'pro', 'developer', 'teams'];
const OFFER_PLANS: Plan[] = ['free', 'pro', 'developer'];
const planLabel = (p: Plan): string => (p === 'free' ? 'Free' : `${planName(p)} · ${monthly(p)}`);

function planSummary(p: Plan): string {
  const e = PLANS[p];
  const req = `${n(e.routerRequestsPerMonth)} routed requests a month`;
  switch (p) {
    case 'free': return `${req} on every provider and every mode, with a ${e.routerDiagnosticDays}-day decision log. No card.`;
    case 'pro': return `${req}, routing analytics and CSV/JSON exports, plus the full leaderboard analysis.`;
    case 'developer': return `${req}, API monitoring with per-key logs, costs, prompt auditing and budget limits, ${e.routerDiagnosticDays}-day decision logs, and a workspace with one project.`;
    case 'teams': return `${req}, ${e.seats} editors, ${e.projects} projects with their own router keys, budgets and spend reports, ${e.routerDiagnosticDays}-day decision logs, webhooks, single sign-on and an audit trail.`;
    default: return req;
  }
}

const TOC = [
  { id: 'live', label: 'Live picks' },
  { id: 'how', label: 'How it decides' },
  { id: 'what', label: 'What it is' },
  { id: 'works', label: 'Works with' },
  { id: 'plans', label: 'Plans' },
  { id: 'gateway', label: 'Gateway or aggregator?' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

interface FaqContext {
  /** Minutes between provider probes, from /providers/status; null when the feed did not answer. */
  interval: number | null;
  /** Models on the leaderboard, by vendor, from /api/models; empty when the roster did not load. */
  perVendor: Array<{ v: Vendor; count: number }>;
}

/** The visible Q&As; the same strings feed the FAQPage structured data, so the two cannot disagree. */
function buildFaq({ interval, perVendor }: FaqContext): FaqItem[] {
  const total = perVendor.reduce((s, x) => s + x.count, 0);
  const vendorLinks = VENDORS.map((v) => `[${vendorMention(v)}](${v.modelsPath})`);
  const families = `${vendorLinks.slice(0, -1).join(', ')} and ${vendorLinks[vendorLinks.length - 1]}`;
  const counts = perVendor.map(({ v, count }) => `${count} from ${v.label}`).join(', ');
  const roster = total > 0
    ? `Every model on the [leaderboard](/): ${total} models from ${perVendor.length} providers as this page was rendered (${counts}), each with its own page under its vendor: ${families}.`
    : `Every model on the [leaderboard](/), from ${families}, each with its own page under its vendor.`;
  const probe = interval ? `every ${interval} minutes` : 'on a fixed schedule';
  return [
    {
      q: 'What is an LLM router?',
      a: `An LLM router is a service that sits in front of several language-model providers, behind one API, and chooses which model answers each request. Most route on rules you write, on price, or on which models are popular. The AI Stupid Level Smart Router routes on benchmark results: every model on the [leaderboard](/) runs the same coding, reasoning and tool-use tasks, ${CADENCE}, and each auto-* mode sends your request to the model placing highest for that job among the providers you hold keys for. That is automatic model selection with a checkable basis, and the decision is written into every response.`,
    },
    {
      q: 'How does the Smart Router choose a model?',
      a: `Each mode names a suite and a rule: auto-coding ranks on the Coding board, auto-reasoning on Reasoning, auto-tooling on Tool use, auto-best on the Combined score (coding 50%, reasoning 25%, tool use 25%). A quality mode uses the average of a model’s last ${RUNS_AVERAGED} scored runs, never one run. Leaders closer than 1.96 times their combined standard error are a statistical tie, and your tie-break decides: cheapest per task by default, or fastest, or highest. The auto-value modes choose among models within ${VALUE_FLOOR_POINTS} points of the best and take the most points per dollar of one scored run; auto-fastest-quality takes the lowest median response time among them. Drift-aware routing then moves any model with a fired Page-Hinkley detector or an open canary incident behind the healthy ones. The X-AISM-Reasoning header on every response says which rule won. The full table is on this page under [how it decides](/router#how).`,
    },
    {
      q: 'Do you mark up tokens?',
      a: `No. Requests go out with your own provider keys and the provider bills you at its own list price; the router adds nothing per token. Plans include a number of routed requests a month: ${n(PLANS.free.routerRequestsPerMonth)} on Free, ${n(PLANS.pro.routerRequestsPerMonth)} on ${planName('pro')}, ${n(PLANS.developer.routerRequestsPerMonth)} on ${planName('developer')} and ${n(PLANS.teams.routerRequestsPerMonth)} on ${planName('teams')}. Past that, top-up credits cost $1 per ${n(ROUTER_CREDITS.requestsPerUsd)} requests (minimum $${ROUTER_CREDITS.minimumUsd}) and do not expire. A request a model refuses is not counted. [Plans and prices](/pricing).`,
    },
    {
      q: 'Can I use it with Claude Code or Cursor?',
      a: `Yes. Claude Code talks to the router through the native Anthropic endpoint: set ANTHROPIC_BASE_URL to ${SITE} and ANTHROPIC_API_KEY to your router key, and /v1/messages passes through, token counting included, with a routing mode such as auto-coding as the model name. Cursor uses its Override OpenAI Base URL setting with ${BASE_URL} and a mode as the custom model name, in chat and plan mode. Step-by-step pages: [Claude Code](/router/integrations/claude-code) and [Cursor](/router/integrations/cursor), with guides for ${TOOLS.filter((t) => !['claude-code', 'cursor'].includes(t.slug)).map((t) => t.name).join(', ')} on the [integrations hub](/router/integrations).`,
    },
    {
      q: 'What happens when a provider is down?',
      a: `Every request carries up to ${MAX_FALLBACKS} fallbacks: the rest of your traffic split, then your own fallback order, then up to ${MAX_AUTO_FALLBACKS} automatic picks at other providers. A model that fails ${CIRCUIT_FAILURES} times in a row is skipped for ${CIRCUIT_COOLDOWN_S} seconds and probed before it returns, so a provider that stops answering stops receiving traffic after a handful of requests, and the response header names the fallback that answered. Independently, a short completion goes to every provider ${probe} from our own account; a provider that is not answering is shown on the [status page](/status), with a page per provider such as [OpenAI API status](/status/openai), and its open incident is one of the signals drift-aware routing reads.`,
    },
    {
      q: 'Which models can it route to?',
      a: `${roster} You add a key for each provider you want in play, and the modes rank only the models you can reach. Any real model id from GET /v1/models can also be pinned directly. The router handles text, code and tool calls, because those are what the benchmarks measure.`,
    },
    {
      q: 'Is the Smart Router an OpenRouter alternative?',
      a: `Yes. Like OpenRouter, it puts many models behind one OpenAI-compatible API. It differs in how it picks the model, from public benchmark results re-run ${CADENCE}, and in always using your own provider keys, with no markup on tokens. [OpenRouter alternatives](/openrouter-alternatives) compares the two with the other options, each from its vendor’s own pages, and shows the three steps to switch; [Best AI routers in 2026](/best-ai-router) sets the wider field side by side, and [AI aggregator](/ai-aggregator) and [what an AI router is](/ai-router) cover the terms.`,
    },
    {
      q: 'Is there a free tier?',
      a: `Yes. ${FREE_TIER} Routing itself is not paywalled: Free gets every provider and every auto-* mode. The paid plans buy volume, longer decision logs, API monitoring and team features. [Compare the plans](/pricing).`,
    },
  ];
}

export default async function RouterLanding({ snapshot: raw }: { snapshot: LandingSnapshot | null }): Promise<JSX.Element> {
  const snapshot = raw ? scrubSnapshot(raw) : null;
  const [roster, providers] = await Promise.all([getRoster(), getProviders()]);
  const interval = providers?.meta.checkIntervalMinutes ?? null;
  const perVendor = VENDORS.map((v) => ({ v, count: modelsOfVendor(roster, v.key).length })).filter((x) => x.count > 0);
  const scenarios: DemoScenario[] = snapshot
    ? DEMO.flatMap((d) => {
        const snap = snapshot.strategies[d.key];
        return snap && snap.rows.length ? [{ id: d.id, q: d.q, meta: d.meta, snap }] : [];
      })
    : [];
  const providerCount = snapshot?.providerCount || perVendor.length;
  const faq = buildFaq({ interval, perVendor });

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Smart Router', path: ROUTER_PATH }]),
    webPageLd({
      path: ROUTER_PATH,
      name: H1_FULL,
      description: ROUTER_DESCRIPTION,
      ...(snapshot ? { dateModified: isoDay(snapshot.generatedAt) } : {}),
      about: { '@id': APP_ID },
    }),
    {
      '@type': 'SoftwareApplication',
      '@id': APP_ID,
      name: 'AI Stupid Level Smart Router',
      alternateName: ['ASL Smart Router', 'AI Smart Router'],
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      url: `${SITE}${ROUTER_PATH}`,
      description: ROUTER_DESCRIPTION,
      author: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID },
      isAccessibleForFree: true,
      softwareHelp: { '@type': 'CreativeWork', url: `${SITE}/router/docs` },
      featureList: [
        'OpenAI-compatible /v1/chat/completions with streaming, tool calls and JSON schema output',
        'Native Anthropic /v1/messages passthrough for Claude Code',
        '/v1/embeddings',
        `${MODE_COUNT} auto-* routing modes ranked on benchmark results`,
        'Drift-aware routing: a model with a fired detector or an open canary incident moves behind healthy ones',
        `Up to ${MAX_FALLBACKS} fallbacks per request and a per-model circuit breaker`,
        'Per-request routing decision in the X-AISM-Reasoning header',
        `Your own provider keys, stored with ${KEY_CIPHER}; no markup on tokens`,
      ],
      offers: OFFER_PLANS.map((p) => ({
        '@type': 'Offer',
        name: `${planName(p)} plan`,
        price: priceNumber(p),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE}/pricing`,
        description: `${n(PLANS[p].routerRequestsPerMonth)} routed requests a month`,
      })),
    },
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-router"
        kicker="Smart Router"
        title={H1}
        accent={H1_ACCENT}
        lead={<>
          An AI router with one endpoint, {MODE_COUNT} auto-* modes, your own provider keys and zero markup on tokens. Point any
          OpenAI-compatible client at <code>{BASE_URL}</code>, send <code>model: &quot;auto-coding&quot;</code> or any other mode, and the request
          goes to the model placing highest for that job among the providers you hold keys for, re-ranked as the benchmarks
          re-run: {CADENCE}.
        </>}
        actions={(
          <CtaRow>
            <RouterCta cta="router-hero-key" />
            <LeaderboardCta ghost cta="router-hero-leaderboard" label="See the boards it routes on →" sub="Coding, Reasoning, Tool use and Combined, over 24 hours, 7 days and 30 days." />
          </CtaRow>
        )}
        note={FREE_TIER}
        aside={(
          <dl className="lp-facts">
            <div><dt>0%</dt><dd>markup on tokens. Providers bill you directly, at their own list price.</dd></div>
            <div><dt>{MODE_COUNT}</dt><dd>auto-* routing modes, from <code>auto-coding</code> to <code>auto-cheapest</code>.</dd></div>
            {interval !== null && <div><dt>{interval}&nbsp;min</dt><dd>between health checks on every provider the router can pick.</dd></div>}
            <div><dt>{MAX_FALLBACKS}</dt><dd>fallbacks at most on every request, your own order first.</dd></div>
          </dl>
        )}
        toc={TOC}
        final={(
          <RdFinal
            title="Route on evidence, not habit"
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <RouterCta cta="router-final-key" />
                <LeaderboardCta ghost cta="router-final-leaderboard" />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection
          id="live"
          n={num('live')}
          title="Where does each routing mode send a request?"
          lead="The requests below are examples. Every ranking and pick is the live router’s own decision for an example caller who holds a key for every provider; the explorer under it shows the same for each mode, with the code to send."
        >
          {scenarios.length > 0 && snapshot ? (
            <>
              <div className="lp-router-demo rtl-live lp-up">
                <RouterDemo scenarios={scenarios} modelCount={snapshot.modelCount} note="Example requests · live router picks" />
              </div>
              <AsOf>
                As of {utcStamp(snapshot.generatedAt)} · the router’s own picks for an example caller with keys for all {providerCount} providers · the requests are examples
              </AsOf>
            </>
          ) : (
            <RdProse>
              <p>
                <Link href="/router/docs#strategies">Read how the Smart Router decides</Link> in the router documentation, or see the
                boards it ranks on: <Link href="/best-llm-for-coding">coding</Link>,{' '}
                <Link href="/best-llm-for-reasoning">reasoning</Link> and <Link href="/best-ai-model-for-agents">agents</Link>.
              </p>
            </RdProse>
          )}
          {snapshot && <RouterExplorer snapshot={snapshot} />}
        </RdSection>

        <RdSection
          id="how"
          n={num('how')}
          title="How does the Smart Router decide which model to use?"
          lead={`Each auto-* mode names a benchmark suite and a rule. A quality mode ranks on the average of a model’s last ${RUNS_AVERAGED} scored runs of that suite, never on one run; the near-top modes choose among the models within ${VALUE_FLOOR_POINTS} points of the best one you can use, so a cheaper, faster or steadier pick is never a much weaker one. The boards are the same ones the leaderboard shows.`}
        >
          <div className="rd-table-wrap lp-up">
            <table className="rd-table rtl-modes">
              <caption>Every mode GET /v1/models publishes, and what it ranks on. <code>auto</code> alone is your saved preference: a mode plus your exclusions, cost and latency caps and fallback order.</caption>
              <thead>
                <tr><th scope="col">Mode</th><th scope="col">Ranks on</th><th scope="col">See</th></tr>
              </thead>
              <tbody>
                {MODES.map((m) => (
                  <tr key={m.id}>
                    <th scope="row"><code>{m.id}</code></th>
                    <td>{m.ranks}</td>
                    <td className="rtl-board"><Link href={m.more.href}>{m.more.label}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RdRows rows={[
            ['Statistical ties, your tie-break', <>
              When the leaders are closer than 1.96 times their combined standard error, the test behind the leaderboard’s
              &ldquo;=&rdquo; places, they are tied, and your tie-break in Preferences decides: the one that cost least per task in
              our runs (the default), the fastest, or the highest average. A model you were already routed to stays while it
              is still tied, and a conversation stays on the model that answered it, so the pick does not change with every
              new run. The rule is on the <Link href="/methodology#ranks">methodology page</Link>.
            </>],
            ['Drift-aware by default', <>
              A model whose Page-Hinkley detector (a CUSUM-family test) has fired on the suite your mode relies on, or that has an
              open canary incident, moves behind every unflagged model. It is never removed: if every candidate is flagged, the
              best of them is used, and the routing reason names any model passed over. Every model&apos;s alarms are on the{' '}
              <Link href="/ai-degradation-tracker">AI degradation tracker</Link>. The same detectors answer{' '}
              <Link href="/is-chatgpt-getting-worse">is ChatGPT getting worse</Link> and{' '}
              <Link href="/is-claude-getting-worse">is Claude getting worse</Link>; how they work is on{' '}
              <Link href="/ai-drift-detection">AI drift detection</Link>.
            </>],
            ['Your constraints first', <>
              Provider and model exclusions, a maximum price per 1M tokens, a maximum latency and tool-calling-only are checked
              before anything is sent; the ranking applies to what remains. A caller with keys for two providers is ranked among
              those two providers’ models only.
            </>],
            ['Explained on every response', <>
              The <code>X-AISM-Reasoning</code> header names the model, the provider, the latency and why it won, including who
              was passed over for drift or an outage. The dashboard previews any routing setting against the real pipeline
              without spending a request.
            </>],
            ['Learns from production', <>
              Failures the router can attribute to a model over the last {FEEDBACK_DAYS} days, and your own ratings through{' '}
              <code>/v1/router/feedback</code>, adjust that model’s effective score, so a model that benchmarks well but fails in
              practice loses ground.
            </>],
          ]} />
        </RdSection>

        <RdSection
          id="what"
          n={num('what')}
          title="What is the Smart Router, and what is it not?"
          lead={`A proxy in front of ${word(providerCount)} providers that speaks the OpenAI API, speaks Anthropic’s too, and decides the model. Everything below is what the running service does today; the documentation has every parameter.`}
        >
          <RdRows rows={[
            ['An OpenAI-compatible endpoint', <>
              <code>POST /v1/chat/completions</code> with streaming, tool calls that keep the provider’s own call ids and each
              model’s own turn for {TURN_MEMORY_HOURS} hours of an agent loop, forced <code>tool_choice</code> (natively where
              the provider enforces it, otherwise asked for and checked), and <code>response_format</code> as{' '}
              <code>json_object</code> or <code>json_schema</code> on every provider. <code>GET /v1/models</code> lists the
              modes and every real model.
            </>],
            ['A native Anthropic endpoint', <>
              <code>POST /v1/messages</code> and <code>/v1/messages/count_tokens</code> pass through to Anthropic unchanged, so
              Claude Code runs behind the router by setting <code>ANTHROPIC_BASE_URL</code>. See{' '}
              <Link href="/router/integrations/claude-code">Claude Code with the Smart Router</Link>.
            </>],
            ['Embeddings', <><code>POST /v1/embeddings</code> on the same key, counted and budgeted like every other request.</>],
            ['Fallbacks and a circuit breaker', <>
              Every request carries up to {MAX_FALLBACKS} fallbacks: the rest of your traffic split, then your own fallback order (up
              to {MAX_OWN_LIST} models), then up to {MAX_AUTO_FALLBACKS} automatic picks, preferring providers not yet in the chain. A
              model that fails {CIRCUIT_FAILURES} times in a row is skipped for {CIRCUIT_COOLDOWN_S} seconds and probed before it returns.
            </>],
            ['A per-request decision log', <>
              Each response explains its pick in the <code>X-AISM-Reasoning</code> header, and the dashboard keeps a log per
              request — model, provider, latency, tokens and cost — for {FREE.routerDiagnosticDays} days on Free,{' '}
              {PLANS.developer.routerDiagnosticDays} on {planName('developer')} and {PLANS.teams.routerDiagnosticDays} on{' '}
              {planName('teams')}.
            </>],
            ['Your keys, encrypted', <>
              Provider keys are stored with {KEY_CIPHER}. Prompt logging is off unless you turn it on, and logged prompts are
              scrubbed of secrets before they are encrypted.
            </>],
            ['Room for agents', <>
              Request bodies up to {BODY_LIMIT_MB} MB for long contexts, native streaming on every provider, and prompt caching on every
              provider, requested explicitly where a provider needs asking.
            </>],
          ]} />
          <RdProse>
            <p><b>What it is not.</b></p>
            <ul className="rd-ticks">
              <li><b>Not a hosted model or a reseller of inference.</b> The router never answers a prompt itself. Every request goes to the provider with your own key, and the provider bills you at its own list price.</li>
              <li><b>Not a way around one provider’s limits.</b> It does not spread your traffic over several accounts at one provider. The one split it does is the one you define yourself with <code>auto-split</code>.</li>
              <li><b>Not a markup.</b> Nothing is added to token prices. Plans include a number of routed requests a month, and that is all the router counts.</li>
              <li><b>Not multimodal.</b> It routes text, code and tool calls, because those are what the benchmarks measure; images and audio are not routed.</li>
            </ul>
          </RdProse>
        </RdSection>

        <RdSection
          id="works"
          n={num('works')}
          title="Which tools work with the Smart Router?"
          lead="Anything that lets you set an OpenAI-compatible base URL, and Claude Code through the Anthropic endpoint. Each guide has the exact settings, which auto-* mode fits the tool, what the tool supports behind a custom base URL, and the top of the board that mode reads, over the last 24 hours."
        >
          <ul className="rd-tags lp-up" aria-label="Integration guides">
            {TOOLS.map((t) => <li key={t.slug}><Link href={`/router/integrations/${t.slug}`}>{t.name}</Link></li>)}
          </ul>
          <RdProse>
            <p>
              The <Link href="/router/docs">router documentation</Link> is the full reference: every endpoint, parameter, mode
              and SDK, with the <Link href="/router/docs#integrations">integrations section</Link> covering tools beyond the
              guides above. Each tool above has its own page on the <Link href="/router/integrations">integrations hub</Link>:{' '}
              {toolNames()}. The <Link href="/router/help">help centre</Link> adds one-line settings for Chatbox, TypingMind, Jan.ai,
              AnythingLLM and LiteLLM. Anything that can call <code>{BASE_URL}</code> with a bearer key works; the guides only save
              you the reading.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="plans"
          n={num('plans')}
          title="How much does the Smart Router cost?"
          lead="Routing is in every plan, Free included. Every allowance and price below is read from the plan table, the same one the checkout enforces."
        >
          <RdFacts rows={SHOWN_PLANS.map((p): [ReactNode, ReactNode] => [planLabel(p), planSummary(p)])} />
          <RdProse>
            <p>
              Past an allowance, top-up credits: $1 buys {n(ROUTER_CREDITS.requestsPerUsd)} requests, minimum ${ROUTER_CREDITS.minimumUsd}, and they
              do not expire. Enterprise is contracted, with unlimited seats and requests. Providers bill you separately for
              tokens, at their own list prices, whatever the plan. <Link href="/pricing">Compare every plan</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection
          id="gateway"
          n={num('gateway')}
          title="Is the Smart Router an AI gateway or an AI aggregator?"
          lead="Both, in the sense people usually mean: one base URL and one key in front of every provider, with logging, budgets, fallbacks and per-request accounting behind it."
        >
          <RdProse>
            <p>
              Swap the base URL in any OpenAI SDK, or in any tool with a base-URL field, and nothing else changes: one key, your
              own provider accounts, no token markup. What differs is the routing signal. A gateway’s automatic mode usually
              picks by share of spend, by popularity, or by a rule you wrote and have to keep. The Smart Router picks from
              benchmark results on the boards: every model on the same tasks, on the same schedule, {CADENCE}, with a drift
              detector that moves a degrading model behind healthy ones and a status probe that keeps an unavailable provider out
              of the chain.
            </p>
            <p>
              {OPENNESS} The boards it routes on are public: <Link href="/best-llm-for-coding">best LLM for coding</Link>,{' '}
              <Link href="/best-llm-for-reasoning">best LLM for reasoning</Link>,{' '}
              <Link href="/best-ai-model-for-agents">best AI model for agents</Link>,{' '}
              <Link href="/best-value-ai-model">best value AI model</Link> and <Link href="/fastest-ai-model">fastest AI model</Link>;
              how they are scored is on the <Link href="/methodology">methodology page</Link>, and provider health on the{' '}
              <Link href="/status">status page</Link>. Any two models can be put side by side on <Link href="/compare">compare</Link>,
              and the same data is available by key through the <Link href="/api-docs">Data API</Link>.
            </p>
            <p>
              <b>Compare routers.</b> The Smart Router beside the other AI routers, gateways and aggregators, each described from its
              vendor’s own pages, and the steps to switch:
            </p>
          </RdProse>
          <ClusterTags current={ROUTER_PATH} label="Compare routers" />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Smart Router questions">
          <Faq items={faq} />
        </RdSection>
      </ReadingPage>
      <SiteFooter force />
    </>
  );
}
