'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PROVIDER_LABEL, type HealthRow } from './types';
import { onView, pad2 } from './util';

const ORDER = ['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm'];
const PILL: Record<HealthRow['status'], [string, string]> = {
  operational: ['ok', 'Operational'],
  degraded: ['warn', 'Degraded'],
  down: ['bad', 'Outage'],
  unmeasured: ['na', 'Not measured'],
};
/**
 * /status says only what a check can show: the provider answered or it did not. "Operational"
 * would claim more than one small question every ten minutes can tell.
 */
const STATUS_PILL: Record<HealthRow['status'], [string, string]> = {
  operational: ['ok', 'Answering'],
  degraded: ['warn', 'Slow'],
  down: ['bad', 'Not answering'],
  unmeasured: ['na', 'Not measured'],
};
const LEGEND: Record<'landing' | 'status', Array<[string, string]>> = {
  landing: [['', 'Operational'], ['w', 'Degraded'], ['b', 'Provider outage'], ['o', 'Our side — not counted against the provider']],
  status: [['', 'Answered'], ['w', 'Slow'], ['b', 'Did not answer'], ['o', 'Not measured — our side, counted as neither'], ['e', 'No check']],
};
const CELL: Record<string, string> = { '.': '', w: 'w', b: 'b', o: 'o', e: 'e' };

/** Timestamps from the API are UTC, sometimes without the zone ("2026-10-14 12:00:02"). */
const parseUtc = (s: string) => Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));

function latency(ms: number | null): string {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** The same health data /status renders: status now, median latency, 7 days hourly, uptime. */
export default function StatusBoard({ providers, wording = 'landing', labels }: {
  providers: HealthRow[];
  wording?: 'landing' | 'status';
  /** Provider names, when the page around the board names them its own way. */
  labels?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    const stop = onView(ref.current, () => setInView(true), 0.3);
    return () => { mq.removeEventListener('change', on); clearInterval(t); stop(); };
  }, []);

  const rows = [...providers].sort((a, b) => ORDER.indexOf(a.provider) - ORDER.indexOf(b.provider));
  const healthy = rows.filter(p => p.status === 'operational').length;
  const last = Math.max(...rows.map(p => parseUtc(p.lastChecked)).filter(Number.isFinite));
  // Local clock times only once mounted: the server's time zone is not the visitor's.
  const lastLabel = now && Number.isFinite(last) ? (() => { const d = new Date(last); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; })() : '—';
  // Checks run on Berlin's 10-minute marks, which are UTC's.
  const left = now ? 600 - ((now.getUTCMinutes() % 10) * 60 + now.getUTCSeconds()) : null;
  const n = narrow ? 48 : 168;

  return (
    <div className={`lp-sb lp-up${inView ? ' is-in' : ''}`} ref={ref}>
      <div className="lp-sb-head">
        <span>
          <b>{healthy === rows.length ? `All ${rows.length} providers answering` : `${healthy} of ${rows.length} providers answering normally`}</b>
          {' '}· last check {lastLabel}
        </span>
        <span className="lp-sb-next">Next check in <b>{left == null ? '--:--' : `${Math.floor(left / 60)}:${pad2(left % 60)}`}</b></span>
      </div>
      <div className="lp-sb-cols"><span>Provider</span><span>Now</span><span title="Median over the last 24 hours">Latency</span><span>Last 7 days, hourly</span><span>Uptime</span></div>
      {rows.map(p => {
        const cells = p.cells.slice(-n);
        const end = p.lastHour ? Date.parse(p.lastHour) : NaN;
        const pills = wording === 'status' ? STATUS_PILL : PILL;
        const [pillCls, pillText] = pills[p.status] ?? pills.unmeasured;
        const label = labels?.[p.provider] ?? PROVIDER_LABEL[p.provider] ?? p.provider;
        return (
          <div className="lp-sb-row" key={p.provider}>
            <span className="lp-sb-prov">
              <span className="lp-lgc"><img src={`/logos/${p.provider}.svg`} alt="" width={18} height={18} loading="lazy" /></span>
              <span>{label}</span>
            </span>
            <span className={`lp-pill ${pillCls}`}>{pillText}</span>
            <span className="lp-sb-lat">{latency(p.latencyMs)}</span>
            <div className="lp-strip" style={{ '--n': cells.length } as CSSProperties} aria-label={`${label}: hourly status, last ${narrow ? '2' : '7'} days`}>
              {Array.from(cells, (c, i) => (
                <i key={i} className={CELL[c] ?? ''} style={{ '--d': `${((i / cells.length) * 0.6).toFixed(3)}s` } as CSSProperties}
                  title={now && Number.isFinite(end) ? new Date(end - (cells.length - 1 - i) * 3600e3).toLocaleString() : undefined} />
              ))}
            </div>
            <span className="lp-sb-up">{p.uptime7d == null ? '—' : `${p.uptime7d}%`}</span>
          </div>
        );
      })}
      <div className="lp-sb-legend">
        {LEGEND[wording].map(([cls, text]) => <span key={text} className={cls || undefined}><i />{text}</span>)}
      </div>
    </div>
  );
}
