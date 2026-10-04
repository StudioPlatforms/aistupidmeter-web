import { openIdentityDb } from '@/lib/identity-db';
import type { User } from '@/lib/db-client';

/**
 * Account deletion, identity-database half (the benchmark-database half is the API's
 * POST /api/account-purge; app/api/account/delete runs both, that one first).
 *
 * What goes: the account and everything that is only about it — watchlists, alert
 * preferences and deliveries, activation events, UI preferences, workspace memberships,
 * router credits, SSO tickets (all ON DELETE CASCADE), the forum profile and reactions, and
 * workspaces the person owns alone. What stays, without a link to the person: forum posts
 * and topics (re-attributed to the "Deleted user" placeholder so threads still read),
 * contact messages, assessment requests and audit events (ON DELETE SET NULL). Stripe keeps
 * invoices, as it must.
 */

export const DELETED_USER_EMAIL = 'deleted-user@aistupidlevel.invalid';

export interface DeletionBlocker {
  code: 'subscription' | 'workspace';
  message: string;
  href?: string;
}

/** Reasons the account cannot be deleted yet. Empty means it can. */
export function deletionBlockers(user: User): DeletionBlocker[] {
  const blockers: DeletionBlocker[] = [];

  // A subscription that will renew would keep charging an account that no longer exists.
  // Cancelled ones (subscription_canceled_at set) never charge again, so they do not block.
  if (user.stripe_subscription_id && user.subscription_tier !== 'free' && !user.subscription_canceled_at) {
    blockers.push({
      code: 'subscription',
      message: 'You have a subscription that will renew. Cancel it in Billing first; you can delete your account straight after.',
      href: '/account/billing',
    });
  }

  const db = openIdentityDb({ readonly: true });
  try {
    const shared = db.prepare(`
      SELECT o.name, COUNT(m.user_id) AS others
        FROM organizations o
        JOIN organization_members m ON m.org_id = o.id AND m.user_id IS NOT NULL AND m.user_id <> o.owner_user_id
       WHERE o.owner_user_id = ?
       GROUP BY o.id
    `).all(user.id) as Array<{ name: string; others: number }>;
    for (const w of shared) {
      blockers.push({
        code: 'workspace',
        message: `You own the team workspace “${w.name}”, which has ${w.others} other member${w.others === 1 ? '' : 's'}. Remove them or hand the workspace over first.`,
        href: '/account/team',
      });
    }
  } catch {
    /* no workspace tables yet: nothing to block on */
  } finally {
    db.close();
  }
  return blockers;
}

/** The account that keeps deleted people's forum posts readable. Created on first use; it cannot sign in. */
export function deletedUserPlaceholderId(): number {
  const db = openIdentityDb();
  try {
    const found = db.prepare('SELECT id FROM router_users WHERE email = ?').get(DELETED_USER_EMAIL) as { id: number } | undefined;
    if (found) return found.id;
    // No password and no OAuth provider, at a reserved .invalid address: there is no way to sign in as it.
    const r = db.prepare(`
      INSERT INTO router_users (email, name, email_verified, subscription_tier, role, created_at, updated_at)
      VALUES (?, 'Deleted user', 1, 'free', 'system', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(DELETED_USER_EMAIL);
    return Number(r.lastInsertRowid);
  } finally {
    db.close();
  }
}

/** Delete the account from the identity database in one transaction. Returns rows touched per table. */
export function deleteIdentityAccount(userId: number, placeholderId: number): Record<string, number> {
  if (userId === placeholderId) throw new Error('Refusing to delete the placeholder account');
  const db = openIdentityDb();
  try {
    const exists = (t: string) => !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`).get(t);
    const counts: Record<string, number> = {};
    const run = (label: string, table: string, sql: string, ...args: unknown[]) => {
      if (exists(table)) counts[label] = db.prepare(sql).run(...args).changes;
    };
    db.transaction(() => {
      // Forum: posts and topics stay so threads still read, attributed to "Deleted user".
      run('forum_posts', 'forum_posts', 'UPDATE forum_posts SET author_id = ? WHERE author_id = ?', placeholderId, userId);
      run('forum_posts_edited', 'forum_posts', 'UPDATE forum_posts SET edited_by = ? WHERE edited_by = ?', placeholderId, userId);
      run('forum_topics', 'forum_topics', 'UPDATE forum_topics SET author_id = ? WHERE author_id = ?', placeholderId, userId);
      run('forum_topics_last_reply', 'forum_topics', 'UPDATE forum_topics SET last_reply_by = ? WHERE last_reply_by = ?', placeholderId, userId);
      run('forum_categories_created', 'forum_categories', 'UPDATE forum_categories SET created_by = ? WHERE created_by = ?', placeholderId, userId);
      run('forum_categories_last_post', 'forum_categories', 'UPDATE forum_categories SET last_post_by = ? WHERE last_post_by = ?', placeholderId, userId);
      run('forum_reports_reporter', 'forum_reports', 'UPDATE forum_reports SET reporter_id = ? WHERE reporter_id = ?', placeholderId, userId);
      run('forum_reports_reviewer', 'forum_reports', 'UPDATE forum_reports SET reviewed_by = ? WHERE reviewed_by = ?', placeholderId, userId);
      run('forum_post_reactions', 'forum_post_reactions', 'DELETE FROM forum_post_reactions WHERE user_id = ?', userId);
      run('forum_user_profiles', 'forum_user_profiles', 'DELETE FROM forum_user_profiles WHERE user_id = ?', userId);

      // Projects in someone else's workspace stay with that workspace.
      run('projects_created', 'projects', 'UPDATE projects SET created_by = ? WHERE created_by = ?', placeholderId, userId);
      run('project_watchlists_added', 'project_watchlists', 'UPDATE project_watchlists SET added_by = ? WHERE added_by = ?', placeholderId, userId);

      // Router tables here are unused copies (the live ones are in the benchmark database).
      for (const t of ['router_requests', 'router_usage', 'router_api_keys', 'router_provider_keys', 'router_preferences']) {
        run(t, t, `DELETE FROM ${t} WHERE user_id = ?`, userId);
      }

      // Workspaces owned alone (deletionBlockers refused the shared ones); members, projects,
      // webhooks, SSO and SCIM configuration cascade with them.
      run('organizations', 'organizations', 'DELETE FROM organizations WHERE owner_user_id = ?', userId);

      // The account. Everything else about it cascades or is unlinked (see the header).
      counts.router_users = db.prepare('DELETE FROM router_users WHERE id = ?').run(userId).changes;
    })();
    return counts;
  } finally {
    db.close();
  }
}
