'use client';

import { useRouter } from 'next/navigation';
import ThemeButton from '../ThemeButton';

interface MobileNavProps {
  selectedView: string;
  onViewChange: (view: 'dashboard' | 'about' | 'faq') => void;
}

export default function MobileNav({ selectedView, onViewChange }: MobileNavProps) {
  const router = useRouter();

  // MobileNav is hidden on desktop via CSS (.v4-mobile-nav)
  return (
    <div className="v4-mobile-nav">
      <button
        onClick={() => onViewChange('dashboard')}
        className="vintage-btn"
        style={{
          flex: 1,
          minHeight: '42px',
          fontSize: '9px',
          padding: '8px 4px',
          borderRadius: '4px',
          ...(selectedView === 'dashboard' ? { 
            background: 'var(--phosphor-green)',
            color: 'var(--terminal-black)',
          } : {}),
        }}
      >
        DASHBOARD
      </button>
      <button
        onClick={() => onViewChange('about')}
        className="vintage-btn"
        style={{
          flex: 1,
          minHeight: '42px',
          fontSize: '9px',
          padding: '8px 4px',
          borderRadius: '4px',
          ...(selectedView === 'about' ? { 
            background: 'var(--phosphor-green)',
            color: 'var(--terminal-black)',
          } : {}),
        }}
      >
        ABOUT
      </button>
      <button
        onClick={() => router.push('/router')}
        className="vintage-btn"
        style={{
          flex: 1,
          minHeight: '42px',
          fontSize: '9px',
          padding: '8px 4px',
          borderRadius: '4px',
          borderColor: '#00BFFF',
          color: '#00BFFF',
        }}
      >
        ⚡ PRO
      </button>
      <button
        onClick={() => onViewChange('faq')}
        className="vintage-btn"
        style={{
          flex: 1,
          minHeight: '42px',
          fontSize: '9px',
          padding: '8px 4px',
          borderRadius: '4px',
          ...(selectedView === 'faq' ? { 
            background: 'var(--phosphor-green)',
            color: 'var(--terminal-black)',
          } : {}),
        }}
      >
        FAQ
      </button>
      <div style={{ flex: '0 0 42px' }}>
        <ThemeButton />
      </div>
    </div>
  );
}
