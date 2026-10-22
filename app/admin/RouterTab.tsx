'use client';

import { useState } from 'react';
import { Pane, Stats, Stat, Meter, ProviderMark, Tag, Note } from '@/components/studio';
import { isUnlimited } from '@/lib/entitlements';
import type { AdminOverview, RouterUser } from '@/lib/admin-types';
import { AccountCell, EmptyRow, StatusPill } from './bits';
import { ChartPane, DayColumns } from './AdminCharts';
import { ROUTED } from './OverviewTab';
import { ago, compact, fullDate, num, pct, planLabel, usd, PROVIDER_NAME } from './format';

const CAUSE: Record<string, string> = {
  no_provider_key: 'No provider key saved',
  client_auth: 'Provider rejected the key',
  client_request: 'Provider rejected the request',
  client_quota: 'Provider account out of credit',
  client_rate_limit: 'Provider rate-limited the key',
  refusal: 'Model declined the request',
  model: 'Model did not answer',
  unknown: 'Unknown provider error',
  unclassified: 'Unclassified',
};

function Allowance({ u }: { u: RouterUser }) {
  const unlimited = isUnlimited(u.limit);
  return (
    <div className="ad-allow">
      <span className="st-num"><b>{num(u.used)}</b><span className="st-faint">{unlimited ? ' · no limit' : ` / ${compact(u.limit)}`}</span></span>
      {!unlimited && <Meter used={u.used} limit={u.limit} />}
    </div>
  );
}

function Providers({ u }: { u: RouterUser }) {
  if (u.providers.length === 0) {
    return <Tag tone="warn" title={u.noProviderKey ? `${num(u.noProviderKey)} requests refused for want of a provider key` : 'No provider key saved'}>None</Tag>;
  }
  return (
    <span className="ad-provs" title={u.providers.map(p => PROVIDER_NAME[p] ?? p).join(', ') + (u.providerKeysFailing ? ` · ${u.providerKeysFailing} failing validation` : '')}>
      {u.providers.map(p => <ProviderMark key={p} provider={p} />)}
      {u.providerKeysFailing > 0 && <Tag tone="bad">{u.providerKeysFailing} failing</Tag>}
    </span>
  );
}

