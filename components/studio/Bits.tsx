import type { ReactNode } from 'react';

/** Loading state: the ASL node's three slanted bars, lighting in turn. */
export function Loader({ label = 'Loading…', minHeight }: { label?: ReactNode; minHeight?: number }) {
  return (
    <div className="st-loader" role="status" aria-live="polite" style={minHeight ? { minHeight } : undefined}>
      <span className="st-bars" aria-hidden="true"><i /><i /><i /></span>
      {label && <span>{label}</span>}
    </div>
  );
}

/** Nothing here yet: a title, a sentence on what would fill it, and the action that does. */
export function Empty({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="st-empty st-up">
      <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
      <h3 className="st-empty-t">{title}</h3>
      {children && <div className="st-empty-p">{children}</div>}
      {actions && <div className="st-actions">{actions}</div>}
    </div>
  );
}

/** Callout. Tone: accent (default), good, warn, bad. */
export function Note({ title, tone, children }: { title?: ReactNode; tone?: 'good' | 'warn' | 'bad'; children?: ReactNode }) {
  return (
    <div className={`st-note${tone ? ` is-${tone}` : ''}`} role={tone === 'bad' ? 'alert' : undefined}>
      <div>
        {title && <b className="st-note-t">{title}</b>}
        {children}
      </div>
    </div>
  );
}

type TagTone = 'accent' | 'good' | 'warn' | 'bad' | 'solid' | 'ink' | 'line';

/** Small pill label. */
export function Tag({ tone, title, children }: { tone?: TagTone; title?: string; children: ReactNode }) {
  return <span className={`st-tag${tone ? ` is-${tone}` : ''}`} title={title}>{children}</span>;
}

/** Status with a dot: "Operational", "Degraded". */
export function Pill({ tone, live, children }: { tone?: 'good' | 'warn' | 'bad' | 'accent'; live?: boolean; children: ReactNode }) {
  return <span className={`st-pill${tone ? ` is-${tone}` : ''}${live ? ' is-live' : ''}`}>{children}</span>;
}

const LOGOS = new Set(['openai', 'anthropic', 'google', 'xai', 'deepseek', 'glm', 'kimi']);

function logoFile(provider: string): string | null {
  const p = (provider || '').toLowerCase().replace('x.ai', 'xai').replace('gemini', 'google').replace('moonshot', 'kimi').replace('zhipu', 'glm');
  return LOGOS.has(p) ? p : null;
}

/** A provider's official mark on a white chip, as on the leaderboard. Unknown providers get initials. */
export function ProviderMark({ provider, size }: { provider: string; size?: 'sm' | 'lg' }) {
  const file = logoFile(provider);
  return (
    <span className={`st-logo${size ? ` is-${size}` : ''}`} aria-hidden="true">
      {file
        ? <img src={`/logos/${file}.svg`} alt="" width={18} height={18} loading="lazy" />
        : <b style={{ fontSize: 11, color: '#5f6368' }}>{provider.slice(0, 2).toUpperCase()}</b>}
    </span>
  );
}

/** Used vs limit, as a thin bar. Pass limit < 0 for unlimited (renders nothing). */
export function Meter({ used, limit }: { used: number; limit: number }) {
  if (limit < 0) return null;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 90 ? ' is-bad' : pct >= 70 ? ' is-warn' : '';
  return (
    <div className={`st-meter${tone}`} role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A paid feature the visitor cannot see yet: which plan has it, what it shows, and one button that
 * opens the existing upgrade flow. Every locked panel on a page uses this, so they read as one thing.
 */
export function Locked({ plan = 'Pro Intelligence', title, children, onOpen, action = 'See what it includes' }: {
  plan?: ReactNode; title: ReactNode; children?: ReactNode; onOpen: () => void; action?: ReactNode;
}) {
  return (
    <div className="st-locked">
      <span className="st-locked-streaks" aria-hidden="true"><i /><i /><i /></span>
      <p className="st-kicker">{plan}</p>
      <h3 className="st-locked-t">{title}</h3>
      {children && <div className="st-locked-p">{children}</div>}
      <button type="button" className="st-btn is-primary" onClick={onOpen}>
        {action} <span className="st-ar" aria-hidden="true">→</span>
      </button>
    </div>
  );
}
