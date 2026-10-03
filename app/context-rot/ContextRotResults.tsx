'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { upgradeHref } from '@/lib/checkout-url';
import { HeatGrid, HeatLegend, SKILLS, k, pct, type CrtModel } from '@/components/context-rot/shared';

/**
 * Context-rot results (Pro Intelligence and above). The page around it is public; this panel
 * asks /api/pro/context-rot, which checks the session and plan server-side. Below Pro it shows
 * what the panel contains and how to get it — never the numbers.
 *
 * Charts are plain SVG. Colours follow the validated categorical order (dataviz palette, slots
 * 1-5, checked in light and dark). Three light-mode slots are under 3:1 against the surface,
 * so every line is labelled directly and the table above the chart carries every value.
 */

type ModelRow = CrtModel;
interface Data { buckets: number[]; depths: number[]; models: ModelRow[] }

export default function ContextRotResults() {
  const [state, setState] = useState<'loading' | 'ok' | 'signin' | 'upgrade' | 'error'>('loading');
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/pro/context-rot', { cache: 'no-store' })
      .then(async r => {
        if (r.status === 401) return setState('signin');
        if (r.status === 403) return setState('upgrade');
        const d = await r.json();
        if (!d?.success) return setState('error');
        setData(d.data); setState('ok');
      })
      .catch(() => setState('error'));
  }, []);

  if (state === 'loading') return <p className="crt-muted">Loading the results…</p>;
  if (state === 'error') return <p className="crt-muted">The results could not be loaded. Please try again shortly.</p>;
  if (state === 'signin' || state === 'upgrade') return <Locked signedIn={state === 'upgrade'} />;
  if (!data) return null;

  const measured = data.models.filter(m => m.sweeps > 0);
  if (!measured.length) {
    return <p className="crt-muted">The first weekly run has not finished yet. Results appear here as soon as it has.</p>;
  }
  return (
    <div className="crt">
      <SummaryTable data={data} />
      <LengthChart data={data} />
      <SkillTable data={data} />
      <PositionGrids data={data} />
    </div>
  );
}

function Locked({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="crt-locked">
      <p><b>The results are part of Pro Intelligence and above.</b> They include every pilot model’s accuracy at each length from 8K to 1M tokens, its effective context length, what breaks first — finding, linking, tracking or counting — and where in the document it loses facts.</p>
      <div className="crt-locked-actions">
        <Link className="doc-btn is-primary" href={upgradeHref('pro', 'annual')}>Start free trial</Link>
        {!signedIn && <Link className="doc-btn" href="/auth/signin?callbackUrl=/context-rot">Sign in</Link>}
        <Link className="doc-btn" href="/pricing">Compare plans</Link>
      </div>
    </div>
  );
}

