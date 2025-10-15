'use client';

import { useRouter } from 'next/navigation';
import PixelIcon from './PixelIcon';

const ROUTING_STRATEGIES = [
  {
    id: 'best_overall',
    name: 'Best Overall',
    iconName: 'target',
    description: 'Automatically selects the model with the lowest stupid score across all categories',
    recommended: true,
  },
  {
    id: 'best_coding',
    name: 'Best for Coding',
    iconName: 'code',
    description: 'Optimized for code generation, debugging, and programming tasks',
    recommended: false,
  },
  {
    id: 'best_reasoning',
    name: 'Best for Reasoning',
    iconName: 'brain',
    description: 'Optimized for complex reasoning, problem-solving, and analysis',
    recommended: false,
  },
  {
    id: 'best_creative',
    name: 'Best for Creative',
    iconName: 'palette',
    description: 'Optimized for creative writing, content generation, and storytelling',
    recommended: false,
  },
  {
    id: 'cheapest',
    name: 'Most Cost-Effective',
    iconName: 'money',
    description: 'Always selects the cheapest available model',
    recommended: false,
  },
  {
    id: 'fastest',
    name: 'Fastest Response',
    iconName: 'lightning',
    description: 'Prioritizes models with the lowest latency',
    recommended: false,
  },
];

const PROVIDERS = ['openai', 'anthropic', 'xai', 'google', 'glm', 'deepseek', 'kimi'];

