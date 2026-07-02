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

export function applyTheme(theme: ThemeColors) {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  // Core (legacy variable names, new clean values)
  set('--phosphor-green', theme.primary);
  set('--phosphor-dim', theme.primaryDim);
  set('--terminal-black', theme.background);
  set('--terminal-dark', theme.backgroundDark);
  set('--metal-silver', theme.border);
  set('--paper-white', theme.backgroundDark);

  // Accent + semantic tokens
  set('--accent', theme.accent);
  set('--accent-ink', theme.accentInk);
  set('--accent-bg', theme.accentBg);
  set('--accent-rgb', hexToRgb(theme.accent));
  set('--primary-rgb', hexToRgb(theme.accent)); // tints resolve to the accent
  set('--good', theme.good); set('--good-bg', theme.goodBg);
  set('--warn', theme.warn); set('--warn-bg', theme.warnBg);
  set('--bad', theme.bad);   set('--bad-bg', theme.badBg);
  set('--amber-warning', theme.warn);
  set('--red-alert', theme.bad);

  // Light/dark hook for CSS + native form controls
  root.setAttribute('data-theme', theme.isLight ? 'light' : 'dark');
  root.style.colorScheme = theme.isLight ? 'light' : 'dark';

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.setAttribute('content', theme.backgroundDark);
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
