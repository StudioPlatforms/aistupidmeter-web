'use client';

/**
 * The public contact form.
 *
 * Open to everyone, signed in or not. The Enterprise plan used to send people to
 * /assessment — a $490 one-off engagement — which is a strange answer to
 * "I would like to talk about an annual contract", and there was no route at all
 * for support, security or press. Every one of those now lands here and reaches
 * a person.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

const TOPICS: Array<{ id: string; label: string; blurb: string }> = [
  { id: 'general', label: 'General', blurb: 'Anything that does not fit the others.' },
  { id: 'enterprise', label: 'Enterprise', blurb: 'Contracted scope, SSO, SCIM, audit trail, invoicing.' },
  { id: 'sales', label: 'Sales & pricing', blurb: 'Which plan fits, volume pricing, annual terms.' },
  { id: 'custom-benchmark', label: 'Custom benchmarking', blurb: 'Continuous measurement of your own workload, built and run by us.' },
  { id: 'support', label: 'Support', blurb: 'Something is not working the way it should.' },
  { id: 'security', label: 'Security', blurb: 'Vulnerability reports and security questions.' },
  { id: 'press', label: 'Press', blurb: 'Questions about the benchmark or our methodology.' },
];

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)', borderRadius: 6, padding: '18px 20px',
};

const input: React.CSSProperties = {
  width: '100%', padding: '9px 10px', borderRadius: 4,
  background: 'var(--terminal-black)', border: '1px solid var(--metal-silver)',
  color: 'inherit', fontFamily: 'inherit', fontSize: '0.92em',
};

const label: React.CSSProperties = {
  display: 'block', fontSize: '0.82em', color: 'var(--phosphor-dim)', marginBottom: 6,
};

export default function ContactClient() {
  const { data: session } = useSession();
  const params = useSearchParams();

  const [topic, setTopic] = useState('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deep links from the pricing page and the locked-feature pages arrive with a
  // topic already chosen, so nobody has to re-explain why they clicked.
  useEffect(() => {
    const t = params.get('topic');
    if (t && TOPICS.some(x => x.id === t)) setTopic(t);
  }, [params]);

  // Signed-in visitors should not retype what we already know.
  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
    if (session?.user?.name && !name) setName(session.user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, name, email, company, message, website }),
      });
      const payload = await res.json().catch(() => null);
      if (!payload?.success) {
        setError(payload?.message || payload?.error || 'Could not send your message.');
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      // Deliberately no address and no link back here: this fires when THIS form failed,
      // so sending the reader to the contact form would be a circle.
      setError('Could not reach us just now — this is on our side, not yours. Please try again in a moment.');
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4em', margin: '0 0 12px' }}>Message sent</h1>
        <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, marginBottom: 24 }}>
          It has reached a person, not a queue. We answer every message ourselves, usually within one
          business day. A confirmation is on its way to <strong>{email}</strong>.
        </p>
        <Link href="/" className="vintage-btn" style={{ padding: '10px 20px', textDecoration: 'none' }}>
          Back to the leaderboard
        </Link>
      </div>
    );
  }

  const selected = TOPICS.find(t => t.id === topic)!;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 70px' }}>
      <h1 style={{ fontSize: '1.5em', margin: '0 0 8px' }}>Talk to us</h1>
      <p style={{ color: 'var(--phosphor-dim)', lineHeight: 1.65, maxWidth: 620, margin: '0 0 26px' }}>
        We are a small team and we answer our own email. Whether you are evaluating a plan, running
        into something broken, or reporting a security issue, this reaches us directly.
      </p>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }} className="contact-grid">
        <form onSubmit={submit} style={card}>
          <div style={{ marginBottom: 16 }}>
            <span style={label}>What is this about?</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOPICS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: '0.82em', cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: `1px solid ${topic === t.id ? 'var(--accent, #1a73e8)' : 'var(--border-subtle, #2a2a2a)'}`,
                    background: topic === t.id ? 'rgba(26,115,232,0.10)' : 'transparent',
                    color: topic === t.id ? 'var(--accent, #1a73e8)' : 'inherit',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.8em', color: 'var(--phosphor-dim)', marginTop: 8 }}>{selected.blurb}</div>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 14 }}>
            <div>
              <label style={label} htmlFor="contact-name">Your name</label>
              <input id="contact-name" style={input} value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Okafor" autoComplete="name" />
            </div>
            <div>
              <label style={label} htmlFor="contact-email">Email <span style={{ color: 'var(--red-alert, #d93025)' }}>*</span></label>
              <input id="contact-email" style={input} type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={label} htmlFor="contact-company">Company <span style={{ opacity: 0.6 }}>(optional)</span></label>
            <input id="contact-company" style={input} value={company} onChange={e => setCompany(e.target.value)}
              placeholder="Acme Ltd" autoComplete="organization" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label} htmlFor="contact-message">
              Message <span style={{ color: 'var(--red-alert, #d93025)' }}>*</span>
            </label>
            <textarea
              id="contact-message" required rows={7} value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
              placeholder={
                topic === 'custom-benchmark'
                  ? 'What the model does for you, what a good and a bad answer look like, roughly how many example tasks you could supply, and which models you run today.'
                  : topic === 'enterprise'
                  ? 'How many people would use it, which identity provider you use, and what you need to sign off on.'
                  : topic === 'security'
                    ? 'What you found, how to reproduce it, and how you would like to be credited.'
                    : 'What you are trying to do, and where you got stuck.'
              }
            />
            <div style={{ fontSize: '0.76em', color: 'var(--phosphor-dim)', marginTop: 6 }}>
              {message.length}/5000
            </div>
          </div>

          {/* Hidden from people, tempting to bots. Never rendered visibly. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="contact-website">Leave this empty</label>
            <input id="contact-website" tabIndex={-1} autoComplete="off" value={website}
              onChange={e => setWebsite(e.target.value)} />
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: '10px 12px', borderRadius: 4, fontSize: '0.85em',
              border: '1px solid var(--red-alert, #d93025)', background: 'rgba(217,48,37,0.08)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={sending} className="vintage-btn vintage-btn--primary"
            style={{ padding: '11px 24px', opacity: sending ? 0.6 : 1 }}>
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>

        <aside style={{ display: 'grid', gap: 14 }}>
          <section style={card}>
            <h2 style={{ fontSize: '0.95em', margin: '0 0 8px', fontWeight: 600 }}>Evaluating for a team?</h2>
            <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: '0 0 10px' }}>
              Enterprise covers single sign-on, SCIM provisioning, the audit trail, contracted scope
              and invoicing. Tell us your identity provider and seat count and we will come back with
              specifics.
            </p>
            <Link href="/pricing" style={{ fontSize: '0.82em', color: 'var(--accent, #1a73e8)' }}>
              Compare the plans →
            </Link>
          </section>

          <section style={card}>
            <h2 style={{ fontSize: '0.95em', margin: '0 0 8px', fontWeight: 600 }}>Want a decision, not a dashboard?</h2>
            <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: '0 0 10px' }}>
              The workload assessment runs your own tasks against three candidate models and returns a
              written recommendation.
            </p>
            <Link href="/assessment" style={{ fontSize: '0.82em', color: 'var(--accent, #1a73e8)' }}>
              About the assessment →
            </Link>
          </section>

          <section style={card}>
            <h2 style={{ fontSize: '0.95em', margin: '0 0 8px', fontWeight: 600 }}>Security reports</h2>
            <p style={{ fontSize: '0.85em', color: 'var(--phosphor-dim)', lineHeight: 1.6, margin: 0 }}>
              We will not pursue anyone who reports a genuine issue in good faith, gives us reasonable
              time to fix it, and does not access other people&rsquo;s data while proving it.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
