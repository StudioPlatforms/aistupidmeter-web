'use client';

/**
 * The project's report: what its Smart Router keys spent, who spent it, on which models, how
 * reliably, and who got the most out of each dollar — for a chosen period.
 */
import { useEffect, useMemo, useState } from 'react';
import SpendChart from '../SpendChart';
import { wsApi, money, pct, num, ms, ago, providerLabel } from '../ws';
import type { ProjectData, Report } from './types';

const PERIODS: Array<{ id: string; label: string }> = [
  { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' }, { id: '90d', label: '90 days' },
];

const CATEGORY: Record<string, string> = {
  coding: 'Coding', reasoning: 'Reasoning', creative: 'Writing', analysis: 'Analysis', general: 'General', unclassified: 'Not classified',
};
const SOURCE: Record<string, string> = {
  project: 'The project’s own provider keys', workspace: 'The workspace’s shared keys', personal: 'People’s own keys', unknown: 'Not recorded',
};

function hourWords(h: number): string {
  const local = new Date(Date.UTC(2026, 0, 1, h)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00 UTC (${local} your time)`;
}

export default function OverviewTab({ d }: { d: ProjectData }) {
  const [period, setPeriod] = useState('30d');
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setR(null);
    wsApi<Report>(`/projects/${d.project.id}/report?period=${period}`).then(x => { if (x.ok) setR(x.data); else setErr(x.error); });
  }, [d.project.id, period]);
  const names = useMemo(() => new Map((r?.members ?? []).map(m => [m.userId, m.name])), [r]);
  const nameOf = (id: number) => names.get(id) ?? d.members.find(m => m.userId === id)?.name ?? 'Former member';

  if (err) return <p className="ws-empty">{err}</p>;
  const t = r?.totals;
  const h = r?.highlights;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="ws-seg" role="group" aria-label="Period">
          {PERIODS.map(p => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
        <a className="ws-link" href={`/api/account/org/projects/${d.project.id}/requests?format=csv`}>
          {d.me.canSeeSpendDetail ? 'Download the request log (CSV)' : 'Download your requests (CSV)'}
        </a>
      </div>
      {!r || !t ? <p className="ws-empty">Loading the report…</p> : (
        <>
          <div className="ws-tiles">
            <div className="ws-tile">
              <div className="ws-tile-label">Spend</div>
              <div className="ws-tile-value">{money(t.spendUsd)}</div>
              <div className="ws-tile-sub">{t.spendChange === null ? r.window.label : <>
                <span className={t.spendChange > 0 ? 'ws-up' : 'ws-down'}>{t.spendChange > 0 ? '+' : ''}{pct(t.spendChange)}</span> on the period before</>}</div>
            </div>
            <div className="ws-tile">
              <div className="ws-tile-label">Requests</div>
              <div className="ws-tile-value">{num(t.requests)}</div>
              <div className="ws-tile-sub">{t.requests ? `${pct(t.successRate, 1)} answered` : 'none in the period'}</div>
            </div>
            <div className="ws-tile">
              <div className="ws-tile-label">Typical response time</div>
              <div className="ws-tile-value">{ms(t.p50LatencyMs)}</div>
              <div className="ws-tile-sub">{t.p95LatencyMs !== null ? `slowest 5% above ${ms(t.p95LatencyMs)}` : 'median of answered requests'}</div>
            </div>
            <div className="ws-tile">
              <div className="ws-tile-label">Cost per 1,000 tokens</div>
              <div className="ws-tile-value">{money(t.costPer1kTokens)}</div>
              <div className="ws-tile-sub">{t.costPerRequest !== null ? `${money(t.costPerRequest)} per answered request` : 'in and out, blended'}</div>
            </div>
            <div className="ws-tile">
              <div className="ws-tile-label">Saved by fallback</div>
              <div className="ws-tile-value">{num(t.rescued)}</div>
              <div className="ws-tile-sub">requests answered after the first model failed</div>
            </div>
          </div>

          <section className="ws-section">
            <h2>Spend by day</h2>
            <p className="ws-lead">At each provider&rsquo;s list price for the tokens actually used ({r.window.label}). Your provider&rsquo;s invoice is the final word: discounts and caching are not included.</p>
            <SpendChart days={r.daily} nameOf={r.memberDetail ? nameOf : undefined} />
          </section>

          {r.memberDetail && t.requests > 0 && (
            <section className="ws-section">
              <h2>Highlights</h2>
              <div className="ws-highlights">
                <div className="ws-highlight">
                  <div className="ws-highlight-label">Most efficient</div>
                  {h?.mostEfficient ? <>
                    <div className="ws-highlight-value">{nameOf(h.mostEfficient.userId)}</div>
                    <div className="ws-highlight-sub">{h.mostEfficient.costIndex.toFixed(2)}× the project average for the same tokens</div>
                  </> : <div className="ws-highlight-sub">Needs two people with {r.minSample}+ answered requests</div>}
                </div>
                <div className="ws-highlight">
                  <div className="ws-highlight-label">Top spender</div>
                  {h?.topSpender ? <>
                    <div className="ws-highlight-value">{nameOf(h.topSpender.userId)}</div>
                    <div className="ws-highlight-sub">{money(h.topSpender.spendUsd)}, {pct(h.topSpender.share)} of the total</div>
                  </> : <div className="ws-highlight-sub">—</div>}
                </div>
                <div className="ws-highlight">
                  <div className="ws-highlight-label">Most active</div>
                  {h?.mostActive ? <>
                    <div className="ws-highlight-value">{nameOf(h.mostActive.userId)}</div>
                    <div className="ws-highlight-sub">{num(h.mostActive.requests)} requests</div>
                  </> : <div className="ws-highlight-sub">—</div>}
                </div>
                <div className="ws-highlight">
                  <div className="ws-highlight-label">Most reliable</div>
                  {h?.mostReliable ? <>
                    <div className="ws-highlight-value">{nameOf(h.mostReliable.userId)}</div>
                    <div className="ws-highlight-sub">{pct(h.mostReliable.successRate, 1)} of {num(h.mostReliable.requests)} requests answered</div>
                  </> : <div className="ws-highlight-sub">Needs two people with {r.minSample}+ answered requests</div>}
                </div>
                <div className="ws-highlight">
                  <div className="ws-highlight-label">Busiest hour</div>
                  <div className="ws-highlight-value">{h?.busiestHourUtc !== null && h?.busiestHourUtc !== undefined ? hourWords(h.busiestHourUtc) : '—'}</div>
                </div>
                <div className="ws-highlight">
                  <div className="ws-highlight-label">Naming a model vs letting the router choose</div>
                  {h?.pinnedVsRouted ? <>
                    <div className="ws-highlight-value">{h.pinnedVsRouted.ratio}× the cost per 1,000 tokens</div>
                    <div className="ws-highlight-sub">{money(h.pinnedVsRouted.pinnedPer1k)} named vs {money(h.pinnedVsRouted.routedPer1k)} routed</div>
                  </> : <div className="ws-highlight-sub">Needs {r.minSample}+ answered requests of each kind</div>}
                </div>
              </div>
              {r.insights.length > 0 && <ul className="ws-insights">{r.insights.map(i => <li key={i}>{i}</li>)}</ul>}
            </section>
          )}
          {!r.memberDetail && r.insights.length > 0 && <ul className="ws-insights" style={{ marginBottom: 24 }}>{r.insights.map(i => <li key={i}>{i}</li>)}</ul>}

          <section className="ws-section">
            <h2>{r.memberDetail ? 'People' : 'Your use'}</h2>
            {!r.memberDetail && <p className="ws-lead">This project shows each person&rsquo;s spending to its managers only; here is yours.</p>}
            {r.members.length === 0 ? <p className="ws-empty">No requests in this period.</p> : (
              <div className="ws-table-wrap">
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>Person</th><th className="num">Requests</th><th className="num">Spend</th><th className="num ws-hide-sm">Share</th>
                      <th className="num" title="Spend divided by what the same input and output tokens would cost at the project's average prices. Below 1 means cheaper model choices.">Cost index</th>
                      <th className="num ws-hide-sm">Answered</th><th className="num ws-hide-sm">Named a model</th><th className="ws-hide-sm">Most used</th><th className="num ws-hide-sm">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.members.map(m => (
                      <tr key={m.userId}>
                        <td><div className="ws-name">{m.name}</div></td>
                        <td className="num">{num(m.requests)}</td>
                        <td className="num">{money(m.spendUsd)}</td>
                        <td className="num ws-hide-sm">{pct(m.share)}</td>
                        <td className="num" style={{ color: m.costIndex === null ? undefined : m.costIndex < 0.95 ? 'var(--good)' : m.costIndex > 1.05 ? 'var(--bad)' : undefined }}
                          title={m.costIndex === null ? `Shown from ${r.minSample} answered requests` : undefined}>
                          {m.costIndex === null ? '—' : `${m.costIndex.toFixed(2)}×`}
                        </td>
                        <td className="num ws-hide-sm">{pct(m.successRate, 1)}</td>
                        <td className="num ws-hide-sm">{pct(m.pinnedShare)}</td>
                        <td className="ws-hide-sm dim">{m.topModel ?? '—'}</td>
                        <td className="num ws-hide-sm dim">{ago(m.lastActive)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="ws-note" style={{ marginTop: 10 }}>
              The cost index compares each person&rsquo;s spend with what the same input and output tokens would have cost at this
              project&rsquo;s average price per token, so a long code review and a short question are judged fairly: 1.00× is the
              project average, 0.60× means 40% cheaper model choices for the same work. Shown from {r.minSample} answered requests.
            </p>
          </section>

          {r.models.length > 0 && (
            <section className="ws-section">
              <h2>Models</h2>
              <div className="ws-table-wrap">
                <table className="ws-table">
                  <thead><tr><th>Model</th><th className="num">Requests</th><th className="num">Spend</th><th className="num ws-hide-sm">Share</th><th className="num">Answered</th><th className="num ws-hide-sm">Response time</th><th className="num">Per 1K tokens</th></tr></thead>
                  <tbody>
                    {r.models.map(m => (
                      <tr key={`${m.provider}:${m.model}`}>
                        <td><div className="ws-name">{m.model}</div><div className="ws-meta">{providerLabel(m.provider)}{r.memberDetail ? ` · ${m.people} ${m.people === 1 ? 'person' : 'people'}` : ''}</div></td>
                        <td className="num">{num(m.requests)}</td>
                        <td className="num">{money(m.spendUsd)}</td>
                        <td className="num ws-hide-sm">{pct(m.share)}</td>
                        <td className="num">{pct(m.successRate, 1)}</td>
                        <td className="num ws-hide-sm">{ms(m.avgLatencyMs)}</td>
                        <td className="num">{money(m.costPer1kTokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {t.requests > 0 && (
            <div className="ws-grid-2" style={{ marginBottom: 24 }}>
              <section>
                <h2 className="ws-h2">What it is used for</h2>
                <p className="ws-note" style={{ margin: '0 0 8px' }}>From each request&rsquo;s text, classified on our side; the text itself is not stored unless prompt logging is on.</p>
                <table className="ws-table"><tbody>
                  {r.categories.map(c => <tr key={c.category}><td>{CATEGORY[c.category] ?? c.category}</td><td className="num">{num(c.requests)}</td><td className="num dim">{pct(c.share)}</td></tr>)}
                </tbody></table>
              </section>
              <section>
                <h2 className="ws-h2">Whose provider keys paid</h2>
                <p className="ws-note" style={{ margin: '0 0 8px' }}>The provider bills whoever&rsquo;s key was used.</p>
                <table className="ws-table"><tbody>
                  {r.keySources.map(k => <tr key={k.source}><td>{SOURCE[k.source] ?? k.source}</td><td className="num">{money(k.spendUsd)}</td><td className="num dim">{pct(k.share)}</td></tr>)}
                </tbody></table>
                {r.failures.length > 0 && (
                  <>
                    <h2 className="ws-h2" style={{ marginTop: 18 }}>Failed requests</h2>
                    <table className="ws-table"><tbody>
                      {r.failures.map(f => <tr key={f.failureClass}><td>{{ model: 'Model did not answer', client_request: 'Request rejected as malformed', client_auth: 'Provider key missing or rejected', client_quota: 'Provider account out of credit', transport: 'Network or timeout', unknown: 'Other' }[f.failureClass] ?? f.failureClass}</td><td className="num">{num(f.requests)}</td></tr>)}
                    </tbody></table>
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
