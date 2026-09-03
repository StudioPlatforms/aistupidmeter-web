'use client';

import { useState } from 'react';
import { slugifyModelName } from '../lib/model-slug';
import PixelIcon from './PixelIcon';

interface ShareButtonProps {
  type?: 'rankings' | 'alert' | 'index' | 'winner';
  data?: any;
}

const SITE = 'https://aistupidlevel.info';

/**
 * Brand marks, inlined.
 *
 * PixelIcon only defines 'check' and 'close' out of the names this modal needs
 * — 'twitter', 'linkedin', 'reddit' and 'copy' all fell through to its
 * `iconMap[name] || iconMap['info']` fallback, so every network button showed
 * the same generic info glyph. These are the real marks at the sizes we use.
 */
const BRAND_PATHS: Record<string, string> = {
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z',
  reddit:
    'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-6.994 4.87-3.865 0-6.994-2.176-6.994-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12c-.689 0-1.25.562-1.25 1.25 0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.561-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  check: 'M9 16.2L4.8 12L3.4 13.4L9 19L21 7L19.6 5.6L9 16.2Z',
};

function BrandIcon({ name, size = 16 }: { name: string; size?: number }) {
  const d = BRAND_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** "3 Sep 2026, 13:40 UTC" — same shape the OG card footer uses. */
function utcStamp(): string {
  const d = new Date();
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    d.getUTCMonth()
  ];
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export default function ShareButton({ type = 'rankings', data }: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const top3: any[] = Array.isArray(data?.modelScores) ? data.modelScores.slice(0, 3) : [];
  const scoreOf = (m: any) =>
    typeof m?.currentScore === 'number' ? m.currentScore : typeof m?.score === 'number' ? m.score : null;

  /**
   * Multi-line body, used for the X post and the in-modal preview.
   *
   * Deliberately plain text. The previous version used the RetroIcons set
   * (♕ ♔ ▤ ① ② ③ ⚠) — leftovers from the terminal theme, which read as mojibake
   * on most clients and are exactly the vocabulary the clean redesign removed.
   * Model names are no longer .toUpperCase()'d either, so the post matches how
   * the site and the share card actually render them.
   */
  const getShareText = (): string => {
    const stamp = utcStamp();

    if (type === 'alert' && data?.model) {
      const s = scoreOf(data.model);
      const drop = data?.dropPercentage;
      return [
        `Performance drop detected: ${data.model.name}${
          drop ? ` is down ${drop}% from its baseline` : ' has degraded'
        }${s !== null ? `, now scoring ${s}/100` : ''}.`,
        '',
        'Independent AI model benchmarks, re-scored every hour.',
        stamp,
      ].join('\n');
    }

    if (type === 'winner' && data?.topModel) {
      const s = scoreOf(data.topModel);
      return [
        `${data.topModel.name} is the top-scoring AI model right now${
          s !== null ? ` — ${s}/100` : ''
        }.`,
        '',
        'Independent AI model benchmarks, re-scored every hour.',
        stamp,
      ].join('\n');
    }

    if (type === 'index' && typeof data?.globalIndex?.current?.globalScore === 'number') {
      const score = data.globalIndex.current.globalScore;
      const status = score >= 70 ? 'holding up' : score >= 50 ? 'middling' : 'struggling';
      return [
        `Global AI performance index: ${score}/100 — the fleet is ${status}.`,
        '',
        'Independent AI model benchmarks, re-scored every hour.',
        stamp,
      ].join('\n');
    }

    if (top3.length >= 3) {
      const rows = top3
        .map((m, i) => {
          const s = scoreOf(m);
          return `${i + 1}. ${m.name}${s !== null ? ` — ${s}` : ''}`;
        })
        .join('\n');
      return [`AI model leaderboard — live benchmark scores:`, '', rows, '', `Independently re-scored every hour.`, stamp].join(
        '\n'
      );
    }

    return [
      'Live AI model benchmarks — compare GPT, Claude, Gemini, Grok and more on independently measured scores.',
      stamp,
    ].join('\n');
  };

  /**
   * Single-line variant. Reddit puts this in the post TITLE, and a title cannot
   * contain newlines — the old code passed the multi-line body straight in,
   * which Reddit truncated at the first break.
   */
  const getShareTitle = (): string => {
    if (type === 'alert' && data?.model) {
      const drop = data?.dropPercentage;
      return `Performance drop detected: ${data.model.name}${drop ? ` is down ${drop}%` : ' has degraded'} on live AI benchmarks`;
    }
    if (type === 'winner' && data?.topModel) {
      const s = scoreOf(data.topModel);
      return `${data.topModel.name} is currently the top-scoring AI model${s !== null ? ` at ${s}/100` : ''}`;
    }
    if (top3.length >= 3) {
      const s0 = scoreOf(top3[0]);
      const rest = top3
        .slice(1)
        .map((m) => {
          const s = scoreOf(m);
          return `${m.name}${s !== null ? ` (${s})` : ''}`;
        })
        .join(' and ');
      return `AI model leaderboard: ${top3[0].name} leads${s0 !== null ? ` at ${s0}` : ''}, ahead of ${rest}`;
    }
    return 'Live AI model benchmarks — independently scored every hour';
  };

  /**
   * ONE url for every network.
   *
   * This used to differ per button: X got `/share/<type>` while LinkedIn,
   * Reddit and Copy got the bare homepage. `/share/<type>` is a stub that shows
   * "Preparing your share preview…" and bounces to `/` after 1s, so anyone
   * following a shared link landed on a flash screen and a redirect, and its
   * og:url pointed at a page that immediately sends you somewhere else.
   *
   * The homepage carries the same dynamic OG card (/api/og?type=rankings), so
   * sharing the canonical url gives the identical preview with none of that.
   * Model-specific shares point at the model page, which has its own metadata.
   * The /share/<type> route still works for links already in the wild; we just
   * no longer mint new ones.
   */
  const getShareUrl = (): string => {
    if (type === 'alert' && data?.model) {
      const slug = data.model.name ? slugifyModelName(data.model.name) : data.model.id;
      return slug ? `${SITE}/models/${slug}` : SITE;
    }
    if (type === 'winner' && data?.topModel) {
      const slug = data.topModel.name ? slugifyModelName(data.topModel.name) : data.topModel.id;
      return slug ? `${SITE}/models/${slug}` : SITE;
    }
    return SITE;
  };

  const shareText = getShareText();
  const shareTitle = getShareTitle();
  const shareUrl = getShareUrl();

  const openShare = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=600,height=520');

  const handleTwitterShare = () =>
    openShare(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    );

  // LinkedIn's share-offsite endpoint only reads `url`; it pulls title and
  // description from the page's own Open Graph tags rather than anything we pass.
  const handleLinkedInShare = () =>
    openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`);

  const handleRedditShare = () =>
    openShare(
      `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`
    );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const networks = [
    { key: 'twitter', label: 'Share on X', icon: 'x', onClick: handleTwitterShare, primary: true },
    { key: 'linkedin', label: 'Share on LinkedIn', icon: 'linkedin', onClick: handleLinkedInShare },
    { key: 'reddit', label: 'Share on Reddit', icon: 'reddit', onClick: handleRedditShare },
  ];

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="vintage-btn share-button-floating"
        aria-label="Share"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <PixelIcon name="share" size={16} />
        <span className="share-text-desktop">SHARE</span>
      </button>

      {showModal && (
        // Reuses the reskin's own modal vocabulary (.pro-modal*) instead of the
        // old .crt-monitor shell with its 2px phosphor border, black backdrop
        // and blinking cursor.
        <div className="pro-modal" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div
            className="pro-modal-card"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="pro-modal-close" onClick={() => setShowModal(false)} aria-label="Close">
              <PixelIcon name="close" size={14} />
            </button>

            <span className="pro-modal-badge">Share</span>
            <div className="pro-modal-title">Share the live leaderboard</div>
            <div className="pro-modal-sub">
              Posts include the current scores and a preview card that updates itself.
            </div>

            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--terminal-black)',
                border: '1px solid var(--metal-silver)',
                fontSize: 12.5,
                lineHeight: 1.5,
                color: 'var(--phosphor-green)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {shareText}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: 'var(--phosphor-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shareUrl}
            </div>

            <div className="pro-modal-actions">
              {networks.map((n) => (
                <button
                  key={n.key}
                  onClick={n.onClick}
                  className={`pro-modal-btn${n.primary ? ' primary' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <BrandIcon name={n.icon} size={15} />
                  {n.label}
                </button>
              ))}

              <button
                onClick={handleCopy}
                className="pro-modal-btn"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <BrandIcon name={copied ? 'check' : 'copy'} size={15} />
                {copied ? 'Copied' : 'Copy post and link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
