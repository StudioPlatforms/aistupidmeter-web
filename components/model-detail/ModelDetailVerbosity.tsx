'use client';

/**
 * How much the model writes, per suite, against the fleet on the same tasks.
 *
 * Words are counted from the answers the model actually returned — never its hidden
 * reasoning — because output TOKENS are not a verbosity measure on this fleet: a thinking
 * model is billed for its reasoning in the same count as its answer. The billed figure is
 * still shown beside the words, labelled for what it is, since the gap between the two is
 * itself worth knowing. The comparison is always on the same tasks (lib/verbosity.ts in the
 * API), so a model missing a task is never compared on a different mix.
 *
 * The strip is an emphasis chart: this model in the data blue, the rest of the fleet in
 * grey, on a log scale so 2x and 0.5x sit the same distance from "typical". Colours checked
 * with the dataviz validator: blue/grey ΔE 17.6 (protan) and >= 3:1 on both light surfaces.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

type SuiteKey = 'hourly' | 'deep' | 'tooling';
interface FleetPoint { name: string; ratio: number; wordsPerTask: number; self: boolean }
interface ModelSuite {
  wordsPerTask: number;
  fleetWordsPerTask: number;
  tokensOutPerTask: number | null;
  ratio: number;
  rank: number;
  ofModels: number;
  tasks: number;
  suiteTasks: number;
  samples: number;
  unanswered: string[];
}
interface SuiteBlock { since: string; fleetWordsPerTask: number; fleet: FleetPoint[]; model: ModelSuite | null }
interface Payload { computedAt: string; suites: Partial<Record<SuiteKey, SuiteBlock>> }

const LABEL: Record<SuiteKey, string> = { hourly: 'Coding', deep: 'Reasoning', tooling: 'Tool use' };
const ORDER: SuiteKey[] = ['hourly', 'deep', 'tooling'];
const WHAT: Record<SuiteKey, string> = {
  hourly: 'its full response to each coding task',
  deep: 'every turn of each multi-turn reasoning session',
  tooling: 'its messages plus the arguments of every tool call, per session',
};

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtK = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const fmtRatio = (r: number) => (r >= 10 ? r.toFixed(0) : r >= 1 ? r.toFixed(1) : r.toFixed(2)) + '×';

function Strip({ fleet, suite }: { fleet: FleetPoint[]; suite: SuiteKey }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn in real pixels at the container's width, so the strip spans the card and dots stay
  // round (a fixed-aspect viewBox shrank to fit the 34px height and filled half the card).
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(160, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 46, PAD = 14, Y = 18, LANE = 6, GAP = 8;
  const [lo, hi] = useMemo(() => {
    const rs = fleet.map(p => p.ratio).filter(r => r > 0);
    return [Math.min(0.5, ...rs) * 0.85, Math.max(2, ...rs) * 1.15];
  }, [fleet]);
  const x = (r: number) => PAD + ((Math.log(Math.max(r, 1e-3)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (W - 2 * PAD);
  const ticks = [0.25, 0.5, 1, 2, 4, 8].filter(t => t >= lo && t <= hi);
  // Beeswarm lanes: coding answers sit within ±25% of typical, and 22 dots on one line pile
  // into a smear. A dot within GAP px of one already in its lane moves to the next free lane
  // (0, -1, +1, -2, +2), so every model stays visible and hoverable.
  const lanes = useMemo(() => {
    const placed: Array<{ px: number; lane: number }> = [];
    const out = new Map<number, number>();
    [...fleet.map((p, i) => ({ px: x(p.ratio), i }))].sort((a, b) => a.px - b.px).forEach(({ px, i }) => {
      const lane = [0, -1, 1, -2, 2].find(l => !placed.some(q => q.lane === l && Math.abs(q.px - px) < GAP)) ?? 0;
      placed.push({ px, lane });
      out.set(i, lane);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleet, W, lo, hi]);
  // Draw the fleet first and this model last, so it is never hidden under a neighbour.
  const ordered = [...fleet.map((p, i) => ({ p, i }))].sort((a, b) => Number(a.p.self) - Number(b.p.self));
  const hp = hover !== null ? fleet[hover] : null;

  return (
    <div className="md-vb-strip" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`${LABEL[suite]}: this model among ${fleet.length} models, from ${fmtRatio(Math.min(...fleet.map(p => p.ratio)))} to ${fmtRatio(Math.max(...fleet.map(p => p.ratio)))} of the typical model`}>
        <line x1={PAD} x2={W - PAD} y1={Y} y2={Y} className="md-vb-axis" />
        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={Y - (t === 1 ? 14 : 3)} y2={Y + (t === 1 ? 14 : 3)} className={t === 1 ? 'md-vb-tick-typ' : 'md-vb-tick'} />
            <text x={x(t)} y={H - 1} className="md-vb-ticklabel" textAnchor="middle">{t === 1 ? 'typical' : `${t}×`}</text>
          </g>
        ))}
        {ordered.map(({ p, i }) => (
          <g key={i}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(h => (h === i ? null : h))}
            onFocus={() => setHover(i)} onBlur={() => setHover(h => (h === i ? null : h))}
            tabIndex={0} aria-label={`${p.name}: ${fmtRatio(p.ratio)} the typical model, ${fmt(p.wordsPerTask)} words per task`}>
            {/* the hit target is bigger than the mark */}
            <circle cx={x(p.ratio)} cy={Y + (lanes.get(i) ?? 0) * LANE} r={7} fill="transparent" />
            <circle cx={x(p.ratio)} cy={Y + (lanes.get(i) ?? 0) * LANE} r={p.self ? 5.5 : 4} className={p.self ? 'md-vb-dot md-vb-dot-self' : 'md-vb-dot'} />
          </g>
        ))}
      </svg>
      {hp && (
        <div className="md-vb-tip" style={{ left: `${(x(hp.ratio) / W) * 100}%`, bottom: H - 4 }} role="status">
          <strong>{fmtRatio(hp.ratio)}</strong> {hp.name}
          <span className="md-vb-tip-sub">{fmt(hp.wordsPerTask)} words per task</span>
        </div>
      )}
    </div>
  );
}

