'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * The assessment offer and its intake form.
 *
 * The copy states what is included, what is not, and the refund condition —
 * because the strategy's whole argument for this offer is that it is a small,
 * bounded, honest first purchase. Vagueness here would defeat the point.
 */
export default function AssessmentClient() {
  const { data: session } = useSession();
  const [sent, setSent] = useState(false);
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
      if (d?.success) setSent(true); else setError(d?.error ?? 'Something went wrong');
    } catch { setError('Network error'); }
    finally { setBusy(false); }
  };

  const field: React.CSSProperties = {
    width: '100%', padding: '9px 11px', marginTop: 4,
    background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-subtle, #2a2a2a)',
    borderRadius: 3, color: 'inherit', font: 'inherit',
  };
  const label: React.CSSProperties = { display: 'block', marginBottom: 14, fontSize: '0.85em' };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 70px' }}>
      <h1 style={{ fontSize: '1.5em', margin: '0 0 10px' }}>Is the model you chose still the right one?</h1>
      <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, margin: '0 0 20px' }}>
        A fixed-scope assessment of one workload against three candidate models, using your tasks
        rather than ours. You get a decision report within seven business days of us having what we
        need — including, where the evidence supports it, a recommendation to change nothing.
      </p>

      <div style={{ padding: 16, border: '1px solid var(--phosphor-green)', borderRadius: 4, marginBottom: 24 }}>
        <div style={{ fontSize: '1.3em', fontWeight: 700, marginBottom: 8 }}>$490</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.87em', lineHeight: 1.7, color: 'var(--phosphor-dim)' }}>
          <li>One workload, up to 20 tasks you supply</li>
          <li>Three candidate models, up to 1,000 standard execution units</li>
          <li>Two hours of expert time, and a concise decision report</li>
          <li>Credited in full against an annual plan bought within 30 days</li>
          <li>Refunded if we cannot deliver the agreed report</li>
        </ul>
        <p style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
          Provider inference is billed to your own keys under a cap you agree first. We scope with you
          before charging anything — nobody pays until we both know the workload is one we can measure.
        </p>
      </div>

      {sent ? (
        <div style={{ padding: 20, border: '1px solid var(--phosphor-green)', borderRadius: 4, lineHeight: 1.65 }}>
          <strong>Got it.</strong>
          <p style={{ margin: '8px 0 0', color: 'var(--phosphor-dim)', fontSize: '0.9em' }}>
            We will come back to you to agree the scope, the acceptance criterion and the provider
            spend cap before anything is charged.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label style={label}>
            Your email
            <input name="email" type="email" required style={field}
              defaultValue={session?.user?.email ?? ''} placeholder="your@email.com" />
          </label>
          <label style={label}>
            Company <span style={{ opacity: 0.6 }}>(optional)</span>
            <input name="company" style={field} />
          </label>
          <label style={label}>
            What decision do you need to make?
            <textarea name="workload" required rows={5} style={field}
              placeholder="e.g. We use Claude Sonnet for support-ticket triage and are considering moving to a cheaper model. We need to know whether quality would hold." />
          </label>
          <label style={label}>
            Candidate models <span style={{ opacity: 0.6 }}>(optional)</span>
            <input name="models" style={field} placeholder="claude-sonnet-5, gpt-5.6-terra, deepseek-v4-pro" />
          </label>
          <label style={label}>
            Roughly how many tasks? <span style={{ opacity: 0.6 }}>(optional, up to 20)</span>
            <input name="taskCount" type="number" min={1} max={20} style={field} />
          </label>

          {error && <p style={{ color: 'var(--amber-warning)', fontSize: '0.85em' }}>{error}</p>}

          <button type="submit" disabled={busy} className="vintage-btn"
            style={{ padding: '11px 22px', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Sending…' : 'Start the conversation →'}
          </button>
        </form>
      )}
    </div>
  );
}
