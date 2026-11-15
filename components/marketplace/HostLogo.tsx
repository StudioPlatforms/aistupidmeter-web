import type { CSSProperties, ReactNode } from 'react';
import { hostInitials, logoSources, markPxFor } from '@/lib/host-logo';

/**
 * A host's mark (an inference provider listed on AI Stupid Level), Phase 3 plan §3.5.
 *
 * Always on a white tile, in the light theme and the dark theme alike, exactly as the OpenAI,
 * Anthropic and Google marks appear (Logo standards item 2): the approved mark, drawn at about 60%
 * of the tile from the server's PNG renditions (`srcset` 64/128), or the host's initials until a
 * mark is approved. A host never goes through ProviderLogo without its `logoUrl`: that component
 * shows the OpenAI mark for every name it does not know.
 *
 * Styled inline, so it draws the same on the boards, in the app and on the admin screens without a
 * stylesheet of its own; the hairline follows the theme's line colour where the page has one.
 */

const INITIALS: CSSProperties = { display: 'block', fontWeight: 600, lineHeight: 1, color: '#5f6368', letterSpacing: '-0.01em', whiteSpace: 'nowrap' };

/**
 * Just the mark (or the initials), for a chip that draws its own tile: the boards' `.sl-logo`.
 * `px` is the mark's size in CSS pixels. A `logoUrl` that is not one of a host's PNG renditions
 * (lib/host-logo.ts) draws the initials.
 */
export function HostMark({ name, logoUrl, px, alt = '' }: { name: string; logoUrl?: string | null; px: number; alt?: string }) {
  const sources = logoUrl ? logoSources(logoUrl, px) : null;
  if (sources) {
    return (
      <img
        src={sources.src}
        srcSet={sources.srcSet}
        sizes={sources.sizes}
        width={px}
        height={px}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ display: 'block', width: px, height: px, objectFit: 'contain' }}
      />
    );
  }
  return <b style={{ ...INITIALS, fontSize: Math.max(8, Math.round(px * 0.68)) }}>{hostInitials(name)}</b>;
}

export interface HostLogoProps {
  /** The host's display name: its initials until a mark is approved, and the image's description. */
  name: string;
  /** The approved mark's 64 px rendition (/media/providers/<slug>-<sha8>-64.png, or a preview route's /png/64). */
  logoUrl?: string | null;
  /** The tile's side in CSS pixels; the mark is drawn at about 60% of it (§3.1 item 2). */
  size?: number;
  /** The mark's side, when it must differ from the usual share of the tile. */
  mark?: number;
  /** A round chip: crops the corners. */
  round?: boolean;
  /** No hairline: the 24 px round chips. */
  bare?: boolean;
  /** Read out instead of being skipped: for a tile that is the content (a preview), not a decoration beside the name. */
  label?: string;
  className?: string;
  /** Extra content drawn over the mark's box (the uploader's safe-area overlay). */
  overlay?: ReactNode;
}

export default function HostLogo({ name, logoUrl, size = 30, mark, round, bare, label, className, overlay }: HostLogoProps) {
  const px = mark ?? markPxFor(size);
  const tile: CSSProperties = {
    display: 'inline-grid',
    placeItems: 'center',
    flex: 'none',
    boxSizing: 'border-box',
    width: size,
    height: size,
    background: '#fff',
    border: bare ? 0 : '1px solid var(--lp-line, #e3e6ea)',
    borderRadius: round ? '50%' : Math.max(6, Math.round(size * 0.26)),
    overflow: 'hidden',
    verticalAlign: 'middle',
  };
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <span className={className} style={tile} {...a11y}>
      {overlay ? (
        <span style={{ position: 'relative', display: 'block', width: px, height: px }}>
          <HostMark name={name} logoUrl={logoUrl} px={px} />
          {overlay}
        </span>
      ) : (
        <HostMark name={name} logoUrl={logoUrl} px={px} />
      )}
    </span>
  );
}