/** One row per model: effective context, then overall accuracy at each length. */
function SummaryTable({ data }: { data: Data }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table crt-table">
        <caption className="crt-caption">Accuracy on all sixteen questions, latest weekly run</caption>
        <thead>
          <tr>
            <th>Model</th><th>Holds up to</th>
            {data.buckets.map(b => <th key={b} className="num">{k(b)}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.models.map((m, i) => (
            <tr key={m.name}>
              <td><span className={`crt-swatch s${i + 1}`} aria-hidden="true" />{m.displayName}</td>
              <td title={m.effectiveIsLowerBound ? 'Held at every length measured so far; longer lengths not measured yet' : undefined}>{m.effectiveContext ? `${m.effectiveIsLowerBound ? '≥ ' : ''}${k(m.effectiveContext)}` : '—'}</td>
              {m.buckets.map(b => (
                <td key={b.bucket} className="num" title={b.runnable ? `${b.correct}/${b.total} correct${b.tokens ? ` · ${b.tokens.toLocaleString()} tokens` : ''}${b.excluded ? ` · ${b.excluded} trial(s) excluded (provider error)` : ''}` : `Beyond its ${m.window.toLocaleString()}-token window`}>
                  {!b.runnable ? <span className="crt-na">n/a</span> : pct(b.accuracy)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="crt-note">“Holds up to”: the longest length that keeps at least 90% of the model’s own 8K accuracy. n/a: longer than the model’s context window. Hover a value for the number of questions and the real token count.</p>
    </div>
  );
}

/** Accuracy by length, one line per model, equal spacing per length step. */
function LengthChart({ data }: { data: Data }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 300, L = 44, R = 150, T = 16, B = 34;
  const xs = data.buckets.map((_, i) => L + (i * (W - L - R)) / (data.buckets.length - 1));
  // Every pilot model sits between ~85% and 100%, so a 0-100% axis flattens the differences into
  // one band. A line chart may start above zero; this one starts at 50% while every value is at or
  // above it (and says so under the chart), and falls back to 0% the moment one is not.
  const allAcc = data.models.flatMap(m => m.buckets.filter(b => b.runnable && b.accuracy !== null).map(b => b.accuracy as number));
  const floor = allAcc.length && Math.min(...allAcc) >= 0.5 ? 0.5 : 0;
  const ticks = floor === 0.5 ? [0.5, 0.6, 0.7, 0.8, 0.9, 1] : [0, 0.25, 0.5, 0.75, 1];
  const y = (a: number) => T + ((1 - a) / (1 - floor)) * (H - T - B);
  const series = data.models.map((m, i) => ({
    m, slot: i + 1,
    pts: m.buckets.map((b, j) => (b.runnable && b.accuracy !== null ? { x: xs[j], y: y(b.accuracy), a: b.accuracy, j } : null)),
  }));
  // Direct labels at each line's last point, nudged apart so they never overlap.
  const labels = useMemo(() => {
    // Only series with at least one measured point get a label (unmeasured models have no line).
    const ends = series.filter(s => s.pts.some(Boolean))
      .map(s => { const last = [...s.pts].reverse().find(Boolean)!; return { s, x: last.x, y: last.y }; })
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    return ends;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <figure className="crt-figure">
      <figcaption className="crt-fig-title">Accuracy by context length</figcaption>
      <div className="crt-legend" aria-hidden="true">
        {series.map(s => <span key={s.m.name}><i className={`crt-swatch s${s.slot}`} />{s.m.displayName}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="crt-svg" role="img"
        aria-label="Line chart of each model's accuracy at each context length; the table above lists every value."
        onMouseLeave={() => setHover(null)}>
        {ticks.map(a => (
          <g key={a}>
            <line x1={L} x2={W - R} y1={y(a)} y2={y(a)} className="crt-grid" />
            <text x={L - 8} y={y(a) + 4} className="crt-axis" textAnchor="end">{Math.round(a * 100)}%</text>
          </g>
        ))}
        {xs.map((x, j) => (
          <g key={j}>
            <text x={x} y={H - 10} className="crt-axis" textAnchor="middle">{k(data.buckets[j])}</text>
            <rect x={x - (W - L - R) / (2 * (xs.length - 1))} y={T} width={(W - L - R) / (xs.length - 1)} height={H - T - B}
              fill="transparent" onMouseEnter={() => setHover(j)} />
          </g>
        ))}
        {hover !== null && <line x1={xs[hover]} x2={xs[hover]} y1={T} y2={H - B} className="crt-crosshair" />}
        {series.map(s => {
          const pts = s.pts.filter(Boolean) as Array<{ x: number; y: number; a: number; j: number }>;
          return (
            <g key={s.m.name} className={`crt-series s${s.slot}`}>
              <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} />
              {pts.map(p => <circle key={p.j} cx={p.x} cy={p.y} r={hover === p.j ? 5 : 3.5} />)}
            </g>
          );
        })}
        {labels.map(l => (
          <text key={l.s.m.name} x={l.x + 10} y={l.y + 4} className="crt-endlabel">{l.s.m.displayName}</text>
        ))}
      </svg>
      {floor > 0 && <p className="crt-note">The axis starts at 50%: every model is above it at every length.</p>}
      {hover !== null && (
        <div className="crt-tip" role="status">
          <b>{k(data.buckets[hover])}</b>
          {series.map(s => {
            const b = s.m.buckets[hover];
            return <span key={s.m.name}><i className={`crt-swatch s${s.slot}`} />{s.m.displayName}: {!b.runnable ? 'beyond window' : pct(b.accuracy)}{b.runnable && b.total ? ` (${b.correct}/${b.total})` : ''}</span>;
          })}
        </div>
      )}
    </figure>
  );
}

/** What breaks first: each skill at 8K and at the longest length the model ran. */
function SkillTable({ data }: { data: Data }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table crt-table">
        <caption className="crt-caption">What breaks first — 8K compared with the longest length each model ran</caption>
        <thead><tr><th>Model</th>{SKILLS.map(([, label]) => <th key={label} className="num">{label}</th>)}</tr></thead>
        <tbody>
          {data.models.map(m => {
            const runs = m.buckets.filter(b => b.runnable && b.accuracy !== null);
            const first = runs[0], last = runs[runs.length - 1];
            return (
              <tr key={m.name}>
                <td>{m.displayName}{last ? <span className="crt-sub"> · longest {k(last.bucket)}</span> : null}</td>
                {SKILLS.map(([skill]) => (
                  <td key={skill} className="num">
                    {first && last ? <>{pct(first.skills[skill]?.accuracy)} <span className="crt-arrow">→</span> {pct(last.skills[skill]?.accuracy)}</> : '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Lost in the middle: finding-a-fact accuracy by position (rows) and length (columns). */
function PositionGrids({ data }: { data: Data }) {
  return (
    <figure className="crt-figure">
      <figcaption className="crt-fig-title">Where in the document — finding a fact, by position and length</figcaption>
      <HeatLegend />
      <p className="crt-note">Pooled over the last {Math.max(...data.models.map(m => m.gridSweeps), 1)} weekly run(s); hover a cell for the count.</p>
      <div className="crt-grids">
        {data.models.map(m => (
          <div key={m.name} className="crt-gridbox">
            <div className="crt-gridname">{m.displayName}</div>
            <HeatGrid model={m} buckets={data.buckets} depths={data.depths} />
          </div>
        ))}
      </div>
    </figure>
  );
}
