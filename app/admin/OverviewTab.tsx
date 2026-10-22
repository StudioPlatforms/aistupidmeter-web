'use client';

import { Pane, Stats, Stat, Meter, Empty } from '@/components/studio';
import { isUnlimited } from '@/lib/entitlements';
import type { AdminOverview } from '@/lib/admin-types';
import { AccountCell, AttentionList, type TabKey } from './bits';
import { ChartPane, DayColumns } from './AdminCharts';
import { money, num, planLabel } from './format';
import type { VisitorStats } from './TrafficTab';

/** The first screen: the numbers that matter today, and what needs a decision. */
export default function OverviewTab({ data, visitors, go }: {
  data: AdminOverview; visitors: VisitorStats | null; go: (tab: TabKey) => void;
}) {
  const b = data.billing;
  const r = data.router;
  const a = data.accounts;
  const routing = r.users.filter(u => !u.internal && u.used > 0).slice(0, 6);
  const dates = a.signupsDaily.map(d => d.date);

  return (
    <>
      <Stats columns={6}>
        <Stat
          value={b.error ? '—' : money(b.mrr, true)}
          label="Monthly recurring revenue"
          sub={b.error ? 'Stripe could not be read' : `${money(b.mrr * 12, true)} a year at list prices`}
          tone="accent"
        />
        <Stat value={num(b.payingCustomers)} label="Paying customers" sub={`${b.trialing} on trial · ${b.pastDue} past due`} />
        <Stat value={num(a.total)} label="Accounts" sub={`+${num(a.today)} today · +${num(a.week)} this week`} />
        <Stat
          value={num(r.totals.monthSuccess)}
          label="Routed requests this month"
          sub={`${r.totals.activeMonth} ${r.totals.activeMonth === 1 ? 'customer' : 'customers'} routing`}
        />
        <Stat value={b.error ? '—' : money(b.collected30, true)} label="Collected, last 30 days" sub={`${num(b.invoicesPaid30)} paid invoices`} />
        <Stat
          value={visitors ? num(visitors.today.visits) : '—'}
          label="Visits today"
          sub={visitors ? `${num(visitors.today.unique)} unique visitors` : 'Loading…'}
        />
      </Stats>

      <Pane
        title="Needs attention"
        sub={data.attention.length
          ? 'Failed payments, double charges, unpaid access, trials ending and 12-month dates, worst first.'
          : 'Failed payments, double charges, unpaid access, trials ending and 12-month dates.'}
        actions={data.attention.length > 5 && (
          <button type="button" className="st-btn is-sm" onClick={() => go('billing')}>All {data.attention.length} in Billing</button>
        )}
        ruled flush
      >
        {data.attention.length
          ? <AttentionList items={data.attention} limit={5} />
          : <div className="ad-pad"><Empty title="Nothing needs attention">Every subscription is paid, linked to one account and nothing is about to change.</Empty></div>}
      </Pane>

      <div className="st-split">
        <Pane
          title="Customers by plan"
          sub={`Each account's own plan. Our ${data.internalAccounts} internal accounts are left out.`}
          ruled flush delay={0.04}
          foot={<button type="button" className="ad-linkbtn" onClick={() => go('billing')}>Plans and billing in detail</button>}
        >
          <div className="st-table-wrap">
            <table className="st-table">
              <thead><tr><th>Plan</th><th className="is-num">Accounts</th><th className="is-num">Paying</th><th className="is-num ad-hide-sm">Trial</th><th className="is-num">MRR</th></tr></thead>
              <tbody>
                {[...data.plans.filter(p => p.plan !== 'free'), ...data.plans.filter(p => p.plan === 'free')].map(p => (
                  <tr key={p.plan}>
                    <td>{planLabel(p.plan)}</td>
                    <td className="is-num">{num(p.accounts)}</td>
                    <td className="is-num">{p.plan === 'free' ? '—' : num(p.byStatus.active)}</td>
                    <td className="is-num ad-hide-sm">{p.plan === 'free' ? '—' : num(p.byStatus.trial)}</td>
                    <td className="is-num">{p.mrr ? money(p.mrr) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>

        <Pane
          title="Smart Router this month"
          sub={r.error ? `Usage could not be read: ${r.error}` : `${num(r.totals.monthSuccess)} successful requests, counted against each plan's allowance.`}
          ruled flush delay={0.08}
          foot={<button type="button" className="ad-linkbtn" onClick={() => go('router')}>Every router account</button>}
        >
          {routing.length === 0 ? (
            <p className="st-text ad-pad">No customer has routed a request this month.</p>
          ) : (
            <div className="st-rows">
              {routing.map(u => (
                <div key={u.userId} className="st-row ad-use-row">
                  <AccountCell email={u.email} sub={planLabel(u.plan)} />
                  <div className="ad-use">
                    <Meter used={u.used} limit={isUnlimited(u.limit) ? -1 : u.limit} />
                  </div>
                  <div className="st-row-end st-num">
                    <b>{num(u.used)}</b>
                    <span className="st-faint">{isUnlimited(u.limit) ? 'no limit' : `of ${num(u.limit)}`}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Pane>
      </div>

      <div className="st-grid">
        <ChartPane
          title="Sign-ups"
          sub={`New accounts per day: ${num(a.month)} in the last 30 days`}
          dates={dates}
          series={[{ key: 'n', label: 'Sign-ups', color: 'var(--ad-c1)' }]}
          values={[a.signupsDaily.map(d => d.count)]}
        >
          <DayColumns dates={dates} series={[{ key: 'n', label: 'Sign-ups', color: 'var(--ad-c1)' }]} values={[a.signupsDaily.map(d => d.count)]} unit="sign-ups" />
        </ChartPane>
        <ChartPane
          title="Routed requests"
          sub="Per day, last 30 days, customers only"
          dates={r.daily.map(d => d.date)}
          series={ROUTED}
          values={[r.daily.map(d => d.ok), r.daily.map(d => d.failed)]}
          delay={0.06}
        >
          <DayColumns dates={r.daily.map(d => d.date)} series={ROUTED} values={[r.daily.map(d => d.ok), r.daily.map(d => d.failed)]} unit="requests" />
        </ChartPane>
      </div>
    </>
  );
}

export const ROUTED = [
  { key: 'ok', label: 'Succeeded', color: 'var(--ad-c1)' },
  { key: 'failed', label: 'Failed', color: 'var(--ad-fail)' },
];
