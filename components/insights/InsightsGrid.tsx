'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import ProviderLogo from '../ProviderLogo';
import { buildActivityItems, buildRecoItems, providerTrustList, type RecoItem } from '../v4/IntelligencePanel';
import { RadarChart, axesForSort, axisWeightLabel, getAveragedAxes, scoreBg, scoreColor } from '../v4/AnalyticsPanel';
import { providerStatus, useProviderHealth } from '../v4/ProviderStrip';
import { getModelPricing } from '../../lib/model-pricing';
import { slugifyModelName } from '../../lib/model-slug';
import { routerPrice } from '@/lib/pricing-display';
import { SAVINGS_PCT } from '@/lib/savings-estimate';
import { PLANS } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import { Locked } from '../studio';
import '../../styles/studio-boards.css';

/**
 * Everything under the full-width leaderboards, on a wide screen, as rows of panes grouped
 * by what a visitor is trying to do: act on a problem, get a quick answer, compare, check the
 * providers and the method, and (once) the Smart Router.
 *
 * WHY ROWS, NOT THE OLD THREE COLUMNS
 * The side panels were built as rails beside a tall board in the middle column. With the
 * boards moved above them, the middle held ~400px against a 1,341px-tall right rail, leaving
 * ~900px of empty page at every width (measured 2026-09-27). Panes in a row share a height,
 * so rows cannot leave that hole, and the data-dense panes (heatmap, prices) get real width.
 *
 * The content and its rules are the side panels' own, shared rather than copied: the builders
 * live in IntelligencePanel / AnalyticsPanel / ProviderStrip, which still render the Drift
 * Monitor view and the phone layout. Styles: styles/studio-boards.css (sl-*).
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
/** The plan that unlocks Quick answers, the heatmap, price-performance and the radar (lib/capabilities). */
const INSIGHTS_PLAN = PLANS[REQUIRED_PLAN['board-insights']].label;

const hrefFor = (name?: string | null, id?: string | number) =>
  `/models/${(name && slugifyModelName(name)) || id || ''}`;
const money = (n: number) => `$${Number(n.toFixed(2))}`;

function Logo({ provider, size = 13, box = 'sm' }: { provider?: string | null; size?: number; box?: 'xs' | 'sm' | 'md' }) {
  return (
    <span className={`sl-logo is-${box}`} aria-hidden="true">
      <ProviderLogo provider={provider || ''} size={size} />
    </span>
  );
}