export default function RouterTab({ data }: { data: AdminOverview }) {
  const r = data.router;
  const t = r.totals;
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [internal, setInternal] = useState(false);
  const pool = r.users.filter(u => internal || !u.internal);
  const active = pool.filter(u => u.used > 0 || u.failedThisMonth > 0);
  const rows = scope === 'month' ? active : pool;
  const modeTotal = r.modes.reduce((n, m) => n + m.requests, 0);
  const modelTotal = t.last30Success;
  const first = r.funnel[0]?.count ?? 0;
  const d = data.dataApi;

  return (
    <>
      {r.error && <Note tone="bad" title="Router usage could not be read">{r.error}. Accounts and billing are unaffected.</Note>}

      <Stats columns={6}>
        <Stat value={num(t.monthSuccess)} label="Requests this month" sub={`${num(t.monthFailed)} failed, not counted`} tone="accent" />
        <Stat value={num(t.activeMonth)} label="Customers routing this month" sub={`${num(t.active7)} in the last 7 days`} />
        <Stat value={pct(t.last30Success, t.last30)} label="Success, last 30 days" sub={`${num(t.last30)} requests`} />
        <Stat value={t.latency30 === null ? '—' : `${(t.latency30 / 1000).toFixed(1)}`} unit={t.latency30 === null ? undefined : 's'} label="Average latency" sub="Successful requests, 30 days" />
        <Stat value={compact(t.tokens30)} label="Tokens, last 30 days" sub="Input and output" />
        <Stat value={usd(t.cost30)} label="Provider cost, 30 days" sub="Estimated; customers pay their providers" />
      </Stats>

      <div className="st-split">
        <ChartPane
          title="Routed requests"
          sub="Per day, last 30 days, customers only"
          dates={r.daily.map(x => x.date)}
          series={ROUTED}
          values={[r.daily.map(x => x.ok), r.daily.map(x => x.failed)]}
        >
          <DayColumns dates={r.daily.map(x => x.date)} series={ROUTED} values={[r.daily.map(x => x.ok), r.daily.map(x => x.failed)]} unit="requests" />
        </ChartPane>

        <Pane title="From sign-up to routing" sub="Customer accounts at each step, all time unless dated." ruled flush delay={0.06}>
          <ol className="ad-funnel">
            {r.funnel.map((f, i) => (
              <li key={f.step}>
                <span className="ad-funnel-s">{f.step}</span>
                <b className="st-num">{num(f.count)}</b>
                <span className="ad-funnel-p st-num" title="Share of all customer accounts">{i === 0 ? '' : pct(f.count, first)}</span>
              </li>
            ))}
          </ol>
        </Pane>
      </div>

      <Pane
        title="Who is using the Smart Router"
        sub="Successful requests this calendar month against each plan's allowance (a workspace plan included). Failed requests are not counted. Prepaid credits are added to what is left."
        actions={
          <div className="ad-actions">
            <div className="st-seg" role="group" aria-label="Which accounts">
              <button type="button" aria-pressed={scope === 'month'} onClick={() => setScope('month')}>This month · {active.length}</button>
              <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Every router account · {pool.length}</button>
            </div>
            <button type="button" className="st-chip" aria-pressed={internal} onClick={() => setInternal(v => !v)}>Internal accounts</button>
          </div>
        }
        ruled flush
      >
        <div className="st-table-wrap ad-scroll is-tall">
          <table className="st-table ad-router">
            <thead>
              <tr>
                <th>Account</th><th>This month</th><th className="is-num">Left</th><th className="is-num">30 days</th>
                <th className="is-num">Last</th><th className="is-num ad-hide-md">Keys</th><th>Providers</th>
                <th className="ad-hide-md">Top model</th><th className="ad-hide-md">Mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={9}>{scope === 'month' ? 'No customer has routed a request this month.' : 'No router accounts yet.'}</EmptyRow>}
              {rows.map(u => (
                <tr key={u.userId}>
                  <td><AccountCell email={u.email} internal={u.internal} sub={<>{planLabel(u.plan)}{u.plan !== 'free' && <StatusPill status={u.status} />}</>} /></td>
                  <td><Allowance u={u} /></td>
                  <td className="is-num">{u.remaining === null ? 'No limit' : num(u.remaining)}{u.credits > 0 && <span className="st-faint" title="Prepaid credits included"> +{num(u.credits)} cr</span>}</td>
                  <td className="is-num" title={`${num(u.last30Success)} of ${num(u.last30)} succeeded`}>{num(u.last30)}</td>
                  <td className="is-num" title={fullDate(u.lastAt)}>{ago(u.lastAt)}</td>
                  <td className="is-num ad-hide-md" title={u.keyLastUsedAt ? `Last used ${fullDate(u.keyLastUsedAt)}` : 'Never used'}>{u.keysActive}<span className="st-faint">/{u.keysTotal}</span></td>
                  <td><Providers u={u} /></td>
                  <td className="ad-hide-md">
                    {u.topModel ? <span className="ad-model" title={`${num(u.topModel.requests)} successful requests in 30 days`}><ProviderMark provider={u.topModel.provider} />{u.topModel.model}</span> : <span className="st-faint">—</span>}
                  </td>
                  <td className="ad-hide-md">{u.topMode ? <code className="ad-code">{u.topMode}</code> : <span className="st-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>

      <div className="st-grid">
        <Pane title="Routing modes" sub="What callers asked for, last 30 days: a mode, or a pinned model." ruled flush>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Asked for</th><th className="is-num">Requests</th><th className="is-num">Share</th></tr></thead>
              <tbody>
                {r.modes.length === 0 && <EmptyRow cols={3}>No requests in the last 30 days.</EmptyRow>}
                {r.modes.slice(0, 12).map(m => (
                  <tr key={m.mode}><td><code className="ad-code">{m.mode}</code></td><td className="is-num">{num(m.requests)}</td><td className="is-num is-dim">{pct(m.requests, modeTotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
        <Pane title="Models chosen" sub="Where successful requests went, last 30 days." ruled flush delay={0.06}>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Model</th><th className="is-num">Requests</th><th className="is-num">Share</th></tr></thead>
              <tbody>
                {r.models.length === 0 && <EmptyRow cols={3}>No successful requests in the last 30 days.</EmptyRow>}
                {r.models.map(m => (
                  <tr key={`${m.provider}/${m.model}`}>
                    <td><span className="ad-model"><ProviderMark provider={m.provider} />{m.model}</span></td>
                    <td className="is-num">{num(m.requests)}</td>
                    <td className="is-num is-dim">{pct(m.requests, modelTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
      </div>

      <div className="st-grid">
        <Pane title="Failed requests" sub={`Last 30 days, by cause. Fallbacks used: ${num(t.fallback30)}.`} ruled flush>
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Cause</th><th className="is-num">Requests</th></tr></thead>
              <tbody>
                {r.failures.length === 0 && <EmptyRow cols={2}>No failed requests in the last 30 days.</EmptyRow>}
                {r.failures.map(f => <tr key={f.cause}><td>{CAUSE[f.cause] ?? f.cause}</td><td className="is-num">{num(f.requests)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Pane>

        <Pane
          title="Data API"
          sub={`${num(d.activeKeys)} active keys on ${num(d.accounts)} accounts · ${num(d.today)} calls today · ${num(d.totalRequests)} all time`}
          ruled flush delay={0.06}
        >
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Account</th><th className="is-num">Today</th><th className="is-num">All time</th><th className="is-num">Last</th></tr></thead>
              <tbody>
                {d.top.length === 0 && <EmptyRow cols={4}>No Data API keys yet.</EmptyRow>}
                {d.top.map(x => (
                  <tr key={x.userId}>
                    <td><AccountCell email={x.email} internal={x.internal} sub={`${planLabel(x.plan)} · ${x.activeKeys} active ${x.activeKeys === 1 ? 'key' : 'keys'}`} /></td>
                    <td className="is-num">{num(x.today)}</td>
                    <td className="is-num">{num(x.totalRequests)}</td>
                    <td className="is-num" title={fullDate(x.lastUsedAt)}>{ago(x.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
      </div>
    </>
  );
}
