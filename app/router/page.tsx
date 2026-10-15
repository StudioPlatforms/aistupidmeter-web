'use client';

import { SAVINGS_PCT } from '@/lib/savings-estimate';

import { useCallback, useEffect, useMemo, useState, Suspense, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import { apiClient } from '@/lib/api-client';
import type { AnalyticsOverview, RecentRequest, CostSavings, PreferencesPreview, UserPreferences } from '@/lib/api-client';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';
import {
  PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note, Tag, Pill, ProviderMark, Meter,
  RankList, RouterDemo, previewToSnap, useModelNames, metricKind, PROVIDER_LABEL,
  type DemoScenario, type LandingStrategy,
} from '@/components/studio';
import type { LandingSnapshot } from '@/components/landing/types';
import { scoreLabel } from '@/components/landing/util';
import '@/styles/studio-router.css';

export const dynamic = 'force-dynamic';

type OkPreview = Extract<PreferencesPreview, { ok: true }>;
interface Sample { q: string; meta: string; tools?: boolean }

/**
 * The live router's requests are examples (and say so); every ranking and pick in it is this
 * account's own preview — POST /router/preferences/preview with the saved preferences and the
 * caller's keys, which spends nothing. With one strategy for every request, the examples share
 * that one preview: the router really would send each of them to the same place.
 */
const SAMPLES: Sample[] = [
  { q: 'Fix the race condition in checkout.ts', meta: 'stream' },
  { q: 'Tag 2,000 support tickets by intent', meta: 'batch' },
  { q: 'Suggest a subject line for this email', meta: 'short' },
  { q: 'Write unit tests for parseDate()', meta: 'code' },
];
/** match_task decides per request, so each example gets its own preview and its own rule. */
const TASK_SAMPLES: Sample[] = [
  { q: 'Fix the race condition in checkout.ts', meta: 'stream' },
  { q: 'Design the event schema for multi-tenant billing', meta: 'design' },
  { q: 'Move Tuesday’s design review and email the team', meta: '3 tools', tools: true },
  { q: 'Suggest a subject line for this email', meta: 'short' },
  { q: 'Write unit tests for parseDate()', meta: 'code' },
];
/** No provider keys yet: the landing page's own demo (GET /dashboard/landing), labelled as an example. */
const EXAMPLE: Array<{ id: string; q: string; meta: string; key: string }> = [
  { id: 'auto-coding', q: 'Fix the race condition in checkout.ts', meta: 'stream', key: 'best_coding' },
  { id: 'auto-cheapest', q: 'Tag 2,000 support tickets by intent', meta: 'batch', key: 'cheapest' },
  { id: 'auto-task', q: 'Design the event schema for multi-tenant billing', meta: 'match_task', key: 'match_task_design' },
  { id: 'auto-tooling', q: 'Move Tuesday’s design review and email the team', meta: '3 tools', key: 'best_tooling' },
  { id: 'auto-fastest', q: 'Suggest a subject line for this email', meta: 'short', key: 'fastest' },
  { id: 'auto-value-coding', q: 'Write unit tests for parseDate()', meta: 'code', key: 'best_value_coding' },
];

const STRATEGY_NAME: Record<string, string> = {
  best_overall: 'Best overall', best_coding: 'Best for coding', best_reasoning: 'Best for reasoning', best_tooling: 'Best for tool use',
  best_value: 'Best value overall', best_value_coding: 'Best value for coding', best_value_reasoning: 'Best value for reasoning',
  best_value_tooling: 'Best value for tool use', fastest_quality: 'Fastest good model', best_consistent: 'Most consistent',
  fastest: 'Fastest response', cheapest: 'Lowest list price', match_task: 'Match each request', custom_split: 'Your traffic split',
};

/**
 * RouterDemo formats its numbers by the strategy id. A caller's preview carries scores for the
 * value and consistency modes (previewToSnap: points per dollar and run-to-run spread are not in
 * it), so those ids get an invisible word joiner in front: the readout still names the strategy,
 * and the column is labelled and formatted as the score it really shows.
 */
function forDemo(snap: LandingStrategy): LandingStrategy {
  const k = metricKind(snap.effectiveStrategy);
  return k === 'value' || k === 'spread' ? { ...snap, effectiveStrategy: `⁠${snap.effectiveStrategy}` } : snap;
}

const providerName = (p: string) => PROVIDER_LABEL[p] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Provider');
const pctText = (v: string | number) => (String(v).endsWith('%') ? String(v) : `${v}%`);
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
const decimals = (v: string | number | undefined) => (String(v ?? '').split('.')[1] ?? '').replace(/\D.*$/, '').length;

function ago(ts: string): string {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

type Live =
  | { kind: 'loading' }
  | { kind: 'ready'; prefs: UserPreferences; runs: Array<{ s: Sample; p: OkPreview }> }
  | { kind: 'blocked'; prefs: UserPreferences; preview: PreferencesPreview }
  | { kind: 'nokeys' }
  | { kind: 'error'; message: string };

interface UsageMeter { key: string; label: string; used: number; limit: number; period: string }

function RouterDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [costSavings, setCostSavings] = useState<CostSavings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  // The live router (this account's own routing preview) and what it needs around it.
  const [live, setLive] = useState<Live>({ kind: 'loading' });
  const [liveVersion, setLiveVersion] = useState(0);
  const [example, setExample] = useState<LandingSnapshot | null>(null);
  const [routerKeys, setRouterKeys] = useState<number | null>(null);
  const [routedMeter, setRoutedMeter] = useState<UsageMeter | null>(null);
  const names = useModelNames();
  const userId = session?.user?.id;

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      setShowSuccessBanner(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.pathname);
      setTimeout(() => setShowSuccessBanner(false), 10000);
    }

    // Routing — keys, providers and this dashboard — is part of every plan, Free included
    // (lib/capabilities REQUIRED_PLAN.routing). This page used to show Free accounts a sales
    // overlay instead, while the same accounts could create keys and route.
    if (status === 'authenticated' && session?.user?.id) {
      apiClient.setUserId(session.user.id);
      setCheckingSubscription(false);
      fetchDashboardData();
    } else if (status === 'unauthenticated') {
      setError('User authentication required');
      setLoading(false);
      setCheckingSubscription(false);
    }
  }, [status, session, searchParams]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewData, requestsData, savingsData] = await Promise.all([
        apiClient.getAnalyticsOverview(),
        apiClient.getRecentRequests(5, 0),
        apiClient.getCostSavings().catch(() => null)
      ]);
      setOverview(overviewData);
      setRecentRequests(requestsData.requests);
      setCostSavings(savingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  /** Where this account's requests would go right now: the saved preferences, previewed. */
  const loadLive = useCallback(async () => {
    try {
      const saved = await apiClient.getPreferences();
      const prefs: UserPreferences = { ...saved, fallbackOrder: saved.fallbackOrder ?? [], trafficSplit: saved.trafficSplit ?? [] };
      let results: Array<{ s: Sample; p: PreferencesPreview | null }>;
      if (prefs.routingStrategy === 'match_task') {
        results = await Promise.all(TASK_SAMPLES.map(s =>
          apiClient.previewPreferences({ ...prefs, samplePrompt: s.q, sampleHasTools: s.tools || undefined })
            .then(p => ({ s, p }), () => ({ s, p: null }))));
      } else {
        const p = await apiClient.previewPreferences(prefs);
        results = SAMPLES.map(s => ({ s, p }));
      }
      const answered = results.filter((r): r is { s: Sample; p: PreferencesPreview } => !!r.p);
      if (!answered.length) throw new Error('The routing preview did not answer.');
      if (answered.some(r => !r.p.ok && r.p.error === 'no_provider_keys')) {
        setLive({ kind: 'nokeys' });
      } else {
        const runs = answered.filter((r): r is { s: Sample; p: OkPreview } => r.p.ok);
        setLive(runs.length ? { kind: 'ready', prefs, runs } : { kind: 'blocked', prefs, preview: answered[0].p });
      }
      setLiveVersion(v => v + 1);
    } catch (err) {
      setLive({ kind: 'error', message: err instanceof Error ? err.message : 'The routing preview is unavailable.' });
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    apiClient.setUserId(userId);
    loadLive();
    fetch('/api/account/usage', { cache: 'no-store' })
      .then(r => r.json())
      .then(u => { if (u?.success) setRoutedMeter((u.data?.meters ?? []).find((m: UsageMeter) => m.key === 'routedRequests') ?? null); })
      .catch(() => {});
  }, [status, userId, loadLive]);

  // No provider keys: the setup steps, the landing's example router, and whether step 2 is done.
  useEffect(() => {
    if (live.kind !== 'nokeys') return;
    let alive = true;
    fetch('/dashboard/landing')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.success && j.strategies) setExample(j as LandingSnapshot); })
      .catch(() => {});
    apiClient.getUniversalKeys()
      .then(r => { if (alive) setRouterKeys(r.keys.filter(k => !k.revoked).length); })
      .catch(() => {});
    return () => { alive = false; };
  }, [live.kind, liveVersion]);

  const refresh = () => {
    fetchDashboardData();
    loadLive();
  };

  const demo = useMemo(() => {
    if (live.kind !== 'ready') return null;
    const scenarios: DemoScenario[] = [];
    for (const { s, p } of live.runs) {
      const r = previewToSnap(p, names);
      if (r && r.snap.rows.length) scenarios.push({ id: 'auto', q: s.q, meta: s.meta, snap: forDemo(r.snap) });
    }
    const first = live.runs[0].p;
    const usable = first.details.candidates.filter(c => c.status === 'eligible').length;
    return { scenarios, modelCount: usable || first.details.candidates.length, providers: first.providers, split: first.details.split };
  }, [live, names]);

  const exampleScenarios = useMemo<DemoScenario[]>(() => (example
    ? EXAMPLE.flatMap(d => {
        const snap = example.strategies[d.key];
        return snap && snap.rows.length ? [{ id: d.id, q: d.q, meta: d.meta, snap }] : [];
      })
    : []), [example]);

  const blockedView = useMemo(() => (live.kind === 'blocked' ? previewToSnap(live.preview, names) : null), [live, names]);

  if (checkingSubscription || (loading && !overview)) {
    return (
      <RouterLayout>
        <PageHead kicker="Smart Router" title="AI Smart Router" />
        <div data-page-loading><Loader label="Loading dashboard" minHeight={360} /></div>
      </RouterLayout>
    );
  }

  const stats = overview ? {
    totalRequests: overview.overview.totalRequests,
    totalCost: overview.overview.totalCost,
    successRate: overview.overview.successRate,
    totalTokens: overview.overview.totalTokens,
  } : null;
  const costDecimals = Math.max(2, decimals(stats?.totalCost));
  const rateDecimals = Math.max(0, Math.min(2, decimals(stats?.successRate)));

  const plan: Plan = isPlan((session?.user as any)?.plan) ? (session!.user as any).plan : 'free';
  const planEnt = PLANS[plan];
  // A legacy payer is never shown the word "legacy" (as on the account page).
  const planLabel = plan === 'legacy_pro' ? 'Pro' : planEnt.label;
  const planPrice = planEnt.priceMonthly === null ? 'Contracted' : planEnt.priceMonthly === 0 ? 'Free plan' : `$${planEnt.priceMonthly}/month`;
  const allowance = planEnt.routerRequestsPerMonth;

  const strategyId = live.kind === 'ready' || live.kind === 'blocked' ? live.prefs.routingStrategy : null;
  const strategyName = strategyId ? STRATEGY_NAME[strategyId] ?? strategyId : '';

  return (
    <RouterLayout>
      <PageHead
        kicker="Smart Router"
        title="AI Smart Router"
        lead="Intelligent model selection, backed by live benchmarks: each request goes to the model measuring best right now, sent with your own provider keys."
        actions={<>
          {loading ? (
            <Pill tone="warn">Refreshing</Pill>
          ) : error ? (
            <Pill tone="bad">Error</Pill>
          ) : (
            <Pill tone="good" live>Online</Pill>
          )}
          <button type="button" onClick={refresh} className="st-btn is-sm" title="Refresh" aria-label="Refresh the dashboard">Refresh</button>
        </>}
      />

      <div className="st-body sr-dash">
        {/* Success banner */}
        {showSuccessBanner && (
          <div className="st-note is-good sr-banner" role="status">
            <div><b>Subscription active</b>Thank you. Your plan&apos;s features are unlocked.</div>
            <button type="button" onClick={() => setShowSuccessBanner(false)} className="st-x" aria-label="Dismiss">×</button>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="st-note is-bad sr-banner" role="alert">
            <div><b>Connection error</b>{error}</div>
            <button type="button" onClick={fetchDashboardData} className="st-btn is-sm is-danger">Retry</button>
          </div>
        )}

        {/* The live router: this account's own routing, animated as on the landing page. */}
        {live.kind === 'loading' && (
          <section className="sr-hero" aria-label="Your router, live">
            <div className="sr-hero-wait"><Loader label="Asking your router where requests go" /></div>
          </section>
        )}

        {live.kind === 'ready' && demo && demo.scenarios.length > 0 && (
          <section className="sr-hero sr-demo st-up" aria-label="Your router, live">
            <RouterDemo
              key={`${liveVersion}-${Object.keys(names).length > 0}`}
              scenarios={demo.scenarios}
              modelCount={demo.modelCount}
              title="Your router, live"
              titleSub={`· ${strategyName}`}
              note="Live picks for your keys and preferences; the requests are examples"
            />
            <div className="sr-hero-foot">
              <ul className="sr-cfg" aria-label="Your saved routing preferences">
                <li className="is-main"><code>auto</code> {strategyName}</li>
                <li>
                  Keys
                  <span className="sr-marks">{demo.providers.map(p => <ProviderMark key={p} provider={p} size="sm" />)}</span>
                  <span className="st-sr">{demo.providers.map(providerName).join(', ')}</span>
                </li>
                <li>{!live.prefs.fallbackEnabled ? 'Fallbacks off' : (live.prefs.fallbackOrder?.length ? `Your fallback order of ${live.prefs.fallbackOrder.length}, then automatic` : 'Automatic fallbacks')}</li>
                <li>{live.prefs.avoidDrifting !== false ? 'Drift-flagged models go last' : 'Drift alerts not avoided'}</li>
                {(live.prefs.excludedProviders.length + live.prefs.excludedModels.length) > 0 && (
                  <li>
                    {[plural(live.prefs.excludedProviders.length, 'provider'), plural(live.prefs.excludedModels.length, 'model')].filter(Boolean).join(', ')} excluded
                  </li>
                )}
                {live.prefs.maxCostPer1kTokens !== null && <li>At most ${(live.prefs.maxCostPer1kTokens * 1000).toFixed(2)} per 1M tokens</li>}
                {live.prefs.maxLatencyMs !== null && <li>At most {(live.prefs.maxLatencyMs / 1000).toFixed(1)} s</li>}
                {live.prefs.requireToolCalling && <li>Tool-calling models only</li>}
              </ul>
              <Link href="/router/preferences" className="st-more">Routing preferences</Link>
              {live.prefs.routingStrategy === 'custom_split' && demo.split && demo.split.length > 0 && (
                <p className="sr-hero-note">
                  <b>Your traffic split:</b> {demo.split.map(x => `${names[x.model] ?? x.model} ${Math.round(x.share * 100)}%${x.usable ? '' : ` (unusable: ${x.reason})`}`).join(' · ')}.
                  {' '}Each request draws its model in these proportions; the demo shows the first model of your split.
                </p>
              )}
              <p className="sr-hero-cap">The requests are examples. Each ranking and pick is live, for your keys and saved preferences.</p>
            </div>
          </section>
        )}

        {live.kind === 'blocked' && (
          <Pane
            title="Your router, live"
            sub={`With your saved preferences (${strategyName}), no model can be used right now.`}
            actions={<Link href="/router/preferences" className="st-btn is-sm is-primary">Review preferences</Link>}
            tone="accent"
          >
            <Note tone="warn" title="Nothing qualifies">{live.preview.ok ? '' : live.preview.message}</Note>
            {blockedView && blockedView.snap.rows.length > 0 && (
              <div className="sr-rank">
                <p className="st-label"><span>Every model, and why it is out</span><span>{scoreLabel(blockedView.snap.effectiveStrategy, blockedView.kind)}</span></p>
                <RankList rows={blockedView.snap.rows} kind={blockedView.kind} winLabel="your pick" />
              </div>
            )}
          </Pane>
        )}

        {live.kind === 'error' && (
          <div className="st-note is-warn sr-banner" role="status">
            <div><b>The live router preview is unavailable</b>{live.message}</div>
            <button type="button" onClick={loadLive} className="st-btn is-sm">Try again</button>
          </div>
        )}

        {live.kind === 'nokeys' && (
          <>
            <Pane
              title="Start routing in three steps"
              sub={`The router calls models with your own provider keys, so it needs one before it can pick a model. Your plan includes ${isUnlimited(allowance) ? 'unlimited' : allowance.toLocaleString()} routed requests a month.`}
              tone="accent"
            >
              <ol className="sr-steps">
                <li className="sr-step">
                  <span className="sr-step-n" aria-hidden="true">01</span>
                  <h3 className="sr-step-t">Add a provider key</h3>
                  <p className="sr-step-d">OpenAI, Anthropic, Google, DeepSeek, Moonshot AI or Z.ai. Providers bill you directly, at their own list price.</p>
                  <Link href="/router/providers" className="st-btn is-primary">Add a provider key <span className="st-ar" aria-hidden="true">→</span></Link>
                </li>
                <li className="sr-step">
                  <span className="sr-step-n" aria-hidden="true">02</span>
                  <h3 className="sr-step-t">
                    Create a router key
                    {routerKeys !== null && routerKeys > 0 && <Tag tone="good">{routerKeys === 1 ? '1 key' : `${routerKeys} keys`} ready</Tag>}
                  </h3>
                  <p className="sr-step-d">One key for every model, on one OpenAI-compatible endpoint.</p>
                  <Link href="/router/keys" className="st-btn">{routerKeys ? 'Manage router keys' : 'Create a router key'}</Link>
                </li>
                <li className="sr-step">
                  <span className="sr-step-n" aria-hidden="true">03</span>
                  <h3 className="sr-step-t">Send a request</h3>
                  <p className="sr-step-d">Point any OpenAI-compatible client at <code>https://aistupidlevel.info/v1</code> and send <code>model: &quot;auto&quot;</code>, or a mode such as <code>auto-coding</code>.</p>
                  <Link href="/router/docs" className="st-btn">Read the docs</Link>
                </li>
              </ol>
            </Pane>

            {exampleScenarios.length > 0 && example && (
              <section className="st-up" aria-labelledby="sr-example-t">
                <div className="sr-ex-head">
                  <p className="st-label">An example, not your account</p>
                  <h2 className="st-pane-title" id="sr-example-t">What the router does with keys for all six providers</h2>
                  <p className="st-pane-sub">The live router for an example caller who has added a key for every provider. The requests are examples; the picks and rankings are live.</p>
                </div>
                <div className="sr-hero sr-demo">
                  <RouterDemo
                    scenarios={exampleScenarios}
                    modelCount={example.modelCount}
                    title="Example router"
                    titleSub="· keys for all six providers"
                    note="An example caller, not your account; the requests are examples"
                  />
                </div>
              </section>
            )}
          </>
        )}

        {/* KPI stats */}
        <div className={`sr-stats${loading ? ' is-busy' : ''}`} aria-busy={loading}>
          <Stats columns={4}>
            <Stat value={<CountUp value={stats?.totalRequests ?? 0} />} label="Total requests" sub="All time" />
            <Stat value={<CountUp value={parseFloat(String(stats?.totalCost ?? 0)) || 0} format={n => `$${n.toFixed(costDecimals)}`} />} label="Total cost" />
            <Stat value={<CountUp value={parseFloat(String(stats?.successRate ?? 0)) || 0} format={n => `${n.toFixed(rateDecimals)}%`} />} label="Success rate"
              sub={overview ? `${overview.overview.successfulRequests.toLocaleString()} succeeded` : undefined} />
            <Stat value={<CountUp value={stats?.totalTokens ?? 0} />} label="Total tokens"
              sub={overview ? `${overview.overview.totalTokensIn.toLocaleString()} in · ${overview.overview.totalTokensOut.toLocaleString()} out` : undefined} />
          </Stats>
        </div>

        {/* Cost savings highlight */}
        {costSavings && parseFloat(costSavings.savings) > 0 && (
          <Note tone="good" title={`Cost savings: $${costSavings.savings}`}>
            {pctText(costSavings.savingsPercentage)} saved vs. worst case · {Number(costSavings.totalRequests).toLocaleString()} requests processed
          </Note>
        )}

        <div className="st-split">
          {/* Recent activity */}
          <Pane
            title="Recent activity"
            sub="Your last five routed requests."
            actions={<Link href="/router/analytics" className="st-btn is-sm">View all</Link>}
            ruled={recentRequests.length > 0}
            flush={recentRequests.length > 0}
          >
            {recentRequests.length > 0 ? (
              <div className="st-rows sr-act">
                {recentRequests.map((req) => {
                  const when = ago(req.timestamp);
                  return (
                    <div key={req.id} className="st-row">
                      <ProviderMark provider={req.provider} />
                      <div className="st-row-main">
                        <div className="st-row-t" title={req.model}>{names[req.model] ?? req.model}</div>
                        <div className="st-row-s">
                          {providerName(req.provider)} · {(req.tokensIn + req.tokensOut).toLocaleString()} tokens
                          {req.latency != null ? ` · ${Number(req.latency).toLocaleString()} ms` : ''}{when ? ` · ${when}` : ''}
                        </div>
                      </div>
                      <div className="st-row-end">
                        <span className="sr-cost">${req.cost}</span>
                        {req.success ? <Tag tone="good">Success</Tag> : <Tag tone="bad">Failed</Tag>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                title="No activity yet"
                actions={live.kind === 'nokeys'
                  ? <Link href="/router/providers" className="st-btn is-sm">Add a provider key</Link>
                  : <Link href="/router/docs" className="st-btn is-sm">How to send a request</Link>}
              >
                Start making requests to see your activity here.
              </Empty>
            )}
          </Pane>

          <div className="sr-col">
            {/* Provider breakdown */}
            {overview && overview.providers.length > 0 && (
              <Pane title="Provider usage" sub="Share of your routed requests, all time." delay={0.06}>
                <div className="sr-pu">
                  {overview.providers.map((provider) => {
                    const pct = parseFloat(provider.percentage) || 0;
                    return (
                      <div key={provider.provider}>
                        <div className="sr-pu-top">
                          <ProviderMark provider={provider.provider} size="sm" />
                          <span className="sr-pu-name">{providerName(provider.provider)}</span>
                          <span className="sr-pu-cost">${provider.totalCost}</span>
                        </div>
                        <div className="st-meter" role="meter" aria-label={`${providerName(provider.provider)} share of requests`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                          <i style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <div className="sr-pu-sub">
                          <span>{provider.requests.toLocaleString()} requests</span>
                          <span>{pctText(provider.percentage)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Pane>
            )}

            {/* Plan and routed-request allowance */}
            <Pane
              title="Your plan"
              sub="Routed requests included each month."
              delay={0.1}
              foot={plan === 'free'
                ? <Link href="/pricing" className="st-more">See plans</Link>
                : <Link href="/account/billing" className="st-more">Manage plan</Link>}
            >
              <div className="sr-plan-v"><b>{planLabel}</b><span>{planPrice}</span></div>
              <div className="sr-plan-m">
                <span>Smart Router requests</span>
                <span>
                  {routedMeter
                    ? <><b>{routedMeter.used.toLocaleString()}</b>{isUnlimited(routedMeter.limit) ? ' · no limit' : ` of ${routedMeter.limit.toLocaleString()}`} {routedMeter.period}</>
                    : isUnlimited(allowance) ? 'No limit' : `${allowance.toLocaleString()} a month`}
                </span>
              </div>
              {routedMeter && <Meter used={routedMeter.used} limit={isUnlimited(routedMeter.limit) ? -1 : routedMeter.limit} />}
            </Pane>
          </div>
        </div>

        {/* Quick actions */}
        <section className="st-up" aria-labelledby="sr-quick">
          <p className="st-label" id="sr-quick">Quick actions</p>
          <div className="st-cards" style={{ ['--min' as string]: '220px' } as CSSProperties}>
            {[
              { title: 'API keys', desc: 'Manage universal keys', href: '/router/keys' },
              { title: 'Providers', desc: 'Connect AI providers', href: '/router/providers' },
              { title: 'Preferences', desc: 'Configure routing', href: '/router/preferences' },
              { title: 'Analytics', desc: 'View statistics', href: '/router/analytics' },
            ].map((a, i) => (
              <Link key={a.href} href={a.href} className="st-card sr-go st-up" style={{ ['--d' as string]: `${i * 0.04}s` } as CSSProperties}>
                <span className="st-card-t">{a.title}<span className="st-ar" aria-hidden="true">→</span></span>
                <span className="st-card-d">{a.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Smart routing features */}
        <Pane title="Smart routing features">
          <ul className="sr-feats">
            {[
              { title: 'Live benchmark data', desc: 'The same scores as the leaderboard: coding every 4 hours, reasoning and tool use daily' },
              { title: '14 routing strategies', desc: 'Best quality, best value, speed and stability — or match each request, or your own traffic split' },
              { title: 'Cost awareness', desc: `Prefers cheaper models when the measured quality is equivalent — a ${SAVINGS_PCT}% gap in our own measurements` },
              { title: 'Auto failover', desc: 'If a model fails, the next is tried automatically; models failing right now are skipped' },
            ].map((f) => (
              <li key={f.title} className="sr-feat">
                <b><i className="st-key is-accent" aria-hidden="true" />{f.title}</b>
                <p>{f.desc}</p>
              </li>
            ))}
          </ul>
        </Pane>

        <p className="sr-foot">
          Powered by AI Stupid Level · Routing on live benchmark scores · <Link href="/">View live rankings</Link>
        </p>
      </div>
    </RouterLayout>
  );
}

export default function RouterDashboard() {
  return (
    <Suspense fallback={
      <RouterLayout>
        <PageHead kicker="Smart Router" title="AI Smart Router" />
        <Loader label="Loading" minHeight={360} />
      </RouterLayout>
    }>
      <RouterDashboardContent />
    </Suspense>
  );
}
