import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import { confirmAssessmentSession } from '@/lib/assessment';
import '../../../styles/docs.css';

export const metadata: Metadata = {
  title: 'Assessment booked',
  robots: { index: false, follow: false },
};

// Per-customer and verified against Stripe on every load: never cached, never prerendered.
export const dynamic = 'force-dynamic';

export default async function AssessmentConfirmed({ searchParams }: { searchParams?: { session_id?: string } }) {
  const sessionId = searchParams?.session_id ?? '';
  let result: Awaited<ReturnType<typeof confirmAssessmentSession>> | null = null;
  if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
    try { result = await confirmAssessmentSession(sessionId); } catch (e: any) {
      console.error('[assessment] confirmation lookup failed:', e?.message || e);
    }
  }

  return (
    <SubpageLayout>
      <div className="doc">
        {result?.paid ? (
          <header className="doc-head">
            <div className="doc-kicker">Assessment #{result.paid.id}</div>
            <h1>Thank you — your assessment is booked</h1>
            <p className="doc-lead">
              Payment received. A confirmation is on its way to {result.paid.email}, and Stripe sends the invoice
              separately.
            </p>
            <div className="doc-prose">
              <h3>What happens next</h3>
              <ol>
                <li>Within two business days, a member of the team writes to you to agree the tasks, the three candidate models and what “good” means for your workload.</li>
                <li>You send your tasks; we build the suite and run it against the candidates.</li>
                <li>You receive the decision report within seven business days of us having your tasks.</li>
              </ol>
              <p>If, once we have read your workload, we cannot measure it, we refund the full amount before any work starts. To reach us sooner, reply to the confirmation email or use the <Link href="/contact?topic=sales">contact page</Link>.</p>
            </div>
            <div className="doc-actions"><Link className="doc-btn" href="/">Back to the leaderboards</Link></div>
          </header>
        ) : result?.processing ? (
          <header className="doc-head">
            <div className="doc-kicker">Workload assessment</div>
            <h1>Your payment is being processed</h1>
            <p className="doc-lead">Stripe has not confirmed the payment yet. You will receive a confirmation email as soon as it does — there is nothing more to do.</p>
          </header>
        ) : (
          <header className="doc-head">
            <div className="doc-kicker">Workload assessment</div>
            <h1>We could not confirm this booking</h1>
            <p className="doc-lead">
              If you completed a payment, it is safe — the confirmation email is the record. Otherwise you can{' '}
              <Link href="/assessment">book again</Link> or <Link href="/contact?topic=sales">contact us</Link>.
            </p>
          </header>
        )}
      </div>
    </SubpageLayout>
  );
}
