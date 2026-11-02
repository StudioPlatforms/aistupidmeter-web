/**
 * A readable mirror of "this browser holds a session cookie", which is httpOnly and so invisible to
 * the page's own scripts. middleware.ts sets and clears it; the theme boot script reads it before
 * first paint (lib/theme-config.ts). It carries no identity and grants nothing.
 */
export const SESSION_HINT_COOKIE = 'asl_in';
