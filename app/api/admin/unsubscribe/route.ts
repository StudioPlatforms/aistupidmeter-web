import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { openIdentityDb } from '@/lib/identity-db';
import { requireAdminSession } from '@/lib/admin-auth';

// Per-request: writes account settings, must never be prerendered or cached.
export const dynamic = 'force-dynamic';

const EMAIL = /[^\s<>"',;:()[\]]+@[^\s<>"',;:()[\]]+\.[a-z]{2,}/gi;

type Outcome = 'unsubscribed' | 'already' | 'no_account';

/**
 * Unsubscribe the accounts behind pasted email addresses, for people who reply "unsubscribe" to
 * product mail. It makes the same change as the one-click link (app/api/unsubscribe): weekly digest,
 * email alerts and provider alerts off. The mail scripts in /root/admin/mail skip any account with
 * alerts and digest off. Account mail (sign-in, password reset) is not affected.
 *
 * The preferences row is created first when the account never opened its alert settings, with an
 * unsubscribe token the way the API's ensureAlertPreferences makes one.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  // JSON only: a cross-site form cannot send it, so the session cookie alone cannot be used to call this.
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return NextResponse.json({ error: 'Send JSON: { "text": "..." }' }, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  const text: string = typeof body?.text === 'string' ? body.text.slice(0, 20000) : '';
  const emails = Array.from(new Set((text.match(EMAIL) || []).map((e: string) => e.toLowerCase()))).slice(0, 200);
  if (emails.length === 0) return NextResponse.json({ error: 'No email address found in the text.' }, { status: 400 });

  const db = openIdentityDb();
  try {
    const findUsers = db.prepare('SELECT id FROM router_users WHERE lower(trim(email)) = ?');
    const prefs = db.prepare('SELECT email_alerts, weekly_digest, provider_alerts FROM alert_preferences WHERE user_id = ?');
    const addPrefs = db.prepare('INSERT OR IGNORE INTO alert_preferences (user_id, unsubscribe_token) VALUES (?, ?)');
    const switchOff = db.prepare(`
      UPDATE alert_preferences
         SET weekly_digest = 0, email_alerts = 0, provider_alerts = 0,
             updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       WHERE user_id = ?`);

    const results = db.transaction(() => emails.map(email => {
      const users = findUsers.all(email) as { id: number }[];
      if (users.length === 0) return { email, outcome: 'no_account' as Outcome };
      let changed = false;
      for (const { id } of users) {
        const p = prefs.get(id) as { email_alerts: number; weekly_digest: number; provider_alerts: number } | undefined;
        if (p && p.email_alerts === 0 && p.weekly_digest === 0 && p.provider_alerts === 0) continue;
        addPrefs.run(id, randomBytes(24).toString('hex'));
        switchOff.run(id);
        changed = true;
      }
      return { email, outcome: (changed ? 'unsubscribed' : 'already') as Outcome };
    }))();

    const count = (o: Outcome) => results.filter(r => r.outcome === o).length;
    console.log(`[admin-unsubscribe] by user ${admin.userId}: ${count('unsubscribed')} unsubscribed, ` +
      `${count('already')} already, ${count('no_account')} without an account`);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[admin-unsubscribe] failed:', error);
    return NextResponse.json({ error: 'Could not update the accounts. Nothing was changed.' }, { status: 500 });
  } finally {
    db.close();
  }
}
