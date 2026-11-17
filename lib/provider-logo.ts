/**
 * The logo pipeline's side of the provider pages (Phase 3 plan §3, M3 API contract v1): the shapes the
 * API answers, the words for each state, the browser's first look at a file before it is sent, and
 * the addresses of the PNGs the server rendered — the only previews any page shows. The uploaded SVG
 * itself is never put into a page: it is read as text here only to find the root element's
 * `viewBox` attribute, and then sent. Client-safe: no server imports.
 */

export type LogoState = 'queued' | 'processing' | 'refused' | 'pending_review' | 'approved' | 'retired' | 'withdrawn';

export type LogoCheckKey =
  | 'square_viewbox' | 'style_removed' | 'colours' | 'not_background' | 'not_wordmark'
  | 'visible_on_white' | 'legible_12px' | 'opacity' | 'lookalike';

export interface LogoCheck {
  key: LogoCheckKey | string;
  ok: boolean;
  /** "Visible on white", "Legible at 12 px", … */
  label: string;
  /** "4.6:1 on 61% of pixels", "ink 24%", "" … */
  detail: string;
}

export interface LogoView {
  id: number;
  state: LogoState;
  createdAt: string;
  /** When processing ended (refused / pending_review) or a later decision. */
  decidedAt: string | null;
  /** Crashed or timed-out processing attempts (3 → refused, processing_failed). */
  attempts: number;
  /**
   * Queued or processing, and uploaded more than 60 s ago (the API's rule): a queued file is then
   * waiting for a sandbox that is not taking files; a processing one is still being checked.
   */
  delayed: boolean;
  /** The plan's sentence for the refusal (§3.2), filled in. */
  refusal: { code: string; message: string } | null;
  /** [] until processed; partial for a file refused early. */
  checks: LogoCheck[];
  /** [64, 128, 256, 512] once rendered, else []. */
  pngSizes: number[];
  sha8: string | null;
  /** The uploaded file's size. */
  bytes: number;
}

/** GET /account/provider/logo. */
export interface LogoStatus {
  role: 'owner' | 'admin' | 'viewer';
  canUpload: boolean;
  limits: { maxBytes: number; perDay: number; usedToday: number; queueFull: boolean };
  /** The newest upload that is queued, processing, refused or in review. */
  current: LogoView | null;
  /** The live mark, if any. */
  approved: LogoView | null;
  standardsVersion: string;
}

/** The admin views' rows (contract §3). */
export interface AdminLogoRow extends LogoView {
  provider: { publicId: string; displayName: string; internal: boolean };
}
export interface AdminLogoDetail extends AdminLogoRow {
  dhash: string | null;
  lookalike: { brand: string; distance: number } | null;
}

export const LOGO_MAX_BYTES = 16_384;

/** Where the Logo standards are read (shown to staff from M3, public with the opening). */
export const LOGO_STANDARDS_PATH = '/inference-providers/logo-standards';

export const LOGO_STATE_LABEL: Record<LogoState, string> = {
  queued: 'Waiting to be checked',
  processing: 'Being checked',
  refused: 'Refused',
  pending_review: 'Awaiting approval',
  approved: 'Approved',
  retired: 'Retired',
  withdrawn: 'Withdrawn',
};

export function logoStateTone(state: LogoState): 'good' | 'warn' | 'bad' | 'accent' | undefined {
  return state === 'approved' ? 'good' : state === 'pending_review' ? 'warn' : state === 'refused' ? 'bad'
    : state === 'queued' || state === 'processing' ? 'accent' : undefined;
}

/** Still with the processor: the page asks again until it is not. */
export const isWorking = (v: LogoView | null | undefined): boolean => !!v && (v.state === 'queued' || v.state === 'processing');

/** The plan's sentences (§3.2) that the page itself says. */
export const LOGO_TEXT = {
  formatNotAccepted: 'Upload an SVG file.',
  fileTooLarge: 'SVG files can be up to 16 KB.',
  notSquare: (viewBox: string) => `Your viewBox is ${viewBox}. Use a square viewBox, for example 0 0 24 24.`,
  noViewBox: 'Your SVG has no viewBox. Use a square viewBox, for example 0 0 24 24.',
  processingUnavailable: 'We could not process files just now. Your upload is queued and will be checked automatically.',
  queueFull: 'Too many files are waiting to be checked. Try again in an hour.',
  /** Ours: a `delayed` upload the processor already has (state processing), beside its "Being checked" pill. */
  stillChecking: 'Your file is still being checked, more than a minute after it was uploaded.',
} as const;

/**
 * What a `delayed` upload says, by its state: the API sets the flag on queued and on processing
 * uploads alike, and only a queued one is waiting for the processor. Null when there is nothing to say.
 */
