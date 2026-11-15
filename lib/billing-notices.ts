/**
 * The billing log: one row per thing the billing code did, in the identity database's
 * billing_notices table (UNIQUE kind + ref, so a rerun never repeats one). Shared by the billing
 * watch (lib/billing-watch.ts), the paid start and refund window (lib/paid-start.ts) and the
 * Stripe webhook; the admin dashboard shows it.
 *
 * `once()` claims a (kind, ref) before acting (paid start, 2026-11-13). The first payment of a
 * subscription fires customer.subscription.created and checkout.session.completed milliseconds
 * apart, and both handlers confirm the purchase: checked-then-recorded, both found nothing and
 * both sent the email. The claim is the row itself, marked in progress; it becomes the record
 * when the action works and is removed when it does not, so a failed email is tried again on the
 * next run, as before. A claim left in progress for 15 minutes (the server stopped half way) is
 * taken over by the next attempt rather than counted as done.
 */
import { openIdentityDb } from '@/lib/identity-db';

export type NoticeKind =
  | 'duplicate_cancelled' | 'payment_failed' | 'downgraded' | 'cancelled_unpaid'
  | 'legacy_price_notice' | 'legacy_price_changed' | 'legacy_now_pro' | 'cancelled_from_email'
  // Before 2026-10-29 a $4.99 subscription ended at 12 months; these remain in the log.
  | 'legacy_end_scheduled' | 'legacy_ended' | 'legacy_end_reverted'
  // Paid start and the 7-day refund window (lib/paid-start.ts), from 2026-11-13.
  | 'paid_start' | 'purchase_confirmed' | 'refunded_in_window' | 'refund_confirmed' | 'refund_failed'
  | 'granted_late' | 'upgrade_voided'
  // A refund's plan-change credit, decided once per subscription (2026-11-14).
  | 'credit_reversed';

export interface WatchAction {
  kind: NoticeKind;
  userId: number | null;
  email: string | null;
  /** The Stripe object it is about (a subscription or invoice id), or user:<id> for per-account notices. */
  ref: string;
  detail: string;
  done: boolean;
  error?: string;
}

export type Outcome = void | { success: boolean; error?: string };

/** Marks a claimed row until its action has worked. */
const IN_PROGRESS = '(in progress) ';
/** A claim older than this is taken over: the server that made it stopped before finishing. */
const STALE_CLAIM = '-15 minutes';

export function withNotices<T>(fn: (db: ReturnType<typeof openIdentityDb>) => T): T {
  const db = openIdentityDb();
  try {
    // user_id cascades with the account, so account deletion removes these with everything else.
    db.exec(`
      CREATE TABLE IF NOT EXISTS billing_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES router_users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE (kind, ref)
      )
    `);
    return fn(db);
  } finally {
    db.close();
  }
}

/** Whether (kind, ref) is recorded, or claimed by an action still running. */
export function hasNotice(kind: NoticeKind, ref: string): boolean {
  return withNotices(db => !!db.prepare('SELECT 1 FROM billing_notices WHERE kind = ? AND ref = ?').get(kind, ref));
}

/** Record (kind, ref) outright. True when this call wrote it, false when it was already there. */
export function recordNotice(userId: number | null, kind: NoticeKind, ref: string, detail: string): boolean {
  return withNotices(db => db.prepare('INSERT OR IGNORE INTO billing_notices (user_id, kind, ref, detail) VALUES (?, ?, ?, ?)')
    .run(userId, kind, ref, detail).changes > 0);
}

/** Claim (kind, ref): true when this call holds it now. */
function claim(a: Omit<WatchAction, 'done'>): boolean {
  return withNotices(db => {
    db.prepare(`DELETE FROM billing_notices WHERE kind = ? AND ref = ? AND detail LIKE ? AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now', ?)`)
      .run(a.kind, a.ref, `${IN_PROGRESS}%`, STALE_CLAIM);
    return db.prepare('INSERT OR IGNORE INTO billing_notices (user_id, kind, ref, detail) VALUES (?, ?, ?, ?)')
      .run(a.userId, a.kind, a.ref, IN_PROGRESS + a.detail).changes > 0;
  });
}

/**
 * Do something once per (kind, ref): skipped when already recorded (or claimed), only described
 * when dry, recorded when it worked, and released for the next run when it did not (an email that
 * did not send is tried again).
 */
export async function once(a: Omit<WatchAction, 'done'>, run: () => Promise<Outcome>, dryRun: boolean): Promise<WatchAction | null> {
  if (dryRun) return hasNotice(a.kind, a.ref) ? null : { ...a, done: false };
  if (!claim(a)) return null;
  const release = () => withNotices(db => db.prepare('DELETE FROM billing_notices WHERE kind = ? AND ref = ?').run(a.kind, a.ref));
  try {
    const out = await run();
    if (out && !out.success) { release(); return { ...a, done: false, error: out.error || 'not sent' }; }
    withNotices(db => db.prepare('UPDATE billing_notices SET detail = ? WHERE kind = ? AND ref = ?').run(a.detail, a.kind, a.ref));
    return { ...a, done: true };
  } catch (err) {
    release();
    return { ...a, done: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** The most recent notices, newest first, for the admin dashboard. */
export function recentNotices(limit = 40): Array<{ createdAt: string; kind: NoticeKind; userId: number | null; ref: string; detail: string | null }> {
  return withNotices(db => db.prepare(`
    SELECT created_at AS createdAt, kind, user_id AS userId, ref, detail
      FROM billing_notices ORDER BY id DESC LIMIT ?
  `).all(limit) as Array<{ createdAt: string; kind: NoticeKind; userId: number | null; ref: string; detail: string | null }>);
}

/**
 * Refunds recorded (`refunded_in_window`) more than `minutes` ago, by SQLite's own clock, with no
 * `refund_confirmed` yet: lib/paid-start.ts finishRefund records the refund before it takes back
 * the plan-change credit and emails the customer, so one of those two is stuck. A claim still in
 * progress is not a confirmation. For the admin's attention list.
 */
export function refundsUnconfirmed(minutes: number): Array<{ createdAt: string; userId: number | null; ref: string; detail: string | null }> {
  return withNotices(db => db.prepare(`
    SELECT r.created_at AS createdAt, r.user_id AS userId, r.ref, r.detail FROM billing_notices r
     WHERE r.kind = 'refunded_in_window' AND r.created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now', ?)
       AND NOT EXISTS (SELECT 1 FROM billing_notices c WHERE c.kind = 'refund_confirmed' AND c.ref = r.ref
                          AND (c.detail IS NULL OR c.detail NOT LIKE ?))
     ORDER BY r.id DESC
  `).all(`-${minutes} minutes`, `${IN_PROGRESS}%`) as Array<{ createdAt: string; userId: number | null; ref: string; detail: string | null }>);
}

/** Notices of one kind from the last `days` days (by SQLite's own clock), for the admin's attention list. */
export function noticesSince(kind: NoticeKind, days: number): Array<{ createdAt: string; userId: number | null; ref: string; detail: string | null }> {
  return withNotices(db => db.prepare(`
    SELECT created_at AS createdAt, user_id AS userId, ref, detail FROM billing_notices
     WHERE kind = ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now', ?) ORDER BY id DESC
  `).all(kind, `-${days} days`) as Array<{ createdAt: string; userId: number | null; ref: string; detail: string | null }>);
}
