/**
 * A host's mark (an inference provider listed on AI Stupid Level), as every component that draws
 * one finds it: the approved mark's PNG renditions, or the host's initials until a mark is approved
 * (Phase 3 plan §3.5). Pure functions, safe on the server and in the browser.
 *
 * A host's mark is only ever one of the server-rendered PNGs (§3.4): 64, 128, 256 and 512 px, under
 * /media/providers/<slug>-<sha8>-<size>.png once public, and under the member and admin preview
 * routes (…/logo/<id>/png/<size>) before that. A component is given one of those addresses (the
 * 64 px one, by convention) and offers the browser the larger ones through `srcset`.
 */

/** The sizes the processor renders (M3 API contract §1, `pngSizes`). */
export const LOGO_PNG_SIZES = [64, 128, 256, 512] as const;

/**
 * The only addresses a host's mark is drawn from (security review MINOR-10), each the pattern its
 * own route accepts: the public media route's file (app/media/providers/[file]/route.ts), the member
 * preview route the uploader uses (lib/provider-logo.ts memberLogoPng, with the account it names)
 * and the admin preview route of the logo review (adminLogoPng). Same origin and a PNG rendition
 * only: never another site, a data: or javascript: address, or any other path of this one.
 */
const LOGO_URLS = [
  /^\/media\/providers\/[a-z0-9-]{1,32}-[0-9a-f]{8}-(?:64|128|256|512)\.png$/,
  /^\/api\/account\/provider\/logo\/[1-9]\d{0,15}\/png\/(?:64|128|256|512)(?:\?provider=[a-z2-7]{10})?$/,
  /^\/api\/admin\/marketplace\/logos\/[1-9][0-9]{0,9}\/png\/(?:64|128|256|512)$/,
];

/** True for an address of one of a host's PNG renditions (LOGO_URLS). */
export function isHostLogoUrl(url: unknown): url is string {
  return typeof url === 'string' && LOGO_URLS.some(re => re.test(url));
}

// "…-64.png" (the public media route) or "…/png/64" (the preview routes), with the query after it.
const RENDITION_RE = /^(.*?(?:-|\/png\/))(64|128|256|512)((?:\.png)?(?:\?.*)?)$/;

/**
 * The `src`, `srcSet` and `sizes` for a mark drawn at `px` CSS pixels. The 64 and 128 px renditions
 * cover every chip on the site at up to 2× (the largest app chip draws its mark at 40 px); a larger
 * drawing (a 72 px share-card mark, a detail preview) is offered the 256 and 512 px ones as well.
 * Null for an address that is not one of LOGO_URLS: the caller then draws no image (a host's initials).
 */
export function logoSources(url: string, px: number): { src: string; srcSet: string; sizes: string } | null {
  if (!isHostLogoUrl(url)) return null;
  const m = RENDITION_RE.exec(url);
  if (!m) return null;
  const [, base, , rest] = m;
  const sizes = px > 64 ? LOGO_PNG_SIZES : LOGO_PNG_SIZES.slice(0, 2);
  return {
    src: `${base}64${rest}`,
    srcSet: sizes.map(s => `${base}${s}${rest} ${s}w`).join(', '),
    sizes: `${px}px`,
  };
}

/**
 * A host's initials, shown on its tile until a mark is approved: the first and last words' first
 * letters, as the About page's team monograms ("Together AI" → "TA", "Fireworks" → "F"). Display
 * names are ASCII letters, digits, spaces and . - & ' (§4.1); anything else is skipped.
 */
export function hostInitials(name: string): string {
  const words = (name || '').split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  if (!words.length) return '–';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/**
 * The mark's size in a tile of `tile` px, as the site's chips draw them (§3.1 item 2): 20 → 12,
 * 22 → 13, 24 → 14, 30 → 18, 40 → 24, 64 → 40, 120 → 72; about 60% for any other tile.
 */
export function markPxFor(tile: number): number {
  const fixed: Record<number, number> = { 20: 12, 22: 13, 24: 14, 26: 15, 28: 16, 30: 18, 34: 20, 40: 24, 64: 40, 120: 72 };
  return fixed[tile] ?? Math.round(tile * 0.6);
}
