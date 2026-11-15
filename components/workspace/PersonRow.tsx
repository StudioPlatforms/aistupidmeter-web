'use client';

import type { ReactNode } from 'react';
import { Tag } from '@/components/studio';
import { day } from '@/components/workspace/ws';

type Tone = 'accent' | 'good' | 'warn' | 'bad' | 'solid' | 'ink' | 'line';

/**
 * One person in a team list: initial, name (or address), role, the invitation's state, a detail
 * line, and the actions the viewer may take. Shared by the workspace's People tab
 * (/account/team) and the provider account's Team page (/account/provider/team), so a member, a
 * pending invitation and an expired one read the same everywhere. Styles: styles/studio-team.css
 * (sw-person, sw-avatar).
 *
 * `actions` undefined renders no actions cell; an empty fragment renders an empty one, which the
 * stylesheet hides (`.sw-person-acts:empty`).
 */
export default function PersonRow({
  name, email, role, roleLabel, roleTone = 'line', pending, expired, expiresAt, deactivated, self, detail, actions,
}: {
  name: string | null; email: string | null; role: string; roleLabel: ReactNode; roleTone?: Tone;
  pending?: boolean; expired?: boolean; expiresAt?: string | null; deactivated?: boolean; self?: boolean;
  detail?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="sw-person">
      <span className={`sw-avatar${pending ? ' is-pending' : role === 'owner' ? ' is-ink' : ''}`} aria-hidden="true">
        {(name || email || '?').trim().charAt(0).toUpperCase()}
      </span>
      <div className="sw-person-main">
        <div className="sw-person-line">
          <span className="sw-t">{name || email || '—'}{self && <span className="sw-you"> (you)</span>}</span>
          <Tag tone={roleTone}>{roleLabel}</Tag>
          {pending && !expired && <Tag tone="warn">Invited · until {day(expiresAt)}</Tag>}
          {pending && expired && <Tag tone="bad">Invitation expired</Tag>}
          {deactivated && <Tag tone="bad">Deactivated</Tag>}
        </div>
        {detail}
      </div>
      {actions !== undefined && <div className="sw-person-acts">{actions}</div>}
    </div>
  );
}