export default function PreferencesPreview() {
  const router = useRouter();

  const handleStartTrial = () => {
    router.push('/api/stripe/checkout');
  };

  return (
    <div className="vintage-container">
      {/* Sticky Upgrade Banner */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 140, 0, 0.15)',
        border: '2px solid rgba(255, 140, 0, 0.5)',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(255, 140, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5em' }}>⚙️</span>
            <div>
              <div className="terminal-text" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '2px' }}>
                PREVIEW MODE - Configuration Locked
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Unlock full routing customization and preferences
              </div>
            </div>
          </div>
          <button
            onClick={handleStartTrial}
            className="vintage-btn vintage-btn--active"
            style={{
              padding: '8px 20px',
              fontSize: '0.9em',
              whiteSpace: 'nowrap'
            }}
          >
            START FREE TRIAL →
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="crt-monitor" style={{ marginBottom: '20px' }}>
        <div className="terminal-text">
          <div style={{ fontSize: '1.5em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PixelIcon name="settings" size={28} className="terminal-text--green" />
            <span className="terminal-text--green">ROUTING PREFERENCES</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
            Configure how the router selects models for your requests
          </div>
          <div className="terminal-text--amber" style={{ fontSize: '0.85em', padding: '8px', background: 'rgba(255, 140, 0, 0.1)', borderRadius: '4px', border: '1px solid rgba(255, 140, 0, 0.3)' }}>
            🔒 Upgrade to Pro to customize these settings
          </div>
        </div>
      </div>

      {/* Routing Strategy */}
      <div className="crt-monitor" style={{ marginBottom: '20px', position: 'relative' }}>
        {/* Blur overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(3px)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '6px',
          cursor: 'not-allowed'
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🎯</div>
            <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px' }}>
              UNLOCK ROUTING STRATEGIES
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', maxWidth: '400px' }}>
              Choose from 6 intelligent routing strategies tailored to your needs
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{ padding: '10px 24px' }}
            >
              START FREE TRIAL
            </button>
          </div>
        </div>

        <div className="terminal-text" style={{ marginBottom: '16px', filter: 'blur(2px)' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">ROUTING STRATEGY</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Choose how the router selects models for your requests
          </div>
        </div>
        
        <div className="vintage-grid" style={{ filter: 'blur(2px)' }}>
          {ROUTING_STRATEGIES.map((strategy) => (
            <div
              key={strategy.id}
              className="control-panel"
              style={{
                borderColor: strategy.recommended ? 'var(--phosphor-green)' : 'var(--metal-silver)',
                backgroundColor: strategy.recommended ? 'rgba(0, 255, 65, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                cursor: 'not-allowed',
                textAlign: 'left',
                opacity: 0.6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PixelIcon name={strategy.iconName} size={24} />
                  <span className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                    {strategy.name}
                  </span>
                </div>
                {strategy.recommended && (
                  <span style={{
                    backgroundColor: 'var(--phosphor-green)',
                    color: 'var(--terminal-black)',
                    fontSize: '0.6em',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '2px'
                  }}>
                    RECOMMENDED
                  </span>
                )}
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                {strategy.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Constraints */}
      <div className="crt-monitor" style={{ marginBottom: '20px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(3px)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '6px',
          cursor: 'not-allowed'
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>⚖️</div>
            <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px' }}>
              UNLOCK CONSTRAINTS
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', maxWidth: '400px' }}>
              Set cost limits, latency thresholds, and feature requirements
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{ padding: '10px 24px' }}
            >
              START FREE TRIAL
            </button>
          </div>
        </div>

        <div className="terminal-text" style={{ marginBottom: '16px', filter: 'blur(2px)' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">CONSTRAINTS</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Set limits on cost, latency, and required features
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', filter: 'blur(2px)', opacity: 0.6 }}>
          {['Maximum Cost Per 1K Tokens', 'Maximum Latency', 'Require Tool Calling', 'Require Streaming'].map((constraint, i) => (
            <div key={i} className="control-panel">
              <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '8px' }}>
                {constraint}
              </div>
              <div style={{ height: '40px', background: 'rgba(0, 255, 65, 0.05)', borderRadius: '4px' }}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Exclusions */}
      <div className="crt-monitor" style={{ marginBottom: '20px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(3px)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '6px',
          cursor: 'not-allowed'
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>🔌</div>
            <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px' }}>
              UNLOCK PROVIDER CONTROL
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', maxWidth: '400px' }}>
              Choose which AI providers to include or exclude from routing
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{ padding: '10px 24px' }}
            >
              START FREE TRIAL
            </button>
          </div>
        </div>

        <div className="terminal-text" style={{ marginBottom: '16px', filter: 'blur(2px)' }}>
          <div style={{ fontSize: '1.2em', marginBottom: '8px' }}>
            <span className="terminal-text--green">EXCLUSIONS</span>
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
            Exclude specific providers from routing
          </div>
        </div>
        
        <div className="control-panel" style={{ filter: 'blur(2px)', opacity: 0.6 }}>
          <div className="terminal-text--green" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '12px' }}>
            EXCLUDED PROVIDERS
          </div>
          <div className="vintage-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {PROVIDERS.map((provider) => (
              <div
                key={provider}
                className="vintage-btn"
                style={{
                  borderColor: 'var(--metal-silver)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--phosphor-green)',
                  cursor: 'not-allowed'
                }}
              >
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why Upgrade Section */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--amber">💎 WHY CUSTOMIZE YOUR ROUTER?</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {[
              { icon: '🎯', title: 'Perfect for Your Use Case', desc: 'Choose routing strategies optimized for coding, reasoning, creative work, or cost' },
              { icon: '💰', title: 'Control Your Costs', desc: 'Set maximum cost limits and always stay within budget' },
              { icon: '⚡', title: 'Optimize for Speed', desc: 'Set latency thresholds to ensure fast responses for time-critical applications' },
              { icon: '🔌', title: 'Provider Flexibility', desc: 'Exclude providers you don\'t want to use or focus on your preferred ones' }
            ].map((benefit, index) => (
              <div key={index} style={{ 
                padding: '16px',
                border: '1px solid rgba(255, 140, 0, 0.3)',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 140, 0, 0.05)'
              }}>
                <div style={{ fontSize: '2em', marginBottom: '8px' }}>{benefit.icon}</div>
                <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '6px' }}>
                  {benefit.title}
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.85em', lineHeight: '1.4' }}>
                  {benefit.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255, 140, 0, 0.1)', borderRadius: '6px', border: '2px solid rgba(255, 140, 0, 0.5)' }}>
            <div className="terminal-text--amber" style={{ fontSize: '1.3em', fontWeight: 'bold', marginBottom: '8px' }}>
              $4.99/mo • 7-Day Free Trial
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
              No credit card required • Cancel anytime
            </div>
            <button
              onClick={handleStartTrial}
              className="vintage-btn vintage-btn--active"
              style={{
                padding: '14px 32px',
                fontSize: '1.1em',
                fontWeight: 'bold'
              }}
            >
              CUSTOMIZE YOUR ROUTER NOW →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
