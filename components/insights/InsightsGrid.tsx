'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import ProviderLogo from '../ProviderLogo';
import { buildActivityItems, buildRecoItems, providerTrustList, type RecoItem } from '../v4/IntelligencePanel';
import { RadarChart, axesForSort, axisWeightLabel, getAveragedAxes, scoreBg, scoreColor } from '../v4/AnalyticsPanel';
import { providerStatus, useProviderHealth } from '../v4/ProviderStrip';
import { getModelPricing } from '../../lib/model-pricing';
import { slugifyModelName } from '../../lib/model-slug';
import { ROUTER_PLAN, annualMonthly, annualSaving } from '@/lib/pricing-display';
import { SAVINGS_PCT } from '@/lib/savings-estimate';
import '../../styles/insights.css';

/**
 * Everything under the full-width leaderboards, on a wide screen, as rows of cards grouped
 * by what a visitor is trying to do: act on a problem, get a quick answer, compare, check the
 * providers and the method, and (once) the Smart Router.
 *
 * WHY ROWS, NOT THE OLD THREE COLUMNS
 * The side panels were built as rails beside a tall board in the middle column. With the
 * boards moved above them, the middle held ~400px against a 1,341px-tall right rail, leaving
 * ~900px of empty page at every width (measured 2026-09-27). Cards in a row share a height,
 * so rows cannot leave that hole, and the data-dense cards (heatmap, prices) get real width.
 *
 * The content and its rules are the side panels' own, shared rather than copied: the builders
 * live in IntelligencePanel / AnalyticsPanel / ProviderStrip, which still render the Drift
 * Monitor view and the phone layout unchanged.
 */

type Sort = 'combined' | 'reasoning' | 'speed' | 'tooling' | 'price';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'combined', label: 'Combined' },
  { key: 'speed', label: 'Coding' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'tooling', label: 'Tool use' },
  { key: 'price', label: 'Price' },
];
const TITLES: Record<Sort, { radar: string; heat: string }> = {
  combined: { radar: 'Performance radar', heat: 'Benchmark heatmap' },
  speed: { radar: 'Coding radar', heat: 'Coding heatmap' },
  reasoning: { radar: 'Reasoning radar', heat: 'Reasoning heatmap' },
  tooling: { radar: 'Tool-use radar', heat: 'Tool-use heatmap' },
  price: { radar: 'Cost-efficiency radar', heat: 'Cost-efficiency heatmap' },
};
const PROVIDER_NAME: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek', glm: 'GLM', kimi: 'Kimi', xai: 'xAI',
};
const RADAR_COLORS = ['#1a73e8', '#12b5cb', '#7c4dff', '#f9ab00', '#9aa0a6', '#d93025'];

const hrefFor = (name?: string | null, id?: string | number) =>
  `/models/${(name && slugifyModelName(name)) || id || ''}`;
const money = (n: number) => `$${Number(n.toFixed(2))}`;

function Logo({ provider, size = 13, box = 22 }: { provider?: string | null; size?: number; box?: number }) {
  return (
    <span className="ins-logo" style={{ width: box, height: box }} aria-hidden="true">
      <ProviderLogo provider={provider || ''} size={size} />
    </span>
  );
}

