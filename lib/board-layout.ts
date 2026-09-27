/**
 * How a visitor wants the leaderboards laid out.
 *
 * Four layouts of the same four boards (Combined, Coding, Reasoning, Tool use):
 *   connected — four columns, a line joining each model across them (the default)
 *   side      — four full boards next to each other
 *   table     — one table, a row per model with all four scores
 *   top       — the top five of each board, then the full board underneath
 *
 * WHERE THE CHOICE LIVES
 * A cookie (`asl_lb_layout`), for everyone. The home page is rendered per request, so the
 * server reads it and the first paint is already the right layout — no flash of the default
 * for a returning visitor, which localStorage cannot give. A signed-in user's choice is also
 * saved to their account (identity DB, /account/ui-preferences) so it follows them between
 * devices; the cookie is then a mirror of it. Someone who chose before creating an account
 * has that choice copied into the account the first time they sign in.
 *
 * The cookie holds only this one word — no identifier — and is set because the visitor
 * picked something, so it is a functional preference, not tracking.
 */

export type BoardLayout = 'connected' | 'side' | 'table' | 'top';

export const BOARD_LAYOUTS: BoardLayout[] = ['connected', 'side', 'table', 'top'];
export const DEFAULT_LAYOUT: BoardLayout = 'connected';
export const LAYOUT_COOKIE = 'asl_lb_layout';

/** Set when a layout is saved; the home page shows that layout's explainer, then clears it. */
export const LAYOUT_TOUR_PENDING_KEY = 'stupidmeter-layout-tour-pending';

export const LAYOUT_INFO: Record<BoardLayout, { name: string; description: string }> = {
  connected: {
    name: 'Connected',
    description: 'Four boards in columns, with a line joining each model across them. Click a model to trace it.',
  },
  side: {
    name: 'Side by side',
    description: 'Four full boards next to each other: Combined, Coding, Reasoning and Tool use.',
  },
  table: {
    name: 'Table',
    description: 'One table, one row per model, with all four scores and ranks in the row.',
  },
  top: {
    name: 'Top 5',
    description: 'The top five of every board at a glance, with the full ranking underneath.',
  },
};

export function isBoardLayout(v: unknown): v is BoardLayout {
  return typeof v === 'string' && (BOARD_LAYOUTS as string[]).includes(v);
}

/** Client only. */
export function readLayoutCookie(): BoardLayout | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)asl_lb_layout=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : null;
  return isBoardLayout(v) ? v : null;
}

/** Client only. One year; Lax so it rides along on a normal visit from a link. */
export function writeLayoutCookie(layout: BoardLayout) {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LAYOUT_COOKIE}=${layout}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

/** Ask the home page to explain this layout the next time it is on screen. */
export function markLayoutTourPending(layout: BoardLayout) {
  try { localStorage.setItem(LAYOUT_TOUR_PENDING_KEY, layout); } catch { /* private mode */ }
}
