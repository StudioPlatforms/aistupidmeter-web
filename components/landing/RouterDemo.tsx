'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import RankList from './RankList';
import { metricKind, RANKS_ON, type LandingStrategy } from './types';
import { scoreLabel, useReducedMotion } from './util';

export interface DemoScenario { id: string; q: string; meta: string; snap: LandingStrategy }
type Card = { key: number; s: DemoScenario; done: boolean };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function strategyText(s: LandingStrategy): string {
  return s.taskRule ? `match_task → ${s.effectiveStrategy}` : s.effectiveStrategy;
}
function latency(ms: number | null): string {
  return ms == null ? '' : ` · ${(ms / 1000).toFixed(1)} s`;
}
/** A model the pipeline ranked above its pick but passed over, if any. */
function passedOver(s: LandingStrategy): { cls: string; text: string } | null {
  const idx = s.rows.findIndex(r => r.role === 'primary');
  const r = s.rows.slice(0, Math.max(idx, 0)).find(x => x.tag === 'drift' || x.tag === 'outage');
  if (!r) return null;
  return r.tag === 'outage'
    ? { cls: 'lp-x', text: `${r.displayName} — provider outage` }
    : { cls: 'lp-p', text: `${r.displayName} — drift flagged` };
}

interface RouterDemoProps {
  scenarios: DemoScenario[];
  modelCount: number;
  /** Header wording; the app's own pages say whose router this is. */
  title?: string;
  titleSub?: string;
  note?: string;
}

