import { and, companyOf, fmtScore } from '@/components/seo/best/best-data';
import { LEADERBOARD_TOP_N } from '@/components/seo/leaderboard/leaderboard-config';
import type { ScoreTableRow } from '@/components/seo/ScoreTable';
import { BOARD_KEYS, type BoardKey } from '@/lib/boards-core';
import {
  ARCHIVE_VERSION, ARCHIVE_WINDOW_DAYS, monthTitle,
  type ArchiveBoard, type ArchiveRow, type RankingsSnapshot,
} from '@/lib/rankings-archive';
import { dayLabel } from '@/lib/seo';
import { boardLabel, topOfBoard, type SeoBoards } from '@/lib/seo-data';

/**
 * What the monthly rankings pages say, built from a frozen record (lib/rankings-archive.ts) and
 * nothing else: a past month's page never reads today's boards. buildSnapshot is the one place a
 * record is made, from the leaderboard's own 30-day boards (places and ties from lib/boards-core).
 */

const DAY_MS = 86_400_000;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** The record of `month` from the 30-day boards as they stand at `now`; null when a board has no ranked row. */
export function buildSnapshot(boards: SeoBoards, month: string, now: Date): RankingsSnapshot | null {
  const out = {} as Record<BoardKey, ArchiveBoard>;
  for (const k of BOARD_KEYS) {
    const rows: ArchiveRow[] = [];
    for (const { row, placement } of topOfBoard(boards, k, LEADERBOARD_TOP_N)) {
      if (placement.kind !== 'ranked' || placement.place === null || placement.score === null) continue;
      rows.push({
        place: placement.place,
        joint: placement.joint,
        name: row.label,
        slug: row.slug,
        vendor: companyOf(row.provider, row.vendor),
        score: placement.score,
        se: placement.se,
        ...(row.note ? { coverage: row.note } : {}),
      });
    }
    if (!rows.length) return null;
    out[k] = { ranked: boards.boards[k].ranked.length, leaders: Math.max(1, boards.boards[k].tiedForFirst), rows };
  }
  return {
    version: ARCHIVE_VERSION,
    month,
    frozenAt: now.toISOString(),
    boardsAt: boards.generatedAt,
    from: isoDay(new Date(now.getTime() - ARCHIVE_WINDOW_DAYS * DAY_MS)),
    to: isoDay(now),
    boards: out,
  };
}

/** "the 30 days from 2 Dec 2026 to 1 Jan 2027" */
export const windowText = (s: RankingsSnapshot): string =>
  `the ${ARCHIVE_WINDOW_DAYS} days from ${dayLabel(`${s.from}T00:00:00Z`)} to ${dayLabel(`${s.to}T00:00:00Z`)}`;

export const scoreOf = (r: ArchiveRow): string => fmtScore(r.score, r.se);

/** The rows of one board as the SEO score table takes them. */
export function tableRows(s: RankingsSnapshot, key: BoardKey): ScoreTableRow[] {
  return s.boards[key].rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    vendor: r.vendor,
    score: r.score,
    se: r.se,
    place: r.place,
    joint: r.joint,
    ...(r.coverage ? { extra: { Coverage: r.coverage } } : {}),
  }));
}

/** The leaders the record holds for a board: the rows in first place (a tie wider than the record shows only what it kept). */
export const leadersOf = (s: RankingsSnapshot, key: BoardKey): ArchiveRow[] => s.boards[key].rows.filter((r) => r.place === 1);

/**
 * "<A> led the Coding board in December 2026: 1st of 26 models, scoring 93 ± 0.4." or, for a tie,
 * "<A>, <B> and <C> shared first place on the Coding board in December 2026: statistically tied …".
 */
export function leadSentence(s: RankingsSnapshot, key: BoardKey): string {
  const b = s.boards[key];
  const leaders = leadersOf(s, key);
  const where = `on the ${boardLabel(key)} board in ${monthTitle(s.month)}`;
  const first = leaders[0] ?? b.rows[0];
  if (b.leaders <= 1 || leaders.length <= 1) {
    return `${first.name} led the ${boardLabel(key)} board in ${monthTitle(s.month)}: 1st of ${b.ranked} models, scoring ${scoreOf(first)}.`;
  }
  if (b.leaders <= 3 && leaders.length === b.leaders) {
    return `${and(leaders.map((r) => r.name))} shared first place ${where}: statistically tied, joint 1st of ${b.ranked} models (${leaders.map((r) => `${r.name} ${scoreOf(r)}`).join(', ')}).`;
  }
  return `${b.leaders} models shared first place ${where}, statistically tied; ${first.name} had the highest score of them (${scoreOf(first)}).`;
}

/** A short form for lists: "Claude Opus 5.5" or "3 models tied, Claude Opus 5.5 highest". */
export function leaderShort(s: RankingsSnapshot, key: BoardKey): string {
  const b = s.boards[key];
  const first = leadersOf(s, key)[0] ?? b.rows[0];
  return b.leaders <= 1 ? first.name : `${b.leaders} models tied, ${first.name} highest`;
}
