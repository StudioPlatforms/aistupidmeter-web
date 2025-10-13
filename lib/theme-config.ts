// Theme configuration for retro color schemes
export interface ThemeColors {
  primary: string;
  primaryDim: string;
  background: string;
  backgroundDark: string;
  name: string;
  description: string;
}

export const THEMES: ThemeColors[] = [
  {
    name: 'Classic Green',
    description: 'Original phosphor green terminal',
    primary: '#00ff41',
    primaryDim: '#00cc33',
    background: '#001a00',  // Dark green tint - authentic P1 phosphor glow
    backgroundDark: '#000f00',
  },
  {
    name: 'Amber Terminal',
    description: 'Warm IBM/DOS amber',
    primary: '#ffb000',
    primaryDim: '#cc8800',
    background: '#1a0f00',  // Dark amber/brown - authentic amber monitor glow
    backgroundDark: '#0f0800',
  },
  {
    name: 'Faded Blue',
    description: 'Classic IBM blue screen',
    primary: '#5c9ccc',
    primaryDim: '#4a7a9f',
    background: '#1a2332',  // Faded blue-grey background
    backgroundDark: '#0f1419',
  },
  {
    name: 'Cyan Terminal',
    description: 'Cool DEC cyan phosphor',
    primary: '#00d4ff',
    primaryDim: '#0099cc',
    background: '#001a1f',  // Dark blue tint - authentic cyan phosphor glow
    backgroundDark: '#000f14',
  },
  {
    name: 'Faded Grey',
    description: 'Classic monochrome CRT',
    primary: '#c0c0c0',
    primaryDim: '#808080',
    background: '#1a1a1a',  // Faded grey background
    backgroundDark: '#0f0f0f',
  },
  {
    name: 'Soft Teal',
    description: 'Easy on eyes teal-green',
    primary: '#00cc88',
    primaryDim: '#009966',
    background: '#001410',  // Dark teal tint - medical monitor style
    backgroundDark: '#000a08',
  },
];

export function applyTheme(theme: ThemeColors) {
  document.documentElement.style.setProperty('--phosphor-green', theme.primary);
  document.documentElement.style.setProperty('--phosphor-dim', theme.primaryDim);
  document.documentElement.style.setProperty('--terminal-black', theme.background);
  document.documentElement.style.setProperty('--terminal-dark', theme.backgroundDark);
  
  // Convert hex to RGB for opacity support
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 255, 65';
  };
  
  document.documentElement.style.setProperty('--primary-rgb', hexToRgb(theme.primary));
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme.primary);
  }
}

export function getCurrentThemeIndex(): number {
  if (typeof window === 'undefined') return 0;
  const saved = localStorage.getItem('retro-theme-index');
  return saved ? parseInt(saved, 10) : 0;
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
  applyTheme(THEMES[index]);
}
