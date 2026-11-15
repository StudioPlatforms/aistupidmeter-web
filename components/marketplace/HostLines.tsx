'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Customized } from 'recharts';
import '@/styles/marketplace-hostlines.css';

/**
 * The per-host chart (Phase 3 plan §7.6; M9): one open model's hosts over time, from published days only, through the
 * web's public proxy (GET /api/marketplace/open-models/<slug>/series/<suite>/<days>, ≤ 60 s cache, no identity).
 *
 *   - One point per published day, its whole-point mean, joined by a line. A change of task version or host
 *     configuration breaks the line, with a marker. Days without a published mean are never interpolated: a paused
 *     stretch is a shaded gap with no line, and a stretch with no published day is bridged by a dashed line only
 *     (no value is drawn there). Spot checks are never drawn; values are never offset or jittered.
 *   - Colour follows the host (its chart slot, kept while the listing exists), never its rank: six validated colours
 *     per theme (light on #ffffff, dark on #292a2d), green and red left out (status colours). A host without a slot (the
 *     7th and later) is a thin grey "Other hosts" line; the picker compares up to 6.
 *   - Overlap: direct labels at the line ends in text ink with the host's marker, pushed at least 14 px apart with
 *     leader lines; hosts statistically tied at the end (|Δ| ≤ 1.96·√(se₁² + se₂²)) share one label; one marker shape per
 *     slot with a 2 px surface ring; a crosshair tooltip listing every host that day, sorted, equal values grouped;
 *     legend chips that highlight one host (the others fade to 25 %, its ±1.96·SE band shown) or hide it; a Table view
 *     with the same numbers. The SE is the host's published one (its page's headline, sent as `se`): no day carries
 *     its own, which would let a reader recover single runs' scores.
 *   - The vendor's own line ("Official API", dashed grey) only when the API sends one (the comparable-fleet gate; M10,
 *     design D-A4: on the drawn hosts' task versions, within their days, broken where the fleet's configuration changed).
 */

type Suite = 'combined' | 'coding' | 'reasoning' | 'tooling' | 'canary';
interface Point { day: string; mean: number; runs: number }
interface HostSeries {
  publicId: string; label: string; slot: number | null; status: string; se: number | null;
  daily: Point[]; breaks: Array<{ day: string; kind: 'spec' | 'host_config' }>; gaps: Array<{ from: string; to: string; reason: 'paused' | 'no_data' }>; end: Point | null;
}
export interface SeriesDTO {
  openModel: { slug: string; name: string }; suite: Suite; days: number; from: string; to: string;
  /** M10 (D-A4): `breaks`, the days the fleet's configuration changed; the dashed line starts again there. */
  hosts: HostSeries[]; vendorLine: { label: string; daily: Array<{ day: string; mean: number; runs: number }>; breaks?: Array<{ day: string; kind: string }> } | null;
  comparable: boolean; reason: string | null;
}

const SUITE_LABEL: Record<Suite, string> = { combined: 'Combined', coding: 'Coding', reasoning: 'Reasoning', tooling: 'Tool use', canary: 'Hourly probe' };
const DAYS = [7, 30, 90] as const;
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'ring'] as const;
const DAY_MS = 86_400_000;
const MAX_COMPARE = 6;
const LABEL_GAP = 14;
const TIE_Z = 1.96;

const tOf = (day: string) => Date.parse(`${day}T00:00:00.000Z`);
const dayLabel = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const colourOf = (slot: number | null) => (slot && slot >= 1 && slot <= 6 ? `var(--hl-${slot})` : 'var(--hl-other)');

