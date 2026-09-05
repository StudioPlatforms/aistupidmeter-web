'use client';

import { useEffect, useState } from 'react';

/**
 * "Still calibrating" notice for a recently-added model.
 *
 * A model page looks the same whether it has ten months of history or ten hours, which
 * invites people to read a brand-new model's rank as settled fact. Until we have enough
 * runs to establish that model's own median, its score moves on noise and drift detection
 * has nothing to compare against — so we say that plainly, once, on the way in.
 *
 * Dismissal is remembered per model, not globally: a visitor who dismissed this for one
 * new model should still be warned about the next one.
 */

export const CALIBRATION_DAYS = 10;

interface NewModelNoticeProps {
  modelName: string;
  /** Whole days of history behind this model. null when the age is unknown. */
  daysTracked: number | null | undefined;
  /** Days of history needed before the baseline is meaningful. */
  calibrationDays?: number;
}

export default function NewModelNotice({
  modelName,
  daysTracked,
  calibrationDays = CALIBRATION_DAYS,
}: NewModelNoticeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const qualifies = typeof daysTracked === 'number' && daysTracked < calibrationDays;
  const storageKey = `stupidmeter-newmodel-seen:${modelName}`;

  useEffect(() => {
    if (!qualifies) return;
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === 'true';
    } catch {
      /* private mode — show it, that's the safe direction */
    }
    if (seen) return;
    // Let the page paint first; a dialog over a blank page reads as an error.
    const t = setTimeout(() => setIsOpen(true), 600);
    return () => clearTimeout(t);
  }, [qualifies, storageKey]);

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen || !qualifies) return null;

  const days = daysTracked as number;
  const remaining = Math.max(1, calibrationDays - days);
  const trackedLabel =
    days <= 0 ? 'less than a day' : days === 1 ? '1 day' : `${days} days`;

  return (
    <div className="pro-modal" onClick={dismiss}>
      <div
        className="pro-modal-card nmn-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nmn-title"
      >
        <button className="pro-modal-close" onClick={dismiss} aria-label="Close">×</button>

        <span className="pro-modal-badge nmn-badge">New model</span>

        <div className="pro-modal-title" id="nmn-title">Still calibrating</div>
        <p className="pro-modal-sub">
          We’ve only been testing <b>{modelName}</b> for {trackedLabel}. Its scores below are
          real measurements, but they haven’t settled yet.
        </p>

        <ul className="pro-modal-features nmn-list">
          <li>
            <span className="pro-modal-check">1</span>
            <span>
              A model’s rank moves around early on. With this little history, a couple of
              unlucky runs can swing it more than real ability does.
            </span>
          </li>
          <li>
            <span className="pro-modal-check">2</span>
            <span>
              Drift detection compares a model against <i>its own</i> normal. We don’t know
              this model’s normal yet, so no drift alerts will fire for it.
            </span>
          </li>
          <li>
            <span className="pro-modal-check">3</span>
            <span>
              We need about <b>{calibrationDays} days</b> of runs to set a stable median,
              roughly <b>{remaining} more {remaining === 1 ? 'day' : 'days'}</b> for this one.
            </span>
          </li>
        </ul>

        <p className="pro-modal-priceline nmn-foot">
          Until then, treat this page as an early read rather than a verdict.
        </p>

        <div className="pro-modal-actions">
          <button className="pro-modal-btn primary" onClick={dismiss}>Got it</button>
        </div>
      </div>
    </div>
  );
}
