'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';

/**
 * The assessment booking form (the offer around it is app/assessment/page.tsx).
 *
 * Submitting stores the request and continues to Stripe Checkout (lib/assessment.ts). Styled by
 * the shared landing forms (styles/landing-forms.css, lf-*).
 */
export default function AssessmentClient({ cancelled }: { cancelled: boolean }) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionEmail = session?.user?.email ?? '';

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fd.get('email'), company: fd.get('company'),
          workload: fd.get('workload'), models: fd.get('models'),
          taskCount: fd.get('taskCount'),
        }),
      });
      const d = await r.json();
      if (d?.success && d.data?.url) { window.location.href = d.data.url; return; }
      setError(d?.error ?? 'Something went wrong');
    } catch { setError('Network error — please try again.'); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="lf-card as-form lp-up">
      <h2 className="lf-title">Book your assessment</h2>
      {cancelled && (
        <p className="lf-note is-warn">Payment was not completed, so nothing was charged. You can book again below whenever you are ready.</p>
      )}

      <div className="lf-field">
        <label className="lf-label" htmlFor="as-email">Your email <span className="lf-req" aria-hidden="true">*</span></label>
        {/* Keyed by the session's address: the session usually arrives after the first render, and
            an uncontrolled field only reads its default once. */}
        <input key={sessionEmail || 'anon'} id="as-email" name="email" type="email" required className="lf-input"
          defaultValue={sessionEmail} placeholder="you@company.com" autoComplete="email" />
      </div>
      <div className="lf-field">
        <label className="lf-label" htmlFor="as-company">Company <span className="lf-opt">(optional)</span></label>
        <input id="as-company" name="company" maxLength={200} className="lf-input" autoComplete="organization" />
      </div>
      <div className="lf-field">
        <label className="lf-label" htmlFor="as-workload">What decision do you need to make? <span className="lf-req" aria-hidden="true">*</span></label>
        <textarea id="as-workload" name="workload" required rows={5} maxLength={4000} className="lf-input lf-area"
          placeholder="e.g. We use Claude Sonnet for support-ticket triage and are considering moving to a cheaper model. We need to know whether quality would hold." />
      </div>
      <div className="lf-field">
        <label className="lf-label" htmlFor="as-models">Candidate models <span className="lf-opt">(optional)</span></label>
        <input id="as-models" name="models" maxLength={500} className="lf-input" placeholder="claude-sonnet-5, gpt-5.6-terra, deepseek-v4-pro" />
      </div>
      <div className="lf-field">
        <label className="lf-label" htmlFor="as-tasks">Roughly how many tasks? <span className="lf-opt">(optional, up to 20)</span></label>
        <input id="as-tasks" name="taskCount" type="number" min={1} max={20} className="lf-input as-num" inputMode="numeric" />
      </div>

      {error && <p className="lf-note" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="lp-btn lp-btn-primary lp-btn-lg lf-send as-submit">
        {busy
          ? <><span className="lf-spin" aria-hidden="true" />Opening secure checkout…</>
          : <>Continue to secure payment — {ASSESSMENT_PRICE_LABEL}</>}
      </button>
      <p className="lf-fine">
        You will be taken to Stripe to pay. Questions first? <a href="/contact?topic=sales">Contact us</a>.
      </p>
    </form>
  );
}