/** One slot's marker: circle, square, triangle, diamond, cross, ring (slot 1-6), with a 2 px ring in the surface colour. */
export function Marker({ x, y, slot, r = 4, faded = false }: { x: number; y: number; slot: number | null; r?: number; faded?: boolean }) {
  const shape = slot && slot >= 1 && slot <= 6 ? SHAPES[slot - 1] : 'circle';
  const fill = colourOf(slot);
  const common = { stroke: 'var(--hl-surface)', strokeWidth: 2, opacity: faded ? 0.25 : 1, paintOrder: 'stroke' as const };
  switch (shape) {
    case 'square': return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={fill} {...common} />;
    case 'triangle': return <path d={`M${x} ${y - r * 1.2}L${x + r * 1.1} ${y + r * 0.8}L${x - r * 1.1} ${y + r * 0.8}Z`} fill={fill} {...common} />;
    case 'diamond': return <path d={`M${x} ${y - r * 1.25}L${x + r * 1.25} ${y}L${x} ${y + r * 1.25}L${x - r * 1.25} ${y}Z`} fill={fill} {...common} />;
    case 'cross': return (
      <g opacity={faded ? 0.25 : 1}>
        <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} stroke="var(--hl-surface)" strokeWidth={5} strokeLinecap="round" />
        <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} stroke={fill} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
    case 'ring': return (
      <g opacity={faded ? 0.25 : 1}>
        <circle cx={x} cy={y} r={r + 1} fill="none" stroke="var(--hl-surface)" strokeWidth={4.5} />
        <circle cx={x} cy={y} r={r} fill="none" stroke={fill} strokeWidth={2.2} />
      </g>
    );
    default: return <circle cx={x} cy={y} r={r} fill={fill} {...common} />;
  }
}

/** The legend's marker as a small inline SVG. */
function Swatch({ slot }: { slot: number | null }) {
  return <svg className="mp-hl-swatch" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><Marker x={7} y={7} slot={slot} r={3.6} /></svg>;
}

/** Segments of one host's line: split at breaks and gaps; `bridges` are the dashed spans over days with no published mean. */
export function segmentsOf(h: HostSeries): { segments: Point[][]; bridges: Array<[Point, Point]>; shaded: Array<{ from: string; to: string }>; breakDays: Array<{ day: string; kind: string }> } {
  const pts = [...h.daily].sort((a, b) => (a.day < b.day ? -1 : 1));
  const breakAt = new Map(h.breaks.map(b => [b.day, b.kind]));
  const segments: Point[][] = []; const bridges: Array<[Point, Point]> = [];
  let cur: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; const prev = pts[i - 1];
    if (prev) {
      const consecutive = tOf(p.day) - tOf(prev.day) === DAY_MS;
      const broken = breakAt.has(p.day);
      if (!consecutive || broken) {
        if (cur.length) segments.push(cur);
        cur = [];
        if (!consecutive && !broken) {
          // A stretch without a published day: bridged (dashed) unless the host was paused then (a shaded gap, no line).
          const gap = h.gaps.find(g => g.from > prev.day && g.to < p.day);
          if (!gap || gap.reason !== 'paused') bridges.push([prev, p]);
        }
      }
    }
    cur.push(p);
  }
  if (cur.length) segments.push(cur);
  return { segments, bridges, shaded: h.gaps.filter(g => g.reason === 'paused').map(g => ({ from: g.from, to: g.to })), breakDays: h.breaks };
}

/** Direct labels at the line ends (§7.6 Overlap 1-2): tied hosts share one, then labels are pushed ≥ 14 px apart. */
export function endLabels(ends: Array<{ key: string; label: string; slot: number | null; y: number; mean: number; se: number | null }>, top: number, bottom: number): Array<{ text: string; slot: number | null; y: number; anchors: number[] }> {
  const sorted = [...ends].sort((a, b) => b.mean - a.mean);
  const groups: Array<typeof sorted> = [];
  for (const e of sorted) {
    const g = groups.find(gr => gr.every(x => x.se !== null && e.se !== null && Math.abs(x.mean - e.mean) <= TIE_Z * Math.sqrt(x.se ** 2 + (e.se as number) ** 2)));
    if (g) g.push(e); else groups.push([e]);
  }
  const labels = groups.map(g => ({
    text: g.length > 1 ? `${g.map(x => x.label).join(' · ')} (tied)` : g[0].label,
    slot: g[0].slot, y: g.reduce((a, x) => a + x.y, 0) / g.length, anchors: g.map(x => x.y),
  })).sort((a, b) => a.y - b.y);
  // Push apart: down from the top, then back up from the bottom, so no two are closer than LABEL_GAP.
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < LABEL_GAP) labels[i].y = labels[i - 1].y + LABEL_GAP;
  if (labels.length && labels[labels.length - 1].y > bottom) {
    labels[labels.length - 1].y = bottom;
    for (let i = labels.length - 2; i >= 0; i--) if (labels[i + 1].y - labels[i].y < LABEL_GAP) labels[i].y = labels[i + 1].y - LABEL_GAP;
  }
  if (labels.length && labels[0].y < top) {
    labels[0].y = top;
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < LABEL_GAP) labels[i].y = labels[i - 1].y + LABEL_GAP;
  }
  return labels;
}

