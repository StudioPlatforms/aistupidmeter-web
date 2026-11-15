'use client';

import { SAVINGS_PCT } from '@/lib/savings-estimate';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import RouterLayout from '@/components/RouterLayout';
import { apiClient, endpointEntryLabel, isEndpointEntry, isModelSource, setupOf } from '@/lib/api-client';
import type { AnalyticsOverview, RecentRequest, CostSavings, PreferencesPreview, UserPreferences, ProviderKey } from '@/lib/api-client';
import { PLANS, isPlan, isUnlimited, type Plan } from '@/lib/entitlements';
import {
  PageHead, Pane, Stats, Stat, CountUp, Loader, Empty, Note, Tag, Pill, ProviderMark, Meter,
  RankList, RouterDemo, previewToSnap, useModelNames, metricKind,
  type DemoScenario, type LandingStrategy,
} from '@/components/studio';
import type { LandingSnapshot } from '@/components/landing/types';
import { scoreLabel } from '@/components/landing/util';
import { ActivityRow, providerName } from '@/components/router/RecentRequests';
import ModelChangesPane from '@/components/router/ModelChanges';
import { STRATEGY_NAME } from '@/lib/router-adaptive';
import '@/styles/studio-router.css';


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

/** Model source (R4), as the Preferences page names it. */
const SOURCE_NAME: Record<string, string> = { all: 'All connected', prefer_endpoints: 'Prefer my endpoints', only_endpoints: 'Only my endpoints' };
const pctText = (v: string | number) => (String(v).endsWith('%') ? String(v) : `${v}%`);
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
const decimals = (v: string | number | undefined) => (String(v ?? '').split('.')[1] ?? '').replace(/\D.*$/, '').length;

