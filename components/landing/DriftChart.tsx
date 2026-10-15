'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { onView, useReducedMotion } from './util';

/**
 * An ILLUSTRATION of how a sustained drop is flagged: a seeded 30-day series that falls about six
 * points on day 21, and the Page-Hinkley statistic computed on it with the production constants
 * (lib/page-hinkley.ts: delta 0.01, lambda 0.30, on scores / 100). The flag lands several days after
 * the change, as it does in production on daily medians — never "within hours".
 */
const N = 30;
const CHANGE = 21;
const DELTA = 0.01;
const LAMBDA = 0.3;

function series() {
  let s = 20261014;
  const r01 = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const gauss = () => { let t = 0; for (let i = 0; i < 6; i++) t += r01(); return (t - 3) / Math.sqrt(0.5); };
  const xs = Array.from({ length: N }, (_, i) => +((i < CHANGE ? 88.3 : 82.2) + gauss() * 0.75).toFixed(1));
  let mean = 0, m = 0, mMin = 0, flag = N - 1, found = false;
  const ph = xs.map((x, i) => {
    const v = x / 100;
    mean += (v - mean) / (i + 1);
    m += mean - v - DELTA;
    mMin = Math.min(mMin, m);
    const st = m - mMin;
    if (!found && st >= LAMBDA) { flag = i; found = true; }
    return st;
  });
  const base = xs.slice(0, CHANGE);
  const bm = base.reduce((a, b) => a + b, 0) / base.length;
  const bsd = Math.sqrt(base.reduce((a, b) => a + (b - bm) ** 2, 0) / base.length);
  const after = xs.slice(CHANGE);
  const drop = bm - after.reduce((a, b) => a + b, 0) / after.length;
  return { xs, ph, flag, bm, bsd, drop };
}

export default function DriftChart({ onDrawn }: { onDrawn?: () => void }) {
  const reduced = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const phRef = useRef<SVGPathElement>(null);
  const [w, setW] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const data = useMemo(series, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const hasWidth = w > 0;
  useEffect(() => onView(host.current, () => {
    const paths = [line.current, phRef.current].filter((p): p is SVGPathElement => !!p);
    const done = () => {
      // Drop the dash styles so a later resize redraws a whole line.
      for (const p of paths) { p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }
      setDrawn(true);
      onDrawn?.();
    };
    if (reduced || paths.length < 2) return done();
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect();
      p.style.transition = i === 0 ? 'stroke-dashoffset 1.8s cubic-bezier(.4,0,.2,1)' : 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1) 1.1s';
      p.style.strokeDashoffset = '0';
    });
    setTimeout(done, 2500);
  }, 0.35), [reduced, onDrawn, hasWidth]);

  const W = Math.max(280, w);
  const small = W < 560;
  const H = small ? 300 : 380;
  const L = small ? 30 : 42, R = small ? 8 : 16, T = 18;
  const topH = Math.round(H * 0.58), gap = 34, botT = T + topH + gap, botH = H - botT - 26;
  const X = (i: number) => L + (i / (N - 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - 78) / (92 - 78)) * topH;
  const P = (v: number) => botT + (1 - Math.min(v, 0.5) / 0.5) * botH;
  const { xs, ph, flag, bm, bsd, drop } = data;
  const path = xs.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const phPath = ph.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${P(v).toFixed(1)}`).join(' ');
  const fx = X(flag);
  const label = `Flagged · −${drop.toFixed(1)} pts vs own baseline`;
  const tw = label.length * 6.3 + 20;
  const tx = Math.min(Math.max(fx - tw / 2, L), W - R - tw);
  const day = (i: number) => {
    const d = new Date();
    d.setDate(d.getDate() - (N - 1 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`lp-chart-svg${drawn ? ' is-done' : ''}`} ref={host}>
      {w > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img"
          aria-label="Illustration: a reasoning score drops by about six points; the change-point statistic crosses its threshold several days later and the model is flagged.">
          {[80, 85, 90].map(v => (
            <g key={v}>
              <line className="lp-c-grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
              <text className="lp-c-axis" x={L - 8} y={Y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          <rect className="lp-c-band" x={L} y={Y(bm + 2 * bsd)} width={W - L - R} height={Y(bm - 2 * bsd) - Y(bm + 2 * bsd)} />
          <path className="lp-c-line" ref={line} d={path} />
          <text className="lp-c-axis" x={L} y={botT - 10}>Page-Hinkley statistic</text>
          <line className="lp-c-grid" x1={L} x2={W - R} y1={P(0)} y2={P(0)} />
          <line className="lp-c-thr" x1={L} x2={W - R} y1={P(LAMBDA)} y2={P(LAMBDA)} />
          <text className="lp-c-axis" x={L + 150} y={P(LAMBDA) - 6}>threshold λ 0.30</text>
          <path className="lp-c-pha" d={`${phPath} L${X(N - 1)},${P(0)} L${X(0)},${P(0)} Z`} />
          <path className="lp-c-ph" ref={phRef} d={phPath} />
          <g className="lp-c-late">
            <line className="lp-c-flag" x1={fx} x2={fx} y1={T} y2={P(0)} />
            <circle className="lp-c-dot" cx={fx} cy={P(ph[flag])} r={4.5} />
            <circle className="lp-c-dot" cx={fx} cy={Y(xs[flag])} r={4.5} />
            <g className="lp-c-tag">
              <rect x={tx} y={T - 2} width={tw} height={24} rx={12} />
              <text x={tx + tw / 2} y={T + 14} textAnchor="middle">{label}</text>
            </g>
          </g>
          {[0, 7, 14, 21, 29].map(i => (
            <text key={i} className="lp-c-axis" x={X(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}>{day(i)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}
