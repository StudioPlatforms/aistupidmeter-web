// Theme configuration for retro color schemes
export interface ThemeColors {
  primary: string;
  primaryDim: string;
  background: string;
  backgroundDark: string;
  name: string;
  description: string;
  isLight: boolean;  // Flag to indicate if this is a light theme
}

export const THEMES: ThemeColors[] = [
  {
    name: 'Halloween Spooky',
    description: 'Spooky jack-o-lantern glow for Halloween',
    primary: '#ff6b00',
    primaryDim: '#cc5500',
    background: '#0a0508',  // Deep purple-black night
    backgroundDark: '#050204',  // Near-black with purple tint
    isLight: false,
  },
  {
    name: 'Christmas Festive',
    description: 'Festive holiday green with twinkling lights',
    primary: '#00a86b',  // Christmas emerald green
    primaryDim: '#007a4d',  // Darker festive green
    background: '#050f08',  // Rich forest green-black
    backgroundDark: '#020805',  // Deep green-black for depth
    isLight: false,
  },
  {
    name: 'Classic Green',
    description: 'Original phosphor green terminal',
    primary: '#00ff41',
    primaryDim: '#00cc33',
    background: '#0a0a0a',  // Original pure dark background - no tint
    backgroundDark: '#000000',  // Pure black for darkest areas
    isLight: false,
  },
  {
    name: 'Amber Terminal',
    description: 'Warm IBM/DOS amber',
    primary: '#ffb000',
    primaryDim: '#cc8800',
    background: '#0f0a05',  // Very dark warm brown - subtle amber warmth
    backgroundDark: '#080503',  // Deep warm black
    isLight: false,
  },
  {
    name: 'Faded Blue',
    description: 'Classic IBM blue screen',
    primary: '#5c9ccc',
    primaryDim: '#4a7a9f',
    background: '#0a0f14',  // Dark cool blue-grey - subtle blue tint
    backgroundDark: '#050810',  // Deep cool black
    isLight: false,
  },
  {
    name: 'Cyan Terminal',
    description: 'Cool DEC cyan phosphor',
    primary: '#00d4ff',
    primaryDim: '#0099cc',
    background: '#050f12',  // Dark cyan-tinted background
    backgroundDark: '#020a0c',  // Deep cyan black
    isLight: false,
  },
  {
    name: 'Paper Terminal',
    description: 'Light mode - classic paper printout',
    primary: '#2a2a2a',  // Dark grey text
    primaryDim: '#4a4a4a',  // Medium grey
    background: '#f5f5dc',  // Beige paper color
    backgroundDark: '#e8e8d0',  // Slightly darker beige
    isLight: true,  // This is the light theme!
  },
  {
    name: 'Soft Teal',
    description: 'Easy on eyes teal-green',
    primary: '#00cc88',
    primaryDim: '#009966',
    background: '#050f0c',  // Dark teal-green tinted background
    backgroundDark: '#020805',  // Deep teal black
    isLight: false,
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
  
  // Add data attribute for CSS to detect light/dark theme
  document.documentElement.setAttribute('data-theme', theme.isLight ? 'light' : 'dark');
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme.primary);
  }
}

export function getCurrentThemeIndex(): number {
  if (typeof window === 'undefined') return getDefaultThemeIndex();
  const saved = localStorage.getItem('retro-theme-index');
  return saved ? parseInt(saved, 10) : getDefaultThemeIndex();
}

function getDefaultThemeIndex(): number {
  const today = new Date();
  const month = today.getMonth(); // 0-indexed: 0=Jan, 9=Oct, 11=Dec
  const day = today.getDate();
  
  // Check for seasonal themes
  const isHalloween = month === 9 && day === 31; // October 31st
  const isChristmasSeason = month === 11; // December (entire month)
  
  // Return seasonal theme if applicable, otherwise Classic Green (index 2)
  if (isHalloween) return 0;      // Halloween Spooky
  if (isChristmasSeason) return 1; // Christmas Festive
  return 2;                        // Classic Green (default)
}

function isSeasonalTheme(themeIndex: number): boolean {
  return themeIndex === 0 || themeIndex === 1; // Halloween or Christmas
}

function shouldResetSeasonalTheme(themeIndex: number): boolean {
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();
  
  // Reset Halloween theme after October 31st
  if (themeIndex === 0 && !(month === 9 && day === 31)) {
    return true;
  }
  
  // Reset Christmas theme after December
  if (themeIndex === 1 && month !== 11) {
    return true;
  }
  
  return false;
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
  let index = getCurrentThemeIndex();
  
  // Auto-reset seasonal themes when their season passes
  if (isSeasonalTheme(index) && shouldResetSeasonalTheme(index)) {
    console.log(`Seasonal theme expired, resetting to default theme`);
    index = getDefaultThemeIndex();
    saveThemeIndex(index);
  }
  
  applyTheme(THEMES[index]);
}