type Live =
  | { kind: 'loading' }
  | { kind: 'ready'; prefs: UserPreferences; runs: Array<{ s: Sample; p: OkPreview }> }
  | { kind: 'blocked'; prefs: UserPreferences; preview: PreferencesPreview }
  | { kind: 'nokeys' }
  // No provider key, but the account's own endpoint models answer requests that name them (from R3,
  // GET /router/keys setup): only automatic routing is waiting. `sourceAll`: the API has Model source
  // (R4) and it is All connected, so Prefer or Only my endpoints would route automatic requests to them.
  | { kind: 'endpoints'; endpointModels: number; listedHosts: number; sourceAll: boolean }
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
  // Saved provider keys that real requests show are refused or out of credit.
  const [keyProblems, setKeyProblems] = useState<ProviderKey[]>([]);
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
        // The preview is about automatic routing, which needs a provider key. Whether the account's
        // keys can answer anything at all is the API's verdict (setup.waitingForProviderKey), which
        // counts the account's own endpoint models.
        const setup = await apiClient.getUniversalKeys().then(r => r.setup, () => undefined);
        const said = setup ? setupOf(setup) : null;
        setLive(said && said.endpointsOnly
          ? { kind: 'endpoints', endpointModels: said.endpointModels, listedHosts: said.listedHosts, sourceAll: isModelSource(saved.modelSource) && saved.modelSource === 'all' }
          : { kind: 'nokeys' });
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
    apiClient.getProviderKeys()
      .then(r => setKeyProblems((r.keys || []).filter(k => k.isActive && k.problem)))
      .catch(() => setKeyProblems([]));
    fetch('/api/account/usage', { cache: 'no-store' })
      .then(r => r.json())
      .then(u => { if (u?.success) setRoutedMeter((u.data?.meters ?? []).find((m: UsageMeter) => m.key === 'routedRequests') ?? null); })
      .catch(() => {});
  }, [status, userId, loadLive]);

  // No provider keys: the setup steps, the landing's example router, and whether step 2 is done.
  useEffect(() => {
    if (live.kind !== 'nokeys' && live.kind !== 'endpoints') return;
    let alive = true;
    if (live.kind === 'nokeys') {
      fetch('/dashboard/landing')
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (alive && j?.success && j.strategies) setExample(j as LandingSnapshot); })
        .catch(() => {});
    }
    apiClient.getUniversalKeys()
      .then(r => { if (alive) setRouterKeys(r.keys.filter(k => !k.revoked).length); })
      .catch(() => {});
    return () => { alive = false; };
  }, [live.kind, liveVersion]);

  const refresh = () => {
    fetchDashboardData();
    loadLive();
  };

  // From R4 the first choice can be one of the account's own endpoints (Prefer or Only my endpoints,
  // or All's last resort). The landing's demo animates the benchmark ranking and would crown its top
  // cloud model, so such a chain is listed as it is instead (endpointRun below).
  const endpointRun = useMemo(() => (live.kind === 'ready' ? live.runs.find(r => isEndpointEntry(r.p.primary)) ?? null : null), [live]);

  const demo = useMemo(() => {
    if (live.kind !== 'ready' || endpointRun) return null;
    const scenarios: DemoScenario[] = [];
    for (const { s, p } of live.runs) {
      const r = previewToSnap(p, names);
      if (r && r.snap.rows.length) scenarios.push({ id: 'auto', q: s.q, meta: s.meta, snap: forDemo(r.snap) });
    }
    const first = live.runs[0].p;
    const candidates = first.details?.candidates ?? [];
    const usable = candidates.filter(c => c.status === 'eligible').length;
    return { scenarios, modelCount: usable || candidates.length, providers: first.providers, split: first.details?.split };
  }, [live, names, endpointRun]);

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
  // Model source (R4): the lead says where requests go, so it follows the saved source.
  const savedSource = live.kind === 'ready' || live.kind === 'blocked' ? live.prefs.modelSource : undefined;
  const strategyName = strategyId ? STRATEGY_NAME[strategyId] ?? strategyId : '';

  return (
    <RouterLayout>
      <PageHead
        kicker="Smart Router"
        title="AI Smart Router"
        lead={savedSource === 'only_endpoints'
          ? 'Model source is Only my endpoints: requests made with your personal router keys go to your own endpoints, in your order, and never to a built-in provider.'
          : savedSource === 'prefer_endpoints'
            ? 'Requests go to your own endpoints first, then to the benchmarked model measuring best right now, sent with your own provider keys.'
            : 'Intelligent model selection, backed by live benchmarks: each request goes to the model measuring best right now, sent with your own provider keys.'}
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

        {live.kind === 'ready' && endpointRun && (
          <Pane
            title="Your router, live"
            sub={`${SOURCE_NAME[live.prefs.modelSource ?? 'all'] ?? 'All connected'} · ${strategyName}`}
            actions={<Link href="/router/preferences" className="st-btn is-sm">Routing preferences</Link>}
            tone="accent"
          >
            <ol className="sr-chain" aria-label="Routing order">
              {[endpointRun.p.primary, ...endpointRun.p.fallbacks].map((e, i) => (
                <li key={`${i}-${e.model}`} className={i === 0 ? 'is-pick' : undefined}>
                  <span className="sr-chain-k">{i === 0 ? 'First choice' : i === 1 ? 'If it fails' : 'Then'}</span>
                  <span className="sr-chain-m" title={e.model}>
                    {isEndpointEntry(e)
                      ? <><b>{endpointEntryLabel(e, endpointRun.p.endpoints)}</b><small>your endpoint · not benchmarked</small></>
                      : <><b>{names[e.model] ?? e.model}</b><small>{providerName(e.provider)}</small></>}
                  </span>
                </li>
              ))}
            </ol>
            <div className="sr-why">
              <p className="st-label">Why this model</p>
              <p>{endpointRun.p.primary.reasoning}</p>
            </div>
          </Pane>
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

        {live.kind === 'endpoints' && recentRequests.some(r => !r.success && r.cause === 'no_provider_key') && (
          <Note tone="warn" title="Some of your requests need a provider key">
            Requests that name one of your endpoint models are answered. Others, such as <code className="st-ic">auto</code> or the name of a cloud
            model, are refused with a message saying a provider key is missing; add one and they start working, with no change
            in your app.
            <div className="sk-note-act">
              <Link href="/router/providers" className="st-btn is-primary is-sm">Add a provider key <span className="st-ar" aria-hidden="true">→</span></Link>
            </div>
          </Note>
        )}

        {live.kind === 'nokeys' && recentRequests.some(r => !r.success && r.cause === 'no_provider_key') && (
          <Note tone="warn" title="Your app is already sending requests, and they are being refused">
            Requests are arriving with your router key, but there is no provider key to answer them with, so each one is
            refused with a message saying so. Add a provider key (step 1 below) and they start working straight away, with no
            change in your app.
            <div className="sk-note-act">
              <Link href="/router/providers" className="st-btn is-primary is-sm">Add a provider key <span className="st-ar" aria-hidden="true">→</span></Link>
            </div>
          </Note>
        )}

        {keyProblems.length > 0 && (
          <Note tone="warn" title={keyProblems.length === 1 ? `Your ${providerName(keyProblems[0].provider)} key needs attention` : 'Some provider keys need attention'}>
            {keyProblems.map(k => (
              <span key={k.id} className="sr-keyprob">
                {k.problem!.kind === 'no_credit'
                  ? `${providerName(k.provider)} refused requests for lack of credit on ${new Date(k.problem!.at).toLocaleDateString()}: add credit in your ${providerName(k.provider)} account. `
                  : `${providerName(k.provider)} refused your key on ${new Date(k.problem!.at).toLocaleDateString()}: replace it with a new one. `}
              </span>
            ))}
            <div className="sk-note-act">
              <Link href="/router/providers" className="st-btn is-sm">Open provider keys</Link>
            </div>
          </Note>
        )}

        {live.kind === 'endpoints' && (
          <Pane
            title="Automatic routing needs a provider key"
            actions={<>
              <Link href="/router/providers" className="st-btn is-sm is-primary">Add a provider key</Link>
              <Link href="/router/keys" className="st-btn is-sm">{routerKeys ? 'Manage router keys' : 'Create a router key'}</Link>
            </>}
            tone="accent"
          >
            {live.endpointModels === 0 && live.listedHosts > 0 ? (
              // M8 (B3 item 6): the account's only routes are listed hosts it connected with its own keys.
              <p className="st-text">
                {live.listedHosts === 1 ? 'You connected a listed host' : `You connected ${live.listedHosts.toLocaleString()} listed hosts`}: requests that name one of
                {' '}{live.listedHosts === 1 ? 'its' : 'their'} models (<code className="st-ic">mp/&lt;host&gt;/&lt;model&gt;</code>) are routed already, and so is automatic
                routing among them when Model source prefers them (<Link href="/router/preferences">Routing preferences</Link>). Automatic routing across the
                leaderboard&apos;s cloud models calls them with your own provider key, so it starts once you add one.
              </p>
            ) : (
            <p className="st-text">
              {live.endpointModels === 1 ? 'One of your endpoint models is set up: requests that name it' : `${live.endpointModels > 1 ? live.endpointModels.toLocaleString() : 'Your'} endpoint models are set up: requests that name them`}
              {' '}(<code className="st-ic">ep/&lt;prefix&gt;/&lt;model&gt;</code>) are routed already. Automatic routing (<code className="st-ic">auto</code> and the{' '}
              <code className="st-ic">auto-*</code> modes) chooses among benchmarked cloud models, which the router calls with your own provider key,
              so it starts once you add one.
              {live.sourceAll && <> To send automatic requests to your endpoints instead, set Model source to Prefer or Only my endpoints in <Link href="/router/preferences">Routing preferences</Link>.</>}
            </p>
            )}
          </Pane>
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
                {/* Each with what it asked for (from the API's A1 release) and "Why this model". */}
                {recentRequests.map((req) => <ActivityRow key={req.id} req={req} names={names} />)}
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
                          <span>{provider.requests.toLocaleString()} {Number(provider.requests) === 1 ? 'request' : 'requests'}</span>
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

        {/* Model changes (router release AW3): when a key's automatic requests started going to another model, and why.
            Every plan; ?key=<id> preselects a key (the keys page's link); hidden while the API has no such route. */}
        <ModelChangesPane names={names} initialKey={searchParams.get('key')} />

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

/**
 * Only app/router/page.tsx renders this, and that page is dynamic, so useSearchParams needs no
 * Suspense boundary here. Deliberately none: React 19 streams a finished boundary after the page
 * shell once enough HTML has gone out, so a slow connection painted a loading fallback first. Without
 * one the dashboard's own first state is in the first paint, as it was on Next 14.
 */
export default function RouterDashboard() {
  return <RouterDashboardContent />;
}
