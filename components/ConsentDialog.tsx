'use client';

import { useEffect } from 'react';

export const CONSENT_STORAGE_KEY = 'gdpr-consent';

/**
 * Analytics consent, asked once before anything else.
 *
 * This replaces the old "WELCOME TO AI STUPID METER" popup, which had been rendered
 * inside a `display: none` wrapper since the v4 redesign — invisible, never completable,
 * so consent was never actually collected and the marketing copy never seen. Its product
 * pitch is now the job of OnboardingTour; all that was worth keeping is this question.
 *
 * Styled on the shared .pro-modal system rather than the old terminal look (blinking
 * cursors, phosphor headings) that the rest of the site moved away from.
 */

interface ConsentDialogProps {
  isOpen: boolean;
  /** Called with the visitor's choice once they answer. */
  onDecide: (accepted: boolean) => void;
}

export default function ConsentDialog({ isOpen, onDecide }: ConsentDialogProps) {
  // No Escape-to-dismiss and no backdrop click: this is a question, not an
  // announcement, and silently closing it would leave consent unrecorded.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="pro-modal">
      <div
        className="pro-modal-card consent-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
      >
        <span className="pro-modal-badge">Privacy</span>

        <div className="pro-modal-title" id="consent-title">Analytics on this site</div>
        <p className="pro-modal-sub">
          We use Google Analytics to see which parts of the site people actually use. Your
          IP is anonymised and advertising features are switched off.
        </p>

        <ul className="pro-modal-features consent-list">
          <li><span className="pro-modal-check">✓</span><span>Page views and which charts get opened</span></li>
          <li><span className="pro-modal-check">✓</span><span>Anonymised performance data (how fast pages load)</span></li>
          <li><span className="pro-modal-check">✓</span><span>Country-level location - never a precise one</span></li>
        </ul>

        <p className="pro-modal-priceline consent-foot">
          Decline and none of it is stored. The benchmark data is free either way, and you
          can change your mind from the footer at any time.
        </p>

        <div className="pro-modal-actions">
          <button className="pro-modal-btn primary" onClick={() => onDecide(true)}>
            Accept analytics
          </button>
          <button className="pro-modal-btn ghost" onClick={() => onDecide(false)}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
