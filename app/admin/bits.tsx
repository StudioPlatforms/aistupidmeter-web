'use client';

import type { ReactNode } from 'react';
import { Pill, Tag } from '@/components/studio';
import type { AttentionItem, SubscriptionStatus } from '@/lib/admin-types';
import { STATUS } from './format';

export function StatusPill({ status }: { status: SubscriptionStatus }) {
  const s = STATUS[status] ?? STATUS.free;
  return s.tone ? <Pill tone={s.tone}>{s.label}</Pill> : <span className="ad-plain">{s.label}</span>;
}

/** An account in a table cell: the email, and a quiet second line. */
export function AccountCell({ email, sub, internal }: { email: string; sub?: ReactNode; internal?: boolean }) {
  return (
    <div className="ad-acct">
      <span className="ad-acct-e" title={email}>{email}</span>
      {(sub || internal) && (
        <span className="ad-acct-s">
          {internal && <Tag tone="line" title="One of our own accounts, left out of every total">Internal</Tag>}
          {sub}
        </span>
      )}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="ad-ext" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const KIND_LABEL: Record<AttentionItem['kind'], string> = {
  past_due: 'Payment failed',
  duplicate: 'Charged twice',
  unpaid_access: 'Unpaid access',
  unlinked: 'No account',
  trial_ending: 'Trial ending',
  legacy_anniversary: '12 months at $4.99',
};

/** Billing problems and dates that need a decision, worst first. */
export function AttentionList({ items, limit }: { items: AttentionItem[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="ad-att">
      {shown.map((a, i) => (
        <li key={`${a.kind}-${a.userId ?? i}-${i}`} className={`ad-att-row is-${a.tone}`}>
          <Tag tone={a.tone}>{KIND_LABEL[a.kind]}</Tag>
          <div className="ad-att-main">
            <p className="ad-att-t">{a.title}</p>
            <p className="ad-att-d">{a.detail}</p>
            {a.links && a.links.length > 0 && (
              <p className="ad-att-l">{a.links.map(l => <ExternalLink key={l.href} href={l.href}>{l.label}</ExternalLink>)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A table row standing in for an empty table. */
export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return <tr><td colSpan={cols} className="ad-empty-cell">{children}</td></tr>;
}

export type TabKey = 'overview' | 'billing' | 'router' | 'accounts' | 'traffic' | 'tools';
