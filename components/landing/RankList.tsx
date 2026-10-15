'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PROVIDER_LABEL, type LandingRow, type MetricKind } from './types';

const TAG_TEXT: Record<string, string> = {
  drift: 'drift flagged',
  outage: 'outage',
  out: 'outside 5 pts',
  excluded: 'excluded',
  over_cost: 'over cost cap',
  not_in_split: 'not in split',
  no_key: 'no key',
  over_latency: 'over latency cap',
  no_tools: 'no tool calling',
};
/** Tags that mean "not a candidate for this mode" — shown faded unless the router still uses the model. */
const DIM = new Set(['out', 'excluded', 'over_cost', 'not_in_split', 'no_key', 'over_latency', 'no_tools']);
const LOGOS = new Set(['openai', 'anthropic', 'google', 'xai', 'deepseek', 'glm', 'kimi']);

export function formatMetric(kind: MetricKind, v: number | null, estimated?: boolean): { main: string; unit?: string } {
  if (v == null) return { main: '—' };
  switch (kind) {
    case 'price': return { main: `$${v.toFixed(2)}`, unit: '/1M' };
    case 'latency': return { main: `${(v / 1000).toFixed(1)} s`, unit: estimated ? 'est.' : undefined };
    case 'value': return { main: Math.round(v).toLocaleString('en-US'), unit: 'pts/$' };
    case 'spread': return { main: `± ${v.toFixed(1)}` };
    case 'weight': return { main: `${v}%` };
    default: return { main: Number.isInteger(v) ? String(v) : v.toFixed(1) };
  }
}

/** Bar lengths relative to the rows on screen; log scale where values span orders of magnitude. */
function barWidths(rows: LandingRow[], kind: MetricKind): Map<string, number> {
  const out = new Map<string, number>();
  const usable = rows.filter(r => r.metric != null && !(r.tag && DIM.has(r.tag) && !r.role));
  if (!usable.length) return out;
  const log = kind === 'price' || kind === 'latency' || kind === 'value';
  const f = (v: number) => (log ? Math.log(Math.max(v, 1e-3)) : v);
  const vals = usable.map(r => f(r.metric as number));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const lowerBetter = kind === 'price' || kind === 'latency' || kind === 'spread';
  for (const r of rows) {
    if (r.metric == null || (r.tag && DIM.has(r.tag) && !r.role)) { out.set(r.model, 0); continue; }
    const t = hi === lo ? 1 : (f(r.metric) - lo) / (hi - lo);
    out.set(r.model, 0.12 + 0.88 * (lowerBetter ? 1 - t : t));
  }
  return out;
}

/**
 * A ranking whose rows are keyed by model: when the order changes the rows slide to their new
 * places, models that leave fade out where they were, and new ones fade in.
 */
export default function RankList({ rows, kind, winLabel = 'routed' }: { rows: LandingRow[]; kind: MetricKind; winLabel?: string }) {
  const [pool, setPool] = useState<LandingRow[]>(rows);
  const lastPos = useRef(new Map<string, number>());

  useEffect(() => {
    setPool(prev => {
      const seen = new Map(prev.map(r => [r.model, r]));
      for (const r of rows) seen.set(r.model, r);
      return Array.from(seen.values());
    });
  }, [rows]);

  const index = new Map(rows.map((r, i) => [r.model, i]));
  rows.forEach((r, i) => lastPos.current.set(r.model, i));
  const bars = barWidths(rows, kind);

  return (
    <div className="lp-rl" style={{ '--rows': Math.max(rows.length, 1) } as CSSProperties}>
      {pool.map(p => {
        const i = index.get(p.model);
        const live = i !== undefined;
        const r = live ? rows[i] : p;
        const pos = live ? i : lastPos.current.get(p.model) ?? 0;
        const dim = !!r.tag && DIM.has(r.tag) && !r.role;
        const cls = ['lp-rr',
          live && r.role === 'primary' ? 'is-win' : '',
          r.tag === 'drift' ? 'is-flag' : '',
          r.tag === 'outage' ? 'is-down' : '',
          dim ? 'is-dim' : '',
          live ? '' : 'is-gone'].filter(Boolean).join(' ');
        const m = dim && r.metric == null ? { main: '—' } : formatMetric(kind, r.metric, r.estimated);
        return (
          <div key={p.model} className={cls} style={{ transform: `translateY(calc(${pos} * var(--rh)))` }} aria-hidden={!live}>
            <span className="lp-rk">{live ? i + 1 : ''}</span>
            <span className="lp-lgc">
              <img src={`/logos/${LOGOS.has(r.provider) ? r.provider : 'openai'}.svg`} alt="" width={18} height={18} loading="lazy" />
            </span>
            <span className="lp-nm">
              <span>{r.displayName}</span>
              <small>
                <span>{PROVIDER_LABEL[r.provider] ?? r.provider}</span>
                {r.role === 'primary' && <span className="lp-tg is-win">{winLabel}</span>}
                {r.role === 'fallback' && <span className="lp-tg is-fb">fallback</span>}
                {r.tag && <span className={`lp-tg is-${r.tag}`} title={r.note}>{TAG_TEXT[r.tag]}</span>}
              </small>
            </span>
            <span className="lp-bar"><i style={{ width: `${((bars.get(r.model) ?? 0) * 100).toFixed(1)}%` }} /></span>
            <span className="lp-val">{m.main}{m.unit && <small>{m.unit}</small>}</span>
          </div>
        );
      })}
    </div>
  );
}
