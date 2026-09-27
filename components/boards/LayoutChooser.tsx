'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BOARD_LAYOUTS, DEFAULT_LAYOUT, LAYOUT_INFO, type BoardLayout } from '../../lib/board-layout';

/**
 * Pick how the leaderboards are laid out. Opened once on a first visit (after the consent
 * question), and again from the Layout button whenever someone wants to change it.
 *
 * On a first visit, dismissing it by any route keeps the default and counts as a choice, so
 * nobody is asked twice. The footnote says where the choice is kept: an account keeps it
 * everywhere and in Settings; without one it lives on this device only.
 */

export function LayoutSketch({ layout }: { layout: BoardLayout }) {
  const bar = (x: number, y: number, w: number, key: string, strong = false) =>
    <rect key={key} x={x} y={y} width={w} height="3" rx="1.5" className={strong ? 'lbx-sk-strong' : 'lbx-sk'} />;
  const cols = [4, 34, 64, 94];
  return (
    <svg viewBox="0 0 120 64" className="lbx-sketch" aria-hidden="true">
      {layout === 'connected' && (
        <>
          {cols.map((x, c) => [0, 1, 2, 3, 4, 5].map((r) => bar(x, 8 + r * 9, 22, `${c}-${r}`)))}
          <path d="M26 9.5C30 9.5 30 36.5 34 36.5M56 36.5C60 36.5 60 18.5 64 18.5M86 18.5C90 18.5 90 45.5 94 45.5" className="lbx-sk-hot" />
          <path d="M26 27.5C30 27.5 30 9.5 34 9.5M56 9.5C60 9.5 60 27.5 64 27.5M86 27.5C90 27.5 90 9.5 94 9.5" className="lbx-sk-line" />
        </>
      )}
      {layout === 'side' && (
        <>
          {cols.map((x, c) => (
            <g key={c}>
              <rect x={x - 2} y="4" width="26" height="56" rx="3" className="lbx-sk-card" />
              {[0, 1, 2, 3, 4].map((r) => bar(x + 2, 10 + r * 9, 18, `${c}-${r}`, r === 0))}
            </g>
          ))}
        </>
      )}
      {layout === 'table' && (
        <>
          <rect x="4" y="4" width="112" height="56" rx="3" className="lbx-sk-card" />
          {[0, 1, 2, 3, 4].map((r) => (
            <g key={r}>
              {bar(10, 11 + r * 10, 30, `m${r}`, r === 0)}
              {[48, 64, 80, 96].map((x, c) => bar(x, 11 + r * 10, 10, `s${r}-${c}`, c === 0))}
            </g>
          ))}
        </>
      )}
      {layout === 'top' && (
        <>
          {cols.map((x, c) => (
            <g key={c}>
              <rect x={x - 2} y="4" width="26" height="30" rx="3" className="lbx-sk-card" />
              {[0, 1, 2].map((r) => bar(x + 2, 10 + r * 8, 18, `${c}-${r}`, r === 0))}
            </g>
          ))}
          <rect x="2" y="40" width="116" height="20" rx="3" className="lbx-sk-card lbx-sk-card--soft" />
          {[8, 36, 64, 92].map((x, i) => bar(x, 49, 20, `st${i}`))}
        </>
      )}
    </svg>
  );
}

export default function LayoutChooser({ isOpen, current, firstTime, signedIn, onSave, onClose }: {
  isOpen: boolean;
  current: BoardLayout;
  /** First visit: closing keeps the default and counts as the choice. */
  firstTime: boolean;
  signedIn: boolean;
  onSave: (layout: BoardLayout) => void;
  onClose: () => void;
}) {
  const [pick, setPick] = useState<BoardLayout>(current);
  useEffect(() => { if (isOpen) setPick(current); }, [isOpen, current]);

  const dismiss = () => (firstTime ? onSave(current) : onClose());

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, firstTime, current]);

  if (!isOpen) return null;

  return (
    <div className="pro-modal" onClick={dismiss}>
      <div className="pro-modal-card lbx-chooser" role="dialog" aria-modal="true" aria-labelledby="lbx-chooser-title"
           onClick={(e) => e.stopPropagation()}>
        <span className="pro-modal-badge">Leaderboard layout</span>
        <div className="pro-modal-title" id="lbx-chooser-title">
          {firstTime ? 'How would you like to see the leaderboards?' : 'Change the leaderboard layout'}
        </div>
        <p className="pro-modal-sub">
          The same four boards — Combined, Coding, Reasoning and Tool use — shown four ways. You can change this any time with the Layout button above the board.
        </p>

        <div className="lbx-options" role="radiogroup" aria-label="Layouts">
          {BOARD_LAYOUTS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={pick === l}
                    className={`lbx-option${pick === l ? ' is-picked' : ''}`} onClick={() => setPick(l)}>
              <LayoutSketch layout={l} />
              <span className="lbx-option-text">
                <span className="lbx-option-name">
                  {LAYOUT_INFO[l].name}
                  {l === DEFAULT_LAYOUT && <span className="lbx-option-badge">Default</span>}
                </span>
                <span className="lbx-option-desc">{LAYOUT_INFO[l].description}</span>
              </span>
            </button>
          ))}
        </div>

        <p className="lbx-chooser-note">
          {signedIn
            ? <>Saved to your account, so it follows you to any device. You can also change it in <Link href="/account/settings">Settings</Link>.</>
            : <>Saved on this device only. <Link href="/auth/signup?callbackUrl=/">Create an account</Link> to keep it on every device and change it from your Settings page.</>}
        </p>

        <div className="lbx-chooser-actions">
          <button type="button" className="pro-modal-btn ghost" onClick={dismiss}>
            {firstTime ? `Keep ${LAYOUT_INFO[current].name}` : 'Cancel'}
          </button>
          <button type="button" className="pro-modal-btn primary" onClick={() => onSave(pick)}>
            Use {LAYOUT_INFO[pick].name}
          </button>
        </div>
      </div>
    </div>
  );
}
