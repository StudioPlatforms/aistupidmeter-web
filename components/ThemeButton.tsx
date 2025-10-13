'use client';

import { useState, useEffect } from 'react';
import { THEMES, cycleTheme, getCurrentThemeIndex, initializeTheme } from '../lib/theme-config';

export default function ThemeButton() {
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Initialize theme on mount
    initializeTheme();
    setCurrentThemeIndex(getCurrentThemeIndex());
  }, []);

  const handleThemeChange = () => {
    const newIndex = cycleTheme();
    setCurrentThemeIndex(newIndex);
    
    // Show tooltip briefly
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  const currentTheme = THEMES[currentThemeIndex];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleThemeChange}
        className="vintage-btn"
        style={{
          padding: '8px 16px',
          fontSize: '0.9em',
          position: 'relative',
          overflow: 'visible'
        }}
        title="Change color theme"
      >
        THEME
      </button>
      
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px',
            padding: '8px 12px',
            background: 'var(--terminal-black)',
            border: '2px solid var(--phosphor-green)',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 0 10px var(--phosphor-green)',
            animation: 'fadeIn 0.2s ease-in'
          }}
          className="terminal-text"
        >
          <div style={{ fontSize: '0.9em', marginBottom: '4px' }}>
            <span className="terminal-text--green">{currentTheme.name}</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
            {currentTheme.description}
          </div>
        </div>
      )}
    </div>
  );
}
