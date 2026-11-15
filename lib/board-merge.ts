/**
 * Hosted rows merged into the boards (Phase 3 plan §7.1, MD21; M9). Runs before buildBoard (lib/boards-core.ts).
 *
 *   - A JOINED row (`joined: true`, which the API sets only when the published ranking criteria hold, §7.4) goes into
 *     the raw fleet array in the fleet's own order: among the rows that can be ranked, after every one with a score at
 *     least as high (sortModelScores, the API's lib/model-scoring.ts: available, then held, then unavailable, each by
 *     score). buildBoard then ranks the merged list with the unchanged statisticalRanks. No row can join in Phase 3
 *     (criterion P4), so this branch is for Phase 4.
 *   - Every OTHER hosted row goes to the fourth group, Board.hosted, ranked among themselves with the same
 *     statisticalRanks (paused and under-review rows greyed, rank "–").
 *   - With zero hosted rows the fleet array is returned as it came (the same array), so every board is byte-identical
 *     to today's.
 * No React here: the model pages' server text could use it too.
 */

export interface HostedFields {
  host?: { slug: string; name: string; logoUrl: string | null } | null;
  openModel?: { slug: string; name: string } | null;
  href?: string;
  joined?: boolean;
  paused?: boolean;
}

/** A row the API's boards route made (id h:<listing>, with its host). Anything else is dropped. */
export function isHostedRow(r: unknown): r is Record<string, any> & HostedFields {
  const x = r as Record<string, any> | null;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && /^h:[a-z2-7]{10}$/.test(x.id)
    && !!x.host && typeof x.host === 'object' && typeof x.host.name === 'string' && typeof x.href === 'string' && x.href.startsWith('/inference-providers/');
}

const rankableFleet = (m: any) => m && m.currentScore !== 'unavailable' && m.rankable !== false && typeof m.currentScore === 'number';

export function mergeHosted(rawFleet: any[], rawHosted: unknown): { fleet: any[]; hosted: any[] } {
  const hosted = Array.isArray(rawHosted) ? rawHosted.filter(isHostedRow) : [];
  if (!hosted.length) return { fleet: rawFleet, hosted: [] };
  const joined = hosted.filter(r => r.joined === true && r.paused !== true && r.rankable !== false && typeof r.currentScore === 'number');
  const own = hosted.filter(r => !joined.includes(r));
  if (!joined.length) return { fleet: rawFleet, hosted: own };
  const fleet = [...rawFleet];
  for (const j of joined) {
    let at = fleet.findIndex(m => !rankableFleet(m) || (m.currentScore as number) < (j.currentScore as number));
    if (at < 0) at = fleet.length;
    fleet.splice(at, 0, j);
  }
  return { fleet, hosted: own };
}
