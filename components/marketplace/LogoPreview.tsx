import type { ReactNode } from 'react';
import { Pill } from '@/components/studio';
import HostLogo from './HostLogo';
import { LOGO_STATE_LABEL, logoStateTone, type LogoCheck, type LogoState } from '@/lib/provider-logo';
import '@/styles/studio-logo.css';

/**
 * A provider's uploaded mark as the site would draw it, for the uploader (§3.3) and the admin's
 * review (§10.4). Every image here is one of the PNGs the server rendered: `src(size)` gives the
 * address of the 64, 128, 256 or 512 px rendition (the member route or the admin route). The SVG
 * itself is never put into a page, an <img>, a data: or a blob: address.
 *
 * Styles: styles/studio-logo.css (mp-lp-, mp-lc-). The strips keep their own fixed grounds, so the
 * light and the dark one read the same whichever theme the page is in.
 */

export type RenditionSrc = (size: number) => string;

/** The site's chips from the smallest up (§3.1 item 2): the 12 px mark in a round chip, then tiles of 20–64 px. */
const TILES: Array<{ key: string; tile: number; mark: number; round?: boolean; caption: string }> = [
  { key: 'r12', tile: 20, mark: 12, round: true, caption: '12 px, round' },
  { key: 't20', tile: 20, mark: 12, caption: '20 px' },
  { key: 't24', tile: 24, mark: 14, caption: '24 px' },
  { key: 't30', tile: 30, mark: 18, caption: '30 px' },
  { key: 't40', tile: 40, mark: 24, caption: '40 px' },
  { key: 't64', tile: 64, mark: 40, caption: '64 px' },
];

/** The 1/16 clear space the processor leaves on every side of the mark, drawn over its box. */
const SafeArea = () => (
  <>
    <i className="mp-lp-safe" aria-hidden="true" />
    <i className="mp-lp-safe-line" aria-hidden="true" />
  </>
);

export function LogoStatePill({ state }: { state: LogoState }) {
  return <Pill tone={logoStateTone(state)}>{LOGO_STATE_LABEL[state] ?? state}</Pill>;
}

/** The mark on its white tile at every chip size, on the light theme's ground and on the dark theme's. */
export function LogoStrips({ src, name, safeArea = false }: { src: RenditionSrc; name: string; safeArea?: boolean }) {
  return (
    <div className="mp-lp-strips">
      {(['light', 'dark'] as const).map(ground => (
        <figure key={ground} className={`mp-lp-strip is-${ground}`}>
          <div className="mp-lp-tiles">
            {TILES.map(t => (
              <div key={t.key} className="mp-lp-cell">
                <span className="mp-lp-slot" style={{ height: 64 }}>
                  <HostLogo
                    name={name}
                    logoUrl={src(64)}
                    size={t.tile}
                    mark={t.mark}
                    round={t.round}
                    label={`The mark at ${t.caption} on the ${ground} theme`}
                    overlay={safeArea ? <SafeArea /> : undefined}
                  />
                </span>
                <span className="mp-lp-cap">{t.caption}</span>
              </div>
            ))}
          </div>
          <figcaption className="mp-lp-ground">{ground === 'light' ? 'Light theme' : 'Dark theme'}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** The share card's 120 px tile (72 px mark): large enough to see the trimming and the clear space. */
export function LogoLarge({ src, name, safeArea = false }: { src: RenditionSrc; name: string; safeArea?: boolean }) {
  return (
    <figure className="mp-lp-large">
      <HostLogo name={name} logoUrl={src(64)} size={120} label="The mark at 120 px" overlay={safeArea ? <SafeArea /> : undefined} />
      <figcaption className="mp-lp-cap">120 px, the share card</figcaption>
    </figure>
  );
}

/**
 * A board row as hosted rows will read (§7.2): the host's mark in the logo column, then the one-line
 * name. In a narrow row "hosted by " drops first ("DeepSeek V4 Pro — Acme"), then the text ends in an
 * ellipsis; the whole line stays in the title and the label.
 */
export function HostedRowPreview({ src, name }: { src: RenditionSrc; name: string }) {
  const text = `DeepSeek V4 Pro — hosted by ${name}`;
  return (
    <div className="mp-lp-row" role="img" aria-label={`A board row: ${text}`}>
      <span className="mp-lp-rank" aria-hidden="true">–</span>
      <HostLogo name={name} logoUrl={src(64)} size={26} />
      <span className="mp-lp-name" title={text}>DeepSeek V4 Pro<span className="mp-lp-by"> — <span className="mp-lp-hb">hosted by </span>{name}</span></span>
    </div>
  );
}

const ICON_OK = <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2L9.5 3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ICON_NO = <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2.8v4M6 9.2v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;

/**
 * The processor's checks as ruled rows: passed or not, the check's name and its number ("Visible on
 * white · 4.6:1 on 61% of pixels"). "Not another brand's mark" never refuses a file: when it does
 * not pass, a person looks at the mark, so it is marked for review rather than failed.
 */
export function LogoChecks({ checks, empty }: { checks: LogoCheck[]; empty?: ReactNode }) {
  if (!checks.length) return empty ? <p className="mp-lc-empty">{empty}</p> : null;
  return (
    <ul className="mp-lc">
      {checks.map((c, i) => {
        const review = !c.ok && c.key === 'lookalike';
        const tone = c.ok ? 'is-ok' : review ? 'is-review' : 'is-bad';
        return (
          <li key={`${c.key}-${i}`} className={`mp-lc-row ${tone}`}>
            <span className="mp-lc-mark">
              {c.ok ? ICON_OK : ICON_NO}
              <span className="st-sr">{c.ok ? 'Passed' : review ? 'For a person to review' : 'Not passed'}</span>
            </span>
            <span className="mp-lc-t">{c.label}</span>
            {c.detail && <span className="mp-lc-d">{c.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
