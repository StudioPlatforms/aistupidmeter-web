'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The step-through card used by the first-visit explainers.
 *
 * Extracted from OnboardingTour so the drift monitor could have its own walkthrough
 * without a second copy of the dots / Back / Skip / slide-direction plumbing. The
 * caller supplies the steps and the localStorage key; everything else is shared.
 */

export interface TourStep {
  eyebrow: string;
  title: string;
  body: string[];
  icon: JSX.Element;
}

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TourStep[];
  /** Where "seen" is remembered. Dismissing by any route counts as seen. */
  storageKey: string;
  /** Label on the final button. */
  finishLabel?: string;
}

export default function TourModal({
  isOpen,
  onClose,
  steps,
  storageKey,
  finishLabel = 'Start exploring',
}: TourModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const stepRef = useRef(0);
  useEffect(() => { stepRef.current = step; }, [step]);

  const goTo = useCallback((next: number) => {
    setDirection(next > stepRef.current ? 'fwd' : 'back');
    setStep(next);
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      /* private mode - worst case they see it again */
    }
    onClose();
  }, [onClose, storageKey]);

  useEffect(() => {
    if (isOpen) { setStep(0); setDirection('fwd'); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') goTo(Math.min(stepRef.current + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') goTo(Math.max(stepRef.current - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, finish, goTo, steps.length]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="pro-modal onb" onClick={finish}>
      <div
        className="pro-modal-card onb-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
      >
        <div className="onb-head" key={`head-${step}`}>
          <span className="onb-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20">{current.icon}</svg>
          </span>
          <span className="pro-modal-badge">{current.eyebrow}</span>
        </div>

        <div className={`onb-slide onb-slide--${direction}`} key={step}>
          <div className="pro-modal-title onb-title" id="onb-title">{current.title}</div>
          {current.body.map((paragraph, i) => (
            <p className="pro-modal-sub onb-body" key={i}>{paragraph}</p>
          ))}
        </div>

        <div className="onb-progress" role="tablist" aria-label="Tour progress">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${s.eyebrow}`}
              className={`onb-dot${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="onb-actions">
          <button type="button" className="pro-modal-btn ghost onb-skip" onClick={finish}>
            {isLast ? 'Close' : 'Skip'}
          </button>
          <div className="onb-actions-right">
            {step > 0 && (
              <button type="button" className="pro-modal-btn ghost onb-back" onClick={() => goTo(step - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              className="pro-modal-btn primary onb-next"
              onClick={() => (isLast ? finish() : goTo(step + 1))}
            >
              {isLast ? finishLabel : 'Next'}
            </button>
          </div>
        </div>

        <div className="onb-count">{step + 1} of {steps.length}</div>
      </div>
    </div>
  );
}
