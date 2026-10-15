'use client';

import { useState, useEffect, useRef } from 'react';
import { THEMES, cycleTheme, getCurrentThemeIndex, initializeTheme } from '../lib/theme-config';
import '../styles/studio-board.css';

/**
 * The theme switch. `bar` is the top bar's quiet text button (the landing nav's Theme);
 * `row` is the bordered button in the phone menu. After a press, a small card names the theme
 * now showing. Styles: styles/studio-board.css (sb-theme-*).
 */
export default function ThemeButton({ variant = 'bar' }: { variant?: 'bar' | 'row' }) {
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initialize theme on mount
    initializeTheme();
    setCurrentThemeIndex(getCurrentThemeIndex());
    return () => { if (hide.current) clearTimeout(hide.current); };
  }, []);

  const handleThemeChange = () => {
    const newIndex = cycleTheme();
    setCurrentThemeIndex(newIndex);

    // Show tooltip briefly
    setShowTooltip(true);
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => setShowTooltip(false), 2000);
  };

  const currentTheme = THEMES[currentThemeIndex];

  return (
    <span className={`sb-theme is-${variant}`}>
      <button type="button" onClick={handleThemeChange} className="sb-theme-btn" title="Change color theme">
        Theme
      </button>

      {showTooltip && (
        <span className="sb-theme-tip" role="status">
          <b>{currentTheme.name}</b>
          {currentTheme.description}
        </span>
      )}
    </span>
  );
}
