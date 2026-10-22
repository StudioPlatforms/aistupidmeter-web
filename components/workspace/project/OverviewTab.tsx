'use client';

/**
 * The project's report: what its Smart Router keys spent, who spent it, on which models, how
 * reliably, and who got the most out of each dollar — for a chosen period.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import SpendChart from '../SpendChart';
import { Pane, Stats, Stat, CountUp, Loader } from '@/components/studio';
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
const FAILURE: Record<string, string> = {
  model: 'Model did not answer', client_request: 'Request rejected as malformed', client_auth: 'Provider key missing or rejected',
  client_quota: 'Provider account out of credit', client_rate_limit: 'Provider key rate-limited', refusal: 'Model declined the request',
  transport: 'Network or timeout', unknown: 'Other',
};

function hourWords(h: number): string {
  const local = new Date(Date.UTC(2026, 0, 1, h)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00 UTC (${local} your time)`;
}

/** A number that counts up, or the formatter's dash when there is none. */
function count(n: number | null | undefined, format: (n: number) => string): ReactNode {
  return typeof n === 'number' && Number.isFinite(n) ? <CountUp value={n} format={format} /> : format(NaN);
}
const whole = (n: number) => num(Number.isFinite(n) ? Math.round(n) : null);

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

  if (err) return <p className="sw-quiet">{err}</p>;
  const t = r?.totals;
  const h = r?.highlights;

  return (
    <>
      <div className="sw-toolbar">
        <div className="st-seg is-scroll" role="group" aria-label="Period">
          {PERIODS.map(p => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
        <a className="st-more" href={`/api/account/org/projects/${d.project.id}/requests?format=csv`}>
          {d.me.canSeeSpendDetail ? 'Download the request log (CSV)' : 'Download your requests (CSV)'}
        </a>
      </div>
      {!r || !t ? <Loader label="Loading the report" /> : (
        <>
          <Stats columns={5}>
            <Stat
              value={count(t.spendUsd, money)}
              label="Spend"
              sub={t.spendChange === null ? r.window.label : <>
                <span className={t.spendChange > 0 ? 'sw-tone-bad' : 'sw-tone-good'}>{t.spendChange > 0 ? '+' : ''}{pct(t.spendChange)}</span> on the period before</>}
            />
            <Stat value={count(t.requests, whole)} label="Requests" sub={t.requests ? `${pct(t.successRate, 1)} answered` : 'none in the period'} />
            <Stat value={ms(t.p50LatencyMs)} label="Typical response time" sub={t.p95LatencyMs !== null ? `slowest 5% above ${ms(t.p95LatencyMs)}` : 'median of answered requests'} />
            <Stat value={count(t.costPer1kTokens, money)} label="Cost per 1,000 tokens" sub={t.costPerRequest !== null ? `${money(t.costPerRequest)} per answered request` : 'in and out, blended'} />
            <Stat value={count(t.rescued, whole)} label="Saved by fallback" sub="requests answered after the first model failed" />
          </Stats>

          <Pane title="Spend by day" sub={<>At each provider&rsquo;s list price for the tokens actually used ({r.window.label}). Your provider&rsquo;s invoice is the final word: discounts and caching are not included.</>}>
            <SpendChart days={r.daily} nameOf={r.memberDetail ? nameOf : undefined} />
          </Pane>

          {r.memberDetail && t.requests > 0 && (
            <Pane title="Highlights" delay={0.04}>
              <div className="sw-hls">
                <div className="sw-hl">
                  <div className="sw-hl-l">Most efficient</div>
                  {h?.mostEfficient ? <>
                    <div className="sw-hl-v">{nameOf(h.mostEfficient.userId)}</div>
                    <div className="sw-hl-s">{h.mostEfficient.costIndex.toFixed(2)}× the project average for the same tokens</div>
                  </> : <div className="sw-hl-s">Needs two people with {r.minSample}+ answered requests</div>}
                </div>
                <div className="sw-hl">
                  <div className="sw-hl-l">Top spender</div>
                  {h?.topSpender ? <>
                    <div className="sw-hl-v">{nameOf(h.topSpender.userId)}</div>
                    <div className="sw-hl-s">{money(h.topSpender.spendUsd)}, {pct(h.topSpender.share)} of the total</div>
                  </> : <div className="sw-hl-s">—</div>}
                </div>
                <div className="sw-hl">
                  <div className="sw-hl-l">Most active</div>
                  {h?.mostActive ? <>
                    <div className="sw-hl-v">{nameOf(h.mostActive.userId)}</div>
                    <div className="sw-hl-s">{num(h.mostActive.requests)} requests</div>
                  </> : <div className="sw-hl-s">—</div>}
                </div>
                <div className="sw-hl">
                  <div className="sw-hl-l">Most reliable</div>
                  {h?.mostReliable ? <>
                    <div className="sw-hl-v">{nameOf(h.mostReliable.userId)}</div>
                    <div className="sw-hl-s">{pct(h.mostReliable.successRate, 1)} of {num(h.mostReliable.requests)} requests answered</div>
                  </> : <div className="sw-hl-s">Needs two people with {r.minSample}+ answered requests</div>}
                </div>
                <div className="sw-hl">
                  <div className="sw-hl-l">Busiest hour</div>
                  <div className="sw-hl-v">{h?.busiestHourUtc !== null && h?.busiestHourUtc !== undefined ? hourWords(h.busiestHourUtc) : '—'}</div>
                </div>
                <div className="sw-hl">
                  <div className="sw-hl-l">Naming a model vs letting the router choose</div>
                  {h?.pinnedVsRouted ? <>
                    <div className="sw-hl-v">{h.pinnedVsRouted.ratio}× the cost per 1,000 tokens</div>
                    <div className="sw-hl-s">{money(h.pinnedVsRouted.pinnedPer1k)} named vs {money(h.pinnedVsRouted.routedPer1k)} routed</div>
                  </> : <div className="sw-hl-s">Needs {r.minSample}+ answered requests of each kind</div>}
                </div>
              </div>
              {r.insights.length > 0 && <ul className="sw-insights">{r.insights.map(i => <li key={i}>{i}</li>)}</ul>}
            </Pane>
          )}
          {!r.memberDetail && r.insights.length > 0 && (
            <Pane title="What stands out" delay={0.04}>
              <ul className="sw-insights is-bare">{r.insights.map(i => <li key={i}>{i}</li>)}</ul>
            </Pane>
          )}

          <Pane
            title={r.memberDetail ? 'People' : 'Your use'}
            sub={!r.memberDetail ? <>This project shows each person&rsquo;s spending to its managers only; here is yours.</> : undefined}
            ruled
            flush
            delay={0.06}
            foot={<>
              The cost index compares each person&rsquo;s spend with what the same input and output tokens would have cost at this
              project&rsquo;s average price per token, so a long code review and a short question are judged fairly: 1.00× is the
              project average, 0.60× means 40% cheaper model choices for the same work. Shown from {r.minSample} answered requests.
            </>}
          >
            {r.members.length === 0 ? <p className="sw-quiet sw-pad">No requests in this period.</p> : (
              <div className="st-table-wrap">
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>Person</th><th className="is-num">Requests</th><th className="is-num">Spend</th><th className="is-num sw-hide-sm">Share</th>
                      <th className="is-num" title="Spend divided by what the same input and output tokens would cost at the project's average prices. Below 1 means cheaper model choices.">Cost index</th>
                      <th className="is-num sw-hide-sm">Answered</th><th className="is-num sw-hide-sm">Named a model</th><th className="sw-hide-sm">Most used</th><th className="is-num sw-hide-sm">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.members.map(m => (
                      <tr key={m.userId}>
                        <td><span className="sw-t">{m.name}</span></td>
                        <td className="is-num">{num(m.requests)}</td>
                        <td className="is-num">{money(m.spendUsd)}</td>
                        <td className="is-num sw-hide-sm">{pct(m.share)}</td>
                        <td className={`is-num${m.costIndex === null ? '' : m.costIndex < 0.95 ? ' sw-tone-good' : m.costIndex > 1.05 ? ' sw-tone-bad' : ''}`}
                          title={m.costIndex === null ? `Shown from ${r.minSample} answered requests` : undefined}>
                          {m.costIndex === null ? '—' : `${m.costIndex.toFixed(2)}×`}
                        </td>
                        <td className="is-num sw-hide-sm">{pct(m.successRate, 1)}</td>
                        <td className="is-num sw-hide-sm">{pct(m.pinnedShare)}</td>
                        <td className="sw-hide-sm is-dim">{m.topModel ?? '—'}</td>
                        <td className="is-num sw-hide-sm is-dim">{ago(m.lastActive)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Pane>

          {r.models.length > 0 && (
            <Pane title="Models" ruled flush delay={0.06}>
              <div className="st-table-wrap">
                <table className="st-table">
                  <thead><tr><th>Model</th><th className="is-num">Requests</th><th className="is-num">Spend</th><th className="is-num sw-hide-sm">Share</th><th className="is-num">Answered</th><th className="is-num sw-hide-sm">Response time</th><th className="is-num">Per 1K tokens</th></tr></thead>
                  <tbody>
                    {r.models.map(m => (
                      <tr key={`${m.provider}:${m.model}`}>
                        <td><div className="sw-t">{m.model}</div><div className="sw-s">{providerLabel(m.provider)}{r.memberDetail ? ` · ${m.people} ${m.people === 1 ? 'person' : 'people'}` : ''}</div></td>
                        <td className="is-num">{num(m.requests)}</td>
                        <td className="is-num">{money(m.spendUsd)}</td>
                        <td className="is-num sw-hide-sm">{pct(m.share)}</td>
                        <td className="is-num">{pct(m.successRate, 1)}</td>
                        <td className="is-num sw-hide-sm">{ms(m.avgLatencyMs)}</td>
                        <td className="is-num">{money(m.costPer1kTokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Pane>
          )}

          {t.requests > 0 && (
            <div className="st-grid">
              <Pane title="What it is used for" sub={<>From each request&rsquo;s text, classified on our side; the text itself is not stored unless prompt logging is on.</>} ruled flush delay={0.04}>
                <table className="st-table"><tbody>
                  {r.categories.map(c => <tr key={c.category}><td>{CATEGORY[c.category] ?? c.category}</td><td className="is-num">{num(c.requests)}</td><td className="is-num is-dim">{pct(c.share)}</td></tr>)}
                </tbody></table>
              </Pane>
              <Pane title="Whose provider keys paid" sub={<>The provider bills whoever&rsquo;s key was used.</>} ruled flush delay={0.08}>
                <table className="st-table"><tbody>
                  {r.keySources.map(k => <tr key={k.source}><td>{SOURCE[k.source] ?? k.source}</td><td className="is-num">{money(k.spendUsd)}</td><td className="is-num is-dim">{pct(k.share)}</td></tr>)}
                </tbody></table>
                {r.failures.length > 0 && (
                  <>
                    <p className="st-label sw-sublabel">Failed requests</p>
                    <table className="st-table"><tbody>
                      {r.failures.map(f => <tr key={f.failureClass}><td>{FAILURE[f.failureClass] ?? f.failureClass}</td><td className="is-num">{num(f.requests)}</td></tr>)}
                    </tbody></table>
                  </>
                )}
              </Pane>
            </div>
          )}
        </>
      )}
    </>
  );
}
