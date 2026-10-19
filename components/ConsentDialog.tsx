'use client';

import { useEffect, useRef } from 'react';
import '../styles/studio-board.css';

export const CONSENT_STORAGE_KEY = 'gdpr-consent';

/**
 * Analytics consent, asked once before anything else.
 *
 * This replaces the old "WELCOME TO AI STUPID METER" popup, which had been rendered
 * inside a `display: none` wrapper since the v4 redesign — invisible, never completable,
 * so consent was never actually collected and the marketing copy never seen. Its product
 * pitch is now the job of OnboardingTour; all that was worth keeping is this question.
 *
 * In the studio dialog look (.st-modal markup, styles/studio.css), not the studio Modal component:
 * that one closes on Escape and on the backdrop, and this question must be answered.
 */

interface ConsentDialogProps {
  isOpen: boolean;
  /** Called with the visitor's choice once they answer. */
  onDecide: (accepted: boolean) => void;
}

export default function ConsentDialog({ isOpen, onDecide }: ConsentDialogProps) {
  const box = useRef<HTMLDivElement>(null);

  // No Escape-to-dismiss and no backdrop click: this is a question, not an
  // announcement, and silently closing it would leave consent unrecorded.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the dialog itself, not either answer, so neither is pre-selected.
    requestAnimationFrame(() => box.current?.focus());
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="st-modal-back sb-consent">
      <div
        ref={box}
        className="st-modal is-narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-desc"
        tabIndex={-1}
      >
        <div className="st-modal-head">
          <div>
            <p className="st-kicker">Privacy</p>
            <h2 className="st-modal-title" id="consent-title">Analytics on this site</h2>
          </div>
        </div>

        <div className="st-modal-body">
          <p id="consent-desc">
            We use Google Analytics to see which parts of the site people actually use. Your
            IP is anonymised and advertising features are switched off.
          </p>

          <ul className="sb-consent-list">
            <li><i className="st-key is-accent" aria-hidden="true" /><span>Page views and which charts get opened</span></li>
            <li><i className="st-key is-accent" aria-hidden="true" /><span>Anonymised performance data (how fast pages load)</span></li>
            <li><i className="st-key is-accent" aria-hidden="true" /><span>Country-level location - never a precise one</span></li>
          </ul>

          <p className="sb-fine">
            Decline and none of it is stored. The benchmark data is free either way, and you
            can change your mind from Cookie settings in the footer at any time.{' '}
            <a href="/privacy#cookies">Privacy policy</a>
          </p>
        </div>

        <div className="st-modal-foot">
          <button type="button" className="st-btn" onClick={() => onDecide(false)}>
            Decline
          </button>
          <button type="button" className="st-btn is-primary" onClick={() => onDecide(true)}>
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