export default function ModelDetailVerbosity({ modelId, focus = null }: { modelId: string | number; focus?: SuiteKey | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    fetch(`${apiUrl}/dashboard/model-verbosity/${modelId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => { if (alive) setData(j?.data ?? null); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [modelId]);

  if (failed || !data) return null;
  const rows = ORDER.filter(k => data.suites[k]?.model);
  if (rows.length === 0) return null;

  return (
    <div className="md-chart-section">
      <div className="md-chart-title">HOW MUCH IT WRITES</div>
      <div className="md-vb-rows">
        {rows.map(k => {
          const b = data.suites[k]!;
          const m = b.model!;
          const more = m.ratio >= 1;
          return (
            <div key={k} className={`md-vb-row${focus && focus !== k ? ' md-vb-dim' : ''}`}>
              <div className="md-vb-head">
                <span className="md-vb-name">{LABEL[k]}</span>
                <span className="md-vb-value">{fmt(m.wordsPerTask)}</span>
                <span className="md-vb-unit">words per task</span>
              </div>
              <div className="md-vb-line">
                <strong>{fmtRatio(m.ratio)}</strong> the typical model on the same tasks ({fmt(m.fleetWordsPerTask)} words)
                {' · '}{m.rank === 1 ? 'the most' : m.rank === m.ofModels ? 'the least' : `${ordinal(more ? m.rank : m.ofModels - m.rank + 1)} ${more ? 'most' : 'least'}`} of {m.ofModels}
              </div>
              <Strip fleet={b.fleet} suite={k} />
              {m.tokensOutPerTask != null && (
                <div className="md-vb-sub">
                  Billed for {fmtK(m.tokensOutPerTask)} output tokens per task, which include any reasoning it does not show.
                </div>
              )}
              {m.tasks < m.suiteTasks && m.unanswered.length === 0 && (
                <div className="md-vb-sub">Measured on {m.tasks} of {m.suiteTasks} tasks; the rest were declined by the provider, so they are left out rather than counted as silence.</div>
              )}
              {m.unanswered.length > 0 && (
                <div className="md-vb-sub md-vb-note">
                  Left out: {m.unanswered.map(t => t.replace(/^py\//, '')).join(', ')} — it used its whole 24,000-token output budget reasoning and never returned an answer, so there are no words of its own to count.
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="md-vb-foot">
        Counts the words each model returned — {ORDER.filter(k => data.suites[k]?.model).map(k => `${LABEL[k].toLowerCase()}: ${WHAT[k]}`).join('; ')} — over the last seven days on the current version of each test.
        Hidden reasoning is never counted. Each model is compared with the typical model on exactly the tasks it ran.
      </div>
    </div>
  );
}
