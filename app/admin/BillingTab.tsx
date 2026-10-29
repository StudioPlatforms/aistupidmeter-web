'use client';

import { useState } from 'react';
import { Pane, Stats, Stat, Empty, Pill, Tag, Note } from '@/components/studio';
import type { AdminOverview, AdminSubscription } from '@/lib/admin-types';
import { AccountCell, AttentionList, EmptyRow, ExternalLink } from './bits';
import { ago, clock, day, fullDate, money, num, planLabel, stripeStatus, stripeUrl } from './format';

const NOTICE: Record<string, string> = {
  duplicate_cancelled: 'Cancelled a duplicate',
  payment_failed: 'Emailed: payment failed',
  downgraded: 'Moved to Free',
  cancelled_unpaid: 'Emailed: billing problem',
  legacy_price_notice: 'Emailed: $4.99 → $12',
  legacy_price_changed: 'Switched to $12',
  legacy_now_pro: 'Moved to Pro',
  cancelled_from_email: 'Cancelled from the $12 email',
  legacy_end_scheduled: 'Set $4.99 to end',
  legacy_ended: 'Emailed: $4.99 ended',
  legacy_end_reverted: 'Kept: end undone',
};

const ENDED = new Set(['canceled', 'incomplete_expired']);
const RANK: Record<string, number> = { past_due: 0, unpaid: 0, incomplete: 1, trialing: 2, active: 3 };

function nextEvent(s: AdminSubscription): string {
  if (ENDED.has(s.status)) return s.endedAt ? `Ended ${day(s.endedAt)}` : 'Ended';
  if (s.status === 'past_due' || s.status === 'unpaid') {
    return s.invoice?.nextAttemptAt ? `Retry ${day(s.invoice.nextAttemptAt)}` : 'No retry scheduled';
  }
  if (s.cancelAt) return `Ends ${day(s.cancelAt)}`;
  if (s.status === 'trialing' && s.trialEnd) return `Converts ${day(s.trialEnd)}`;
  return s.periodEnd ? `Renews ${day(s.periodEnd)}` : '—';
}

const perInterval = (s: AdminSubscription) => `${money(s.amount)}/${s.interval === 'year' ? 'year' : s.interval}`;