function Group({ title, note, right, children }: { title: string; note?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ins-group" aria-label={title}>
      <div className="ins-group-head">
        <div className="ins-group-title"><h2>{title}</h2>{note && <p>{note}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function InsightsGrid({
  recommendations, degradations, driftIncidents, providerReliability, modelScores, modelHistoryData,
  transparencyMetrics, leaderboardSortBy, leaderboardPeriod, onSortChange,
}: {
  recommendations: any;
  degradations: any[];
  driftIncidents: any[];
  providerReliability: any[];
  modelScores: any[];
  modelHistoryData: Map<string, any[]>;
  transparencyMetrics: any;
  leaderboardSortBy: string;
  leaderboardPeriod: string;
  onSortChange: (s: Sort) => void;
}) {
  const { data: session } = useSession();
  const health = useProviderHealth();
  const sort = (SORTS.some((s) => s.key === leaderboardSortBy) ? leaderboardSortBy : 'combined') as Sort;

  const reco = buildRecoItems(recommendations, modelScores);
  const answers = reco.filter((r) => r.kind === 'best');
  const poor = reco.filter((r) => r.kind === 'poor');
  const problems = reco.filter((r) => r.kind === 'avoid' || r.kind === 'unreliable');
  const degr = (degradations || []).slice(0, 4);

  // Compare: the same inputs the analytics panel uses, for the page's current sort.
  const { config, axisLabels, axisFullNames, axKeys } = axesForSort(sort);
  const available = modelScores.filter((m) => typeof m.currentScore === 'number' && m.currentScore > 0);
  const ranked = [...available].sort((a, b) => (b.currentScore as number) - (a.currentScore as number));
  const radarModels = [...ranked.slice(0, 3), ...ranked.slice(-3).reverse()];
  const priceRows = available
    .map((m) => {
      const pricing = getModelPricing(m.name, m.provider);
      const cost = pricing.input * 0.4 + pricing.output * 0.6;
      return { m, pricing, value: cost > 0 ? (m.currentScore as number) / cost : 0 };
    })
    .sort((a, b) => b.value - a.value)
    // 14, not the side panel's 10: here it sits beside the full heatmap and has the height.
    .slice(0, 14);
  const historyReady = modelHistoryData.size > 0;

  // Providers and method
  const providers = providerTrustList(providerReliability || [], modelScores);
  const activity = buildActivityItems(degradations || [], modelScores, driftIncidents || []).slice(0, 4);
  const summary = transparencyMetrics?.summary || transparencyMetrics || {};
  const providerCount = new Set(modelScores.map((m) => m.provider)).size;
  const coverage = summary?.coverage != null ? `${Math.round(summary.coverage)}%` : '—';
  const completeness = summary?.confidence != null ? `${Math.round(summary.confidence)}%` : '—';

  return (
    <div className="ins">
      {(degr.length > 0 || problems.length > 0) && (
        <Group title="Needs attention" note="Measured problems right now">
          <div className="ins-alerts">
            {degr.map((d: any, i: number) => (
              <Link key={`d${i}`} href={hrefFor(d.modelName)} className={`ins-alert${d.severity === 'critical' ? ' is-crit' : ''}`}>
                <span className="ins-alert-chip">{d.severity === 'critical' ? 'Critical' : 'Warning'}</span>
                <span className="ins-alert-name">{d.modelName}</span>
                <span className="ins-alert-text">{d.message || `Score dropped ${d.dropPercentage || 0}%.${d.currentScore ? ` Now at ${d.currentScore}.` : ''}`}</span>
              </Link>
            ))}
            {problems.map((p: RecoItem, i: number) => (
              <Link key={`p${i}`} href={hrefFor(p.rawName)} className="ins-alert is-crit">
                <span className="ins-alert-chip">{p.kind === 'avoid' ? 'Avoid now' : 'Unreliable'}</span>
                <span className="ins-alert-name">{p.name}</span>
                <span className="ins-alert-text">{p.detail}</span>
              </Link>
            ))}
          </div>
        </Group>
      )}

      {answers.length > 0 && (
        <Group title="Quick answers" note="Picked from the latest runs">
          <div className="ins-answers">
            {answers.map((a, i) => (
              <Link key={i} href={hrefFor(a.rawName)} className="ins-card ins-answer">
                <span className="ins-answer-top">
                  <span className="ins-answer-id">
                    <span className="ins-kicker">{a.type.toLowerCase()}</span>
                    <span className="ins-answer-name"><Logo provider={a.providerDot} size={14} box={24} />{a.name}</span>
                  </span>
                  <span className="ins-answer-score">
                    <b style={{ color: scoreColor(a.score) }}>{a.score > 0 ? Math.round(a.score) : '—'}</b>
                    <small>{a.status}</small>
                  </span>
                </span>
                <span className="ins-answer-detail">{a.detail}</span>
              </Link>
            ))}
          </div>
        </Group>
      )}

      <Group
        title="Compare models"
        note="The tabs switch both cards to that board"
        right={(
          <div className="ins-seg" role="tablist" aria-label="Board">
            {SORTS.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={sort === s.key}
                      className={sort === s.key ? 'is-active' : ''} onClick={() => onSortChange(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      >
        <div className="ins-compare">
          <div className="ins-card ins-heat">
            <h3>{TITLES[sort].heat}</h3>
            <p className="ins-sub">{axKeys.length} measures, 0–100 · {ranked.length} models · hover a heading for what it weighs</p>
            {!historyReady ? <div className="ins-empty">Loading the measurements…</div> : (
              <div className="ins-heat-grid" style={{ gridTemplateColumns: `minmax(170px, 1.6fr) repeat(${axKeys.length}, minmax(0, 1fr))` }}>
                <span className="ins-heat-hdr ins-heat-hdr--model">Model</span>
                {axisLabels.map((l, i) => {
                  const hot = config.highlightIndices.includes(config.axisIndices[i]);
                  return <span key={l} className={`ins-heat-hdr${hot ? ' is-hot' : ''}`} title={axisWeightLabel(axisFullNames[i])}>{l}{hot ? ' ★' : ''}</span>;
                })}
                {ranked.map((m) => {
                  const axes = getAveragedAxes(modelHistoryData.get(m.id) || m.history || []);
                  return (
                    <div key={m.id} className="ins-heat-row" style={{ display: 'contents' }}>
                      <Link href={hrefFor(m.name, m.id)} className="ins-heat-model"><Logo provider={m.provider} size={11} box={18} /><span>{m.displayName || m.name}</span></Link>
                      {axKeys.map((k, i) => {
                        const raw = axes[k];
                        const v = typeof raw === 'number' ? Math.round(raw * 100) : null;
                        return v === null
                          ? <span key={k} className="ins-heat-cell is-none">—</span>
                          : <span key={k} className="ins-heat-cell" style={{ background: scoreBg(v), color: scoreColor(v) }}
                                  title={`${axisWeightLabel(axisFullNames[i])} · ${m.name}: ${v}`}>{v}</span>;
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ins-card ins-price">
            <h3>Price-performance</h3>
            <p className="ins-sub">Score per dollar of blended price (40% input, 60% output, per 1M tokens)</p>
            <div className="ins-price-grid">
              <span className="ins-price-hdr">Model</span>
              <span className="ins-price-hdr is-r">$ in / out</span>
              <span className="ins-price-hdr is-c">Score</span>
              <span className="ins-price-hdr is-r">Value</span>
              {priceRows.map(({ m, pricing, value }) => (
                <div key={m.id} style={{ display: 'contents' }}>
                  <Link href={hrefFor(m.name, m.id)} className="ins-price-model"><Logo provider={m.provider} size={11} box={18} /><span>{m.displayName || m.name}</span></Link>
                  <span className="ins-price-cell is-r is-dim">{money(pricing.input)} / {money(pricing.output)}</span>
                  <span className="ins-price-cell is-c" style={{ color: scoreColor(m.currentScore as number), fontWeight: 700 }}>{m.currentScore}</span>
                  <span className="ins-price-cell is-r" style={{ fontWeight: 700 }}>{value.toFixed(1)}</span>
                </div>
              ))}
            </div>
            {poor.length > 0 && (
              <div className="ins-poor">
                <div className="ins-poor-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                  Poor value right now
                </div>
                {poor.map((p, i) => (
                  <p key={i}><Link href={hrefFor(p.rawName)}><b>{p.name}</b></Link> · {p.detail}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </Group>

      <Group title="Providers and method" note="Continuous, independent measurement of whether a model gets worse behind the same API name">
        <div className="ins-three">
          <div className="ins-card">
            <h3>Provider health</h3>
            <p className="ins-sub">Live status from a check every 10 minutes, and a trust score from incident history</p>
            <div className="ins-prov-list">
              {providers.map((p: any) => {
                const key = String(p.provider || p.name || '').toLowerCase();
                const trust = Math.round(p.score || p.trustScore || 0);
                const st = providerStatus(health?.[key]);
                return (
                  <div key={key} className="ins-prov-row">
                    <span className="ins-prov-name"><Logo provider={key} />{PROVIDER_NAME[key] || key}</span>
                    <span className="ins-prov-status" title={st?.title} style={st ? { color: st.color } : undefined}>{st ? st.label : '—'}</span>
                    <span className="ins-prov-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, trust))}%`, background: trust >= 75 ? 'var(--good)' : 'var(--warn)' }} /></span>
                    <span className="ins-prov-score" title="Trust score from incident history">{trust}</span>
                  </div>
                );
              })}
            </div>
            <div className="ins-kicker ins-activity-head">Latest activity</div>
            {activity.length === 0 ? <div className="ins-sub">Waiting for activity…</div> : activity.map((a, i) => (
              <div key={i} className={`ins-activity is-${a.tone}`}>
                <span className="ins-dot" aria-hidden="true" />
                <span className="ins-activity-text"><b>{a.model}</b> {a.text}{a.value !== undefined ? <>: <b>{a.value}</b></> : null}</span>
                <span className="ins-activity-time">{a.time}</span>
              </div>
            ))}
          </div>

          <div className="ins-card">
            <h3>{TITLES[sort].radar}</h3>
            <p className="ins-sub">{config.subtitle}</p>
            {!historyReady ? <div className="ins-empty">Loading the measurements…</div> : (
              <>
                <div className="ins-radar">
                  <RadarChart models={radarModels} colors={RADAR_COLORS} modelHistoryData={modelHistoryData}
                              axKeys={axKeys} axisLabels={axisLabels} highlightIndices={config.highlightIndices} />
                </div>
                <div className="ins-legend">
                  {radarModels.map((m, i) => (
                    <span key={m.id || i}><i style={{ background: RADAR_COLORS[i] }} />{m.displayName || m.name} · {m.currentScore}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="ins-card ins-method">
            <h3>How we measure</h3>
            <p className="ins-sub">The same tests on every model, on a fixed schedule</p>
            {[
              ['Drift check (canary)', 'Every hour'],
              ['Coding, nine measures', 'Every 4 hours'],
              ['Reasoning', 'Daily, 03:00 Berlin'],
              ['Tool use', 'Daily, 04:00 Berlin'],
              ['Provider health checks', 'Every 10 minutes'],
              ['Scoring', 'Nine measures, 95% CI'],
            ].map(([what, when]) => (
              <div key={what} className="ins-sched"><span>{what}</span><b>{when}</b></div>
            ))}
            <div className="ins-stats">
              <div><b>{modelScores.length || '—'}</b><span>models tracked</span></div>
              <div><b>{providerCount || '—'}</b><span>providers</span></div>
              <div title="Share of ranked models with fresh results"><b>{coverage}</b><span>test coverage</span></div>
              <div title="Share of ranked models on schedule, suite slots filled, and recent data volume"><b>{completeness}</b><span>data complete</span></div>
            </div>
            <p className="ins-sub ins-method-note">Drift detection: Page-Hinkley (CUSUM family). Scores carry 95% confidence intervals.</p>
            <div className="ins-links">
              <Link href="/router/test-keys">Test your own keys</Link>
              <Link href="/methodology">Read the methodology</Link>
            </div>
          </div>
        </div>
      </Group>

      <Link href={session ? '/router' : '/pricing'} className="ins-router">
        <span className="ins-router-text">
          <span className="ins-router-kicker">Smart Router</span>
          <span>Every request goes to the model measuring best right now. Bring your own provider keys: in our benchmark the cheapest model matching the top score cost {SAVINGS_PCT}% less.</span>
        </span>
        <span className="ins-router-price">
          <b>{annualMonthly(ROUTER_PLAN)}</b>
          <small>billed annually{annualSaving(ROUTER_PLAN) ? ` · saves ${annualSaving(ROUTER_PLAN)} a year` : ''}</small>
        </span>
        <span className="ins-router-btn">See Smart Router</span>
      </Link>

      <p className="ins-period">Scores shown for: {leaderboardPeriod === 'latest' ? 'the latest runs' : `the last ${({ '24h': '24 hours', '7d': '7 days', '1m': '30 days' } as Record<string, string>)[leaderboardPeriod] || leaderboardPeriod}`}</p>
    </div>
  );
}
