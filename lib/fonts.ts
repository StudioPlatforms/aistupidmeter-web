import { Inter, Inter_Tight } from 'next/font/google';

/**
 * Typefaces for the landing and sign-in/sign-up pages. next/font downloads them at build time and
 * serves them from this origin, so no visitor request goes to Google. Applied as CSS variables on
 * those pages' root elements only; the dashboard keeps the system stack in vintage.css.
 *
 * When the web font is not used — an iPhone in Lockdown Mode or behind a content blocker refuses web
 * fonts — the text falls to the platform's own UI face (San Francisco on Apple devices, which Inter
 * was drawn to resemble), not next/font's default size-adjusted Arial, which reads as a plain page.
 * next/font only accepts literal options, so the list is written out in each call.
 */
export const lpBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--lp-font',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'], // literals: next/font requires them
});

export const lpDisplay = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--lp-display',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'], // literals: next/font requires them
});
