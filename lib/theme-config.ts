// Theme configuration — clean, professional palettes (Google-Analytics style).
// The old terminal variable names are kept so every existing
// var(--phosphor-*) / var(--terminal-*) usage across the app keeps working:
//   primary        -> --phosphor-green  (primary INK / text)
//   primaryDim     -> --phosphor-dim    (secondary text)
//   background     -> --terminal-black  (page CANVAS)
//   backgroundDark -> --terminal-dark   (SURFACE / cards)
export interface ThemeColors {
  name: string;
  description: string;
  isLight: boolean;
  primary: string;        // primary text / ink
  primaryDim: string;     // secondary text
  background: string;     // page canvas
  backgroundDark: string; // surface / cards
  border: string;         // hairline border
  accent: string;         // links, active state, primary button
  accentInk: string;      // accent hover / pressed
  accentBg: string;       // accent tint background
  good: string;  goodBg: string;   // positive / success
  warn: string;  warnBg: string;   // warning
  bad: string;   badBg: string;    // negative / error
}

export const THEMES: ThemeColors[] = [
  {
    name: 'Light',
    description: 'Clean professional light — crisp white surfaces & blue accent',
    isLight: true,
    primary: '#202124',
    primaryDim: '#5f6368',
    background: '#f6f8fc',
    backgroundDark: '#ffffff',
    border: '#e3e6ea',
    accent: '#1a73e8',
    accentInk: '#174ea6',
    accentBg: '#e8f0fe',
    good: '#1e8e3e', goodBg: '#e6f4ea',
    warn: '#b06000', warnBg: '#fef7e0',
    bad: '#d93025',  badBg: '#fce8e6',
  },
  {
    name: 'Dark',
    description: 'Clean dark — slate surfaces & soft blue accent',
    isLight: false,
    primary: '#e8eaed',
    primaryDim: '#9aa0a6',
    background: '#202124',
    backgroundDark: '#292a2d',
    border: '#3c4043',
    accent: '#8ab4f8',
    accentInk: '#aecbfa',
    accentBg: '#28344a',
    good: '#81c995', goodBg: '#1f2e23',
    warn: '#fdd663', warnBg: '#332b16',
    bad: '#f28b82',  badBg: '#33211f',
  },
];

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '26, 115, 232';
};

/** The CSS variables a theme sets on <html>. Shared by applyTheme and the pre-paint boot script. */
export function themeVars(theme: ThemeColors): Record<string, string> {
  return {
    // Core (legacy variable names, new clean values)
    '--phosphor-green': theme.primary,
    '--phosphor-dim': theme.primaryDim,
    '--terminal-black': theme.background,
    '--terminal-dark': theme.backgroundDark,
    '--metal-silver': theme.border,
    '--paper-white': theme.backgroundDark,
    // Accent + semantic tokens
    '--accent': theme.accent,
    '--accent-ink': theme.accentInk,
    '--accent-bg': theme.accentBg,
    '--accent-rgb': hexToRgb(theme.accent),
    '--primary-rgb': hexToRgb(theme.accent), // tints resolve to the accent
    '--good': theme.good, '--good-bg': theme.goodBg,
    '--warn': theme.warn, '--warn-bg': theme.warnBg,
    '--bad': theme.bad, '--bad-bg': theme.badBg,
    '--amber-warning': theme.warn,
    '--red-alert': theme.bad,
  };
}

export function applyTheme(theme: ThemeColors) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(theme))) root.style.setProperty(k, v);

  // Light/dark hook for CSS + native form controls
  root.setAttribute('data-theme', theme.isLight ? 'light' : 'dark');
  root.style.colorScheme = theme.isLight ? 'light' : 'dark';

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.setAttribute('content', theme.backgroundDark);
}

/**
 * Inline script for the root layout's <head>: applies the saved theme before the first paint.
 *
 * applyTheme otherwise runs only when the top bar mounts, so anything drawn before it — the home
 * and model pages' loading screens, which render without the top bar — came up in the light theme
 * for a visitor who had chosen dark, and every page flashed light before switching.
 */
export function themeBootScript(): string {
  const themes = THEMES.map((t) => ({ v: themeVars(t), light: t.isLight, bar: t.backgroundDark }));
  return `(function(){try{var T=${JSON.stringify(themes)};var i=parseInt(localStorage.getItem('retro-theme-index')||'0',10);if(!(i>=0&&i<T.length))i=0;var t=T[i],r=document.documentElement;for(var k in t.v)r.style.setProperty(k,t.v[k]);r.setAttribute('data-theme',t.light?'light':'dark');r.style.colorScheme=t.light?'light':'dark';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t.bar);}catch(e){}})();`;
}

function getDefaultThemeIndex(): number {
  return 0; // Light
}

export function getCurrentThemeIndex(): number {
  if (typeof window === 'undefined') return getDefaultThemeIndex();
  const saved = localStorage.getItem('retro-theme-index');
  const idx = saved !== null ? parseInt(saved, 10) : getDefaultThemeIndex();
  // Clamp: older builds saved indices 0-7 that no longer exist
  if (Number.isNaN(idx) || idx < 0 || idx >= THEMES.length) return getDefaultThemeIndex();
  return idx;
}

export function saveThemeIndex(index: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('retro-theme-index', index.toString());
}

export function cycleTheme(): number {
  const currentIndex = getCurrentThemeIndex();
  const nextIndex = (currentIndex + 1) % THEMES.length;
  saveThemeIndex(nextIndex);
  applyTheme(THEMES[nextIndex]);
  return nextIndex;
}

export function initializeTheme() {
  if (typeof window === 'undefined') return;
  const index = getCurrentThemeIndex();
  saveThemeIndex(index); // normalise any stale saved value
  applyTheme(THEMES[index]);
}
