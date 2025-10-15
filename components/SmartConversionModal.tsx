'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ConversionContext = 'degradation' | 'price' | 'return-visit' | 'engaged' | 'default';

interface SmartConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: ConversionContext;
}

export default function SmartConversionModal({ isOpen, onClose, context = 'default' }: SmartConversionModalProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  if (!isOpen || !isVisible) return null;

  const handleStartTrial = () => {
    router.push('/api/stripe/checkout');
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  // Context-aware content
  const getContent = () => {
    switch (context) {
      case 'degradation':
        return {
          icon: '🚨',
          title: 'STOP USING DEGRADED MODELS',
          subtitle: 'You just saw a model degrade in real-time',
          benefits: [
            'Automatic failover when models degrade',
            'Never use a degraded model again',
            'Real-time alerts before performance drops',
            'Save 50-70% by avoiding expensive failures'
          ],
          cta: 'PROTECT YOUR AI STACK NOW'
        };
      
      case 'price':
        return {
          icon: '💰',
          title: 'STOP OVERPAYING FOR AI',
          subtitle: 'You\'re comparing prices manually - let us automate it',
          benefits: [
            'Auto-route to cheapest model that meets quality',
            'Save 50-70% on AI costs automatically',
            'One API key for all providers',
            'Real-time cost optimization'
          ],
          cta: 'START SAVING MONEY NOW'
        };
      
      case 'return-visit':
        return {
          icon: '👋',
          title: 'WELCOME BACK!',
          subtitle: 'Ready to automate your AI model selection?',
          benefits: [
            'You\'ve seen how models degrade',
            'You\'ve compared the performance data',
            'Now let AI Router Pro do this for you',
            '7-day free trial • Cancel anytime'
          ],
          cta: 'TRY PRO FREE FOR 7 DAYS'
        };
      
      case 'engaged':
        return {
          icon: '⚡',
          title: 'YOU\'RE TRACKING MODELS MANUALLY',
          subtitle: 'Spent 3+ minutes checking rankings? Automate it.',
          benefits: [
            'Stop manually checking model rankings',
            'Automatic routing based on real-time data',
            'Never miss a degradation alert',
            'One API key replaces all your keys'
          ],
          cta: 'AUTOMATE YOUR WORKFLOW'
        };
      
      default:
        return {
          icon: '🚀',
          title: 'THE ONLY AI ROUTER WITH REAL INTELLIGENCE',
          subtitle: 'Other routers guess. We know.',
          benefits: [
            'Based on 171+ live benchmarks',
            'Detects degradation before it costs you',
            'Saves 50-70% on AI costs',
            'World\'s first intelligence-based router'
          ],
          cta: 'START FREE TRIAL'
        };
    }
  };

  const content = getContent();

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={handleClose}
    >
      <div 
        className="crt-monitor"
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: window.innerWidth < 768 ? '20px' : '32px',
          backgroundColor: 'var(--terminal-black)',
          border: '3px solid var(--phosphor-green)',
          borderRadius: '8px',
          boxShadow: '0 0 30px var(--phosphor-green)',
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--phosphor-green)',
            fontSize: '1.5em',
            cursor: 'pointer',
            padding: '4px 8px',
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          ×
        </button>

        <div className="terminal-text">
          {/* Icon & Title */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '3em', marginBottom: '12px' }}>
              {content.icon}
            </div>
            <h2 style={{ 
              fontSize: window.innerWidth < 768 ? '1.3em' : '1.6em',
              marginBottom: '8px',
              color: 'var(--phosphor-green)',
              textShadow: '0 0 10px var(--phosphor-green)'
            }}>
              {content.title}
            </h2>
            <p className="terminal-text--dim" style={{ 
              fontSize: window.innerWidth < 768 ? '0.9em' : '1em'
            }}>
              {content.subtitle}
            </p>
          </div>

          {/* Benefits */}
          <div style={{ 
            marginBottom: '24px',
            padding: '20px',
            backgroundColor: 'rgba(0, 255, 65, 0.05)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '6px'
          }}>
            {content.benefits.map((benefit, index) => (
              <div 
                key={index}
                style={{ 
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: index < content.benefits.length - 1 ? '12px' : '0',
                  fontSize: window.innerWidth < 768 ? '0.9em' : '1em'
                }}
              >
                <span className="terminal-text--green" style={{ fontSize: '1.2em', flexShrink: 0 }}>
                  ✓
                </span>
                <span className="terminal-text">
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: 'rgba(255, 165, 0, 0.08)',
            border: '2px solid var(--amber-warning)',
            borderRadius: '6px'
          }}>
            <div className="terminal-text--dim" style={{ 
              fontSize: '0.9em',
              textDecoration: 'line-through',
              marginBottom: '4px'
            }}>
              $49.99/month
            </div>
            <div style={{ 
              fontSize: window.innerWidth < 768 ? '2em' : '2.5em',
              fontWeight: 'bold',
              color: 'var(--amber-warning)',
              textShadow: '0 0 10px var(--amber-warning)',
              lineHeight: '1',
              marginBottom: '8px'
            }}>
              $4.99<span style={{ fontSize: '0.4em' }}>/mo</span>
            </div>
            <div className="terminal-text--green" style={{ 
              fontSize: '1em',
              fontWeight: 'bold',
              marginBottom: '4px'
            }}>
              🎉 7-Day Free Trial
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              No credit card • Cancel anytime
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleStartTrial}
            className="vintage-btn vintage-btn--active"
            style={{
              width: '100%',
              padding: '16px 32px',
              fontSize: window.innerWidth < 768 ? '1em' : '1.1em',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              background: 'linear-gradient(135deg, var(--phosphor-green), var(--phosphor-dim))',
              border: '2px solid var(--phosphor-green)',
              color: 'var(--terminal-black)',
              boxShadow: '0 0 20px rgba(0, 255, 65, 0.4)',
              marginBottom: '16px'
            }}
          >
            {content.cta} →
          </button>

          {/* Footer */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleClose}
              className="terminal-text--dim"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85em',
                textDecoration: 'underline',
                padding: '8px'
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `
      }} />
    </div>
  );
}
