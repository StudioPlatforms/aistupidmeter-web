'use client';

import { useState } from 'react';

/**
 * Contact affordance for Enterprise access.
 *
 * The address is never written into the page. It is split into fragments and
 * only assembled in the browser when someone actually clicks, so the rendered
 * HTML — which is what address harvesters read, along with every crawler and
 * archive of it — contains no address and no `mailto:` href to lift.
 *
 * The parts are stored reversed as a second cheap step: a scraper that executes
 * JS defeats this, but the overwhelming majority just regex the markup.
 */

// 'ue.smroftalpoiduts' → 'studioplatforms.eu', 'nasivtunoi' → 'ionutvisan'
const LOCAL = 'nasivtunoi';
const DOMAIN = 'ue.smroftalpoiduts';

function address(): string {
  const rev = (v: string) => v.split('').reverse().join('');
  return `${rev(LOCAL)}@${rev(DOMAIN)}`;
}

const SUBJECT = 'AIStupidLevel Data API — Enterprise access';

interface Props {
  /** 'button' for a standalone CTA, 'inline' to sit inside a table cell. */
  variant?: 'button' | 'inline';
  label?: string;
}

export default function EnterpriseContact({ variant = 'button', label = 'Contact us' }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = () => {
    const to = address();
    setRevealed(to);
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(SUBJECT)}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the address is on screen at this point anyway.
    }
  };

  const isInline = variant === 'inline';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={open}
        aria-label="Email us about Enterprise access"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: isInline ? '10.5px' : '11px',
          fontWeight: 'bold',
          letterSpacing: '0.3px',
          padding: isInline ? '4px 10px' : '8px 16px',
          borderRadius: '3px',
          background: 'rgba(26, 115, 232,0.1)',
          border: '1px solid rgba(26, 115, 232,0.4)',
          color: 'var(--phosphor-green)',
        }}
      >
        <MailIcon />
        {label}
      </button>

      {revealed && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10.5px',
            color: 'var(--phosphor-dim)',
          }}
        >
          <span style={{ userSelect: 'all' }}>{revealed}</span>
          <button
            type="button"
            onClick={copy}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '9px',
              padding: '2px 7px',
              borderRadius: '2px',
              background: 'transparent',
              border: '1px solid rgba(192,192,192,0.3)',
              color: 'var(--phosphor-dim)',
            }}
          >
            {copied ? '✓ COPIED' : 'COPY'}
          </button>
        </span>
      )}
    </span>
  );
}

function MailIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
