'use client';

/**
 * The public contact form.
 *
 * Open to everyone, signed in or not. The Enterprise plan used to send people to
 * /assessment — a paid one-off engagement — which is a strange answer to
 * "I would like to talk about an annual contract", and there was no route at all
 * for support, security or press. Every one of those now lands here and reaches
 * a person.
 *
 * Renders the form card only; the page around it is app/contact/page.tsx (styles/contact.css).
 */

import { useEffect, useState, type CSSProperties } from 'react';
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

/** The API's own limits (app/api/contact/route.ts), so nothing is cut or refused after typing. */
const MAX = { name: 120, company: 160, message: 5000 };

const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

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
      <div className="lf-card ct-sent" role="status">
        <svg className="ct-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27l7.5 7.5L37.5 19" />
        </svg>
        <h2 className="ct-title">Message sent</h2>
        <p className="ct-sent-p">
          It has reached a person, not a queue. We answer every message ourselves, usually within one
          business day. A confirmation is on its way to <strong>{email}</strong>.
        </p>
        <Link href="/" className="lp-btn lp-btn-ghost">
          {session ? 'Back to the leaderboard' : 'Back to the home page'}
        </Link>
      </div>
    );
  }

  const selected = TOPICS.find(t => t.id === topic)!;
  const nearLimit = message.length > MAX.message * 0.9;

  return (
    <form onSubmit={submit} className="lf-card lp-intro" style={intro('.22s')}>
      <div className="lf-field">
        <span className="lf-label" id="contact-topic">What is this about?</span>
        <div className="ct-topics" role="group" aria-labelledby="contact-topic">
          {TOPICS.map(t => (
            <button
              key={t.id}
              type="button"
              className="ct-topic"
              aria-pressed={topic === t.id}
              onClick={() => setTopic(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Keyed by topic, so the line settles in again each time the choice changes. */}
        <p key={topic} className="ct-blurb" aria-live="polite">{selected.blurb}</p>
      </div>

      <div className="lf-pair">
        <div className="lf-field">
          <label className="lf-label" htmlFor="contact-name">Your name</label>
          <input id="contact-name" className="lf-input" value={name} maxLength={MAX.name}
            onChange={e => setName(e.target.value)} placeholder="Jane Okafor" autoComplete="name" />
        </div>
        <div className="lf-field">
          <label className="lf-label" htmlFor="contact-email">Email <span className="lf-req" aria-hidden="true">*</span></label>
          <input id="contact-email" className="lf-input" type="email" required value={email}
            onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
        </div>
      </div>

      <div className="lf-field">
        <label className="lf-label" htmlFor="contact-company">Company <span className="lf-opt">(optional)</span></label>
        <input id="contact-company" className="lf-input" value={company} maxLength={MAX.company}
          onChange={e => setCompany(e.target.value)} placeholder="Acme Ltd" autoComplete="organization" />
      </div>

      <div className="lf-field">
        <label className="lf-label" htmlFor="contact-message">
          Message <span className="lf-req" aria-hidden="true">*</span>
        </label>
        <textarea
          id="contact-message" className="lf-input lf-area" required rows={7} value={message}
          maxLength={MAX.message}
          onChange={e => setMessage(e.target.value)}
          aria-describedby="contalf-count"
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
        <span id="contalf-count" className={`lf-count${nearLimit ? ' is-near' : ''}`}>
          {message.length.toLocaleString('en-US')}/{MAX.message.toLocaleString('en-US')}
        </span>
      </div>

      {/* Hidden from people, tempting to bots. Never rendered visibly. */}
      <div aria-hidden="true" className="lf-hp">
        <label htmlFor="contact-website">Leave this empty</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={website}
          onChange={e => setWebsite(e.target.value)} />
      </div>

      {error && <p className="lf-note" role="alert">{error}</p>}

      <button type="submit" disabled={sending} className="lp-btn lp-btn-primary lp-btn-lg lf-send">
        {sending
          ? <><span className="lf-spin" aria-hidden="true" />Sending…</>
          : <>Send message <span className="lp-ar" aria-hidden="true">→</span></>}
      </button>
    </form>
  );
}
