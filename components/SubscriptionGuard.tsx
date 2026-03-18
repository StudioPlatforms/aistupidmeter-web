'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  feature: string;
}

export default function SubscriptionGuard({ children, feature }: SubscriptionGuardProps) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session!.user!.email! })
      });
      const result = await response.json();
      setHasAccess(result.success && result.data.hasAccess);
    } catch {
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
      <div className="rv4-loading" style={{ minHeight: '300px' }}>
        <div className="rv4-loading-dot" />
        <div className="rv4-loading-dot" />
        <div className="rv4-loading-dot" />
        <span>CHECKING ACCESS</span>
      </div>
    );
  }

  if (!hasAccess) {
    const featureBenefits = getFeatureBenefits(feature);

    return (
      <div className="rv4-body">
        {/* Sticky upgrade banner */}
        <div className="rv4-upgrade-sticky">
          <div className="rv4-upgrade-sticky-msg">
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--amber-warning)', fontWeight: 'bold' }}>[LOCKED]</span>
            <div>
              <div className="rv4-upgrade-sticky-title">{feature.toUpperCase()} — PRO FEATURE</div>
              <div className="rv4-upgrade-sticky-sub">Upgrade to AI Router PRO to unlock this feature</div>
            </div>
          </div>
          <button onClick={handleUpgrade} className="rv4-ctrl-btn primary" style={{ padding: '8px 18px', fontSize: '11px' }}>
            START FREE TRIAL →
          </button>
        </div>

        {/* Hero CTA */}
        <div className="rv4-upgrade-hero">
          <div className="rv4-upgrade-hero-title">{feature.toUpperCase()} IS A PRO FEATURE</div>
          <div className="rv4-upgrade-hero-sub">Upgrade to AI Router PRO to unlock this and all other Pro features</div>
          <div className="rv4-upgrade-price">$4.99<sub>/mo</sub></div>
          <div className="rv4-upgrade-trial-badge">7-DAY FREE TRIAL — NO CREDIT CARD</div>
          <button onClick={handleUpgrade} className="rv4-upgrade-cta">
            Upgrade to PRO →
          </button>
          <div className="rv4-upgrade-fine-print">Cancel anytime • Instant access</div>
        </div>

        {/* Feature benefits */}
        <div className="rv4-panel" style={{ marginBottom: '16px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">WHAT YOU'LL UNLOCK</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-upgrade-benefits">
              {featureBenefits.map((b, i) => (
                <div key={i} className="rv4-upgrade-benefit">
                  <div className="rv4-upgrade-benefit-icon" style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor-green)' }}>→</div>
                  <div className="rv4-upgrade-benefit-title">{b.title}</div>
                  <div className="rv4-upgrade-benefit-desc">{b.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why upgrade */}
        <div className="rv4-panel" style={{ marginBottom: '16px' }}>
          <div className="rv4-panel-header">
            <span className="rv4-panel-title">WHY UPGRADE TO PRO?</span>
          </div>
          <div className="rv4-panel-body">
            <div className="rv4-features-checklist">
              {[
                'Save 50-70% on AI costs with intelligent routing',
                'Access all AI models (GPT, Claude, Grok, Gemini)',
                'Real-time analytics and performance tracking',
                'Unlimited universal API keys',
                'Zero downtime with automatic failover',
                'Secure provider key management',
                'Advanced cost optimization',
                'Custom routing preferences',
              ].map((item, i) => (
                <div key={i} className="rv4-feature-check">
                  <span className="check">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div style={{
          background: 'rgba(255,176,0,0.06)', border: '2px solid var(--amber-warning)',
          borderRadius: '3px', padding: '20px', textAlign: 'center', marginBottom: '16px',
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--amber-warning)', marginBottom: '6px' }}>
            $4.99/month
          </div>
          <div style={{ fontSize: '11px', color: 'var(--phosphor-green)', fontWeight: 'bold', marginBottom: '14px' }}>
            7-Day Free Trial • No Credit Card • Cancel Anytime
          </div>
          <button onClick={handleUpgrade} className="rv4-upgrade-cta">
            UNLOCK {feature.toUpperCase()} — START FREE TRIAL →
          </button>
        </div>

        <div className="rv4-footer">
          Powered by AI Stupid Meter • Real-time benchmarks • <a href="/">View Live Rankings</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function getFeatureBenefits(feature: string) {
  const benefits: Record<string, Array<{ title: string; description: string }>> = {
    'API Keys': [
      { title: 'UNLIMITED KEYS', description: 'Create as many universal API keys as you need for any application' },
      { title: 'SECURE STORAGE', description: 'AES-256 encryption protects all your keys at rest and in transit' },
      { title: 'USAGE TRACKING', description: 'Monitor key usage, last used date, and performance metrics' },
    ],
    'Providers': [
      { title: 'ALL PROVIDERS', description: 'Connect OpenAI, Anthropic, xAI, Google, DeepSeek, GLM, Kimi' },
      { title: 'AUTO VALIDATION', description: 'Automatic key validation tests connectivity and lists available models' },
      { title: 'SMART ROUTING', description: 'Intelligent routing uses your keys for optimal model selection' },
    ],
    'Analytics': [
      { title: 'FULL ANALYTICS', description: 'Complete usage and cost tracking across all your API requests' },
      { title: 'COST INSIGHTS', description: 'See exactly how much you save vs. worst-case pricing' },
      { title: 'DATA EXPORT', description: 'Download your analytics data in CSV or JSON format anytime' },
    ],
    'Preferences': [
      { title: 'CUSTOM RULES', description: 'Set your own routing strategy optimized for your use case' },
      { title: 'MODEL SELECTION', description: 'Choose preferred models and exclude providers you don\'t want' },
      { title: 'COST CONTROLS', description: 'Set budget limits, latency thresholds, and feature requirements' },
    ],
    'Intelligence': [
      { title: 'MODEL INSIGHTS', description: 'Real-time performance data from 171+ continuous benchmarks' },
      { title: 'SIDE-BY-SIDE COMPARE', description: 'Compare up to 4 models with overlaid charts and detailed analytics' },
      { title: 'DATA EXPORT', description: 'Download comprehensive model data in CSV or JSON format' },
    ],
  };

  return benefits[feature] || [
    { title: 'FULL ACCESS', description: 'Unlock all features and capabilities of AI Router' },
    { title: 'NO LIMITS', description: 'Unlimited usage with no rate limits or feature restrictions' },
    { title: 'PREMIUM SUPPORT', description: 'Priority customer support with fast response times' },
  ];
}
