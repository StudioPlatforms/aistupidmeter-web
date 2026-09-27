'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BOARD_KEYS, BOARD_TITLE, BOARD_CADENCE, standingOn, useElementWidth, type Board, type BoardRow, type Boards } from '../../lib/use-boards';
import { Logo, Star, modelHref } from './BoardBits';

/**
 * Layout "Connected" (the default): each board is a column, best at the top, and a line
 * joins the same model from one board to the next, so where a model is strong and where it
 * slips reads at a glance. Pointing at a model previews its line; clicking it keeps it
 * traced and fills the bar above with its rank on all four boards.
 *
 * A model with no rank on a board (community-funded or stale) sits below that column's
 * ranked rows under a label, and the lines that reach it are dashed.
 *
 * Under ~1000px of width four columns cannot hold model names, so each model becomes a row
 * with a small chart of its four ranks instead.
 */

const ROW = 32;
const HEAD = 58;
const LABEL = 34;

type Group = 'ranked' | 'community' | 'other';
type Item = { kind: 'row'; row: BoardRow; group: Group } | { kind: 'label'; text: string };

function columnItems(board: Board): Item[] {
  const items: Item[] = board.ranked.map((row) => ({ kind: 'row', row, group: 'ranked' as Group }));
  if (board.community.length) {
    const dates = Array.from(new Set(board.community.map((r) => r.when).filter(Boolean)));
    const text = board.key === 'combined'
      ? 'Community-funded · coding only'
      : `Community-funded · ${dates.length === 1 ? `last run ${dates[0]}` : 'last funded run'}`;
    items.push({ kind: 'label', text });
    board.community.forEach((row) => items.push({ kind: 'row', row, group: 'community' }));
  }
  if (board.other.length) {
    items.push({ kind: 'label', text: 'Not ranked right now' });
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
    <div ref={ref} className="lbx-conn">
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
  const gap = Math.max(56, Math.min(120, Math.round(width * 0.075)));
  const colW = (width - 3 * gap) / 4;
  const bodyH = Math.max(...cols.map((c) => c.height));

  const paths = useMemo(() => {
    let normal = '', dashed = '', hot = '';
    for (const m of everyone) {
      for (let g = 0; g < 3; g++) {
        const a = cols[g].pos.get(m.id), c = cols[g + 1].pos.get(m.id);
        if (!a || !c) continue;
        const x1 = g * (colW + gap) + colW, x2 = (g + 1) * (colW + gap);
        const bend = gap / 2;
        const seg = `M${x1.toFixed(1)} ${a.y}C${(x1 + bend).toFixed(1)} ${a.y} ${(x2 - bend).toFixed(1)} ${c.y} ${x2.toFixed(1)} ${c.y}`;
        if (m.id === focus) hot += seg;
        else if (a.dashed || c.dashed) dashed += seg;
        else normal += seg;
      }
    }
    return { normal, dashed, hot };
  }, [cols, everyone, focus, colW, gap]);

  const selRow = everyone.find((r) => r.id === sel) || null;

  return (
    <>
      {selRow && <TraceBar row={selRow} boards={boards} />}
      <div className="lbx-conn-area" style={{ height: HEAD + bodyH }} onMouseLeave={() => onHover(null)}>
        <div className="lbx-conn-cols" style={{ gap }}>
          {cols.map(({ board, items }) => (
            <div key={board.key} className="lbx-conn-col" style={{ width: colW }}>
              <header className="lbx-conn-head" style={{ height: HEAD }}>
                <h3>{board.title}</h3>
                <p>{BOARD_CADENCE[board.key]} · {board.ranked.length} ranked</p>
              </header>
              {items.map((it, i) => it.kind === 'label'
                ? <div key={`l${i}`} className="lbx-conn-label" style={{ height: LABEL }}>{it.text}</div>
                : (
                  <div
                    key={it.row.id}
                    className={`lbx-conn-row${it.group !== 'ranked' ? ' is-muted' : ''}${it.row.id === focus ? ' is-hot' : ''}`}
                    style={{ height: ROW }}
                    onMouseEnter={() => onHover(it.row.id)}
                  >
                    <span className="lbx-conn-rank">{it.group === 'ranked' ? it.row.rankText : '–'}</span>
                    <span className="lbx-model">
                      <Star row={it.row} size={12} />
                      <Logo provider={it.row.provider} size={13} box={20} />
                      <button
                        type="button"
                        className="lbx-name lbx-conn-pick lbx-stretch"
                        onClick={() => onSelect(it.row.id)}
                        onFocus={() => onHover(it.row.id)}
                        onBlur={() => onHover(null)}
                        aria-pressed={it.row.id === sel}
                        title={it.group === 'other' && it.row.staleReason ? it.row.staleReason : `Follow ${it.row.label} across the four boards`}
                      >
                        {it.row.label}
                      </button>
                    </span>
                    <span className="lbx-conn-score">{it.row.score ?? '—'}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
        <svg className="lbx-conn-lines" width={width} height={bodyH} style={{ top: HEAD }} aria-hidden="true">
          <path d={paths.normal} className="lbx-line" />
          <path d={paths.dashed} className="lbx-line lbx-line--dashed" />
          <path d={paths.hot} className="lbx-line lbx-line--hot" />
        </svg>
      </div>
      <div className="lbx-legend" aria-hidden="true">
        <span><svg width="28" height="8"><path d="M0 4H28" className="lbx-line" /></svg>Ranked on both boards</span>
        <span><svg width="28" height="8"><path d="M0 4H28" className="lbx-line lbx-line--dashed" /></svg>Not ranked on one side (community-funded)</span>
        <span><svg width="28" height="8"><path d="M0 4H28" className="lbx-line lbx-line--hot" /></svg>Selected model</span>
      </div>
    </>
  );
}

function TraceBar({ row, boards }: { row: BoardRow; boards: Boards }) {
  const isCommunity = row.community.length > 0;
  return (
    <div className="lbx-trace" aria-live="polite">
      <div className="lbx-trace-who">
        <Logo provider={row.provider} size={16} box={26} />
        <span className="lbx-trace-id">
          <span className="lbx-trace-name"><span className="lbx-trace-kicker">Following</span> {row.label}</span>
          <span className="lbx-trace-hint">Click any model in the columns to follow it across the boards</span>
        </span>
      </div>
      <div className="lbx-trace-stats">
        {BOARD_KEYS.map((k) => {
          const s = standingOn(boards, k, row.id);
          return (
            <div key={k} className="lbx-trace-stat">
              <span className="lbx-trace-label">{BOARD_TITLE[k]}</span>
              <span><b>{s.v}</b> <small>{s.sub}</small></span>
            </div>
          );
        })}
      </div>
      <div className="lbx-trace-links">
        {isCommunity && <Link href={modelHref(row, true)}>Fund a run</Link>}
        <Link href={modelHref(row)}>Open model page</Link>
      </div>
    </div>
  );
}

/** Phone / narrow: one row per model, with a four-point chart of its rank on each board. */
function RankLines({ boards, everyone }: { boards: Boards; everyone: BoardRow[] }) {
  const maxRank = Math.max(2, ...BOARD_KEYS.map((k) => boards[k].ranked.length));
  const X = [18, 54, 90, 126];
  const yOf = (rank: number) => +(5 + ((rank - 1) / (maxRank - 1)) * 30).toFixed(1);

  const rows = everyone.map((m) => {
    const cells = BOARD_KEYS.map((k) => {
      const r = boards[k].ranked.find((x) => x.id === m.id);
      if (r) return { label: r.rankText, rank: r.rank as number };
      const c = boards[k].community.find((x) => x.id === m.id);
      return { label: c && k !== 'combined' ? (c.when || '—') : '—', rank: null as number | null };
    });
    const isCommunity = m.community.length > 0;
    const pts = cells.map((c, i) => (c.rank ? { x: X[i], y: yOf(c.rank) } : null));
    const present = pts.filter(Boolean) as { x: number; y: number }[];
    return {
      m,
      // A community row has one rank (coding); saying so is shorter and clearer than "— · =2 · 24 Sep · 24 Sep".
      sub: isCommunity
        ? `coding ${cells[1].rank ? cells[1].label : '—'}${cells[2].label !== '—' ? ` · ${cells[2].label}` : ''}`
        : cells.map((c) => c.label).join(' · '),
      line: present.length > 1 ? present.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') : '',
      dots: present.map((p) => `M${p.x} ${p.y}h0`).join(' '),
      gaps: pts.map((p, i) => (p ? '' : `M${X[i]} 35h0`)).join(' '),
      muted: m.community.length > 0 || cells[0].rank === null,
    };
  });

  const firstUnranked = rows.findIndex((r) => r.muted);

  return (
    <div className="lbx-card lbx-rl">
      <div className="lbx-rl-head">
        <span>Model · ranks</span>
        <span className="lbx-rl-axis"><span>Comb</span><span>Code</span><span>Reas</span><span>Tool</span></span>
      </div>
      {rows.map((r, i) => (
        <div key={r.m.id}>
          {i === firstUnranked && (
            <div className="lbx-rl-group">
              {r.m.community.length ? 'Community-funded · ranked on coding only' : 'Not ranked on every board'}
            </div>
          )}
          <div className={`lbx-rl-row${r.muted ? ' is-muted' : ''}`}>
            <span className="lbx-model">
              <Star row={r.m} />
              <Logo provider={r.m.provider} size={15} box={24} />
              <span className="lbx-model-text"><Link href={modelHref(r.m)} className="lbx-name lbx-stretch">{r.m.label}</Link><span className="lbx-prov">{r.sub}</span></span>
            </span>
            <svg width="144" height="40" aria-hidden="true" className="lbx-rl-chart">
              <path d="M0 5H144" className="lbx-rl-top" />
              {r.line && <path d={r.line} className="lbx-rl-line" />}
              {r.gaps && <path d={r.gaps} className="lbx-rl-gap" />}
              {r.dots && <path d={r.dots} className="lbx-rl-dot" />}
            </svg>
          </div>
        </div>
      ))}
      <p className="lbx-foot">Top of each chart is rank 1. A grey dot at the bottom means no rank on that board.</p>
    </div>
  );
}
