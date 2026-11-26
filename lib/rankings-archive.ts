import fs from 'fs';
import path from 'path';
import { BOARD_KEYS, type BoardKey } from './boards-core';

/**
 * The monthly rankings archive: one JSON file per month in content/rankings/<YYYY-MM>.json, written
 * once by POST /api/internal/rankings-freeze and never rewritten. A file holds the first places of
 * the four 30-day boards exactly as they stood at the freeze (places and statistical ties already
 * computed), so a later change to the ranking code cannot re-rank a past month.
 *
 * Server only (reads the disk). The pages are /rankings and /rankings/<month-year>; with no file
 * there is no page: the index and every month answer 404 and the sitemap lists nothing.
 */

export const ARCHIVE_VERSION = 1;
/** The boards' 30-day view is the window every record covers. */
export const ARCHIVE_WINDOW_DAYS = 30;

export interface ArchiveRow {
  /** 1-based place on the board at the freeze. */
  place: number;
  /** True when the place was a statistical tie. */
  joint: boolean;
  name: string;
  /** URL segment of /models/<slug>. */
  slug: string;
  /** The company, as written in copy. */
  vendor: string;
  score: number;
  se: number | null;
  /** The board's coverage note ("7/9 tasks"), when it had one. */
  coverage?: string;
}

export interface ArchiveBoard {
  /** Models ranked on the board at the freeze. */
  ranked: number;
  /** Models sharing first place at the freeze (1 = a sole leader). */
  leaders: number;
  /** The first places, in board order. */
  rows: ArchiveRow[];
}

/** A dated note added after the freeze (a correction, a retirement); the rows themselves are never edited. */
export interface ArchiveNote { date: string; text: string }

export interface RankingsSnapshot {
  version: 1;
  /** "2026-12" */
  month: string;
  /** When the record was written (ISO). */
  frozenAt: string;
  /** The boards' own timestamp at the freeze (ISO). */
  boardsAt: string;
  /** First and last day of the window (ISO days, UTC). */
  from: string;
  to: string;
  boards: Record<BoardKey, ArchiveBoard>;
  notes?: ArchiveNote[];
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export const isMonth = (s: string): boolean => MONTH_RE.test(s);

/** "2026-12" → "december-2026", the URL segment. */
export function monthSlug(month: string): string {
  const m = MONTH_RE.exec(month);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]}-${m[1]}` : month;
}

/** "december-2026" → "2026-12"; null for anything else. */
export function monthFromSlug(slug: string): string | null {
  const m = /^([a-z]+)-(\d{4})$/.exec(slug);
  if (!m) return null;
  const i = MONTH_NAMES.indexOf(m[1]);
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
}

/** "2026-12" → "December 2026". */
export function monthTitle(month: string): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const name = MONTH_NAMES[Number(m[2]) - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${m[1]}`;
}

export const monthPath = (month: string): string => `/rankings/${monthSlug(month)}`;

/** The month a freeze at `now` records: the calendar month that ended most recently (UTC). */
export function monthEndedBefore(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function archiveDir(): string {
  return process.env.RANKINGS_ARCHIVE_DIR || path.join(process.cwd(), 'content', 'rankings');
}

const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isStamp = (s: unknown): s is string => typeof s === 'string' && !isNaN(new Date(s).getTime());
const isText = (s: unknown, max: number): s is string => typeof s === 'string' && s.length > 0 && s.length <= max;

function rowOk(r: any): r is ArchiveRow {
  return !!r && Number.isInteger(r.place) && r.place >= 1 && typeof r.joint === 'boolean'
    && isText(r.name, 120) && isText(r.slug, 120) && !/[\s/]/.test(r.slug) && isText(r.vendor, 80)
    && typeof r.score === 'number' && Number.isFinite(r.score)
    && (r.se === null || (typeof r.se === 'number' && Number.isFinite(r.se)))
    && (r.coverage === undefined || isText(r.coverage, 80));
}

/** A parsed file, or null when it is not a complete record of `month` (a half-written or hand-broken file is no page). */
export function parseSnapshot(raw: unknown, month: string): RankingsSnapshot | null {
  const s = raw as any;
  if (!s || s.version !== ARCHIVE_VERSION || s.month !== month || !isMonth(month)) return null;
  if (!isStamp(s.frozenAt) || !isStamp(s.boardsAt) || !isDay(s.from) || !isDay(s.to)) return null;
  if (!s.boards || typeof s.boards !== 'object') return null;
  for (const k of BOARD_KEYS) {
    const b = s.boards[k];
    if (!b || !Number.isInteger(b.ranked) || !Number.isInteger(b.leaders) || !Array.isArray(b.rows) || !b.rows.length) return null;
    if (!b.rows.every(rowOk)) return null;
  }
  if (s.notes !== undefined && !(Array.isArray(s.notes) && s.notes.every((n: any) => n && isDay(n.date) && isText(n.text, 600)))) return null;
  return s as RankingsSnapshot;
}

/** One month's record; null when there is none. */
export function readMonth(month: string): RankingsSnapshot | null {
  if (!isMonth(month)) return null;
  try {
    return parseSnapshot(JSON.parse(fs.readFileSync(path.join(archiveDir(), `${month}.json`), 'utf8')), month);
  } catch {
    return null;
  }
}

/** Every complete record, newest month first. Empty when the folder is missing. */
export function listSnapshots(): RankingsSnapshot[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(archiveDir());
  } catch {
    return [];
  }
  return names
    .map((n) => /^(\d{4}-\d{2})\.json$/.exec(n)?.[1])
    .filter((m): m is string => !!m && isMonth(m))
    .sort()
    .reverse()
    .map(readMonth)
    .filter((s): s is RankingsSnapshot => !!s);
}

/**
 * Writes a month's record once. 'exists' when the month already has a file: a record is never
 * replaced (delete the file by hand to redo one). The write is a temp file linked into place, so a
 * reader never sees half a file and two writers cannot both win.
 */
export function writeMonth(snap: RankingsSnapshot): 'written' | 'exists' {
  if (!parseSnapshot(snap, snap.month)) throw new Error('not a complete record');
  const dir = archiveDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${snap.month}.json`);
  const tmp = path.join(dir, `.${snap.month}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(snap, null, 2)}\n`, { mode: 0o644 });
  try {
    fs.linkSync(tmp, file);
    return 'written';
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return 'exists';
    throw e;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
