'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BOARD_KEYS, BOARD_TITLE, BOARD_CADENCE, standingOn, useElementWidth, type Board, type BoardRow, type Boards } from '../../lib/use-boards';
import { Logo, Star, modelHref, useFlip } from './BoardBits';

/**
 * Layout "Connected" (the default): each board is a column, best at the top, and a line
 * joins the same model from one board to the next, so where a model is strong and where it
 * slips reads at a glance. Pointing at a model previews its line; clicking it keeps it
 * traced and fills the bar above with its rank on all four boards.
 *
 * A model with no rank on a board (community-funded or stale) sits below that column's
 * ranked rows under a label, and the lines that reach it are dashed.
 *
 * When the order changes (another period) the rows slide to their new places; the lines step
 * aside while they move and fade back in where the rows settle, so the two never disagree.
 *
 * Under ~1000px of width four columns cannot hold model names, so each model becomes a row
 * with a small chart of its four ranks instead.
 */

const ROW = 34;
/** Column header, including its bottom rule (styles/studio-boards.css .sl-conn-head). */
const HEAD = 66;
const LABEL = 36;
/** The column card's border and its body's padding, above the first row. */
const EDGE = 1;
const PAD = 6;

type Group = 'ranked' | 'community' | 'other';
type Item = { kind: 'row'; row: BoardRow; group: Group } | { kind: 'label'; group: Group; text: string; title?: string };

function columnItems(board: Board): Item[] {
  const items: Item[] = board.ranked.map((row) => ({ kind: 'row', row, group: 'ranked' as Group }));
  if (board.community.length) {
    const dates = Array.from(new Set(board.community.map((r) => r.when).filter(Boolean)));
    // On Combined, say why they have no rank. "Community-funded · coding only" read as if only
    // coding were community-funded, which is the reverse of the truth.
    const text = board.key === 'combined'
      ? 'Community-funded · no combined rank'
      : `Community-funded · ${dates.length === 1 ? `last run ${dates[0]}` : 'last funded run'}`;
    const title = board.key === 'combined'
      ? 'Their reasoning and tool-use runs are funded by the community, so there is no complete combined score to rank. We test their coding every 4 hours.'
      : 'Community-funded: these scores are from the last run someone funded, so they are not ranked against models we measure on schedule.';
    items.push({ kind: 'label', group: 'community', text, title });
    board.community.forEach((row) => items.push({ kind: 'row', row, group: 'community' }));
  }
  if (board.other.length) {
    items.push({ kind: 'label', group: 'other', text: 'Not ranked right now' });
    board.other.forEach((row) => items.push({ kind: 'row', row, group: 'other' }));
  }
  return items;
}

/** `selected` lives in Leaderboards so the watchlist card can pick a model to follow too. */
export default function LayoutConnected({ boards, selected, onSelect }: {
  boards: Boards; selected: string | null; onSelect: (id: string) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);

  const cols = useMemo(() => BOARD_KEYS.map((k) => {
    const items = columnItems(boards[k]);
    const pos = new Map<string, { y: number; dashed: boolean }>();
    let y = 0;
    for (const it of items) {
      if (it.kind === 'label') { y += LABEL; continue; }
      pos.set(it.row.id, { y: y + ROW / 2, dashed: it.group !== 'ranked' });
      y += ROW;
    }
    return { board: boards[k], items, pos, height: y };
  }), [boards]);

  const everyone = useMemo(
    () => [...boards.combined.ranked, ...boards.combined.community, ...boards.combined.other],
    [boards],
  );
  const sel = selected ?? everyone[0]?.id ?? null;
  const focus = hover ?? sel;

  return (
    <div ref={ref} className="sl-conn">
      {width === 0 ? null : width >= 1000
        ? <Columns cols={cols} width={width} focus={focus} sel={sel} everyone={everyone}
                   onSelect={onSelect} onHover={setHover} boards={boards} />
        : <RankLines boards={boards} everyone={everyone} />}
    </div>
  );
}