export default function BillingTab({ data }: { data: AdminOverview }) {
  const b = data.billing;
  const [show, setShow] = useState<'live' | 'ended'>('live');
  const live = b.subscriptions
    .filter(s => !ENDED.has(s.status))
    .sort((x, y) => (RANK[x.status] ?? 4) - (RANK[y.status] ?? 4) || y.startedAt.localeCompare(x.startedAt));
  const ended = b.subscriptions.filter(s => ENDED.has(s.status)).sort((x, y) => (y.endedAt ?? '').localeCompare(x.endedAt ?? ''));
  const rows = show === 'live' ? live : ended;

  const paid = data.plans.filter(p => p.plan !== 'free');
  const free = data.plans.find(p => p.plan === 'free');
  const total = (f: (p: (typeof paid)[number]) => number) => paid.reduce((n, p) => n + f(p), 0);

  const now = Date.now();
  const months = new Map<string, { count: number; reached: number }>();
  for (const a of b.legacy.anniversaries) {
    const m = a.anniversary.slice(0, 7);
    const e = months.get(m) ?? { count: 0, reached: 0 };
    e.count++;
    if (Date.parse(a.anniversary) <= now) e.reached++;
    months.set(m, e);
  }
  const upcoming = b.legacy.anniversaries.filter(a => Date.parse(a.anniversary) > now - 30 * 86_400_000).slice(0, 8);
  const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <>
      {b.error && <Note tone="bad" title="Stripe could not be read">{b.error}. The revenue figures below are zero until it answers; account data is unaffected.</Note>}

      <Stats columns={6}>
        <Stat value={money(b.mrr, true)} label="Monthly recurring revenue" sub="Active subscriptions at list price" tone="accent" />
        <Stat value={money(b.mrr * 12, true)} label="Annual run rate" sub="MRR × 12" />
        <Stat value={money(b.collected30, true)} label="Collected, last 30 days" sub={`${num(b.invoicesPaid30)} paid invoices`} />
        <Stat value={money(b.trialPipeline, true)} unit="/mo" label="Trials, if they convert" sub={`${b.trialing} on trial`} />
        <Stat value={money(b.atRisk, true)} unit="/mo" label="Past due" sub={`${b.pastDue} ${b.pastDue === 1 ? 'subscription' : 'subscriptions'} not collected`} tone={b.atRisk ? 'bad' : undefined} />
        <Stat value={money(b.ending, true)} unit="/mo" label="Ending" sub="Cancelled, still running to period end" tone={b.ending ? 'warn' : undefined} />
      </Stats>

      <Pane
        title="Plans"
        sub={`Each account's own plan and its billing state, from Stripe. Our ${data.internalAccounts} internal accounts are left out.${b.discounted ? ` ${b.discounted} live subscriptions carry a discount, so MRR at list price overstates them.` : ''}`}
        ruled flush
      >
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th className="is-num">Accounts</th>
                <th className="is-num">Paying</th>
                <th className="is-num">Trial</th>
                <th className="is-num">Cancelled</th>
                <th className="is-num">Past due</th>
                <th className="is-num">Complimentary</th>
                <th className="is-num">MRR</th>
              </tr>
            </thead>
            <tbody>
              {paid.map(p => (
                <tr key={p.plan}>
                  <td>{planLabel(p.plan)}</td>
                  <td className="is-num">{num(p.accounts)}</td>
                  <td className="is-num">{num(p.byStatus.active)}</td>
                  <td className="is-num">{num(p.byStatus.trial)}</td>
                  <td className="is-num">{num(p.byStatus.cancelled)}</td>
                  <td className="is-num">{num(p.byStatus.past_due)}</td>
                  <td className="is-num">{num(p.byStatus.complimentary)}</td>
                  <td className="is-num">{p.mrr ? money(p.mrr) : '—'}</td>
                </tr>
              ))}
              <tr className="ad-total">
                <td>All paid plans</td>
                <td className="is-num">{num(total(p => p.accounts))}</td>
                <td className="is-num">{num(total(p => p.byStatus.active))}</td>
                <td className="is-num">{num(total(p => p.byStatus.trial))}</td>
                <td className="is-num">{num(total(p => p.byStatus.cancelled))}</td>
                <td className="is-num">{num(total(p => p.byStatus.past_due))}</td>
                <td className="is-num">{num(total(p => p.byStatus.complimentary))}</td>
                <td className="is-num">{money(b.mrr)}</td>
              </tr>
              {free && (
                <tr>
                  <td className="is-dim">Free</td>
                  <td className="is-num is-dim">{num(free.accounts)}</td>
                  <td className="is-num is-dim" colSpan={6}>No subscription</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Pane>

      <Pane
        title="Needs attention"
        sub="Billing problems and dates. The billing watch handles them every six hours; anything it cannot decide stays here for you."
        ruled flush
      >
        {data.attention.length
          ? <AttentionList items={data.attention} />
          : <div className="ad-pad"><Empty title="Nothing needs attention">Every subscription is paid, linked to one account and nothing is about to change.</Empty></div>}
      </Pane>

      <Pane
        title="Subscriptions"
        sub={b.fetchedAt ? `From Stripe at ${clock(b.fetchedAt)}. Refresh reads it again.` : undefined}
        actions={
          <div className="st-seg" role="group" aria-label="Which subscriptions">
            <button type="button" aria-pressed={show === 'live'} onClick={() => setShow('live')}>Live · {live.length}</button>
            <button type="button" aria-pressed={show === 'ended'} onClick={() => setShow('ended')}>Ended, 60 days · {ended.length}</button>
          </div>
        }
        ruled flush
      >
        <div className="st-table-wrap ad-scroll is-tall">
          <table className="st-table">
            <thead>
              <tr>
                <th>Customer</th><th>Plan</th><th className="is-num">Price</th><th>Status</th>
                <th className="ad-hide-md">Started</th><th>Next</th><th><span className="st-sr">Stripe</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={7}>{show === 'live' ? 'No live subscriptions.' : 'Nothing ended in the last 60 days.'}</EmptyRow>}
              {rows.map(s => {
                const st = stripeStatus(s.status, s.cancelAt);
                return (
                  <tr key={s.id}>
                    <td>
                      <AccountCell
                        email={s.email ?? 'No email on the customer'}
                        sub={<>
                          {s.userId ? `#${s.userId}` : 'No account here'}
                          {s.userId && !s.linked && !ENDED.has(s.status) && <Tag tone="bad" title="The account record points at a different subscription">Not the one in use</Tag>}
                        </>}
                      />
                    </td>
                    <td className="ad-nowrap">{planLabel(s.plan)}</td>
                    <td className="is-num ad-nowrap">{perInterval(s)}{s.discounted && <> <Tag tone="line">discount</Tag></>}</td>
                    <td>{st.tone ? <Pill tone={st.tone}>{st.label}</Pill> : <span className="ad-plain">{st.label}</span>}</td>
                    <td className="is-dim ad-hide-md">{day(s.startedAt)}</td>
                    <td className="is-dim">{nextEvent(s)}</td>
                    <td><ExternalLink href={stripeUrl('subscriptions', s.id)}>Open</ExternalLink></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Pane>

      <Pane
        title="Billing automation"
        sub="What the billing watch has done: cancelled duplicates, moved unpaid accounts to Free, moved $4.99 subscriptions to $12 after 12 months, and every email it sent. It runs every six hours; Stripe events also trigger the emails as they happen."
        ruled flush
      >
        <div className="st-table-wrap ad-scroll">
          <table className="st-table">
            <thead><tr><th className="is-num">When</th><th>Account</th><th>What</th><th className="ad-hide-md">Detail</th></tr></thead>
            <tbody>
              {b.notices.length === 0 && <EmptyRow cols={4}>Nothing yet.</EmptyRow>}
              {b.notices.map(n => (
                <tr key={`${n.kind}-${n.ref}`}>
                  <td className="is-num" title={fullDate(n.createdAt)}>{ago(n.createdAt)}</td>
                  <td><AccountCell email={n.email ?? 'No account'} sub={n.userId ? `#${n.userId}` : undefined} /></td>
                  <td className="ad-nowrap">{NOTICE[n.kind] ?? n.kind}</td>
                  <td className="is-dim ad-hide-md">{n.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>

      <Pane
        title="Legacy Pro at $4.99"
        sub={`${b.legacy.live} live subscriptions on the original price. Each keeps $4.99 for 12 months from the subscriber's first subscription, then moves to the $12 Pro price at the first renewal at least 30 days after the subscriber is emailed (37 days before the mark); the email has a cancel link.`}
      >
        <div className="ad-two">
          <div>
            <p className="st-label">12-month mark, by month</p>
            <dl className="st-kv is-tight">
              {Array.from(months.entries()).map(([m, e]) => (
                <div key={m}>
                  <dt>{monthName(m)}</dt>
                  <dd className="st-num">{num(e.count)} {e.count === 1 ? 'subscriber' : 'subscribers'}{e.reached ? ` · ${e.reached} reached` : ''}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="st-label">Next and recent</p>
            <dl className="st-kv is-tight">
              {upcoming.length === 0 && <div><dt>None</dt><dd>No 12-month mark in the next months.</dd></div>}
              {upcoming.map(a => {
                const reached = Date.parse(a.anniversary) <= now;
                return (
                  <div key={a.userId}>
                    <dt className="ad-ellip" title={a.email}>{a.email}</dt>
                    <dd>{day(a.anniversary)} {reached ? <Tag tone="warn">reached</Tag> : null}<span className="st-faint"> · since {day(a.firstStart)}</span></dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </Pane>
    </>
  );
}
