/**
 * Statistical tie ranks, shared by the leaderboards (client) and the model pages' server-rendered
 * text, so a model's rank reads the same everywhere. Not a 'use client' module on purpose: a
 * server component cannot call a function exported from one.
 */

/**
 * Statistical tie ranks — the rule the single-board view has always used
 * (components/v4/V4Leaderboard.tsx), unchanged: standard competition numbering, and a row
 * joins the group above it when it is not measurably worse than that group's leader
 * (gap ≤ 1.96 × combined standard error). A row graded on fewer tasks than the rest keeps
 * its position and never joins or anchors a tie.
 */
export function statisticalRanks(rows: any[], statisticalTies = true): Map<string, number> {
  const hasSE = (m: any) => m.rankable !== false && typeof m.standardError === 'number' && typeof m.currentScore === 'number';
  const better = (o: any, m: any) =>
    o.currentScore - m.currentScore > 1.96 * Math.sqrt(o.standardError * o.standardError + m.standardError * m.standardError);
  const ranks = new Map<string, number>();
  let leader: any = null;
  let leaderRank = 1;
  let position = 0;
  for (const m of rows) {
    if (!hasSE(m)) continue;
    position++;
    if (!statisticalTies || m.coverage) { ranks.set(String(m.id), position); continue; }
    if (leader === null || better(leader, m)) { leader = m; leaderRank = position; }
    ranks.set(String(m.id), leaderRank);
  }
  return ranks;
}

