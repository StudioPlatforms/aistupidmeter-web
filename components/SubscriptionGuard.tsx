'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  feature: string;
}

export default function SubscriptionGuard({ children, feature }: SubscriptionGuardProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      checkSubscription();
    } else if (status === 'unauthenticated') {
      setChecking(false);
      setHasAccess(false);
    }
  }, [status, session]);

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session!.user!.email!
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data.hasAccess) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (err) {
      console.error('[SubscriptionGuard] Failed to check subscription:', err);
      setHasAccess(false);
    } finally {
      setChecking(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = '/api/stripe/checkout';
  };

  if (checking) {
    return (
      <div className="vintage-container">
        <div className="crt-monitor">
          <div className="terminal-text terminal-text--green" style={{ fontSize: '1.5em', textAlign: 'center', padding: 'var(--space-xl)' }}>
            CHECKING ACCESS<span className="vintage-loading"></span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="vintage-container">
        <div className="crt-monitor" style={{ maxWidth: 'min(1200px, 95vw)', margin: '0 auto', width: '100%' }}>
          {/* Locked Feature Banner */}
          <div style={{ 
            textAlign: 'center', 
            padding: 'clamp(1.5rem, 4vw, 3rem)',
            borderBottom: '2px solid rgba(255,165,0,0.3)'
          }}>
            <div style={{ fontSize: 'clamp(3em, 6vw, 4em)', marginBottom: 'var(--space-md)' }}>🔒</div>
            <h1 className="terminal-text terminal-text--amber" style={{ 
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 'bold',
              marginBottom: 'var(--space-sm)',
              textTransform: 'uppercase',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto'
            }}>
              {feature} - PRO FEATURE
            </h1>
            <p className="terminal-text terminal-text--dim" style={{ 
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              maxWidth: '800px',
              margin: '0 auto',
              lineHeight: '1.5'
            }}>
              Upgrade to AI Router PRO to unlock this feature
            </p>
          </div>

          {/* Preview Section */}
          <div style={{ 
            padding: 'clamp(1.5rem, 4vw, 2.5rem)',
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(0,255,65,0.2)'
          }}>
            <div className="terminal-text terminal-text--green" style={{ 
              fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)',
              fontWeight: 'bold',
              marginBottom: 'var(--space-lg)',
              textAlign: 'center'
            }}>
              What You'll Get:
            </div>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
              gap: 'clamp(1rem, 2vw, 1.5rem)',
              marginBottom: 'var(--space-xl)',
              maxWidth: '1000px',
              margin: '0 auto var(--space-xl)'
            }}>
              {getFeatureBenefits(feature).map((benefit, i) => (
                <div key={i} className="control-panel" style={{ 
                  padding: 'clamp(1rem, 2vw, 1.5rem)',
                  textAlign: 'center',
                  minHeight: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <div style={{ fontSize: 'clamp(2em, 4vw, 2.5em)', marginBottom: 'var(--space-sm)' }}>{benefit.icon}</div>
                  <div className="terminal-text terminal-text--green" style={{ 
                    fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)',
                    fontWeight: 'bold',
                    marginBottom: 'var(--space-xs)',
                    wordWrap: 'break-word'
                  }}>
                    {benefit.title}
                  </div>
                  <div className="terminal-text--dim" style={{ 
                    fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
                    lineHeight: '1.5',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    {benefit.description}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <button 
                onClick={handleUpgrade}
                className="vintage-btn"
                style={{ 
                  fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                  padding: 'clamp(0.75rem, 2vw, 1rem) clamp(1.5rem, 4vw, 2.5rem)',
                  background: 'linear-gradient(135deg, var(--phosphor-green), var(--phosphor-dim))',
                  border: '2px solid var(--phosphor-green)',
                  color: 'var(--terminal-black)',
                  fontWeight: 'bold',
                  boxShadow: '0 0 15px rgba(0,255,0,0.4)',
                  textTransform: 'uppercase',
                  width: '100%',
                  maxWidth: '450px',
                  margin: '0 auto',
                  display: 'block'
                }}
              >
                Upgrade to PRO →
              </button>
              <div className="terminal-text--dim" style={{ 
                marginTop: 'var(--space-md)',
                fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)'
              }}>
                $4.99/month • 7-Day Free Trial • Cancel Anytime
              </div>
            </div>
          </div>

          {/* Value Props */}
          <div style={{ padding: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
            <div className="terminal-text terminal-text--green" style={{ 
              fontSize: 'clamp(1.125rem, 2.5vw, 1.375rem)',
              fontWeight: 'bold',
              marginBottom: 'var(--space-lg)',
              textAlign: 'center'
            }}>
              Why Upgrade to PRO?
            </div>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
              gap: 'clamp(0.75rem, 1.5vw, 1rem)',
              maxWidth: '1000px',
              margin: '0 auto'
            }}>
              {[
                '💰 Save 50-70% on AI costs with intelligent routing',
                '🎯 Access to all AI models (GPT, Claude, Grok, Gemini)',
                '📊 Real-time analytics and performance tracking',
                '🔑 Unlimited universal API keys',
                '⚡ Zero downtime with automatic failover',
                '🔒 Secure provider key management',
                '📈 Advanced cost optimization',
                '🎛️ Custom routing preferences'
              ].map((item, i) => (
                <div key={i} style={{ 
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-sm)',
                  padding: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                  background: 'rgba(0,255,0,0.05)',
                  borderRadius: '4px'
                }}>
                  <span style={{ fontSize: 'clamp(1.1em, 2vw, 1.3em)', flexShrink: 0 }}>{item.split(' ')[0]}</span>
                  <span className="terminal-text--dim" style={{ 
                    fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
                    lineHeight: '1.5',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}>
                    {item.substring(item.indexOf(' ') + 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function getFeatureBenefits(feature: string) {
  const benefits: Record<string, Array<{icon: string, title: string, description: string}>> = {
    'API Keys': [
      { icon: '🔑', title: 'Unlimited Keys', description: 'Create as many universal API keys as you need' },
      { icon: '🔒', title: 'Secure Storage', description: 'AES-256 encryption for all keys' },
      { icon: '📊', title: 'Usage Tracking', description: 'Monitor key usage and performance' }
    ],
    'Providers': [
      { icon: '🔌', title: 'All Providers', description: 'Connect OpenAI, Anthropic, XAI, Google' },
      { icon: '✅', title: 'Auto Validation', description: 'Automatic key validation and testing' },
      { icon: '🔄', title: 'Smart Routing', description: 'Intelligent model selection' }
    ],
    'Analytics': [
      { icon: '📈', title: 'Full Analytics', description: 'Complete usage and cost tracking' },
      { icon: '💰', title: 'Cost Insights', description: 'See exactly how much you save' },
      { icon: '📊', title: 'Export Data', description: 'Export to CSV or JSON' }
    ],
    'Preferences': [
      { icon: '⚙️', title: 'Custom Rules', description: 'Set your own routing preferences' },
      { icon: '🎯', title: 'Model Selection', description: 'Choose preferred models' },
      { icon: '💵', title: 'Cost Controls', description: 'Set budget limits and alerts' }
    ],
    'Intelligence': [
      { icon: '🧠', title: 'Model Insights', description: 'Real-time performance data' },
      { icon: '📊', title: 'Benchmarks', description: 'Access to 171+ benchmarks' },
      { icon: '🔍', title: 'Comparisons', description: 'Compare models side-by-side' }
    ]
  };

  return benefits[feature] || [
    { icon: '✨', title: 'Full Access', description: 'Unlock all features' },
    { icon: '🚀', title: 'No Limits', description: 'Unlimited usage' },
    { icon: '💎', title: 'Premium Support', description: 'Priority customer support' }
  ];
}
