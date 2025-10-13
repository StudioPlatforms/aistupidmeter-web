'use client';

export default function SalesOverlay() {
  const handleStartTrial = () => {
    window.location.href = '/api/stripe/checkout';
  };

  return (
    <div className="vintage-container">
      <div className="crt-monitor" style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Hero Section - Concise & Powerful */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid rgba(0,255,65,0.3)' }}>
          <h1 className="terminal-text terminal-text--green" style={{ 
            fontSize: 'clamp(1.5rem, 5vw, 2rem)', 
            fontWeight: 'bold', 
            marginBottom: 'var(--space-sm)',
            letterSpacing: '1px'
          }}>
            STOP OVERPAYING FOR AI<span className="blinking-cursor"></span>
          </h1>
          <p className="terminal-text terminal-text--amber" style={{ 
            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
            lineHeight: '1.4'
          }}>
            Save 50-70% on costs • Get better results
          </p>
        </div>

        {/* Revolutionary Intelligence-Based Routing */}
        <div className="intelligence-section" style={{ 
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-lg)',
          background: 'linear-gradient(135deg, rgba(0,255,65,0.1), rgba(0,255,255,0.1))',
          border: '2px solid var(--phosphor-green)',
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated scanline effect */}
          <div className="scanline" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'var(--phosphor-green)',
            boxShadow: '0 0 15px var(--phosphor-green), 0 0 30px rgba(0,255,65,0.5)',
            willChange: 'transform',
            zIndex: 10,
            pointerEvents: 'none'
          }} />
          
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
            <div className="terminal-text terminal-text--green" style={{ 
              fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              fontWeight: 'bold',
              letterSpacing: '2px',
              marginBottom: 'var(--space-xs)'
            }}>
              🚀 WORLD'S FIRST INTELLIGENCE-BASED AI ROUTER
            </div>
            <h2 className="terminal-text terminal-text--amber" style={{ 
              fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
              fontWeight: 'bold',
              marginBottom: 'var(--space-sm)',
              textShadow: '0 0 10px rgba(255,165,0,0.5)'
            }}>
              Powered by Real-Time Benchmark Data
            </h2>
            <p className="terminal-text--dim" style={{ 
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
              lineHeight: '1.5',
              maxWidth: '700px',
              margin: '0 auto'
            }}>
              Unlike other routers that guess, we use live data from <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>171+ benchmarks</span> across <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>16+ models</span> to route your requests to the best-performing, most cost-effective model in real-time.
            </p>
          </div>

          {/* How It Works - Visual Flow */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-md)',
            marginTop: 'var(--space-lg)'
          }}>
            {[
              { 
                step: '1', 
                icon: '📊', 
                title: 'Live Intelligence', 
                desc: 'AI Stupid Meter runs 171+ benchmarks 24/7 tracking real performance' 
              },
              { 
                step: '2', 
                icon: '🧠', 
                title: 'Smart Analysis', 
                desc: 'Router analyzes your request and matches it with current model rankings' 
              },
              { 
                step: '3', 
                icon: '⚡', 
                title: 'Optimal Routing', 
                desc: 'Automatically selects the best model for quality, speed, and cost' 
              },
              { 
                step: '4', 
                icon: '💰', 
                title: 'Save 50-70%', 
                desc: 'Get better results while paying less - no manual switching needed' 
              }
            ].map((item, i) => (
              <div key={i} style={{ 
                padding: 'var(--space-md)',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,255,65,0.3)',
                borderRadius: '4px',
                position: 'relative',
                animation: `fadeInUp 0.6s ease-out ${i * 0.15}s both`
              }}>
                <div style={{ 
                  position: 'absolute',
                  top: '-10px',
                  left: '10px',
                  width: '24px',
                  height: '24px',
                  background: 'var(--phosphor-green)',
                  color: 'var(--terminal-black)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  boxShadow: '0 0 10px var(--phosphor-green)'
                }}>
                  {item.step}
                </div>
                <div style={{ fontSize: '2.5em', textAlign: 'center', marginBottom: 'var(--space-xs)' }}>
                  {item.icon}
                </div>
                <h3 className="terminal-text terminal-text--green" style={{ 
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  marginBottom: 'var(--space-xs)'
                }}>
                  {item.title}
                </h3>
                <p className="terminal-text--dim" style={{ 
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  lineHeight: '1.4',
                  textAlign: 'center'
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Key Differentiator */}
          <div style={{ 
            marginTop: 'var(--space-lg)',
            padding: 'var(--space-md)',
            background: 'rgba(255,165,0,0.1)',
            border: '1px solid var(--amber-warning)',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <div className="terminal-text terminal-text--amber" style={{ 
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
              fontWeight: 'bold',
              marginBottom: 'var(--space-xs)'
            }}>
              ⚡ NO ONE ELSE DOES THIS
            </div>
            <div className="terminal-text--dim" style={{ 
              fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
              lineHeight: '1.5'
            }}>
              Other routers use static rules or outdated data. We use <span className="terminal-text--green" style={{ fontWeight: 'bold' }}>live benchmark intelligence</span> from AI Stupid Meter to make decisions in real-time. When GPT-5 degrades, we know instantly. When Claude gets better, you benefit immediately.
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes scanline-move {
            0% { 
              transform: translateY(-100%); 
              opacity: 0;
            }
            5% {
              opacity: 1;
            }
            95% { 
              transform: translateY(calc(100vh + 100%)); 
              opacity: 1;
            }
            100% { 
              transform: translateY(calc(100vh + 100%)); 
              opacity: 0;
            }
          }
          
          @keyframes scanline-glitch {
            0%, 90%, 100% { 
              filter: none;
            }
            91% { 
              filter: hue-rotate(90deg) brightness(1.5);
            }
            92% { 
              filter: hue-rotate(-90deg) brightness(1.5);
            }
            93% { 
              filter: none;
            }
          }
          
          .intelligence-section .scanline {
            animation: scanline-move 8s cubic-bezier(0.4, 0, 0.2, 1) infinite, 
                       scanline-glitch 8s linear infinite;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          /* Ensure animations work on all browsers */
          @supports (animation: scanline-move 8s infinite) {
            .intelligence-section .scanline {
              animation: scanline-move 8s cubic-bezier(0.4, 0, 0.2, 1) infinite, 
                         scanline-glitch 8s linear infinite;
            }
          }
        `}</style>

        {/* Problem - Brief Pain Points */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ 
            display: 'grid', 
            gap: 'var(--space-sm)',
            padding: 'var(--space-md)',
            background: 'rgba(255,0,0,0.05)',
            border: '1px solid rgba(255,0,0,0.3)',
            borderRadius: '4px'
          }}>
            {[
              'Overpaying for underperforming models?',
              'Models degrading without warning?',
              'Wrong model for each task?'
            ].map((problem, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span className="terminal-text--red" style={{ fontSize: '1.2em', flexShrink: 0 }}>✗</span>
                <span className="terminal-text--dim" style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>{problem}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Solution - 4 Key Benefits */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h2 className="terminal-text terminal-text--green" style={{ 
            fontSize: 'clamp(1.125rem, 3vw, 1.5rem)',
            fontWeight: 'bold',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            What You Get
          </h2>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-md)'
          }}>
            {[
              { icon: '💰', title: 'Cut Costs 50-70%', desc: 'Smart routing picks cheaper models when quality matches' },
              { icon: '🎯', title: 'Better Selection', desc: 'Real-time benchmarks prevent degraded models' },
              { icon: '⚡', title: 'Zero Downtime', desc: 'Auto-failover keeps your apps running' },
              { icon: '🔧', title: 'One API Key', desc: 'Access GPT, Claude, Grok, Gemini & more' }
            ].map((benefit, i) => (
              <div key={i} className="control-panel" style={{ 
                padding: 'var(--space-md)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-xs)'
              }}>
                <div style={{ fontSize: '2em' }}>{benefit.icon}</div>
                <h3 className="terminal-text terminal-text--green" style={{ 
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  fontWeight: 'bold'
                }}>
                  {benefit.title}
                </h3>
                <p className="terminal-text--dim" style={{ 
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  lineHeight: '1.4'
                }}>
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Proof - Compact Stats */}
        <div style={{ 
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-md)',
          background: 'rgba(0,255,0,0.05)',
          border: '1px solid rgba(0,255,0,0.3)',
          borderRadius: '4px'
        }}>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: 'var(--space-md)',
            textAlign: 'center'
          }}>
            {[
              { value: '171+', label: 'Benchmarks' },
              { value: '16+', label: 'Models' },
              { value: '24/7', label: 'Monitoring' },
              { value: '50-70%', label: 'Savings' }
            ].map((stat, i) => (
              <div key={i}>
                <div className="terminal-text terminal-text--green" style={{ 
                  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                  fontWeight: 'bold',
                  lineHeight: '1'
                }}>
                  {stat.value}
                </div>
                <div className="terminal-text--dim" style={{ 
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  marginTop: 'var(--space-xs)'
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA - Prominent but Proportional */}
        <div style={{ 
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-lg)',
          background: 'rgba(255,165,0,0.08)',
          border: '2px solid var(--amber-warning)',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div className="terminal-text--dim" style={{ 
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
              textDecoration: 'line-through',
              marginBottom: 'var(--space-xs)'
            }}>
              $49.99/month
            </div>
            <div className="terminal-text terminal-text--amber" style={{ 
              fontSize: 'clamp(2rem, 6vw, 3rem)',
              fontWeight: 'bold',
              lineHeight: '1',
              textShadow: '0 0 8px var(--amber-warning)'
            }}>
              $4.99<span style={{ fontSize: '0.4em' }}>/mo</span>
            </div>
          </div>
          
          <div className="terminal-text terminal-text--green" style={{ 
            fontSize: 'clamp(1rem, 2.5vw, 1.125rem)',
            fontWeight: 'bold',
            marginBottom: 'var(--space-sm)'
          }}>
            🎉 7-Day Free Trial
          </div>
          
          <div className="terminal-text--dim" style={{ 
            fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
            marginBottom: 'var(--space-lg)'
          }}>
            No credit card • Cancel anytime
          </div>
          
          <button 
            onClick={handleStartTrial}
            className="vintage-btn"
            style={{ 
              fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)',
              padding: 'var(--space-md) var(--space-xl)',
              background: 'linear-gradient(135deg, var(--phosphor-green), var(--phosphor-dim))',
              border: '2px solid var(--phosphor-green)',
              color: 'var(--terminal-black)',
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(0,255,0,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              width: '100%',
              maxWidth: '320px',
              margin: '0 auto',
              display: 'block'
            }}
          >
            Start Free Trial →
          </button>
        </div>

        {/* Features - Scannable List */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="terminal-text terminal-text--green" style={{ 
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            fontWeight: 'bold',
            marginBottom: 'var(--space-md)',
            textAlign: 'center',
            textTransform: 'uppercase'
          }}>
            Everything Included
          </h3>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-sm)'
          }}>
            {[
              'Unlimited API requests',
              'All AI models',
              'Real-time monitoring',
              'Cost optimization',
              'Auto failover',
              'Priority support',
              'Analytics dashboard',
              'Custom routing'
            ].map((feature, i) => (
              <div key={i} style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-xs)',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '3px'
              }}>
                <span className="terminal-text--green" style={{ fontSize: '1.2em', flexShrink: 0 }}>✓</span>
                <span className="terminal-text--dim" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          textAlign: 'center',
          padding: 'var(--space-md)',
          borderTop: '1px solid rgba(0,255,65,0.2)'
        }}>
          <div className="terminal-text--dim" style={{ 
            fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
            marginBottom: 'var(--space-xs)'
          }}>
            Powered by AI Stupid Meter • Real-time intelligence
          </div>
          <div className="terminal-text--dim" style={{ fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)' }}>
            <a href="/" className="terminal-text--green" style={{ textDecoration: 'underline' }}>
              View Live Rankings
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
