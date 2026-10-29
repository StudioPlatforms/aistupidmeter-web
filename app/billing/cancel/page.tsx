import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { readCancelLink } from '@/lib/cancel-link';
import { cancelLinkState, type CancelLinkState } from '@/lib/billing-watch';

// Live Stripe state on every visit; never prerendered or cached.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cancel your subscription',
  robots: { index: false, follow: false },
};

type Params = { u?: string; s?: string; t?: string; done?: string; error?: string };

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Where the cancel link in the $4.99 → $12 email lands (lib/cancel-link.ts). Opening it changes
 * nothing; the button posts to /api/billing/cancel, which comes back here with the result.
 */
export default async function CancelSubscriptionPage({ searchParams }: { searchParams: Params }) {
  const link = readCancelLink(searchParams);
  const done = searchParams.done === '1';
  let st: CancelLinkState = { state: 'invalid' };
  if (link) {
    try { st = await cancelLinkState(link.userId, link.subscriptionId, done); }
    catch { st = { state: 'invalid' }; }
  }

  if (st.state === 'invalid') {
    return (
      <AuthShell mode="account">
        <h1 className="au-title">This link is not valid</h1>
        <p className="au-sub">It may have been cut short when it was copied. You can manage your subscription from your account, or reply to our email and we will do it for you.</p>
        <div className="au-stack" style={{ marginTop: 24 }}>
          <Link href="/account/billing" className="au-btn au-btn-primary au-btn-block">Go to billing</Link>
          <Link href="/contact" className="au-btn au-btn-ghost au-btn-block">Contact us</Link>
        </div>
      </AuthShell>
    );
  }

  if (st.state === 'ended') {
    return (
      <AuthShell mode="account">
        <h1 className="au-title">This subscription has ended</h1>
        <p className="au-sub">There is nothing to cancel, and you will not be charged again.</p>
        <div className="au-stack" style={{ marginTop: 24 }}>
          <Link href="/" className="au-btn au-btn-ghost au-btn-block">Back to AI Stupid Level</Link>
        </div>
      </AuthShell>
    );
  }

  if (st.state === 'ending') {
    return (
      <AuthShell mode="account">
        <h1 className="au-title">{done ? 'Your subscription is cancelled' : 'Your subscription is already cancelled'}</h1>
        <div className="au-note au-note-good" role="status">
          {st.endsAt ? <>It stays active until <b>{longDate(st.endsAt)}</b>. </> : 'It stays active until the end of the period you have paid for. '}
          You will not be charged again.
        </div>
        <p className="au-sub" style={{ marginTop: 14 }}>
          After that your account moves to the free plan. Your watchlist and settings stay. Changed your mind? You can
          renew it from <Link href="/account/billing">billing</Link> before then.
        </p>
        <div className="au-stack" style={{ marginTop: 24 }}>
          <Link href="/" className="au-btn au-btn-ghost au-btn-block">Back to AI Stupid Level</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="account">
      <h1 className="au-title">Cancel your subscription?</h1>
      <p className="au-sub">Pro, now <b>{st.amount} a month</b>.</p>
      <ul className="au-list">
        <li>{st.periodEnd ? <>It stays active until <b>{longDate(st.periodEnd)}</b>, the end of the period you have paid for.</> : 'It stays active until the end of the period you have paid for.'}</li>
        <li>You will not be charged again.</li>
        <li>Your account then moves to the free plan. Your watchlist and settings stay.</li>
      </ul>
      {searchParams.error === '1' && (
        <div className="au-note au-note-bad" role="alert">That did not work. Please try again, or reply to our email and we will cancel it for you.</div>
      )}
      <form method="post" action="/api/billing/cancel" className="au-stack" style={{ marginTop: 24 }}>
        <input type="hidden" name="u" value={searchParams.u} />
        <input type="hidden" name="s" value={searchParams.s} />
        <input type="hidden" name="t" value={searchParams.t} />
        <button type="submit" className="au-btn au-btn-primary au-btn-block">Cancel my subscription</button>
        <Link href="/" className="au-btn au-btn-ghost au-btn-block">Keep my subscription</Link>
      </form>
      <p className="au-ref">To keep it, you do not need to do anything.</p>
    </AuthShell>
  );
}
