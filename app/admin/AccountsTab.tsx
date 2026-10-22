'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pane, Stats, Stat, Tag } from '@/components/studio';
import { isUnlimited } from '@/lib/entitlements';
import type { AdminAccount, AdminOverview } from '@/lib/admin-types';
import { AccountCell, EmptyRow, ExternalLink, StatusPill } from './bits';
import { ChartPane, DayColumns } from './AdminCharts';
import { ago, compact, day, fullDate, num, pct, planLabel, stripeUrl, METHOD_LABEL } from './format';

function AccountsTable({ rows, data, empty }: { rows: AdminAccount[]; data: AdminOverview; empty: string }) {
  const router = useMemo(() => new Map(data.router.users.map(u => [u.userId, u])), [data]);
  return (
    <div className="st-table-wrap">
      <table className="st-table">
        <thead>
          <tr>
            <th>Account</th><th className="is-num">Joined</th><th className="ad-hide-sm">Sign-in</th><th>Plan</th>
            <th className="is-num ad-hide-md">Router, month</th><th className="is-num ad-hide-md">Watching</th><th><span className="st-sr">Stripe</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={7}>{empty}</EmptyRow>}
          {rows.map(a => {
            const u = router.get(a.id);
            const statusNote = a.status === 'trial' && a.trialEndsAt ? `Trial ends ${day(a.trialEndsAt)}`
              : a.status === 'cancelled' && a.endsAt ? `Access ends ${day(a.endsAt)}`
              : a.status === 'complimentary' && a.endsAt ? `Until ${day(a.endsAt)}`
              : a.lastPaymentAt ? `Last paid ${day(a.lastPaymentAt)}` : '';
            return (
              <tr key={a.id}>
                <td>
                  <AccountCell
                    email={a.email}
                    internal={a.internal}
                    sub={<>
                      #{a.id}{a.name ? ` · ${a.name}` : ''}
                      {a.pendingVerification && <Tag tone="warn">email not confirmed</Tag>}
                    </>}
                  />
                </td>
                <td className="is-num" title={fullDate(a.createdAt)}>{ago(a.createdAt)}</td>
                <td className="ad-hide-sm is-dim">{METHOD_LABEL[a.method] ?? a.method}</td>
                <td title={statusNote || undefined}>
                  <div className="ad-plan">
                    <span>{planLabel(a.plan)}</span>
                    {a.plan !== 'free' && <StatusPill status={a.status} />}
                  </div>
                </td>
                <td className="is-num ad-hide-md">
                  {u && (u.used > 0 || u.keysTotal > 0)
                    ? <>{num(u.used)}<span className="st-faint">{isUnlimited(u.limit) ? '' : ` / ${compact(u.limit)}`}</span></>
                    : <span className="st-faint">—</span>}
                </td>
                <td className="is-num ad-hide-md">{a.watchedModels || <span className="st-faint">—</span>}</td>
                <td>{a.stripeCustomerId ? <ExternalLink href={stripeUrl('customers', a.stripeCustomerId)}>Stripe</ExternalLink> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AccountsTab({ data }: { data: AdminOverview }) {
  const a = data.accounts;
  const e = data.engagement;
  const [q, setQ] = useState('');
  const [found, setFound] = useState<AdminAccount[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setFound(null); setSearchError(''); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/admin/accounts?q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: ctl.signal });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) { setSearchError(j.error || `Search failed (${r.status})`); return; }
        setSearchError('');
        setFound(j.data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setSearchError('Could not reach the server.');
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { ctl.abort(); clearTimeout(timer); };
  }, [q]);

  const dates = a.signupsDaily.map(d => d.date);
  const series = [{ key: 'n', label: 'Sign-ups', color: 'var(--ad-c1)' }];
  const methodTotal = a.methods.reduce((n, m) => n + m.count, 0);

  return (
    <>
      <Stats columns={6}>
        <Stat value={num(a.total)} label="Accounts" sub={`Customers; ${data.internalAccounts} internal left out`} tone="accent" />
        <Stat value={num(a.today)} label="New today" sub="Since midnight UTC" />
        <Stat value={num(a.week)} label="New, 7 days" />
        <Stat value={num(a.month)} label="New, 30 days" />
        <Stat value={pct(a.verified, a.total)} label="Email confirmed" sub={`${num(a.verified)} accounts`} />
        <Stat value={num(a.pendingVerification)} label="Awaiting confirmation" sub="Password sign-ups since 4 Oct" />
      </Stats>

      <Pane title="Find an account" sub="Search by email, name or account number." ruled flush>
        <div className={found !== null ? 'ad-search has-results' : 'ad-search'}>
          <label className="st-sr" htmlFor="ad-q">Email, name or account number</label>
          <input
            id="ad-q"
            className="st-input"
            type="search"
            value={q}
            onChange={ev => setQ(ev.target.value)}
            placeholder="name@company.com, a name, or 1577"
            autoComplete="off"
            spellCheck={false}
          />
          {searching && <span className="st-hint">Searching…</span>}
          {searchError && <span className="st-error">{searchError}</span>}
        </div>
        {found !== null && <AccountsTable rows={found} data={data} empty={`No account matches “${q.trim()}”.`} />}
      </Pane>

      <div className="st-split">
        <ChartPane title="Sign-ups" sub={`New accounts per day: ${num(a.month)} in the last 30 days`} dates={dates} series={series} values={[a.signupsDaily.map(d => d.count)]}>
          <DayColumns dates={dates} series={series} values={[a.signupsDaily.map(d => d.count)]} unit="sign-ups" />
        </ChartPane>

        <Pane title="How people sign in" ruled flush delay={0.06}>
          <div className="st-table-wrap">
            <table className="st-table">
              <tbody>
                {a.methods.map(m => (
                  <tr key={m.method}>
                    <td>{METHOD_LABEL[m.method] ?? m.method}</td>
                    <td className="is-num">{num(m.count)}</td>
                    <td className="is-num is-dim">{pct(m.count, methodTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
      </div>

      <Pane title="Engagement" sub="Customer accounts only. Activity counts are people, not clicks.">
        <div className="ad-two">
          <dl className="st-kv">
            <div><dt>Watchlists</dt><dd>{num(e.watchlistAccounts)} accounts track {num(e.watchedModels)} models</dd></div>
            <div><dt>Drift alerts on</dt><dd>{num(e.driftAlertsOn)} watched models</dd></div>
            <div><dt>Weekly digest</dt><dd>{num(e.digestOn)} subscribed</dd></div>
            <div><dt>Opted out of email</dt><dd>{num(e.emailOptedOut)} accounts</dd></div>
            <div><dt>Workspaces</dt><dd>{num(e.workspaces)} with {num(e.workspaceMembers)} members</dd></div>
            <div><dt>Forum</dt><dd>{num(e.forumTopics)} topics, {num(e.forumPosts)} posts ({num(e.forumPosts7)} this week)</dd></div>
          </dl>
          <dl className="st-kv">
            <div><dt>Started checkout, 30 days</dt><dd>{num(e.checkouts30)} people</dd></div>
            <div><dt>Subscribed, 30 days</dt><dd>{num(e.subscriptionsStarted30)} people</dd></div>
            <div><dt>Cancelled, 30 days</dt><dd>{num(e.cancellations30)} people</dd></div>
            <div><dt>Hit a paywall, 30 days</dt><dd>{num(e.paywallHits30)} people</dd></div>
            <div><dt>Contact messages, 30 days</dt><dd>{num(e.contact30)}</dd></div>
          </dl>
        </div>
      </Pane>

      <Pane title="Newest accounts" sub="The 15 most recent sign-ups." ruled flush>
        <AccountsTable rows={a.recent} data={data} empty="No accounts yet." />
      </Pane>
    </>
  );
}
