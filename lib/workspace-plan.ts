/**
 * The plan a person gets from a workspace they work in. Web twin of
 * apps/api/src/lib/workspace-plan.ts — keep the two in step.
 *
 * An active OWNER or EDITOR of a workspace whose owner is on a multi-seat plan (Teams,
 * Enterprise) is entitled to that plan: "five editor seats" means five people with Teams.
 * Viewers never inherit (they are unlimited). A Developer workspace has one seat, so it
 * passes nothing on. Handed to planFor() as `workspace_tier`.
 */
import { openIdentityDb } from '@/lib/identity-db';
import { ownPlanFor, PLANS, planRank, isUnlimited, type Plan, type EntitlementSubject } from '@/lib/entitlements';

const TTL_MS = 60_000;
const cache = new Map<number, { tier: Plan | null; at: number }>();

export function workspaceTierFor(userId: number | string | null | undefined): Plan | null {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tier;
  let best: Plan | null = null;
  let db: ReturnType<typeof openIdentityDb> | null = null;
  try {
    db = openIdentityDb();
    const owners = db.prepare(`
      SELECT o.owner_user_id AS owner
        FROM organization_members m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = ? AND m.role IN ('owner', 'editor') AND m.active = 1 AND m.joined_at IS NOT NULL
    `).all(id) as { owner: number }[];
    const ownerRow = db.prepare(`
      SELECT subscription_tier, trial_ends_at, subscription_canceled_at, subscription_ends_at
        FROM router_users WHERE id = ?
    `);
    for (const { owner } of owners) {
      const plan = ownPlanFor(ownerRow.get(owner) as EntitlementSubject | undefined);
      const seats = PLANS[plan].seats;
      if (!(isUnlimited(seats) || seats > 1)) continue;
      if (!best || planRank(plan) > planRank(best)) best = plan;
    }
  } catch {
    best = null;   // fail to "no workspace": the account keeps its own plan
  } finally {
    db?.close();
  }
  cache.set(id, { tier: best, at: Date.now() });
  return best;
}

/** The account row with its workspace plan attached, ready for planFor(). */
export function withWorkspace<T extends object>(userId: number | string | null | undefined, subject: T | null | undefined): (T & { workspace_tier: Plan | null }) | null {
  if (!subject) return null;
  return { ...subject, workspace_tier: workspaceTierFor(userId) };
}

/**
 * The workspace this account is in and its role there, for navigation: a viewer gets no plan
 * from a workspace, but still needs a way into it (the team watchlist, their projects).
 * Owned first, else joined and active — the same rule as the API's orgFor().
 */
const roleCache = new Map<number, { ws: { role: 'owner' | 'editor' | 'viewer'; name: string } | null; at: number }>();

export function workspaceFor(userId: number | string | null | undefined): { role: 'owner' | 'editor' | 'viewer'; name: string } | null {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const hit = roleCache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ws;
  let ws: { role: 'owner' | 'editor' | 'viewer'; name: string } | null = null;
  let db: ReturnType<typeof openIdentityDb> | null = null;
  try {
    db = openIdentityDb();
    const owned = db.prepare('SELECT name FROM organizations WHERE owner_user_id = ?').get(id) as { name: string } | undefined;
    if (owned) ws = { role: 'owner', name: owned.name };
    else {
      const m = db.prepare(`
        SELECT m.role, o.name FROM organization_members m JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ? AND m.joined_at IS NOT NULL AND m.active = 1 LIMIT 1
      `).get(id) as { role: string; name: string } | undefined;
      if (m) ws = { role: m.role === 'editor' ? 'editor' : 'viewer', name: m.name };
    }
  } catch {
    ws = null;
  } finally {
    db?.close();
  }
  if (roleCache.size > 5_000) roleCache.clear();
  roleCache.set(id, { ws, at: Date.now() });
  return ws;
}