export default function RouterDemo({
  scenarios, modelCount,
  title = 'Smart Router', titleSub = '· live routing decisions',
  note = 'Example requests · live router picks',
}: RouterDemoProps) {
  const reduced = useReducedMotion();
  const [cards, setCards] = useState<Card[]>([{ key: 0, s: scenarios[0], done: true }]);
  const [cur, setCur] = useState<DemoScenario>(scenarios[0]);
  const [shown, setShown] = useState<DemoScenario>(scenarios[0]);
  const [stage, setStage] = useState(5);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [jsReady, setJsReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const queueRef = useRef<HTMLOListElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wInRef = useRef<SVGPathElement>(null);
  const wOutRef = useRef<Array<SVGPathElement | null>>([]);
  const pkRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const winIndex = (s: DemoScenario) => Math.max(0, s.snap.rows.findIndex(r => r.role === 'primary'));

  const layoutWires = useCallback(() => {
    const body = bodyRef.current, svg = svgRef.current, node = nodeRef.current;
    const list = listRef.current?.firstElementChild as HTMLElement | null;
    if (!body || !svg || !node || !list) return;
    const b = body.getBoundingClientRect();
    if (!b.width) return;
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    const rel = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, cx: (r.left + r.right) / 2 - b.left, cy: (r.top + r.bottom) / 2 - b.top };
    };
    const curveH = (x1: number, y1: number, x2: number, y2: number) => { const dx = Math.max(28, (x2 - x1) * 0.5); return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`; };
    const curveV = (x1: number, y1: number, x2: number, y2: number) => { const dy = Math.max(14, (y2 - y1) * 0.55); return `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`; };
    const n = rel(node), L = rel(list);
    const h = parseFloat(getComputedStyle(list).getPropertyValue('--rh')) || 52;
    const card = queueRef.current?.firstElementChild;
    if (card && wInRef.current) {
      const c = rel(card);
      wInRef.current.setAttribute('d', n.l >= c.r - 2 ? curveH(c.r, c.cy, n.l + 4, n.cy) : curveV(c.cx, c.b, n.cx, n.t));
    }
    const horiz = L.l >= n.r - 2;
    const win = winIndex(shownRef.current);
    wOutRef.current.forEach((p, i) => {
      if (!p) return;
      const y = L.t + i * h + (h - 7) / 2;
      if (horiz) p.setAttribute('d', curveH(n.r - 4, n.cy, L.l, y));
      else if (L.t > n.b && i === win) p.setAttribute('d', curveV(n.cx, n.b, L.l + 46, L.t + i * h));
      else p.setAttribute('d', '');
    });
  }, []);

  useLayoutEffect(() => { layoutWires(); }, [cards, shown, layoutWires]);
  useEffect(() => {
    setJsReady(true);
    const ro = new ResizeObserver(() => layoutWires());
    if (bodyRef.current) ro.observe(bodyRef.current);
    const io = new IntersectionObserver(es => { visibleRef.current = es[0].isIntersecting; }, { threshold: 0.05 });
    if (rootRef.current) io.observe(rootRef.current);
    return () => { ro.disconnect(); io.disconnect(); };
  }, [layoutWires]);

  const travel = useCallback((path: SVGPathElement | null | undefined, dur: number) => new Promise<void>(resolve => {
    const pk = pkRef.current, halo = haloRef.current;
    if (!path || !pk || !halo || !path.getAttribute('d')) return resolve();
    const len = path.getTotalLength();
    const t0 = performance.now();
    path.classList.add('is-hot');
    pk.style.opacity = '1';
    halo.style.opacity = '.35';
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const pt = path.getPointAtLength(len * easeIO(p));
      pk.setAttribute('cx', String(pt.x)); pk.setAttribute('cy', String(pt.y));
      halo.setAttribute('cx', String(pt.x)); halo.setAttribute('cy', String(pt.y));
      if (p < 1) requestAnimationFrame(frame);
      else { pk.style.opacity = '0'; halo.style.opacity = '0'; path.classList.remove('is-hot'); resolve(); }
    };
    requestAnimationFrame(frame);
  }), []);

  useEffect(() => {
    if (reduced || scenarios.length < 2) return;
    let alive = true;
    let key = 1;
    const gate = async () => {
      while (alive && (pausedRef.current || !visibleRef.current || document.hidden)) await sleep(200);
    };
    (async () => {
      await sleep(1800);
      for (let i = 1; alive; i++) {
        const s = scenarios[i % scenarios.length];
        await gate();
        if (!alive) return;
        setCards(prev => [{ key: key++, s, done: false }, ...prev].slice(0, 5));
        setCur(s);
        setStage(0);
        await sleep(520);
        if (!alive) return;
        layoutWires();
        await travel(wInRef.current, 700);
        setBusy(true);
        setStage(1); await sleep(170);
        setStage(2); setShown(s); await sleep(260);
        setStage(3); await sleep(560);
        setStage(4); await sleep(320);
        setBusy(false);
        layoutWires();
        await travel(wOutRef.current[winIndex(s)], 760);
        setStage(5);
        setCards(prev => prev.map((c, j) => (j === 0 ? { ...c, done: true } : c)));
        await sleep(2700);
      }
    })();
    return () => { alive = false; };
  }, [reduced, scenarios, layoutWires, travel]);

  const step = () => {
    const i = (scenarios.indexOf(cur) + 1) % scenarios.length;
    const s = scenarios[i];
    setCur(s); setShown(s); setStage(5);
    setCards(prev => [{ key: Date.now(), s, done: true }, ...prev].slice(0, 5));
  };
  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const po = passedOver(cur.snap);
  const p = cur.snap.primary;
  const kind = metricKind(shown.snap.effectiveStrategy);

  return (
    <div className="lp-rv" ref={rootRef} role="region" aria-label="Smart Router routing demo">
      <div className="lp-rv-head">
        <div className="lp-rv-title"><i />{title} <span>{titleSub}</span></div>
        <div className="lp-rv-tools">
          <span className="lp-rv-note">{note}</span>
          {jsReady && (reduced
            ? <button type="button" className="lp-rv-btn" onClick={step}>Next example</button>
            : <button type="button" className="lp-rv-btn" aria-pressed={paused} onClick={togglePause}>{paused ? 'Play' : 'Pause'}</button>)}
        </div>
      </div>
      <div className="lp-rv-body" ref={bodyRef}>
        <svg className="lp-wires" ref={svgRef} aria-hidden="true">
          <path className="lp-wire" ref={wInRef} />
          {shown.snap.rows.map((_, i) => (
            <path key={i} className="lp-wire" ref={el => { wOutRef.current[i] = el; }} />
          ))}
          <circle className="lp-pk-halo" ref={haloRef} r={8} />
          <circle className="lp-pk" ref={pkRef} r={4.5} />
        </svg>
        <div className="lp-rv-col lp-rv-req">
          <div className="lp-rv-label"><span>Incoming requests</span></div>
          <ol className="lp-queue" ref={queueRef}>
            {cards.map((c, j) => (
              <li key={c.key} className={`lp-rq${j === 0 && !c.done ? ' is-active' : ''}${j > 0 ? ' is-old' : ''}${c.key > 0 && j === 0 ? ' is-new' : ''}`}>
                <div className="lp-rq-top"><span className="lp-rq-id">{c.s.id}</span><span className="lp-rq-meta">{c.s.meta}</span></div>
                <div className="lp-rq-text">{c.s.q}</div>
                <div className="lp-rq-res">
                  {c.done
                    ? <>→ <b>{c.s.snap.primary.displayName}</b> · 200{latency(c.s.snap.primary.latencyMs)}</>
                    : <>Ranking {modelCount} models…</>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="lp-rv-col lp-core">
          <div className={`lp-node${busy ? ' is-busy' : ''}`} ref={nodeRef}>
            <img className="lp-mk-l" src="/asl-mark.png" alt="" width={754} height={160} />
            <img className="lp-mk-d" src="/asl-mark-dark.png" alt="" width={754} height={160} />
            <span className="lp-bars"><i /><i /><i /></span>
          </div>
          <dl className="lp-read">
            <div><dt>Model</dt><dd className={stage < 1 ? 'is-pending' : ''}>{stage >= 1 ? <code>{cur.id}</code> : '—'}</dd></div>
            <div><dt>Strategy</dt><dd className={stage < 2 ? 'is-pending' : ''}>{stage >= 2 ? strategyText(cur.snap) : '—'}</dd></div>
            <div><dt>Ranked on</dt><dd className={stage < 3 ? 'is-pending' : ''}>{stage >= 3 ? RANKS_ON[cur.snap.effectiveStrategy] ?? cur.snap.effectiveStrategy : '—'}</dd></div>
            <div><dt>Passed over</dt><dd className={stage < 4 ? 'is-pending' : ''}>{stage >= 4 ? (po ? <span className={po.cls}>{po.text}</span> : 'none') : '—'}</dd></div>
            <div><dt>Routed to</dt><dd className={stage < 5 ? 'is-pending' : ''}>{stage >= 5 ? <><span className="lp-w">{p.displayName}</span>{latency(p.latencyMs)}</> : '—'}</dd></div>
          </dl>
        </div>
        <div className="lp-rv-col lp-rv-models">
          <div className="lp-rv-label"><span>Ranking for this request</span><span>{scoreLabel(shown.snap.effectiveStrategy, kind)}</span></div>
          <div ref={listRef}>
            <RankList rows={stage >= 5 || shown !== cur ? shown.snap.rows : shown.snap.rows.map(r => (r.role === 'primary' ? { ...r, role: null } : r))} kind={kind} />
          </div>
        </div>
      </div>
    </div>
  );
}
