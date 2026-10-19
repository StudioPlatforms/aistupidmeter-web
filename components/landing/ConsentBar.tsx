'use client';

import { useEffect, useState } from 'react';
import { CONSENT_STORAGE_KEY } from '@/components/ConsentDialog';

/**
 * The analytics question, asked on the landing page without covering it. Same storage key and the
 * same Google consent update as the dashboard's ConsentDialog, so an answer here is never asked again.
 */
export default function ConsentBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage blocked: do not nag */
    }
  }, []);

  const decide = (accepted: boolean) => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, accepted ? 'accepted' : 'declined');
      localStorage.setItem('stupidmeter-welcome-seen', 'true');
    } catch {
      /* private mode: the choice holds for this visit only */
    }
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: accepted ? 'granted' : 'denied',
        // No advertising on this site: an accept grants analytics only.
        ad_storage: 'denied',
      });
    }
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div className="lp-consent" role="dialog" aria-label="Analytics consent">
      <p><b>Analytics on this site.</b> We use Google Analytics to see which pages people use. Your IP is anonymised and advertising features are off. <a href="/privacy#cookies">Details</a></p>
      <div>
        <button type="button" className="lp-btn lp-btn-ghost" onClick={() => decide(false)}>Decline</button>
        <button type="button" className="lp-btn lp-btn-primary" onClick={() => decide(true)}>Accept</button>
      </div>
    </div>
  );
}
