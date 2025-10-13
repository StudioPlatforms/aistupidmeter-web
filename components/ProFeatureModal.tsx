'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface ProFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'historical-data' | 'performance-matrix';
}

export default function ProFeatureModal({ isOpen, onClose, feature }: ProFeatureModalProps) {
  const router = useRouter();
  const { data: session } = useSession();

  if (!isOpen) return null;

  const featureDetails = {
    'historical-data': {
      title: '📊 Unlock Historical Data Analysis',
      description: 'Access comprehensive historical performance data across multiple time periods',
      benefits: [
        '24-hour performance tracking',
        '7-day trend analysis',
        '30-day historical comparisons',
        'Advanced performance insights'
      ]
    },
    'performance-matrix': {
      title: '🎯 Unlock Full Performance Matrix',
      description: 'Access all performance evaluation modes and detailed breakdowns',
      benefits: [
        '7-Axis performance breakdown',
        'Deep reasoning analysis',
        'Tool calling metrics',
        'Combined performance view'
      ]
    }
  };

  const details = featureDetails[feature];

  const handleUpgrade = () => {
    if (session) {
      // User is authenticated, go to subscription page
      router.push('/router/subscription');
    } else {
      // User needs to sign up first
      router.push('/auth/signup');
    }
  };

  const handleSignIn = () => {
    router.push('/auth/signin');
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div 
        className="section-card"
        style={{
          maxWidth: '600px',
          width: '100%',
          background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
          border: '3px solid #00BFFF',
          padding: 'var(--space-lg)',
          boxShadow: '0 0 30px rgba(0, 191, 255, 0.5)',
          animation: 'slideUp 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
          paddingBottom: 'var(--space-md)',
          borderBottom: '2px solid rgba(0, 191, 255, 0.3)'
        }}>
          <div className="terminal-text" style={{ 
            fontSize: '1.8em', 
            fontWeight: 'bold',
            color: '#00BFFF',
            marginBottom: '8px',
            textShadow: '0 0 10px rgba(0, 191, 255, 0.5)'
          }}>
            {details.title}
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '1em', lineHeight: '1.5' }}>
            {details.description}
          </div>
        </div>

        {/* Benefits */}
        <div style={{ 
          marginBottom: 'var(--space-lg)',
          padding: 'var(--space-md)',
          background: 'rgba(0, 191, 255, 0.05)',
          border: '1px solid rgba(0, 191, 255, 0.2)',
          borderRadius: '6px'
        }}>
          <div className="terminal-text--green" style={{ 
            fontSize: '1.1em', 
            fontWeight: 'bold',
            marginBottom: 'var(--space-sm)'
          }}>
            ✨ Pro Features Include:
          </div>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0,
            margin: 0
          }}>
            {details.benefits.map((benefit, index) => (
              <li key={index} style={{ 
                padding: '8px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ color: '#00BFFF', fontSize: '1.2em' }}>✓</span>
                <span className="terminal-text" style={{ fontSize: '0.95em' }}>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
          padding: 'var(--space-md)',
          background: 'rgba(0, 255, 65, 0.05)',
          border: '1px solid rgba(0, 255, 65, 0.2)',
          borderRadius: '6px'
        }}>
          <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
            💎 Limited Time Offer
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span className="terminal-text--dim" style={{ 
              fontSize: '1.1em', 
              textDecoration: 'line-through',
              marginRight: '12px'
            }}>
              $49.99
            </span>
            <span className="terminal-text--green" style={{ fontSize: '2em', fontWeight: 'bold' }}>
              $4.99/month
            </span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            7-day free trial • Cancel anytime • No hidden fees
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleUpgrade}
            className="vintage-btn vintage-btn--active"
            style={{
              width: '100%',
              fontSize: '1.1em',
              padding: '16px',
              background: '#00BFFF',
              color: '#000',
              fontWeight: 'bold',
              border: '2px solid #00BFFF',
              boxShadow: '0 0 15px rgba(0, 191, 255, 0.5)'
            }}
          >
            {session ? '🚀 UPGRADE TO PRO' : '🚀 SIGN UP & GET PRO'}
          </button>

          {!session && (
            <button
              onClick={handleSignIn}
              className="vintage-btn"
              style={{
                width: '100%',
                fontSize: '0.95em',
                padding: '12px'
              }}
            >
              Already have an account? Sign In
            </button>
          )}

          <button
            onClick={onClose}
            className="vintage-btn"
            style={{
              width: '100%',
              fontSize: '0.9em',
              padding: '10px',
              opacity: 0.7
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
