import { openIdentityDb } from '@/lib/identity-db';
import type { User } from '@/lib/db-client';

/**
 * Account deletion, identity-database half (the benchmark-database half is the API's
 * POST /api/account-purge; app/api/account/delete runs both, that one first).
 *
 * What goes: the account and everything that is only about it — watchlists, alert
 * preferences and deliveries, activation events, UI preferences, workspace and project
 * memberships (project_members), router credits, SSO tickets, billing notices (all ON DELETE CASCADE), the
 * forum profile and reactions, workspaces the person owns alone, provider-account
 * memberships, and the delivery records of the host alerts and transfer notices mailed to it. What stays, without a link to the person: forum posts and topics (re-attributed
 * to the "Deleted user" placeholder so threads still read), provider-account legal and
 * moderation records (acceptances, actions, appeals, complaints, notices, reports: re-attributed
 * the same way), invitations other workspaces and provider accounts sent to the address, contact
 * messages, assessment requests, audit events and the team watchlist entries they added (ON
 * DELETE SET NULL). Stripe keeps invoices, as it must.
 */

export const DELETED_USER_EMAIL = 'deleted-user@aistupidlevel.invalid';

/**
 * Workspaces this account owns (deletionBlockers has already refused any with other members),
 * and their projects: the benchmark-database half deletes their shared provider keys and
 * budget counters, which live there.
 */
export function ownedWorkspaceIds(userId: number): { orgIds: number[]; projectIds: number[] } {
  const db = openIdentityDb();
  try {
    const orgIds = (db.prepare('SELECT id FROM organizations WHERE owner_user_id = ?').all(userId) as Array<{ id: number }>).map(r => r.id);
    const projectIds = orgIds.length
      ? (db.prepare(`SELECT id FROM projects WHERE org_id IN (${orgIds.map(() => '?').join(',')})`).all(...orgIds) as Array<{ id: number }>).map(r => r.id)
      : [];
    return { orgIds, projectIds };
  } finally {
    db.close();
  }
}

export interface DeletionBlocker {
  code: 'subscription' | 'workspace' | 'provider';
  message: string;
  href?: string;
}

/** The provider accounts (not closed) this person owns, by name; [] without the provider tables. */
function ownedProviders(db: ReturnType<typeof openIdentityDb>, userId: number): string[] {
  try {
    return (db.prepare(`
      SELECT p.display_name AS name
        FROM marketplace_provider_members m JOIN marketplace_providers p ON p.id = m.provider_id
       WHERE m.user_id = ? AND m.role = 'owner' AND m.removed_at IS NULL AND p.state <> 'closed'
    `).all(userId) as Array<{ name: string }>).map(r => r.name);
  } catch {
    return [];   // no provider tables yet: nothing to block on
  }
}

export const providerBlockerMessage = (name: string) =>
  `You own the provider account “${name}”. Close it or transfer ownership first.`;

/**
 * Thrown by deleteIdentityAccount when, by the time its transaction runs, the person owns a provider
 * account (an ownership transfer accepted while the deletion was under way). Nothing in the identity
 * database has changed then; the route says so.
 */
export class ProviderOwnerError extends Error {
  constructor(readonly providerName: string) {
    super(providerBlockerMessage(providerName));
    this.name = 'ProviderOwnerError';
  }
}

/** Reasons the account cannot be deleted yet. Empty means it can. */
export function deletionBlockers(user: User): DeletionBlocker[] {
  const blockers: DeletionBlocker[] = [];

  // A subscription that will renew would keep charging an account that no longer exists.
  // Cancelled ones (subscription_canceled_at set) do not renew, so they do not block; one can
  // still have an unpaid invoice Stripe is retrying, so the deletion route ends the account's
  // billing before anything is deleted (lib/billing-end.ts endCustomerBilling).
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
  }
  try {
    // A provider account must keep an owner while it exists: the owner closes it or transfers
    // ownership first. A closed one does not block.
    for (const name of ownedProviders(db, user.id)) {
      blockers.push({ code: 'provider', message: providerBlockerMessage(name), href: '/account/provider' });
    }
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
      // Checked again here, inside the transaction: an ownership transfer accepted while the
      // benchmark-database half ran would otherwise leave that provider account with no owner.
      const owned = ownedProviders(db, userId);
      if (owned.length) throw new ProviderOwnerError(owned[0]);

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

      // Provider accounts. Memberships go (an owner of one that is not closed was refused above).
      // Invitations other provider accounts sent to this address stay theirs, as workspace
      // invitations do. The legal and moderation records stay, linked to "Deleted user" instead: an
      // acceptance's signer_user_id is outside its hash, so the record chain still verifies.
      run('marketplace_provider_members', 'marketplace_provider_members', 'DELETE FROM marketplace_provider_members WHERE user_id = ?', userId);
      const relink: Array<[string, string]> = [
        ['marketplace_agreement_acceptances', 'signer_user_id'],
        ['marketplace_providers', 'created_by'],
        ['marketplace_providers', 'approved_by'],
        ['marketplace_actions', 'actor_user_id'],
        ['marketplace_appeals', 'submitted_by'],
        ['marketplace_appeals', 'decided_by'],
        ['marketplace_complaints', 'submitted_by'],
        ['marketplace_complaints', 'decided_by'],
        ['marketplace_notices', 'acknowledged_by'],
        ['marketplace_reports', 'reporter_user_id'],
      ];
      for (const [table, column] of relink) {
        run(`${table}_${column}`, table, `UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, placeholderId, userId);
      }
      // A user-run test's statement of reasons (DSA Art. 17; API F7) was mailed to this address: the delivery row stays
      // as the evidence that it was sent, without the address (F7 review MINOR-6). Counted only when one was sent.
      if (exists('marketplace_deliveries')) {
        const email = (db.prepare('SELECT email FROM router_users WHERE id = ?').get(userId) as { email: string | null } | undefined)?.email;
        if (email) {
          const n = db.prepare(`UPDATE marketplace_deliveries SET to_email = 'deleted-account' WHERE kind = 'user_test_statement' AND lower(to_email) = lower(?)`).run(email).changes;
          if (n > 0) counts.marketplace_deliveries_user_test = n;
          // The alerts a listed host's drop sent to this address as a follower of the model (API M17, host_alert) and the
          // notices of a connected host's transfer change (API M13, transfer_change) are about this person only: their
          // delivery rows go. Counted only when one was sent.
          const m = db.prepare(`DELETE FROM marketplace_deliveries WHERE kind IN ('host_alert', 'transfer_change') AND lower(to_email) = lower(?)`).run(email).changes;
          if (m > 0) counts.marketplace_deliveries_alerts = m;
        }
      }

      // The account. Everything else about it cascades or is unlinked (see the header).
      counts.router_users = db.prepare('DELETE FROM router_users WHERE id = ?').run(userId).changes;
    })();
    return counts;
  } finally {
    db.close();
  }
}
