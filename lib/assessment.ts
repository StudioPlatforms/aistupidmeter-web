import Stripe from 'stripe';
import { openIdentityDb } from '@/lib/identity-db';
import { sendAssessmentConfirmation, sendAssessmentNotification } from '@/lib/email-service';

/**
 * The workload assessment: a fixed-scope, one-off purchase.
 *
 * PAYMENT COMES FIRST, WITH A SCOPING GUARANTEE
 * ---------------------------------------------
 * It used to be request → conversation → invoice, so that nobody paid before we knew the
 * workload was measurable. In practice that made it a free enquiry form for a $1,290 service
 * (no request was ever made). Now the customer pays at booking, and the guarantee carries the
 * risk instead: we confirm scope within two business days, and if we cannot measure the
 * workload we refund in full before any work starts. Refunds are issued from the Stripe
 * dashboard.
 *
 * ONE PATH TO "PAID"
 * ------------------
 * Both the Stripe webhook and the confirmation page call `markAssessmentPaid`. The UPDATE is
 * conditional on `paid_at IS NULL`, so whichever arrives first records the payment and sends
 * the two emails; the other is a no-op.
 */

import { ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';
export { ASSESSMENT_PRICE_USD, ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' });

export function assessmentPriceId(): string | null {
  const id = process.env.STRIPE_PRICE_ASSESSMENT;
  return id && id.trim() ? id.trim() : null;
}

export interface AssessmentIntake {
  userId: number | null;
  contactEmail: string;
  company: string | null;
  workload: string;
  candidateModels: string | null;
  taskCount: number | null;
}

/** Store the request (awaiting payment) and open a Stripe Checkout for it. Returns the Checkout URL. */
export async function startAssessmentCheckout(intake: AssessmentIntake): Promise<{ id: number; url: string }> {
  const priceId = assessmentPriceId();
  if (!priceId) throw Object.assign(new Error('STRIPE_PRICE_ASSESSMENT is not configured'), { code: 'unconfigured' });

  const db = openIdentityDb();
  const info = db.prepare(`
    INSERT INTO assessment_requests
      (user_id, contact_email, company, workload, candidate_models, task_count, status)
    VALUES (?, ?, ?, ?, ?, ?, 'awaiting_payment')
  `).run(intake.userId, intake.contactEmail, intake.company, intake.workload, intake.candidateModels, intake.taskCount);
  const id = Number(info.lastInsertRowid);

  const meta = { kind: 'assessment', requestId: String(id) };
  const app = process.env.NEXT_PUBLIC_APP_URL;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: intake.contactEmail,
    customer_creation: 'always',
    client_reference_id: String(id),
    metadata: meta,
    // Cards only: with delayed methods (bank debits) Checkout completes before the money has
    // arrived, and "completed" would no longer mean "paid".
    payment_method_types: ['card'],
    payment_intent_data: { description: `Workload assessment #${id}`, metadata: meta },
    // A business buyer needs a proper invoice, with its address and VAT/tax number on it.
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    invoice_creation: {
      enabled: true,
      invoice_data: { description: `AI Stupid Level workload assessment #${id}`, metadata: meta },
    },
    allow_promotion_codes: true,
    success_url: `${app}/assessment/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${app}/assessment?cancelled=1`,
  });

  db.prepare(`
    UPDATE assessment_requests
       SET stripe_session_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?
  `).run(session.id, id);

  if (!session.url) throw new Error('Stripe returned no Checkout URL');
  return { id, url: session.url };
}

const isPaid = (s: Stripe.Checkout.Session) =>
  s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required');

const usd = (cents: number | null | undefined) =>
  typeof cents === 'number'
    ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
    : ASSESSMENT_PRICE_LABEL;

/**
 * Record a completed assessment payment. Idempotent. Returns the request id when the session is
 * a paid assessment (whether or not this call was the one that recorded it), otherwise null.
 */
export async function markAssessmentPaid(session: Stripe.Checkout.Session): Promise<{ id: number; email: string } | null> {
  if (session.metadata?.kind !== 'assessment' || !isPaid(session)) return null;
  const id = Number(session.metadata.requestId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const db = openIdentityDb();
  const res = db.prepare(`
    UPDATE assessment_requests
       SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), amount_cents = ?,
           stripe_session_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ? AND paid_at IS NULL
  `).run(session.amount_total ?? null, session.id, id);

  const row = db.prepare(`
    SELECT id, contact_email, company, workload, candidate_models, task_count FROM assessment_requests WHERE id = ?
  `).get(id) as { id: number; contact_email: string; company: string | null; workload: string; candidate_models: string | null; task_count: number | null } | undefined;
  if (!row) return null;

  if (res.changes === 1) {
    const amount = usd(session.amount_total);
    // Best-effort: the row is the record of the booking; a mail failure must not lose it.
    void sendAssessmentNotification({
      id, contactEmail: row.contact_email, company: row.company, workload: row.workload,
      candidateModels: row.candidate_models, taskCount: row.task_count, amount,
    }).then((r) => { if (!r.success) console.error(`[assessment] #${id} paid but operator NOT emailed:`, r.error); });
    void sendAssessmentConfirmation(row.contact_email, { id, amount })
      .then((r) => { if (!r.success) console.error(`[assessment] #${id} paid but customer NOT emailed:`, r.error); });
    console.log(`[assessment] #${id} paid (${amount}) by ${row.contact_email}`);
  }
  return { id, email: row.contact_email };
}

/** For the confirmation page: look the session up at Stripe (never trust the query string). */
export async function confirmAssessmentSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = await markAssessmentPaid(session);
  return { paid, processing: !paid && session.metadata?.kind === 'assessment' && session.status === 'complete' };
}
