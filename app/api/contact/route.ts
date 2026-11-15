import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { openIdentityDb } from '@/lib/identity-db';
import { sendContactNotification, sendContactAcknowledgement } from '@/lib/email-service';
import { findUserByEmail } from '@/lib/db-client';
import { planFor } from '@/lib/entitlements';
import { clientIp } from '@/lib/ip-rate-limit';
import { refuseMailForm } from '@/lib/mail-form-guard';
import { validateEmail } from '@/lib/password';

/** The site's own pages: a browser always sends Origin on this POST, and nothing else may submit the form. */
const ORIGINS = new Set(['https://aistupidlevel.info', 'https://www.aistupidlevel.info']);

/** A single-line field: no control characters (CR, LF, NUL…), so nothing can break out into a mail header. */
const oneLine = (v: unknown, max: number): string | null =>
  String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || null;

export const dynamic = 'force-dynamic';

// The form's own topics (app/contact/ContactClient.tsx). One missing here is filed as 'general':
// custom-benchmark was, from the day it was added to the form until 2026-11-02.
// Every topic also needs its label in lib/email-service.ts (TOPIC_LABEL), or the mail shows the raw id.
const TOPICS = new Set(['general', 'enterprise', 'sales', 'custom-benchmark', 'support', 'security', 'press', 'provider', 'investment']);

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

/**
 * A cap across all senders. The per-address limit above does nothing against a sender that rotates
 * addresses (Tor, proxies), so at most GLOBAL_MAX messages an hour are taken from everyone together,
 * and at most ACK_MAX acknowledgements are mailed: the acknowledgement goes to an address typed into
 * the form, so without a cap the form could be used to mail strangers.
 */
const GLOBAL_MAX = 30;
const ACK_MAX = 10;
let accepted: number[] = [];
let acknowledged: number[] = [];
function underCap(list: number[], max: number): { ok: boolean; kept: number[] } {
  const now = Date.now();
  const kept = list.filter(t => now - t < RATE_WINDOW_MS);
  if (kept.length >= max) return { ok: false, kept };
  kept.push(now);
  return { ok: true, kept };
}

/** Reserved names that never receive mail (RFC 2606, RFC 6761): only tests and scripts type them. */
function reservedDomain(email: string): boolean {
  const domain = email.split('@')[1] ?? '';
  return /^(example\.(com|net|org)|[^@]*\.(example|test|invalid|localhost))$/i.test(domain) || /(^|\.)example\.(com|net|org)$/i.test(domain);
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
    const refused = await refuseMailForm(request, 'contact');
    if (refused) return refused;
    if (!ORIGINS.has(request.headers.get('origin') ?? '')) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }

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
    const name = oneLine(body.name, 120);
    const company = oneLine(body.company, 160);
    const topicRaw = String(body.topic ?? 'general').trim();
    const topic = TOPICS.has(topicRaw) ? topicRaw : 'general';
    const message = String(body.message ?? '').trim();

    if (!validateEmail(email)) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (reservedDomain(email)) {
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

    const cap = underCap(accepted, GLOBAL_MAX);
    accepted = cap.kept;
    if (!cap.ok) {
      console.warn(`[contact] global cap of ${GLOBAL_MAX}/h reached; refused ${ip}`);
      return NextResponse.json(
        { success: false, error: 'busy', message: 'We are receiving an unusual number of messages. Please try again in an hour, or email us directly.' },
        { status: 429 }
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
    const ack = underCap(acknowledged, ACK_MAX);
    acknowledged = ack.kept;
    if (ack.ok) void sendContactAcknowledgement(email, name);
    else console.warn(`[contact] #${id}: acknowledgement cap of ${ACK_MAX}/h reached; none sent`);

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