function Group({ title, note, right, children }: { title: string; note?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="sl-ins-group st-up" aria-label={title}>
      <div className="sl-sec-head">
        <div><h2 className="sl-sec-title">{title}</h2>{note && <p className="sl-sec-note">{note}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function InsightsGrid({
  recommendations, degradations, driftIncidents, providerReliability, modelScores, modelHistoryData,
  transparencyMetrics, leaderboardSortBy, leaderboardPeriod, onSortChange, locked = false, onUnlock,
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
  /** A free account (lib/capabilities 'board-insights'): the analysis panes become Pro cards. */
  locked?: boolean;
  onUnlock?: () => void;
}) {
  const unlock = onUnlock ?? (() => {});
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
    <div className="sl-ins">
      {(degr.length > 0 || problems.length > 0) && (
        <Group title="Needs attention" note="Measured problems right now">
          <div className="sl-alerts">
            {degr.map((d: any, i: number) => (
              <Link key={`d${i}`} href={hrefFor(d.modelName)} className={`sl-alert${d.severity === 'critical' ? ' is-bad' : ''}`}>
                <span className={`st-tag ${d.severity === 'critical' ? 'is-bad' : 'is-warn'}`}>{d.severity === 'critical' ? 'Critical' : 'Warning'}</span>
                <span className="sl-alert-name">{d.modelName}</span>
                <span className="sl-alert-text">{d.message || `Score dropped ${d.dropPercentage || 0}%.${d.currentScore ? ` Now at ${d.currentScore}.` : ''}`}</span>
              </Link>
            ))}
            {problems.map((p: RecoItem, i: number) => (
              <Link key={`p${i}`} href={hrefFor(p.rawName)} className="sl-alert is-bad">
                <span className="st-tag is-bad">{p.kind === 'avoid' ? 'Avoid now' : 'Unreliable'}</span>
                <span className="sl-alert-name">{p.name}</span>
                <span className="sl-alert-text">{p.detail}</span>
              </Link>
            ))}
          </div>
        </Group>
      )}

      {locked ? (
        <Group title="Quick answers" note="Picked from the latest runs">
          <Locked plan={INSIGHTS_PLAN} title="Which model should you use right now?" onOpen={unlock}>
            Quick answers name the best model for code, the most reliable, the fastest and the best
            value, picked from the latest runs.
          </Locked>
        </Group>
      ) : answers.length > 0 && (
        <Group title="Quick answers" note="Picked from the latest runs">
          <div className="sl-answers">
            {answers.map((a, i) => (
              <Link key={i} href={hrefFor(a.rawName)} className="sl-answer">
                <span className="st-label">{a.type}</span>
                <span className="sl-answer-top">
                  <span className="sl-answer-id">
                    <Logo provider={a.providerDot} size={15} box="md" />
                    <span className="sl-answer-name">{a.name}</span>
                  </span>
                  <span className="sl-answer-v">
                    <b>{a.score > 0 ? Math.round(a.score) : '—'}</b>
                    <small>{a.status}</small>
                  </span>
                </span>
                <span className="sl-answer-detail">{a.detail}</span>
              </Link>
            ))}
          </div>
        </Group>
      )}

      <Group
        title="Compare models"
        note={locked ? 'Every model on every measure, and what each one costs' : 'The tabs switch both panes to that board'}
        right={locked ? undefined : (
          <div className="st-seg is-scroll sl-seg-tabs" role="tablist" aria-label="Board">
            {SORTS.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} onClick={() => onSortChange(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      >
        {locked ? (
          <Locked plan={INSIGHTS_PLAN} title="Compare every model on every measure" onOpen={unlock}>
            The benchmark heatmap scores every model on each measure of the board you pick, and
            price-performance shows how much score each one gives you per dollar.
          </Locked>
        ) : (
        <div className="sl-compare">
          <div className="sl-pane">
            <h3 className="sl-pane-t">{TITLES[sort].heat}</h3>
            <p className="sl-pane-sub">{axKeys.length} measures, 0–100 · {ranked.length} models · hover a heading for what it weighs</p>
            {!historyReady ? <div className="sl-empty-line">Loading the measurements…</div> : (
              <div className="sl-heat-grid" style={{ gridTemplateColumns: `minmax(170px, 1.6fr) repeat(${axKeys.length}, minmax(0, 1fr))` }}>
                <span className="sl-heat-hdr is-model">Model</span>
                {axisLabels.map((l, i) => {
                  const hot = config.highlightIndices.includes(config.axisIndices[i]);
                  return (
                    <span key={l} className={`sl-heat-hdr${hot ? ' is-hot' : ''}`}
                          title={`${axisWeightLabel(axisFullNames[i])}${hot ? ' · highlighted for this board' : ''}`}>{l}</span>
                  );
                })}
                {ranked.map((m) => {
                  const axes = getAveragedAxes(modelHistoryData.get(m.id) || m.history || []);
                  return (
                    <div key={m.id} style={{ display: 'contents' }}>
                      <Link href={hrefFor(m.name, m.id)} className="sl-heat-model"><Logo provider={m.provider} size={11} box="xs" /><span>{m.displayName || m.name}</span></Link>
                      {axKeys.map((k, i) => {
                        const raw = axes[k];
                        const v = typeof raw === 'number' ? Math.round(raw * 100) : null;
                        return v === null
                          ? <span key={k} className="sl-heat-cell is-none">—</span>
                          : <span key={k} className="sl-heat-cell" style={{ background: scoreBg(v), color: scoreColor(v) }}
                                  title={`${axisWeightLabel(axisFullNames[i])} · ${m.name}: ${v}`}>{v}</span>;
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sl-pane sl-price">
            <h3 className="sl-pane-t">Price-performance</h3>
            <p className="sl-pane-sub">Score per dollar of blended price (40% input, 60% output, per 1M tokens)</p>
            <div className="sl-price-grid">
              <span className="sl-price-hdr">Model</span>
              <span className="sl-price-hdr sl-r">$ in / out</span>
              <span className="sl-price-hdr sl-c">Score</span>
              <span className="sl-price-hdr sl-r">Value</span>
              {priceRows.map(({ m, pricing, value }) => (
                <div key={m.id} style={{ display: 'contents' }}>
                  <Link href={hrefFor(m.name, m.id)} className="sl-price-model"><Logo provider={m.provider} size={11} box="xs" /><span>{m.displayName || m.name}</span></Link>
                  <span className="sl-price-cell sl-r sl-dim">{money(pricing.input)} / {money(pricing.output)}</span>
                  <span className="sl-price-cell sl-c is-num" style={{ color: scoreColor(m.currentScore as number) }}>{m.currentScore}</span>
                  <span className="sl-price-cell sl-r is-num">{value.toFixed(1)}</span>
                </div>
              ))}
            </div>
            {poor.length > 0 && (
              <div className="st-note is-warn sl-poor">
                <div>
                  <b className="st-note-t">Poor value right now</b>
                  {poor.map((p, i) => (
                    <p key={i}><Link href={hrefFor(p.rawName)}>{p.name}</Link> · {p.detail}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </Group>

      <Group title="Providers and method" note="Continuous, independent measurement of whether a model gets worse behind the same API name">
        <div className="sl-three">
          <div className="sl-pane">
            <h3 className="sl-pane-t">Provider health</h3>
            <p className="sl-pane-sub">Live status from a check every 10 minutes, and a trust score from incident history</p>
            <div className="sl-prov">
              {providers.map((p: any) => {
                const key = String(p.provider || p.name || '').toLowerCase();
                const trust = Math.round(p.score || p.trustScore || 0);
                const st = providerStatus(health?.[key]);
                return (
                  <div key={key} className="sl-prov-row">
                    <span className="sl-prov-name"><Logo provider={key} size={13} box="sm" />{PROVIDER_NAME[key] || key}</span>
                    <span className={`sl-status is-${st ? st.tone : 'none'}`} title={st?.title}>{st ? st.label : '—'}</span>
                    <span className="sl-trust" aria-hidden="true"><i className={trust >= 75 ? '' : 'is-warn'} style={{ width: `${Math.max(0, Math.min(100, trust))}%` }} /></span>
                    <span className="sl-prov-score" title="Trust score from incident history">{trust}</span>
                  </div>
                );
              })}
            </div>
            <p className="st-label sl-activity-head">Latest activity</p>
            {activity.length === 0 ? <p className="sl-pane-sub">Waiting for activity…</p> : (
              <ul className="sl-activity">
                {activity.map((a, i) => (
                  <li key={i} className={`is-${a.tone}`}>
                    <span className="sl-dot" aria-hidden="true" />
                    <span className="sl-activity-text"><b>{a.model}</b> {a.text}{a.value !== undefined ? <>: <b>{a.value}</b></> : null}</span>
                    <span className="sl-activity-time">{a.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="sl-pane">
            <h3 className="sl-pane-t">{TITLES[sort].radar}</h3>
            <p className="sl-pane-sub">{config.subtitle}</p>
            {locked ? (
              <div className="sl-lock is-compact">
                <Locked plan={INSIGHTS_PLAN} title="See what separates the best from the rest" onOpen={unlock}>
                  The radar lays the top three and bottom three models over every measure.
                </Locked>
              </div>
            ) : !historyReady ? <div className="sl-empty-line">Loading the measurements…</div> : (
              <>
                <div className="sl-radar">
                  <RadarChart models={radarModels} colors={RADAR_COLORS} modelHistoryData={modelHistoryData}
                              axKeys={axKeys} axisLabels={axisLabels} highlightIndices={config.highlightIndices} />
                </div>
                <div className="sl-radar-keys">
                  {radarModels.map((m, i) => (
                    <span key={m.id || i}><i style={{ background: RADAR_COLORS[i] }} />{m.displayName || m.name} · {m.currentScore}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="sl-pane">
            <h3 className="sl-pane-t">How we measure</h3>
            <p className="sl-pane-sub">The same tests on every model, on a fixed schedule</p>
            <dl className="sl-sched">
              {[
                ['Drift check (canary)', 'Every hour'],
                ['Coding, nine measures', 'Every 4 hours'],
                ['Reasoning', 'Daily, 03:00 Berlin'],
                ['Tool use', 'Daily, 04:00 Berlin'],
                ['Provider health checks', 'Every 10 minutes'],
                ['Scoring', 'Nine measures, 95% CI'],
              ].map(([what, when]) => (
                <div key={what}><dt>{what}</dt><dd>{when}</dd></div>
              ))}
            </dl>
            <div className="sl-figs">
              <div><b>{modelScores.length || '—'}</b><span>models tracked</span></div>
              <div><b>{providerCount || '—'}</b><span>providers</span></div>
              <div title="Share of ranked models with fresh results"><b>{coverage}</b><span>test coverage</span></div>
              <div title="Share of ranked models on schedule, suite slots filled, and recent data volume"><b>{completeness}</b><span>data complete</span></div>
            </div>
            <p className="sl-method-note">Drift detection: Page-Hinkley (CUSUM family). Scores carry 95% confidence intervals.</p>
            <div className="sl-links">
              <Link href="/router/test-keys" className="st-more">Test your own keys</Link>
              <Link href="/methodology" className="st-more">Read the methodology</Link>
            </div>
          </div>
        </div>
      </Group>

      <Link href={session ? '/router' : '/pricing'} className="sl-router st-up">
        <span className="sl-router-streaks" aria-hidden="true"><i /><i /><i /></span>
        <span className="sl-router-text">
          <span className="st-kicker">Smart Router</span>
          <span>Every request goes to the model measuring best right now. Bring your own provider keys: in our benchmark the cheapest model matching the top score cost {SAVINGS_PCT}% less.</span>
        </span>
        <span className="sl-router-price">
          <b>{routerPrice().price}</b>
          <small>{routerPrice().plan}<br />{routerPrice().free}</small>
        </span>
        <span className="st-btn is-primary">See Smart Router <span className="st-ar" aria-hidden="true">→</span></span>
      </Link>

      <p className="sl-period">Scores shown for: {leaderboardPeriod === 'latest' ? 'the latest runs' : `the last ${({ '24h': '24 hours', '7d': '7 days', '1m': '30 days' } as Record<string, string>)[leaderboardPeriod] || leaderboardPeriod}`}</p>
    </div>
  );
}
