'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import WatchStar from '../WatchStar';
import { getModelPricing, getBlendedCostPer1M } from '../../lib/model-pricing';
import {
  BOARD_KEYS, BOARD_TITLE, BOARD_TO_SORT, SORT_TO_BOARD, useElementWidth,
  type BoardKey, type BoardRow, type Boards, type SortKey,
} from '../../lib/use-boards';
import { CommunityIcon, Logo, Rank, modelHref } from './BoardBits';

/**
 * Layout "Table": one row per model with all four scores and each score's rank on its own
 * board. A column heading sorts the table by that board — the same sort the rest of the
 * dashboard follows, so the analytics panel and the drift monitor stay in step with it.
 * Below ~680px of width each model becomes a card: the sorted score large, the other three
 * underneath.
 */

type Group = 'ranked' | 'community' | 'other';
interface Entry { row: BoardRow; group: Group }

const fmtPrice = (n: number) => `$${Number(n.toFixed(2))}`;

export default function LayoutTable({ boards, sortKey, onSortChange }: {
  boards: Boards; sortKey: SortKey; onSortChange: (k: SortKey) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const index = useMemo(() => {
    const out = {} as Record<BoardKey, Map<string, Entry>>;
    for (const k of BOARD_KEYS) {
      const m = new Map<string, Entry>();
      boards[k].ranked.forEach((row) => m.set(row.id, { row, group: 'ranked' }));
      boards[k].community.forEach((row) => m.set(row.id, { row, group: 'community' }));
      boards[k].other.forEach((row) => m.set(row.id, { row, group: 'other' }));
      out[k] = m;
    }
    return out;
  }, [boards]);

  const active: BoardKey | null = sortKey === 'price' ? null : SORT_TO_BOARD[sortKey];
  const everyone: BoardRow[] = [...boards.combined.ranked, ...boards.combined.community, ...boards.combined.other];

  const price = (r: BoardRow) => getBlendedCostPer1M(r.name, r.provider || '');
  const groups: { key: Group; rows: BoardRow[] }[] = active
    ? [
        { key: 'ranked', rows: boards[active].ranked },
        { key: 'community', rows: boards[active].community },
        { key: 'other', rows: boards[active].other },
      ]
    : [{ key: 'ranked', rows: [...everyone].sort((a, b) => price(a) - price(b)) }];

  const cell = (k: BoardKey, id: string) => index[k].get(id);
  const positionOf = (i: number) => i + 1;
  const wide = width >= 680;

  const sortButtons: { key: SortKey; label: string }[] = [
    ...BOARD_KEYS.map((k) => ({ key: BOARD_TO_SORT[k], label: BOARD_TITLE[k] })),
    { key: 'price', label: 'Price' },
  ];

  return (
    <div ref={ref} className="lbx-table-wrap">
      {width === 0 ? null : wide ? (
        <table className="lbx-table">
          <thead>
            <tr>
              <th scope="col" className="lbx-th-rank">#</th>
              <th scope="col" className="lbx-th-model">Model</th>
              {sortButtons.map((s) => (
                <th key={s.key} scope="col" aria-sort={sortKey === s.key ? (s.key === 'price' ? 'ascending' : 'descending') : 'none'}
                    className={`lbx-th-score${sortKey === s.key ? ' is-active' : ''}`}>
                  <button type="button" onClick={() => onSortChange(s.key)}>
                    {s.key === 'price' ? '$/1M' : s.label}
                    {sortKey === s.key && <span aria-hidden="true"> {s.key === 'price' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => g.rows.length === 0 ? null : (
            <tbody key={g.key} className={`lbx-tgroup lbx-tgroup--${g.key}`}>
              {g.key !== 'ranked' && (
                <tr className="lbx-tgroup-head">
                  <td colSpan={7}>
                    {g.key === 'community' ? (
                      <div className="lbx-tgroup-inner">
                        <div>
                          <div className="lbx-comm-head"><CommunityIcon /><span>Community-funded</span></div>
                          <p className="lbx-comm-text">We test these on coding every 4 hours. Reasoning and tool use show the last funded run and are not ranked. Open a model to fund its next run.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="lbx-comm-head"><span>Not ranked right now</span></div>
                    )}
                  </td>
                </tr>
              )}
              {g.rows.map((row, i) => (
                <tr key={row.id} className="lbx-trow" onClick={() => router.push(modelHref(row, g.key === 'community'))}>
                  <td className="lbx-td-rank">
                    {g.key !== 'ranked' ? <span className="lbx-rank lbx-rank--none">–</span>
                      : active ? <Rank row={row} /> : <span className="lbx-rank">{positionOf(i)}</span>}
                  </td>
                  <td className="lbx-td-model">
                    <span className="lbx-model">
                      <span onClick={(e) => e.stopPropagation()}><WatchStar modelId={row.id} modelName={row.label} size={14} /></span>
                      <Logo provider={row.provider} size={17} box={28} />
                      <span className="lbx-model-text">
                        <Link href={modelHref(row)} className="lbx-name" onClick={(e) => e.stopPropagation()}>{row.label}</Link>
                        <span className="lbx-prov">{row.vendor}</span>
                      </span>
                    </span>
                  </td>
                  {BOARD_KEYS.map((k) => (
                    <td key={k} className={`lbx-td-score${active === k ? ' is-active' : ''}`}>
                      <ScoreCell entry={cell(k, row.id)} board={k} />
                    </td>
                  ))}
                  <td className={`lbx-td-score lbx-td-price${sortKey === 'price' ? ' is-active' : ''}`}>
                    <PriceCell row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      ) : (
        <div className="lbx-tcards">
          <div className="lbx-chips" role="tablist" aria-label="Rank by">
            {sortButtons.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={sortKey === s.key}
                      className={`lbx-chipbtn${sortKey === s.key ? ' is-active' : ''}`} onClick={() => onSortChange(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="lbx-card lbx-tcard-list">
            {groups.map((g) => {
              if (g.rows.length === 0) return null;
              const rows = g.key === 'ranked' && !showAll ? g.rows.slice(0, 8) : g.rows;
              return (
                <div key={g.key}>
                  {g.key === 'community' && (
                    <div className="lbx-comm lbx-comm--inline">
                      <div className="lbx-comm-head"><CommunityIcon /><span>Community-funded</span></div>
                      <p className="lbx-comm-text">Tested by us on coding every 4 hours. Reasoning and tool use show the last funded run.</p>
                    </div>
                  )}
                  {g.key === 'other' && <div className="lbx-comm lbx-comm--inline"><div className="lbx-comm-head"><span>Not ranked right now</span></div></div>}
                  {rows.map((row, i) => (
                    <Link key={row.id} href={modelHref(row, g.key === 'community')} className="lbx-tcard">
                      <span className="lbx-tcard-top">
                        <span className="lbx-tcard-rank">
                          {g.key !== 'ranked' ? <span className="lbx-rank lbx-rank--none">–</span>
                            : active ? <Rank row={row} /> : <span className="lbx-rank">{positionOf(i)}</span>}
                        </span>
                        <Logo provider={row.provider} size={17} box={28} />
                        <span className="lbx-model-text">
                          <span className="lbx-name">{row.label}</span>
                          <span className="lbx-prov">{row.vendor}</span>
                        </span>
                        <span className="lbx-tcard-main">
                          {active ? <BigScore entry={cell(active, row.id)} board={active} /> : <PriceCell row={row} />}
                        </span>
                      </span>
                      <span className="lbx-tcard-subs">
                        {BOARD_KEYS.filter((k) => k !== active).slice(0, 3).map((k) => (
                          <span key={k} className="lbx-tcard-sub">
                            <span className="lbx-tcard-label">{BOARD_TITLE[k]}</span>
                            <MiniCell entry={cell(k, row.id)} board={k} />
                          </span>
                        ))}
                      </span>
                    </Link>
                  ))}
                  {g.key === 'ranked' && !showAll && g.rows.length > 8 && (
                    <div className="lbx-more">
                      <button type="button" onClick={() => setShowAll(true)}>Show all {g.rows.length} models</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCell({ entry, board }: { entry?: Entry; board: BoardKey }) {
  if (!entry) return <span className="lbx-cell"><b className="is-muted">—</b></span>;
  const { row, group } = entry;
  if (group === 'ranked') {
    return (
      <span className="lbx-cell">
        <b>{row.score}</b>
        {row.note
          ? <small className="is-amber" title={row.coverage || undefined}>{row.rankText} · {row.note}</small>
          : <small>rank {row.rankText}</small>}
      </span>
    );
  }
  if (group === 'community') {
    return <span className="lbx-cell"><b className="is-muted">{board === 'combined' ? '—' : row.score}</b><small>{row.when}</small></span>;
  }
  return <span className="lbx-cell" title={row.staleReason || undefined}><b className="is-muted">{row.score ?? '—'}</b><small>not ranked</small></span>;
}

function BigScore({ entry, board }: { entry?: Entry; board: BoardKey }) {
  if (!entry) return <span className="lbx-big is-muted">—</span>;
  if (entry.group === 'ranked') return <span className="lbx-big">{entry.row.score}</span>;
  if (entry.group === 'community' && board === 'combined') return <span className="lbx-chip">coding only</span>;
  return <span className="lbx-big is-muted">{entry.row.score ?? '—'}</span>;
}

function MiniCell({ entry, board }: { entry?: Entry; board: BoardKey }) {
  if (!entry) return <span className="lbx-mini is-muted">—</span>;
  const { row, group } = entry;
  if (group === 'ranked') return <span className="lbx-mini"><b>{row.score}</b> <small>{row.rankText}</small></span>;
  if (group === 'community') return <span className="lbx-mini is-muted"><b>{board === 'combined' ? '—' : row.score}</b> <small>{row.when}</small></span>;
  return <span className="lbx-mini is-muted"><b>{row.score ?? '—'}</b> <small>not ranked</small></span>;
}

function PriceCell({ row }: { row: BoardRow }) {
  const p = getModelPricing(row.name, row.provider || '');
  return (
    <span className="lbx-cell lbx-price" title="Input / output price per million tokens">
      <b>{fmtPrice(p.input)}/{fmtPrice(p.output)}</b>
      <small>per 1M tokens</small>
    </span>
  );
}
