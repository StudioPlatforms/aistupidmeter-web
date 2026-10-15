import { Inter, Inter_Tight } from 'next/font/google';

/**
 * Typefaces for the landing and sign-in/sign-up pages. next/font downloads them at build time and
 * serves them from this origin, so no visitor request goes to Google. Applied as CSS variables on
 * those pages' root elements only; the dashboard keeps the system stack in vintage.css.
 */
export const lpBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--lp-font',
  display: 'swap',
});

export const lpDisplay = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--lp-display',
  display: 'swap',
});
