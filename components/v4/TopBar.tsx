'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThemeButton from '../ThemeButton';

interface TopBarProps {
  selectedView: string;
  onViewChange: (view: 'dashboard' | 'about' | 'faq') => void;
  visitorCount: number | null;
  todayVisits: number | null;
}

export default function TopBar({ selectedView, onViewChange, visitorCount, todayVisits }: TopBarProps) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Europe/Berlin',
        }) + ' CET'
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="v4-topbar">
      <div className="v4-topbar-left">
        <div className="v4-logo" onClick={() => onViewChange('dashboard')} style={{ cursor: 'pointer' }}>
          {/* Two files rather than one recoloured by CSS: the mark's "L" is
              navy and vanishes on the dark theme's surface. Only one is ever
              displayed, so screen readers announce the name once. */}
          <img
            className="v4-logo-img v4-logo-img--light"
            src="/asl-mark.png"
            width={754}
            height={160}
            alt="ASL — AI Stupid Level"
          />
          <img
            className="v4-logo-img v4-logo-img--dark"
            src="/asl-mark-dark.png"
            width={754}
            height={160}
            alt="ASL — AI Stupid Level"
          />
        </div>
        <div className="v4-nav">
          <button
            className={`v4-nav-btn ${selectedView === 'dashboard' ? 'active' : ''}`}
            onClick={() => { onViewChange('dashboard'); router.push('/'); }}
          >
            DASHBOARD
          </button>
          <button
            className={`v4-nav-btn ${selectedView === 'about' ? 'active' : ''}`}
            onClick={() => router.push('/about')}
          >
            ABOUT
          </button>
          <button
            className={`v4-nav-btn ${selectedView === 'faq' ? 'active' : ''}`}
            onClick={() => router.push('/faq')}
          >
            FAQ
          </button>
          <button
            className="v4-nav-btn"
            onClick={() => router.push('/router/forum')}
            style={{ color: 'var(--amber-warning, #ffb000)' }}
          >
            FORUM
          </button>
          <button
            className="v4-nav-btn pro-btn"
            onClick={() => router.push('/router')}
          >
            PRO
          </button>
        </div>
      </div>
      <div className="v4-topbar-right">
        <span className="visitors-count">
          👁 <b style={{ color: 'var(--phosphor-green)' }}>{todayVisits !== null ? todayVisits.toLocaleString() : visitorCount ? (visitorCount >= 1000 ? `${Math.round(visitorCount / 1000)}K` : visitorCount.toLocaleString()) : '...'}</b> today
        </span>
        <div className="v4-live-dot"></div>
        <span>ONLINE</span>
        <span className="v4-clock">{currentTime}</span>
        <span className="v4-topbar-theme"><ThemeButton /></span>
      </div>
    </div>
  );
}
