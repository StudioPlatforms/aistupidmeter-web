'use client';

import { useRouter } from 'next/navigation';
import PixelIcon from './PixelIcon';

export default function DashboardPreview() {
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
        backgroundColor: 'rgba(255, 165, 0, 0.15)',
        border: '2px solid var(--amber-warning)',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(255, 165, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5em' }}>🔒</span>
            <div>
              <div className="terminal-text" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '2px' }}>
                PREVIEW MODE
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Unlock full dashboard with 7-day free trial
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

      {/* Dashboard Header */}
      <div className="crt-monitor" style={{ marginBottom: '20px' }}>
        <div className="terminal-text">
          <h1 style={{ fontSize: '1.5em', marginBottom: '8px' }}>
            <span className="terminal-text--green">AI ROUTER DASHBOARD</span>
            <span className="blinking-cursor"></span>
          </h1>
          <p className="terminal-text--dim" style={{ fontSize: '0.9em' }}>
            Universal API Gateway • Intelligent Model Selection • Cost Optimization
          </p>
        </div>
      </div>

      {/* Key Metrics - Blurred */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '20px',
        position: 'relative'
      }}>
        {/* Blur overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '6px',
          border: '2px dashed var(--phosphor-green)'
        }}>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2em', marginBottom: '8px' }}>🔒</div>
            <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '4px' }}>
              ACTIVATE TO TRACK
            </div>
            <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
              Real-time metrics with Pro
            </div>
          </div>
        </div>

        {[
          { label: 'Total Requests', value: '0', icon: 'chart' },
          { label: 'Total Cost', value: '$0.00', icon: 'money' },
          { label: 'Success Rate', value: '0%', icon: 'check' },
          { label: 'Total Tokens', value: '0', icon: 'numbers' }
        ].map((metric, index) => (
          <div key={index} className="control-panel" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <PixelIcon name={metric.icon} size={24} />
              <div style={{ flex: 1 }}>
                <div className="terminal-text--dim" style={{ fontSize: '0.8em', marginBottom: '4px' }}>
                  {metric.label}
                </div>
                <div className="terminal-text--green" style={{ fontSize: '1.3em', fontWeight: 'bold' }}>
                  {metric.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cost Savings Teaser */}
      <div className="crt-monitor" style={{ marginBottom: '20px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '2.5em', marginBottom: '12px' }}>💰</div>
          <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
            UNLOCK COST SAVINGS DATA
          </div>
          <div className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '16px', textAlign: 'center', maxWidth: '400px' }}>
            See exactly how much you save with intelligent routing
          </div>
          <button
            onClick={handleStartTrial}
            className="vintage-btn vintage-btn--active"
            style={{ padding: '10px 24px' }}
          >
            START FREE TRIAL
          </button>
        </div>

        <div className="terminal-text" style={{ padding: '20px', filter: 'blur(4px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PixelIcon name="diamond" size={32} />
            <div>
              <div className="terminal-text--green" style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                DEMO: COST SAVINGS $127.40
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                Based on 500 typical requests • 52% saved vs. worst case
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Recent Activity - Locked */}
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="list" size={20} />
              <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>RECENT ACTIVITY</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7em' }}>🔒</span>
            </div>
            
            <div style={{ 
              padding: '40px 20px',
              textAlign: 'center',
              border: '2px dashed rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 255, 65, 0.05)'
            }}>
              <div style={{ fontSize: '2em', marginBottom: '12px' }}>📊</div>
              <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
                Real-time Request Tracking
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '16px' }}>
                See every API call, model used, cost, and latency
              </div>
              <button
                onClick={handleStartTrial}
                className="vintage-btn"
                style={{ fontSize: '0.85em', padding: '6px 16px' }}
              >
                UNLOCK WITH PRO
              </button>
            </div>
          </div>
        </div>

        {/* Provider Usage - Locked */}
        <div className="crt-monitor">
          <div className="terminal-text">
            <div style={{ fontSize: '1.1em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PixelIcon name="plug" size={20} />
              <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>PROVIDER USAGE</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7em' }}>🔒</span>
            </div>
            
            <div style={{ 
              padding: '40px 20px',
              textAlign: 'center',
              border: '2px dashed rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              backgroundColor: 'rgba(0, 255, 65, 0.05)'
            }}>
              <div style={{ fontSize: '2em', marginBottom: '12px' }}>🔌</div>
              <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
                Provider Cost Breakdown
              </div>
              <div className="terminal-text--dim" style={{ fontSize: '0.85em', marginBottom: '16px' }}>
                Track spending across OpenAI, Anthropic, xAI, Google
              </div>
              <button
                onClick={handleStartTrial}
                className="vintage-btn"
                style={{ fontSize: '0.85em', padding: '6px 16px' }}
              >
                UNLOCK WITH PRO
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - All Locked */}
      <div className="crt-monitor" style={{ marginBottom: '20px' }}>
        <div className="terminal-text">
          <div style={{ fontSize: '1.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="lightning" size={20} />
            <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>QUICK ACTIONS</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {[
              { title: 'API Keys', icon: 'key', desc: 'Universal keys' },
              { title: 'Providers', icon: 'plug', desc: 'Connect AI' },
              { title: 'Preferences', icon: 'settings', desc: 'Configure' },
              { title: 'Analytics', icon: 'analytics', desc: 'View stats' }
            ].map((action, index) => (
              <div
                key={index}
                style={{
                  padding: '16px',
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  borderRadius: '4px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  cursor: 'not-allowed',
                  opacity: 0.6
                }}
              >
                <PixelIcon name={action.icon} size={24} style={{ marginBottom: '8px' }} />
                <div className="terminal-text" style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '4px' }}>
                  {action.title} 🔒
                </div>
                <div className="terminal-text--dim" style={{ fontSize: '0.75em' }}>
                  {action.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why Upgrade Section */}
      <div className="crt-monitor">
        <div className="terminal-text">
          <div style={{ fontSize: '1.2em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--amber">💎 WHY UPGRADE TO PRO?</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {[
              { icon: '⚡', title: 'Automatic Routing', desc: 'Stop manually checking rankings - let AI Router Pro choose the best model for you' },
              { icon: '💰', title: 'Save 50-70%', desc: 'Intelligent routing to cheapest models that meet your quality requirements' },
              { icon: '🛡️', title: 'Degradation Protection', desc: 'Automatic failover when models degrade - never use a bad model again' },
              { icon: '🔑', title: 'One API Key', desc: 'Replace all your provider keys with one universal key for all models' }
            ].map((benefit, index) => (
              <div key={index} style={{ 
                padding: '16px',
                border: '1px solid rgba(0, 255, 65, 0.3)',
                borderRadius: '4px',
                backgroundColor: 'rgba(0, 255, 65, 0.05)'
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
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255, 165, 0, 0.1)', borderRadius: '6px', border: '2px solid var(--amber-warning)' }}>
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
              START FREE TRIAL NOW →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
