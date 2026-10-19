'use client';

import { useState } from 'react';
import Link from 'next/link';
import { readAnalyticsChoice, setAnalyticsChoice, type AnalyticsChoice } from '@/lib/consent';

/**
 * "Cookie settings" in the footer: the place the consent dialog promises a visitor can change
 * their mind. Shows the current analytics choice and lets them accept or withdraw it.
 */
export default function CookieSettings() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<AnalyticsChoice>(null);

  const show = () => { setChoice(readAnalyticsChoice()); setOpen(true); };
  const decide = (accepted: boolean) => {
    setAnalyticsChoice(accepted);
    setChoice(accepted ? 'accepted' : 'declined');
    setOpen(false);
  };

  const status = choice === 'accepted' ? 'Analytics cookies are on.'
    : choice === 'declined' ? 'Analytics cookies are off.'
    : 'You have not chosen yet, so analytics cookies are off.';

  return (
    <>
      <button type="button" className="sf-cookie-btn" onClick={show} aria-haspopup="dialog">Cookie settings</button>
      {open && (
        <div className="sf-cookie" role="dialog" aria-label="Cookie settings">
          <p>
            <b>Cookie settings.</b> {status} We use Google Analytics, with IP anonymisation and advertising
            features off, only if you accept. Sign-in and preference cookies are always on because the site
            needs them. <Link href="/privacy#cookies">Details</Link>
          </p>
          <div className="sf-cookie-actions">
            <button type="button" className="sf-cookie-b" onClick={() => decide(false)}>Decline analytics</button>
            <button type="button" className="sf-cookie-b is-primary" onClick={() => decide(true)}>Accept analytics</button>
            <button type="button" className="sf-cookie-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
        </div>
      )}
    </>
  );
}
