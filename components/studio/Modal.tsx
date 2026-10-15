'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  /** Buttons in the footer strip. */
  footer?: ReactNode;
  size?: 'narrow' | 'wide';
  children?: ReactNode;
}

/**
 * Dialog in the landing's card style; a bottom sheet on phones. Escape and the backdrop close it,
 * focus moves into it on open and back to where it was on close, and the page behind stops scrolling.
 *
 * Rendered into the shell root (.st) rather than in place: panes fade in with a transform, and a
 * fixed-position element inside a transformed one is positioned against that element instead of
 * the screen. The shell root carries the theme tokens, so the dialog keeps its colours there.
 */
export default function Modal({ open, onClose, title, sub, footer, size, children }: ModalProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => { setHost(document.querySelector('.st') ?? document.body); }, []);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => box.current?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open]);

  if (!open || !host) return null;
  return createPortal(
    <div className="st-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className={`st-modal${size ? ` is-${size}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="st-modal-head">
          <div>
            <h2 className="st-modal-title" id={id}>{title}</h2>
            {sub && <p className="st-modal-sub">{sub}</p>}
          </div>
          <button type="button" className="st-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="st-modal-body">{children}</div>
        {footer && <div className="st-modal-foot">{footer}</div>}
      </div>
    </div>,
    host,
  );
}
