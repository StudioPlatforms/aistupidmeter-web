'use client';

import { useEffect } from 'react';
import RouterSidebar from './RouterSidebar';
import { initializeTheme } from '../lib/theme-config';
import '../styles/router-v4.css';

interface RouterLayoutProps {
  children: React.ReactNode;
}

export default function RouterLayout({ children }: RouterLayoutProps) {
  // Initialize theme on mount to ensure it persists across router pages
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <div className="rv4-shell">
      <RouterSidebar />
      <div className="rv4-content">
        {children}
      </div>
    </div>
  );
}
