import { NextRequest, NextResponse } from 'next/server';
import { openIdentityDb } from '@/lib/identity-db';

/**
 * One-click unsubscribe.
 *
 * RFC 8058: when a message carries `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
 * the mail client POSTs to the List-Unsubscribe URL with no user interaction. So
 * POST must work with no session and no confirmation step — the token in the URL
 * is the authorisation.
 *
 * GET is deliberately NOT a mutation: link scanners and prefetchers issue GETs,
 * and silently unsubscribing someone because their security appliance followed a
 * link is a real way to lose a customer. GET redirects to a page with a button.
 */
function unsubscribe(token: string): boolean {
  if (!token || token.length < 16) return false;
  const db = openIdentityDb();
  const info = db.prepare(`
    UPDATE alert_preferences
       SET weekly_digest = 0,
           email_alerts  = 0,
           updated_at    = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     WHERE unsubscribe_token = ?
  `).run(token);
  return info.changes > 0;
}

export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  try {
    const ok = unsubscribe(token);
    // Always 200 for one-click: a mail client showing an error to the reader is
    // worse than a silently ignored bad token, and the token is unguessable.
    return NextResponse.json({ success: true, unsubscribed: ok });
  } catch (err) {
    console.error('[unsubscribe] failed:', err);
    return NextResponse.json({ success: true, unsubscribed: false });
  }
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  return NextResponse.redirect(
    new URL(`/unsubscribe?t=${encodeURIComponent(token)}`, process.env.NEXT_PUBLIC_APP_URL || request.url)
  );
}