function Columns({ cols, width, focus, sel, everyone, onSelect, onHover, boards }: {
  cols: { board: Board; items: Item[]; pos: Map<string, { y: number; dashed: boolean }>; height: number }[];
  width: number; focus: string | null; sel: string | null; everyone: BoardRow[];
  onSelect: (id: string) => void; onHover: (id: string | null) => void; boards: Boards;
}) {
  // The gaps carry the lines; the rest goes to the columns, so full model names fit at 1,440px.
  const gap = Math.max(56, Math.min(100, Math.round(width * 0.06)));
  const colW = (width - 3 * gap) / 4;
  const bodyH = Math.max(...cols.map((c) => c.height));
  const top = EDGE + HEAD + PAD;

  // One path per model per gap, keyed, so a line can follow its rows when the order changes.
  const segs = useMemo(() => {
    const out: { key: string; id: string; g: number; d: string; dashed: boolean }[] = [];
    for (const m of everyone) {
      for (let g = 0; g < 3; g++) {
        const a = cols[g].pos.get(m.id), c = cols[g + 1].pos.get(m.id);
        if (!a || !c) continue;
        const x1 = g * (colW + gap) + colW, x2 = (g + 1) * (colW + gap);
        const bend = gap / 2;
        const d = `M${x1.toFixed(1)} ${a.y}C${(x1 + bend).toFixed(1)} ${a.y} ${(x2 - bend).toFixed(1)} ${c.y} ${x2.toFixed(1)} ${c.y}`;
        out.push({ key: `${m.id}:${g}`, id: m.id, g, d, dashed: a.dashed || c.dashed });
      }
    }
    return out;
  }, [cols, everyone, colW, gap]);
  const hotSegs = segs.filter((sg) => sg.id === focus);

  // Where every row sits. When it changes (a new period), the rows slide and the lines wait.
  const sig = useMemo(() => cols.map((c) => Array.from(c.pos, ([id, p]) => `${id}:${p.y}`).join(',')).join('|'), [cols]);
  const area = useFlip<HTMLDivElement>([sig, Math.round(colW)]);
  // Browsers that can animate a path's shape (CSS `d`) move each line with its rows (700 ms, the
  // rows' own curve). Others hide the lines while the rows slide, as before.
  const [morphs, setMorphs] = useState(true);
  useEffect(() => { setMorphs(typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('d', 'path("M0 0")')); }, []);
  const [settling, setSettling] = useState(false);
  const firstSig = useRef(sig);
  useEffect(() => {
    if (sig === firstSig.current) return;
    firstSig.current = sig;
    if (morphs || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setSettling(true);
    const t = setTimeout(() => setSettling(false), 720);
    return () => clearTimeout(t);
  }, [sig, morphs]);

  // The lines draw in once, sweeping from Combined to Tool use, the first time the boards are seen.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = area.current;
    if (!el || drawn) return;
    if (typeof IntersectionObserver === 'undefined') { setDrawn(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setDrawn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [area, drawn]);

  const selRow = everyone.find((r) => r.id === sel) || null;

  return (
    <>
      {selRow && <TraceBar row={selRow} boards={boards} />}
      <div ref={area} className="sl-conn-area" style={{ height: top + bodyH + PAD + EDGE }} onMouseLeave={() => onHover(null)}>
        <div className="sl-conn-cols" style={{ gap }}>
          {cols.map(({ board, items }) => (
            <div key={board.key} className="sl-conn-col" style={{ width: colW }}>
              <header className="sl-conn-head" style={{ height: HEAD }}>
                <h3>{board.title}</h3>
                <p>{BOARD_CADENCE[board.key]} · {board.ranked.length} ranked</p>
              </header>
              <div className="sl-conn-body">
                {items.map((it) => it.kind === 'label'
                  ? (
                    <div key={`label-${it.group}`} data-flip={`${board.key}:label-${it.group}`} className="sl-conn-label"
                         style={{ height: LABEL }} title={it.title}>
                      {it.text}
                    </div>
                  )
                  : (
                    <div
                      key={it.row.id}
                      data-flip={`${board.key}:${it.row.id}`}
                      className={`sl-crow2${it.group !== 'ranked' ? ' is-muted' : ''}${it.row.id === focus ? ' is-hot' : ''}`}
                      style={{ height: ROW }}
                      onMouseEnter={() => onHover(it.row.id)}
                    >
                      <span className="sl-crank">{it.group === 'ranked' ? it.row.rankText : '–'}</span>
                      <span className="sl-model">
                        <Star row={it.row} size={12} />
                        <Logo provider={it.row.provider} size="xs" />
                        <button
                          type="button"
                          className="sl-pick sl-stretch"
                          onClick={() => onSelect(it.row.id)}
                          onFocus={() => onHover(it.row.id)}
                          onBlur={() => onHover(null)}
                          aria-pressed={it.row.id === sel}
                          title={it.group === 'other' && it.row.staleReason ? it.row.staleReason : `Follow ${it.row.label} across the four boards`}
                        >
                          {it.row.label}
                        </button>
                      </span>
                      <span className="sl-cscore">{it.row.score ?? '—'}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <svg className={`sl-conn-lines${settling ? ' is-settling' : ''}${drawn ? ' is-drawn' : ''}`} width={width} height={bodyH} style={{ top }} aria-hidden="true">
          <g>
            {segs.map((sg) => (
              <path key={sg.key} d={sg.d} style={{ d: `path('${sg.d}')` } as CSSProperties}
                    className={`sl-line sl-seg${sg.dashed ? ' is-dashed' : ''}`} />
            ))}
          </g>
          {/* The followed (or hovered) model's line traces across the boards, left to right. */}
          <g key={`hot-${focus ?? 'none'}`}>
            {hotSegs.map((sg) => (
              <path key={sg.key} d={sg.d} pathLength={1} style={{ d: `path('${sg.d}')`, '--g': sg.g } as CSSProperties}
                    className="sl-line sl-seg is-hot sl-trace-line" />
            ))}
          </g>
        </svg>
      </div>
      <div className="sl-legend" aria-hidden="true">
        <span><svg width="28" height="8"><path d="M0 4H28" className="sl-line" /></svg>Ranked on both boards</span>
        <span><svg width="28" height="8"><path d="M0 4H28" className="sl-line is-dashed" /></svg>Not ranked on one side (community-funded)</span>
        <span><svg width="28" height="8"><path d="M0 4H28" className="sl-line is-hot" /></svg>Selected model</span>
      </div>
    </>
  );
}

function TraceBar({ row, boards }: { row: BoardRow; boards: Boards }) {
  const isCommunity = row.community.length > 0;
  return (
    <div className="sl-trace" aria-live="polite">
      <div className="sl-trace-who sl-swap" key={`who-${row.id}`}>
        <Logo provider={row.provider} size="lg" />
        <span className="sl-trace-id">
          <span className="sl-trace-kicker">Following</span>
          <span className="sl-trace-name">{row.label}</span>
          <span className="sl-trace-hint">Click any model in the columns to follow it across the boards</span>
        </span>
      </div>
      <dl className="sl-trace-stats sl-swap" key={`stats-${row.id}`}>
        {BOARD_KEYS.map((k) => {
          const s = standingOn(boards, k, row.id);
          return (
            <div key={k} className="sl-trace-stat">
              <dt>{BOARD_TITLE[k]}</dt>
              <dd><b>{s.v}</b> <small>{s.sub}</small></dd>
            </div>
          );
        })}
      </dl>
      <div className="sl-trace-links">
        {isCommunity && <Link href={modelHref(row, true)} className="st-btn is-sm">Fund a run</Link>}
        <Link href={modelHref(row)} className="st-more">Open model page</Link>
      </div>
    </div>
  );
}

/** Phone / narrow: one row per model, with a four-point chart of its rank on each board. */
function RankLines({ boards, everyone }: { boards: Boards; everyone: BoardRow[] }) {
  const maxRank = Math.max(2, ...BOARD_KEYS.map((k) => boards[k].ranked.length));
  const X = [18, 54, 90, 126];
  const yOf = (rank: number) => +(5 + ((rank - 1) / (maxRank - 1)) * 30).toFixed(1);

  // The group is the Combined board's own bucket, as on the desktop columns. A community-funded
  // model whose funded runs fall inside the period has a combined score and is ranked like any
  // other; testing `community.length` put a "Community-funded" heading above each such row,
  // wherever it ranked, so the heading repeated with non-community models between.
  const bucket = new Map<string, Group>();
  boards.combined.community.forEach((r) => bucket.set(r.id, 'community'));
  boards.combined.other.forEach((r) => bucket.set(r.id, 'other'));

  const rows = everyone.map((m) => {
    const group: Group = bucket.get(m.id) ?? 'ranked';
    const cells = BOARD_KEYS.map((k) => {
      const r = boards[k].ranked.find((x) => x.id === m.id);
      if (r) return { label: r.rankText, rank: r.rank as number };
      const c = boards[k].community.find((x) => x.id === m.id);
      return { label: c && k !== 'combined' ? (c.when || '—') : '—', rank: null as number | null };
    });
    const isCommunity = group === 'community';
    const pts = cells.map((c, i) => (c.rank ? { x: X[i], y: yOf(c.rank) } : null));
    const present = pts.filter(Boolean) as { x: number; y: number }[];
    return {
      m,
      group,
      // A community row has one rank (coding); saying so is shorter and clearer than "— · =2 · 24 Sep · 24 Sep".
      sub: isCommunity
        ? `coding ${cells[1].rank ? cells[1].label : '—'}${cells[2].label !== '—' ? ` · ${cells[2].label}` : ''}`
        : cells.map((c) => c.label).join(' · '),
      line: present.length > 1 ? present.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') : '',
      dots: present.map((p) => `M${p.x} ${p.y}h0`).join(' '),
      gaps: pts.map((p, i) => (p ? '' : `M${X[i]} 35h0`)).join(' '),
      muted: group !== 'ranked',
    };
  });

  // A heading wherever the group changes: the community-funded models without a combined rank
  // first, then any other model without one (added recently, not yet run on every suite).
  // `everyone` is ranked, then community, then other, so each heading appears once.
  const groupOf = (r: (typeof rows)[number]) => r.group;
  const list = useFlip<HTMLDivElement>([rows.map((r) => r.m.id).join(',')]);

  return (
    <div className="sl-rl" ref={list}>
      <div className="sl-rl-head">
        <span>Model · ranks</span>
        <span className="sl-rl-axis"><span>Comb</span><span>Code</span><span>Reas</span><span>Tool</span></span>
      </div>
      {rows.map((r, i) => (
        <div key={r.m.id} data-flip={r.m.id}>
          {groupOf(r) !== 'ranked' && (i === 0 || groupOf(rows[i - 1]) !== groupOf(r)) && (
            <div className="sl-rl-group">
              {groupOf(r) === 'community' ? 'Community-funded reasoning and tool use' : 'Not ranked on every board'}
            </div>
          )}
          <div className={`sl-rl-row${r.muted ? ' is-muted' : ''}`}>
            <span className="sl-model">
              <Star row={r.m} />
              <Logo provider={r.m.provider} size="sm" />
              <span className="sl-model-t"><Link href={modelHref(r.m)} className="sl-name sl-stretch">{r.m.label}</Link><span className="sl-vendor">{r.sub}</span></span>
            </span>
            <svg width="144" height="40" aria-hidden="true" className="sl-rl-chart">
              <path d="M0 5H144" className="sl-rl-top" />
              {r.line && <path d={r.line} className="sl-rl-line" />}
              {r.gaps && <path d={r.gaps} className="sl-rl-gap" />}
              {r.dots && <path d={r.dots} className="sl-rl-dot" />}
            </svg>
          </div>
        </div>
      ))}
      <p className="sl-foot">Top of each chart is rank 1. A grey dot at the bottom means no rank on that board.</p>
    </div>
  );
}
