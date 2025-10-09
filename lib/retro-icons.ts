// Retro ASCII/Unicode icons for vintage terminal aesthetic
export const RetroIcons = {
  // Navigation & UI
  dashboard: '▣',
  menu: '≡',
  settings: '⚙',
  profile: '◉',
  
  // Actions
  key: '⚿',
  lock: '🔒',
  unlock: '🔓',
  check: '✓',
  cross: '✗',
  plus: '+',
  minus: '-',
  arrow: '→',
  arrowUp: '↑',
  arrowDown: '↓',
  
  // Status
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  
  // Data & Analytics
  chart: '▤',
  graph: '▦',
  stats: '▥',
  analytics: '▧',
  
  // Money & Business
  money: '$',
  coin: '◎',
  savings: '◈',
  
  // Tech & Computing
  api: '⌘',
  code: '< >',
  terminal: '▶',
  server: '▣',
  database: '▦',
  
  // Communication
  email: '✉',
  message: '✎',
  notification: '◉',
  
  // Time
  clock: '◷',
  calendar: '▦',
  
  // Misc
  star: '★',
  heart: '♥',
  lightning: '⚡',
  fire: '▲',
  rocket: '▲',
  target: '◎',
  shield: '◈',
  crown: '♔',
  trophy: '♕',
  
  // Numbers in circles (for steps)
  one: '①',
  two: '②',
  three: '③',
  four: '④',
  five: '⑤',
  six: '⑥',
  seven: '⑦',
  eight: '⑧',
  nine: '⑨',
} as const;

// Helper function to get icon
export function getRetroIcon(name: keyof typeof RetroIcons): string {
  return RetroIcons[name];
}
