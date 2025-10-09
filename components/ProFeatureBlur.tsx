'use client';

import { ReactNode } from 'react';

interface ProFeatureBlurProps {
  children: ReactNode;
  isLocked: boolean;
  onUnlock: () => void;
  title?: string;
}

export default function ProFeatureBlur({ children, isLocked, onUnlock, title = 'Pro Feature' }: ProFeatureBlurProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Blurred content */}
      <div style={{ 
        filter: 'blur(12px)', 
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.2
      }}>
        {children}
      </div>

      {/* Invisible clickable overlay - no text, no visual elements */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          cursor: 'pointer',
          background: 'transparent'
        }}
        onClick={onUnlock}
      />
    </div>
  );
}