interface Drawn { key: string; host: HostSeries; slot: number | null; other: boolean }

/** The visible layer, drawn with the chart's own scales (recharts Customized). */
function HostLayer(props: any) {
  const { xAxisMap, yAxisMap, offset, drawn, vendor, focus, labelsWidth } = props as {
    xAxisMap: Record<string, { scale: (v: number) => number }>; yAxisMap: Record<string, { scale: (v: number) => number }>;
    offset: { left: number; top: number; width: number; height: number }; drawn: Drawn[]; vendor: SeriesDTO['vendorLine']; focus: string | null; labelsWidth: number;
  };
  const xa = xAxisMap && Object.values(xAxisMap)[0]; const ya = yAxisMap && Object.values(yAxisMap)[0];
  if (!xa || !ya || !offset) return null;
  const X = (day: string) => xa.scale(tOf(day)); const Y = (v: number) => ya.scale(v);
  const top = offset.top; const bottom = offset.top + offset.height; const right = offset.left + offset.width;
  const halfDay = Math.max(1, (xa.scale(tOf('2026-01-02')) - xa.scale(tOf('2026-01-01'))) / 2);
  const path = (pts: Array<{ day: string; mean: number }>) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)} ${Y(p.mean).toFixed(1)}`).join('');
  const ends: Array<{ key: string; label: string; slot: number | null; y: number; mean: number; se: number | null }> = [];
  const focused = drawn.find(d => d.key === focus) || null;
  return (
    <g className="mp-hl-layer">
      {/* Paused stretches: shaded, per host (light tint of its colour), never a line. */}
      {drawn.map(d => segmentsOf(d.host).shaded.map(g => (
        <rect key={`gap-${d.key}-${g.from}`} className="mp-hl-gap" x={X(g.from) - halfDay} y={top} width={Math.max(2, X(g.to) - X(g.from) + 2 * halfDay)} height={bottom - top}
          fill={colourOf(d.slot)} opacity={focus && focus !== d.key ? 0.03 : 0.09}><title>{`${d.host.label}: measurement paused ${g.from === g.to ? g.from : `${g.from} to ${g.to}`}`}</title></rect>
      )))}
      {/* The focused host's ±1.96·SE band over its published days. */}
      {focused && typeof focused.host.se === 'number' && segmentsOf(focused.host).segments.map((seg, i) => {
        const se = focused.host.se as number;
        const up = seg.map(p => ({ day: p.day, mean: Math.min(100, p.mean + TIE_Z * se) }));
        const lo = [...seg].reverse().map(p => ({ day: p.day, mean: Math.max(0, p.mean - TIE_Z * se) }));
        return <path key={`band-${i}`} className="mp-hl-band" d={`${path(up)}${lo.map(p => `L${X(p.day).toFixed(1)} ${Y(p.mean).toFixed(1)}`).join('')}Z`} fill={colourOf(focused.slot)} opacity={0.16} />;
      })}
      {vendor && vendor.daily.length > 0 && (
        <g className="mp-hl-vendor" opacity={focus ? 0.4 : 1}>
          <path d={vendor.daily.map((p, i) => `${i === 0 || (vendor.breaks ?? []).some(b => b.day === p.day) ? 'M' : 'L'}${X(p.day).toFixed(1)} ${Y(p.mean).toFixed(1)}`).join('')}
            fill="none" stroke="var(--hl-vendor)" strokeWidth={1.8} strokeDasharray="5 4" />
          {/* M10 (D-A4): the hosts' break marker, where the official API's configuration changed. */}
          {(vendor.breaks ?? []).map(b => (
            <g key={`vbrk-${b.day}`} className="mp-hl-break" data-kind="vendor">
              <line x1={X(b.day) - halfDay} x2={X(b.day) - halfDay} y1={top} y2={bottom} stroke="var(--hl-ink3)" strokeWidth={1} strokeDasharray="2 3" />
              <path d={`M${X(b.day) - halfDay - 4} ${top + 2}h8l-4 6z`} fill="var(--hl-ink3)"><title>{`${vendor.label}: configuration changed on ${b.day}`}</title></path>
            </g>
          ))}
        </g>
      )}
      {drawn.map(d => {
        const { segments, bridges, breakDays } = segmentsOf(d.host);
        const faded = !!focus && focus !== d.key;
        const w = d.other ? 1.2 : 2.2;
        return (
          <g key={`line-${d.key}`} className={`mp-hl-host${d.other ? ' is-other' : ''}`} opacity={faded ? 0.25 : 1} data-host={d.host.publicId}>
            {bridges.map(([a, b], i) => <path key={`br-${i}`} className="mp-hl-bridge" d={path([a, b])} fill="none" stroke={colourOf(d.slot)} strokeWidth={w} strokeDasharray="3 4" />)}
            {segments.map((seg, i) => <path key={`seg-${i}`} className="mp-hl-seg" d={path(seg)} fill="none" stroke={colourOf(d.slot)} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />)}
            {breakDays.map(b => (
              <g key={`brk-${b.day}-${b.kind}`} className="mp-hl-break" data-kind={b.kind}>
                <line x1={X(b.day) - halfDay} x2={X(b.day) - halfDay} y1={top} y2={bottom} stroke="var(--hl-ink3)" strokeWidth={1} strokeDasharray="2 3" />
                <path d={`M${X(b.day) - halfDay - 4} ${top + 2}h8l-4 6z`} fill="var(--hl-ink3)"><title>{b.kind === 'spec' ? `Task version changed on ${b.day}` : `Host configuration changed on ${b.day}`}</title></path>
              </g>
            ))}
            {!d.other && d.host.daily.map(p => <Marker key={`m-${p.day}`} x={X(p.day)} y={Y(p.mean)} slot={d.slot} r={d.host.daily.length > 40 ? 2.6 : 3.6} />)}
          </g>
        );
      })}
      {(() => {
        for (const d of drawn) if (!d.other && d.host.end) ends.push({ key: d.key, label: d.host.label, slot: d.slot, y: Y(d.host.end.mean), mean: d.host.end.mean, se: typeof d.host.se === 'number' ? d.host.se : null });
        if (vendor && vendor.daily.length) { const v = vendor.daily[vendor.daily.length - 1]; ends.push({ key: 'vendor', label: vendor.label, slot: null, y: Y(v.mean), mean: v.mean, se: null }); }
        const labels = endLabels(ends, top + 6, bottom - 4);
        const lx = right + 10;
        return (
          <g className="mp-hl-labels">
            {labels.map((l, i) => (
              <g key={`lab-${i}`} className="mp-hl-label">
                {l.anchors.map((a, j) => <path key={j} d={`M${right + 2} ${a.toFixed(1)}L${lx - 2} ${l.y.toFixed(1)}`} stroke="var(--hl-ink3)" strokeWidth={0.8} fill="none" />)}
                <Marker x={lx + 5} y={l.y} slot={l.slot} r={3.4} />
                <text x={lx + 14} y={l.y} dy="0.35em" className="mp-hl-label-t" fill="var(--hl-ink)">{truncate(l.text, Math.max(8, Math.floor((labelsWidth - 26) / 6.2)))}<title>{l.text}</title></text>
              </g>
            ))}
          </g>
        );
      })()}
    </g>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}

/** The crosshair tooltip: every host that day, sorted, equal values grouped ("A, B: 91"). */
function DayTooltip({ active, label, rows, drawn, vendor }: { active?: boolean; label?: number; rows: Array<Record<string, number | null | string>>; drawn: Drawn[]; vendor: SeriesDTO['vendorLine'] }) {
  if (!active || typeof label !== 'number') return null;
  const day = new Date(label).toISOString().slice(0, 10);
  const vals: Array<{ name: string; mean: number; runs: number }> = [];
  for (const d of drawn) {
    const p = d.host.daily.find(x => x.day === day);
    if (p) vals.push({ name: d.host.label, mean: p.mean, runs: p.runs });
  }
  const v = vendor?.daily.find(x => x.day === day);
  if (!vals.length && !v) return null;
  const groups = new Map<number, Array<{ name: string; runs: number }>>();
  for (const x of vals.sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name))) {
    const g = groups.get(x.mean) ?? []; g.push({ name: x.name, runs: x.runs }); groups.set(x.mean, g);
  }
  void rows;
  return (
    <div className="mp-hl-tip" role="status">
      <div className="mp-hl-tip-d">{dayLabel(label)}</div>
      {Array.from(groups.entries()).map(([mean, g]) => (
        <div key={mean} className="mp-hl-tip-r"><b>{g.map(x => x.name).join(', ')}: {mean}</b> <small>{g.map(x => `${x.runs} run${x.runs === 1 ? '' : 's'}`).join(', ')}</small></div>
      ))}
      {v && <div className="mp-hl-tip-r is-vendor"><b>{vendor?.label}: {v.mean}</b> <small>{v.runs} run{v.runs === 1 ? '' : 's'}</small></div>}
    </div>
  );
}

export default function HostLines({ slug, suites = ['combined', 'coding', 'reasoning', 'tooling', 'canary'], initialSuite, title = 'Each host over time' }: {
  slug: string; suites?: Suite[]; initialSuite?: Suite; title?: string;
}) {
  const [suite, setSuite] = useState<Suite>(initialSuite && suites.includes(initialSuite) ? initialSuite : suites[0]);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<SeriesDTO | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [table, setTable] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setState('loading');
    fetch(`/api/marketplace/open-models/${encodeURIComponent(slug)}/series/${suite}/${days}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (mine !== seq.current) return;
        const d = j && j.success && j.data ? (j.data as SeriesDTO) : null;
        setData(d);
        setState(!d ? 'error' : d.hosts.length ? 'ok' : 'empty');
      })
      .catch(() => { if (mine === seq.current) setState('error'); });
  }, [slug, suite, days]);

  const hosts = data?.hosts ?? [];
  // Up to 6 compared: the hosts with a slot by default; more than 6 hosts -> the picker.
  const compare = useMemo(() => {
    if (picked) return picked;
    return new Set(hosts.filter(h => h.slot !== null).slice(0, MAX_COMPARE).map(h => h.publicId).concat(hosts.filter(h => h.slot === null).map(h => h.publicId)));
  }, [hosts, picked]);
  const drawn: Drawn[] = useMemo(() => hosts
    .filter(h => compare.has(h.publicId) && !hidden.has(h.publicId))
    .map(h => ({ key: h.publicId, host: h, slot: h.slot, other: h.slot === null })), [hosts, compare, hidden]);
  const rows = useMemo(() => {
    if (!data) return [] as Array<Record<string, number | null | string>>;
    const out: Array<Record<string, number | null | string>> = [];
    for (let t = tOf(data.from); t <= tOf(data.to); t += DAY_MS) {
      const day = new Date(t).toISOString().slice(0, 10);
      const r: Record<string, number | null | string> = { t, day };
      for (const h of hosts) r[h.publicId] = h.daily.find(p => p.day === day)?.mean ?? null;
      r.vendor = data.vendorLine?.daily.find(p => p.day === day)?.mean ?? null;
      out.push(r);
    }
    return out;
  }, [data, hosts]);

  const [box, setBox] = useState(0);
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setBox(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(es => { for (const e of es) setBox(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);
  const labelsWidth = Math.round(Math.max(96, Math.min(170, box * 0.3)));
  const toggleHide = (id: string) => setHidden(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePick = (id: string) => setPicked(prev => {
    const n = new Set(prev ?? compare);
    if (n.has(id)) n.delete(id); else if (n.size < MAX_COMPARE) n.add(id);
    return n;
  });

  return (
    <section className="mp-hl" aria-label={title}>
      <div className="mp-hl-head">
        <h3 className="mp-hl-title">{title}</h3>
        <div className="mp-hl-controls">
          {suites.length > 1 && (
            <label className="mp-hl-select"><span>Suite</span>
              <select value={suite} onChange={e => { setSuite(e.target.value as Suite); setFocus(null); }}>
                {suites.map(s => <option key={s} value={s}>{SUITE_LABEL[s]}</option>)}
              </select>
            </label>
          )}
          <div className="mp-hl-seg" role="group" aria-label="Period">
            {DAYS.map(d => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}
          </div>
          <button type="button" className="mp-hl-tablebtn" aria-pressed={table} onClick={() => setTable(t => !t)}>{table ? 'Chart' : 'Table'}</button>
        </div>
      </div>
      {state === 'loading' && <p className="mp-hl-note">Loading the published daily means…</p>}
      {state === 'error' && <p className="mp-hl-note">The chart could not be loaded.</p>}
      {state === 'empty' && <p className="mp-hl-note">{data && !data.comparable ? 'Measurements for each host are on its page.' : 'No published day in this period yet: each day\'s mean appears one to two days after the day ends.'}</p>}
      {state === 'ok' && data && (
        <>
          {hosts.length > MAX_COMPARE && (
            <details className="mp-hl-picker">
              <summary>Compare up to {MAX_COMPARE} of {hosts.length} hosts</summary>
              <ul>
                {hosts.map(h => (
                  <li key={h.publicId}><label><input type="checkbox" checked={compare.has(h.publicId)} onChange={() => togglePick(h.publicId)}
                    disabled={!compare.has(h.publicId) && compare.size >= MAX_COMPARE} /> <Swatch slot={h.slot} /> {h.label}{h.slot === null ? ' (other hosts, grey)' : ''}</label></li>
                ))}
              </ul>
            </details>
          )}
          <ul className="mp-hl-legend" aria-label="Hosts">
            {hosts.filter(h => compare.has(h.publicId)).map(h => (
              <li key={h.publicId} className={`mp-hl-chip${hidden.has(h.publicId) ? ' is-hidden' : ''}${focus === h.publicId ? ' is-on' : ''}`}>
                <button type="button" className="mp-hl-chip-b" aria-pressed={focus === h.publicId} onClick={() => setFocus(f => (f === h.publicId ? null : h.publicId))}
                  title={`Highlight ${h.label} and show its ±1.96·SE band`}>
                  <Swatch slot={h.slot} /><span>{h.label}</span>{h.status !== 'normal' && <small>paused</small>}
                </button>
                <button type="button" className="mp-hl-chip-x" aria-pressed={hidden.has(h.publicId)} aria-label={`${hidden.has(h.publicId) ? 'Show' : 'Hide'} ${h.label}`} onClick={() => toggleHide(h.publicId)}>
                  {hidden.has(h.publicId) ? '+' : '×'}
                </button>
              </li>
            ))}
            {data.vendorLine && <li className="mp-hl-chip is-vendor"><span className="mp-hl-chip-b"><svg width="18" height="8" aria-hidden="true"><path d="M0 4H18" stroke="var(--hl-vendor)" strokeWidth="2" strokeDasharray="5 3" /></svg><span>{data.vendorLine.label}</span></span></li>}
          </ul>
          {table ? (
            <div className="mp-hl-tablewrap">
              <table className="mp-hl-table">
                <caption>{SUITE_LABEL[data.suite]}: published daily means (whole points), last {data.days} days</caption>
                <thead><tr><th scope="col">Day</th>{hosts.filter(h => compare.has(h.publicId) && !hidden.has(h.publicId)).map(h => <th key={h.publicId} scope="col">{h.label}</th>)}{data.vendorLine && <th scope="col">{data.vendorLine.label}</th>}</tr></thead>
                <tbody>
                  {[...rows].reverse().filter(r => hosts.some(h => r[h.publicId] !== null) || r.vendor !== null).map(r => (
                    <tr key={String(r.day)}>
                      <th scope="row">{dayLabel(Number(r.t))}</th>
                      {hosts.filter(h => compare.has(h.publicId) && !hidden.has(h.publicId)).map(h => {
                        const p = h.daily.find(x => x.day === r.day);
                        const gap = h.gaps.find(g => g.from <= String(r.day) && g.to >= String(r.day));
                        return <td key={h.publicId}>{p ? <>{p.mean} <small>{p.runs} run{p.runs === 1 ? '' : 's'}</small></> : gap?.reason === 'paused' ? <small>paused</small> : '—'}</td>;
                      })}
                      {data.vendorLine && <td>{r.vendor ?? '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mp-hl-chart" ref={wrap}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={rows} margin={{ top: 12, right: labelsWidth, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--hl-line)" vertical={false} />
                  <XAxis dataKey="t" type="number" scale="time" domain={[tOf(data.from), tOf(data.to)]} tickFormatter={dayLabel} tick={{ fill: 'var(--hl-ink3)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--hl-line2)' }} tickLine={false} minTickGap={24} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={32} tick={{ fill: 'var(--hl-ink3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  {hosts.map(h => <Line key={h.publicId} dataKey={h.publicId} stroke="none" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />)}
                  <Tooltip content={<DayTooltip rows={rows} drawn={drawn} vendor={data.vendorLine} />} cursor={{ stroke: 'var(--hl-line2)', strokeWidth: 1 }} wrapperStyle={{ outline: 'none' }} />
                  <Customized component={<HostLayer drawn={drawn} vendor={data.vendorLine} focus={focus} labelsWidth={labelsWidth} />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mp-hl-note">
            One point per published day: each day&apos;s mean in whole points, one to two days after the day ends. A dashed stretch has no published day;
            a shaded stretch is a pause; a marker on the top edge is a change of task version or host configuration.
          </p>
        </>
      )}
    </section>
  );
}
