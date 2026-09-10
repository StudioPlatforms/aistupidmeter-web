import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { openIdentityDb } from '@/lib/identity-db';
import { sendContactNotification, sendContactAcknowledgement } from '@/lib/email-service';
import { findUserByEmail } from '@/lib/db-client';
import { planFor } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

const TOPICS = new Set(['general', 'enterprise', 'sales', 'support', 'security', 'press']);

/**
 * Rate limit by IP, in process.
 *
 * A public form that sends mail is a spam relay waiting to happen. This is not
 * a security boundary — the process restarts, and a determined sender rotates
 * addresses — but it stops the ordinary case of a bot hammering the endpoint
 * from turning into a few thousand messages in the operator's inbox.
 */
const RATE_WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived process.
  if (hits.size > 5_000) {
    hits.forEach((times: number[], key: string) => {
      if (!times.some(t => now - t < RATE_WINDOW_MS)) hits.delete(key);
    });
  }
  return false;
}

function clientIp(request: NextRequest): string {
  // nginx sets X-Forwarded-For; the first entry is the original client.
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Public contact form.
 *
 * Storage happens first and mail second, on purpose. Postfix runs on this same
 * box; if it is wedged or the queue is backed up, an enquiry that only existed
 * as an email would be gone. The row is the record of contact, and `notified`
 * says whether the operator has been told yet — so a backlog can be replayed
 * instead of guessed at.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    if (rateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'rate_limited', message: 'You have sent several messages already. Please give us a chance to reply first.' },
        { status: 429 }
      );
    }

    const session = await auth();
    const body = await request.json().catch(() => ({}));

    // Honeypot: a field hidden from people and irresistible to naive bots. A
    // filled one is silently accepted so the bot does not learn to adapt.
    if (String(body.website ?? '').trim()) {
      console.log(`[contact] honeypot triggered from ${ip}`);
      return NextResponse.json({ success: true, data: { id: 0 } });
    }

    const email = String(body.email ?? session?.user?.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim().slice(0, 120) || null;
    const company = String(body.company ?? '').trim().slice(0, 160) || null;
    const topicRaw = String(body.topic ?? 'general').trim();
    const topic = TOPICS.has(topicRaw) ? topicRaw : 'general';
    const message = String(body.message ?? '').trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Tell us a little more — a sentence or two is enough.' },
        { status: 400 }
      );
    }
    if (message.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'That is longer than this form accepts. Email us directly instead.' },
        { status: 400 }
      );
    }

    const db = openIdentityDb();
    const info = db.prepare(`
      INSERT INTO contact_messages
        (user_id, name, email, company, topic, message, source_ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session?.user?.id ? Number(session.user.id) : null,
      name, email, company, topic, message,
      ip, (request.headers.get('user-agent') ?? '').slice(0, 400)
    );
    const id = Number(info.lastInsertRowid);

    // Context worth having in the notification: whether this is a paying
    // customer is the first thing you want to know before replying.
    let accountPlan: string | null = null;
    try {
      const account = findUserByEmail(email);
      if (account) accountPlan = `${planFor(account as any)} (user #${account.id})`;
    } catch {
      /* best effort only */
    }

    const notified = await sendContactNotification({ id, name, email, company, topic, message, accountPlan });
    if (notified.success) {
      db.prepare('UPDATE contact_messages SET notified = 1 WHERE id = ?').run(id);
    } else {
      console.error(`[contact] #${id} stored but NOT emailed:`, notified.error);
    }

    // The acknowledgement is a courtesy; failing to send it must not fail the
    // request, because the message is already safely recorded.
    void sendContactAcknowledgement(email, name, topic);

    console.log(`[contact] #${id} from ${email} (${topic})`);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[contact] submission failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not send your message. Please email us directly.' },
      { status: 500 }
    );
  }
}