export function delayedText(v: LogoView | null | undefined): string | null {
  if (!v?.delayed) return null;
  if (v.state === 'queued') return LOGO_TEXT.processingUnavailable;
  if (v.state === 'processing') return LOGO_TEXT.stillChecking;
  return null;
}

/** The member route's PNG of one of this provider's own uploads (contract §2). */
export function memberLogoPng(id: number, size: number, provider?: string | null): string {
  return `/api/account/provider/logo/${id}/png/${size}${provider ? `?provider=${encodeURIComponent(provider)}` : ''}`;
}

/** The admin route's PNG of any upload (contract §3). */
export function adminLogoPng(id: number, size: number): string {
  return `/api/admin/marketplace/logos/${id}/png/${size}`;
}

// ── The browser's first look (§3.3): type, size and the root viewBox, nothing else ──────────────

export type Precheck = { ok: true } | { ok: false; code: 'format_not_accepted' | 'file_too_large' | 'not_square'; message: string };

const SVG_TYPES = new Set(['image/svg+xml']);
// Types some systems give a .svg file they do not recognise; the name and the content decide then.
const VAGUE_TYPES = new Set(['', 'application/octet-stream', 'text/xml', 'application/xml', 'text/plain']);

/** The file's type and size, before it is read. */
export function precheckLogoFile(file: { name: string; type: string; size: number }): Precheck {
  const type = (file.type || '').toLowerCase();
  const svgName = /\.svg$/i.test(file.name || '');
  if (!SVG_TYPES.has(type) && !(VAGUE_TYPES.has(type) && svgName)) {
    return { ok: false, code: 'format_not_accepted', message: LOGO_TEXT.formatNotAccepted };
  }
  if (file.size > LOGO_MAX_BYTES) return { ok: false, code: 'file_too_large', message: LOGO_TEXT.fileTooLarge };
  return { ok: true };
}

/**
 * The root `<svg …>` start tag's attribute text, or null when the file does not begin with one.
 * Skipped before it, as the API's byte scan does: a byte-order mark, whitespace, the XML declaration
 * and comments; also any other processing instruction or a DOCTYPE, which the API refuses with its
 * own sentence once the file is sent. Nothing past the root start tag is looked at.
 */
export function rootSvgAttributes(text: string): string | null {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  for (;;) {
    while (i < n && /\s/.test(text[i])) i++;
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      if (end < 0) return null;
      i = end + 3;
    } else if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i + 2);
      if (end < 0) return null;
      i = end + 2;
    } else if (/^<!doctype/i.test(text.slice(i, i + 9))) {
      // A DOCTYPE may carry an internal subset in [ ]; it ends at the first > after that.
      const open = text.indexOf('[', i);
      const close = text.indexOf('>', i);
      if (close < 0) return null;
      if (open >= 0 && open < close) {
        const sub = text.indexOf(']', open);
        const end = sub < 0 ? -1 : text.indexOf('>', sub);
        if (end < 0) return null;
        i = end + 1;
      } else {
        i = close + 1;
      }
    } else {
      break;
    }
  }
  if (!text.startsWith('<svg', i) || !/[\s/>]/.test(text[i + 4] ?? '')) return null;
  // The tag ends at the first > outside a quoted attribute value.
  let quote: string | null = null;
  for (let j = i + 4; j < n; j++) {
    const c = text[j];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '>') return text.slice(i + 4, j);
  }
  return null;
}

/** The text of the root element's `viewBox` attribute, or null when it has none. */
export function rootViewBox(attributes: string): string | null {
  const m = /(?:^|\s)viewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attributes);
  return m ? (m[1] ?? m[2] ?? '') : null;
}

/**
 * The file's content: an SVG whose root `viewBox` is square. The text is only searched, never
 * parsed into a document or shown; the processor checks everything else.
 */
export function precheckLogoText(text: string): Precheck {
  const attrs = rootSvgAttributes(text);
  if (attrs === null) return { ok: false, code: 'format_not_accepted', message: LOGO_TEXT.formatNotAccepted };
  const raw = rootViewBox(attrs);
  if (raw === null) return { ok: false, code: 'not_square', message: LOGO_TEXT.noViewBox };
  const parts = raw.trim().split(/[\s,]+/).filter(Boolean);
  const nums = parts.map(Number);
  const shown = parts.join(' ').slice(0, 60) || '(empty)';
  if (nums.length !== 4 || !nums.every(Number.isFinite) || !(nums[2] > 0) || nums[2] !== nums[3]) {
    return { ok: false, code: 'not_square', message: LOGO_TEXT.notSquare(shown) };
  }
  return { ok: true };
}

/** Base64 of the file's bytes, for the upload's JSON body. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x2000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x2000)));
  }
  return btoa(bin);
}

/** "4 h", "25 min", "40 s": how long until the daily limit lets another upload through. */
export function waitText(sec: number): string {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} s`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.ceil(min / 60);
  return `${h} ${h === 1 ? 'hour' : 'hours'}`;
}
