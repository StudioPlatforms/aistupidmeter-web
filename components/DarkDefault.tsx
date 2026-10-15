'use client';

import { useLayoutEffect } from 'react';
import { DARK_THEME_INDEX, THEMES, applyTheme, getCurrentThemeIndex, hasChosenTheme } from '@/lib/theme-config';

/**
 * Keeps a page in Dark unless the visitor chose a theme (lib/theme-config darkDefaultScript does the
 * first paint; this covers in-app navigation). On leaving, it hands the page back to the saved or
 * default theme, so the dashboard and other pages are unaffected. Layout effects run before paint,
 * so moving between two pages that both use this never flashes.
 */
export default function DarkDefault() {
  useLayoutEffect(() => {
    if (hasChosenTheme()) return;
    applyTheme(THEMES[DARK_THEME_INDEX]);
    return () => {
      if (!hasChosenTheme()) applyTheme(THEMES[getCurrentThemeIndex()]);
    };
  }, []);
  return null;
}
