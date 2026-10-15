import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { auth } from '@/auth';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { confirmAssessmentSession } from '@/lib/assessment';
import '@/styles/landing.css';
import '@/styles/assessment.css';

export const metadata: Metadata = {
  title: 'Assessment booked',
  robots: { index: false, follow: false },
};

// Per-customer and verified against Stripe on every load: never cached, never prerendered.
export const dynamic = 'force-dynamic';

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

export default async function AssessmentConfirmed({ searchParams }: { searchParams?: { session_id?: string } }) {
  const sessionId = searchParams?.session_id ?? '';
  let result: Awaited<ReturnType<typeof confirmAssessmentSession>> | null = null;
  if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
    try { result = await confirmAssessmentSession(sessionId); } catch (e: any) {
      console.error('[assessment] confirmation lookup failed:', e?.message || e);
    }
  }
  // "/" is the leaderboard for a signed-in visitor and the landing page for everyone else.
  const signedIn = Boolean((await auth().catch(() => null))?.user);

  return (
    <SubpageLayout>
      <div className={`lp lp-sub lp-asmt ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />
        <header className="lp-hero lp-textured as-done">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            {result?.paid ? (
              <>
                <p className="lp-kicker lp-intro" style={intro('.04s')}>Assessment #{result.paid.id}</p>
                <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                  Thank you — <span className="lp-b">your assessment is booked</span>
                </h1>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  Payment received. A confirmation is on its way to {result.paid.email}, and Stripe sends the invoice
                  separately.
                </p>
                <div className="as-next lp-intro" style={intro('.26s')}>
                  <h2 className="as-h">What happens next</h2>
                  <ol className="as-steps">
                    <li><span>Within two business days, a member of the team writes to you to agree the tasks, the three candidate models and what “good” means for your workload.</span></li>
                    <li><span>You send your tasks; we build the suite and run it against the candidates.</span></li>
                    <li><span>You receive the decision report within seven business days of us having your tasks.</span></li>
                  </ol>
                  <p className="as-muted">
                    If, once we have read your workload, we cannot measure it, we refund the full amount before any work
                    starts. To reach us sooner, reply to the confirmation email or use the{' '}
                    <Link href="/contact?topic=sales">contact page</Link>.
                  </p>
                </div>
                <div className="lp-cta lp-intro" style={intro('.32s')}>
                  <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/">
                    {signedIn ? 'Back to the leaderboards' : 'Back to the home page'} <span className="lp-ar" aria-hidden="true">→</span>
                  </Link>
                </div>
              </>
            ) : result?.processing ? (
              <>
                <p className="lp-kicker lp-intro" style={intro('.04s')}>Workload assessment</p>
                <h1 className="lp-h1 lp-intro" style={intro('.1s')}>Your payment is being processed</h1>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  Stripe has not confirmed the payment yet. You will receive a confirmation email as soon as it does —
                  there is nothing more to do.
                </p>
              </>
            ) : (
              <>
                <p className="lp-kicker lp-intro" style={intro('.04s')}>Workload assessment</p>
                <h1 className="lp-h1 lp-intro" style={intro('.1s')}>We could not confirm this booking</h1>
                <p className="lp-lead lp-intro" style={intro('.18s')}>
                  If you completed a payment, it is safe — the confirmation email is the record. Otherwise you can{' '}
                  <Link href="/assessment">book again</Link> or <Link href="/contact?topic=sales">contact us</Link>.
                </p>
              </>
            )}
          </div>
        </header>
      </div>
    </SubpageLayout>
  );
}
