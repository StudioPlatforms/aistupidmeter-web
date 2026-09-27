'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ASSESSMENT_PRICE_LABEL } from '@/lib/assessment-price';

/**
 * The assessment offer and its booking form.
 *
 * States exactly what is included, what happens after payment, and the two refund conditions —
 * a fixed-scope first purchase only works if nothing about it is vague. Submitting stores the
 * request and continues to Stripe Checkout (lib/assessment.ts).
 */
export default function AssessmentClient({ cancelled }: { cancelled: boolean }) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="doc">
      <header className="doc-head">
        <div className="doc-kicker">Workload assessment</div>
        <h1>Is the model you chose still the right one?</h1>
        <p className="doc-lead">
          A fixed-scope assessment of one workload against three candidate models, using your tasks rather than
          ours. You get a decision report within seven business days of us having what we need — including, where
          the evidence supports it, a recommendation to change nothing.
        </p>
      </header>

      <div className="asmt">
        <div className="asmt-info doc-prose">
          <p className="asmt-price"><b>{ASSESSMENT_PRICE_LABEL}</b> <span>one-off, fixed scope · USD, excluding any applicable tax</span></p>

          <h3>What is included</h3>
          <ul>
            <li>One workload, up to 20 tasks you supply, with the answer keys held out of the prompts</li>
            <li>Three candidate models, up to 1,000 standard execution units, several trials per task</li>
            <li>Two hours of expert time, and a concise decision report</li>
          </ul>

          <h3>How it works</h3>
          <ol>
            <li><b>Book and pay</b> below. Payment is by card through Stripe, and an invoice with your company details is issued automatically.</li>
            <li><b>We confirm the scope within two business days</b> — the tasks, the three models and what “good” means for your workload.</li>
            <li><b>You send your tasks.</b> We build the suite and run it repeatedly against the candidates.</li>
            <li><b>You get the report</b> within seven business days of us having your tasks.</li>
          </ol>

          <h3>Guarantees</h3>
          <ul>
            <li>If, once we have read your workload, we cannot measure it, we refund the full amount before any work starts.</li>
            <li>If we cannot deliver the agreed report, we refund in full.</li>
            <li>The full amount is credited against an annual plan bought within 30 days, up to that plan’s price — with Teams, the year costs nothing extra.</li>
          </ul>
          <p className="doc-muted">
            Provider inference is billed to your own API keys under a cap you agree first, so the cost of running
            the models is never hidden in our price. Your tasks stay yours: never published, never added to the
            public benchmark.
          </p>
        </div>

        <div className="asmt-form-col">
          {cancelled && (
            <p className="asmt-notice">Payment was not completed, so nothing was charged. You can book again below whenever you are ready.</p>
          )}
          <form onSubmit={submit} className="asmt-form">
            <h2>Book your assessment</h2>
            <label>
              Your email
              <input name="email" type="email" required defaultValue={session?.user?.email ?? ''} placeholder="you@company.com" />
            </label>
            <label>
              Company <span>(optional)</span>
              <input name="company" maxLength={200} />
            </label>
            <label>
              What decision do you need to make?
              <textarea name="workload" required rows={5} maxLength={4000}
                placeholder="e.g. We use Claude Sonnet for support-ticket triage and are considering moving to a cheaper model. We need to know whether quality would hold." />
            </label>
            <label>
              Candidate models <span>(optional)</span>
              <input name="models" maxLength={500} placeholder="claude-sonnet-5, gpt-5.6-terra, deepseek-v4-pro" />
            </label>
            <label>
              Roughly how many tasks? <span>(optional, up to 20)</span>
              <input name="taskCount" type="number" min={1} max={20} />
            </label>

            {error && <p className="asmt-error" role="alert">{error}</p>}

            <button type="submit" disabled={busy} className="doc-btn is-primary asmt-submit">
              {busy ? 'Opening secure checkout…' : `Continue to secure payment — ${ASSESSMENT_PRICE_LABEL}`}
            </button>
            <p className="asmt-fine">
              You will be taken to Stripe to pay. Questions first? <a href="/contact?topic=sales">Contact us</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
