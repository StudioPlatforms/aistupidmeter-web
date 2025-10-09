'use client';

import RouterSidebar from './RouterSidebar';

interface RouterLayoutProps {
  children: React.ReactNode;
}

export default function RouterLayout({ children }: RouterLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--terminal-black)' }}>
      <RouterSidebar />
      
      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          marginLeft: '0', // Mobile: no margin
          paddingBottom: '100px', // Mobile: space for hamburger button
          transition: 'margin-left 0.3s ease, padding-bottom 0.3s ease',
        }}
        className="router-content"
      >
        {children}
      </div>

      {/* Desktop-specific styles */}
      <style jsx global>{`
        @media (min-width: 768px) {
          .router-content {
            margin-left: 240px !important;
            padding-bottom: 0 !important;
          }
        }

        /* Smooth page transitions */
        .router-content > * {
          animation: fadeIn 0.3s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Button hover effects */
        .vintage-btn {
          transition: all 0.2s ease;
        }

        .vintage-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(0, 255, 65, 0.4);
        }

        .vintage-btn:active {
          transform: translateY(0);
        }

        /* Success animation */
        @keyframes successBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .success-animation {
          animation: successBounce 0.5s ease;
        }

        /* Error shake */
        @keyframes errorShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .error-animation {
          animation: errorShake 0.5s ease;
        }

        /* Loading skeleton */
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }

        /* Modal slide up animation */
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-slide-up {
          animation: slideUp 0.3s ease-out;
        }

        /* Responsive touch targets for mobile */
        @media (max-width: 767px) {
          .vintage-btn {
            min-height: 44px;
            min-width: 44px;
            padding: 12px 16px;
          }

          .control-panel {
            padding: 16px;
          }

          .crt-monitor {
            padding: 16px;
          }
        }

        /* Desktop optimizations */
        @media (min-width: 768px) {
          .vintage-grid {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          }

          /* Better hover states on desktop */
          .crt-monitor:hover {
            box-shadow: 0 0 15px rgba(0, 255, 65, 0.2);
            transition: box-shadow 0.2s ease;
          }
        }
      `}</style>
    </div>
  );
}
