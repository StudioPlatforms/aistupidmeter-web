'use client';

import { useState } from 'react';
import RouterLayout from '@/components/RouterLayout';
import PixelIcon from '@/components/PixelIcon';

export default function HelpPage() {
  const [openSection, setOpenSection] = useState<string | null>('getting-started');

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <RouterLayout>
      <div className="vintage-container">
        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '30px' }}>
          <div>
            <h1 className="dashboard-title">
              <span className="terminal-text--green">HELP CENTER</span>
              <span className="blinking-cursor"></span>
            </h1>
            <p className="dashboard-subtitle terminal-text--dim">
              Everything you need to know about AI Router
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="section-card" style={{ marginBottom: '20px' }}>
          <div className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PixelIcon name="lightning" size={20} />
            QUICK LINKS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <a href="/router/keys" className="action-button" style={{ textDecoration: 'none' }}>
              <PixelIcon name="key" size={20} />
              <span className="terminal-text--green">Create API Key</span>
            </a>
            <a href="/router/providers" className="action-button" style={{ textDecoration: 'none' }}>
              <PixelIcon name="plug" size={20} />
              <span className="terminal-text--green">Add Providers</span>
            </a>
            <a href="/router/docs" className="action-button" style={{ textDecoration: 'none' }}>
              <PixelIcon name="book" size={20} />
              <span className="terminal-text--green">API Docs</span>
            </a>
            <a href="/router/analytics" className="action-button" style={{ textDecoration: 'none' }}>
              <PixelIcon name="analytics" size={20} />
              <span className="terminal-text--green">View Analytics</span>
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="help-content">
          
          {/* Getting Started */}
          <HelpSection
            id="getting-started"
            title="GETTING STARTED"
            icon="rocket"
            isOpen={openSection === 'getting-started'}
            onToggle={() => toggleSection('getting-started')}
          >
            <div className="help-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>What is AI Router?</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                AI Router is an intelligent API gateway that automatically selects the best AI model for your requests. 
                Instead of manually choosing between Claude, GPT, Gemini, or xAI, our system continuously benchmarks 
                all models and routes your requests to the optimal one based on performance, cost, and your preferences.
              </p>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Quick Start (5 Minutes)</h3>
              <div className="terminal-text--dim" style={{ lineHeight: '1.6' }}>
                <p style={{ marginBottom: '10px' }}><strong className="terminal-text--amber">Step 1:</strong> Create a Universal API Key</p>
                <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
                  <li>Go to <a href="/router/keys" className="terminal-text--green" style={{ textDecoration: 'underline' }}>API Keys</a></li>
                  <li>Click "Create New Key"</li>
                  <li>Give it a name (e.g., "My App")</li>
                  <li>Save the key securely - you won't see it again!</li>
                </ul>

                <p style={{ marginBottom: '10px' }}><strong className="terminal-text--amber">Step 2:</strong> Add Provider API Keys</p>
                <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
                  <li>Go to <a href="/router/providers" className="terminal-text--green" style={{ textDecoration: 'underline' }}>Providers</a></li>
                  <li>Add keys for OpenAI, Anthropic, Google, or xAI</li>
                  <li>The more providers you add, the better the routing!</li>
                </ul>

                <p style={{ marginBottom: '10px' }}><strong className="terminal-text--amber">Step 3:</strong> Start Using It</p>
                <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
                  <li>Use your universal key with any OpenAI-compatible app</li>
                  <li>Base URL: <code className="terminal-text--green">http://aistupidlevel.info:4000/v1</code></li>
                  <li>Model: <code className="terminal-text--green">best_for_coding</code> (or any routing mode)</li>
                </ul>
              </div>
            </div>
          </HelpSection>

          {/* Core Concepts */}
          <HelpSection
            id="core-concepts"
            title="CORE CONCEPTS"
            icon="brain"
            isOpen={openSection === 'core-concepts'}
            onToggle={() => toggleSection('core-concepts')}
          >
            <div className="help-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Universal API Keys</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                Your universal API key (starts with <code className="terminal-text--green">aism_</code>) is what you use in your applications. 
                It's a single key that gives you access to all AI providers you've configured. Think of it as a master key 
                that unlocks all the AI models.
              </p>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Provider API Keys</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                These are your actual API keys from OpenAI, Anthropic, Google, and xAI. You add them to your account, 
                and we securely store them encrypted. The router uses these keys to make requests on your behalf to 
                whichever provider has the best model for your request.
              </p>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Intelligent Routing</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                Our system continuously benchmarks all AI models across different categories:
              </p>
              <ul className="terminal-text--dim" style={{ marginLeft: '20px', marginBottom: '15px', lineHeight: '1.6' }}>
                <li><strong className="terminal-text--amber">Overall Performance:</strong> Best general-purpose model</li>
                <li><strong className="terminal-text--amber">Coding:</strong> Best for code generation and debugging</li>
                <li><strong className="terminal-text--amber">Reasoning:</strong> Best for complex problem-solving</li>
                <li><strong className="terminal-text--amber">Creative:</strong> Best for creative writing</li>
                <li><strong className="terminal-text--amber">Speed:</strong> Fastest response times</li>
                <li><strong className="terminal-text--amber">Cost:</strong> Most cost-effective</li>
              </ul>
              <p className="terminal-text--dim" style={{ lineHeight: '1.6' }}>
                When you make a request, we automatically select the best model based on your chosen routing strategy 
                and your preferences (cost limits, latency requirements, etc.).
              </p>
            </div>
          </HelpSection>

          {/* Using with Apps */}
          <HelpSection
            id="using-with-apps"
            title="USING WITH POPULAR APPS"
            icon="plug"
            isOpen={openSection === 'using-with-apps'}
            onToggle={() => toggleSection('using-with-apps')}
          >
            <div className="help-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Cursor IDE</h3>
              <div className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                <p style={{ marginBottom: '10px' }}>In Cursor settings:</p>
                <ol style={{ marginLeft: '20px' }}>
                  <li>Go to Models → Add Custom Model</li>
                  <li>Base URL: <code className="terminal-text--green">http://aistupidlevel.info:4000/v1</code></li>
                  <li>API Key: Your universal key</li>
                  <li>Model: <code className="terminal-text--green">best_for_coding</code></li>
                </ol>
              </div>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Continue.dev (VSCode)</h3>
              <div className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                <p style={{ marginBottom: '10px' }}>In <code>~/.continue/config.json</code>:</p>
                <pre className="code-block" style={{ backgroundColor: 'rgba(0, 255, 65, 0.1)', padding: '15px', borderRadius: '4px', overflow: 'auto' }}>
{`{
  "models": [{
    "title": "AI Router",
    "provider": "openai",
    "model": "best_for_coding",
    "apiKey": "aism_your_key_here",
    "apiBase": "http://aistupidlevel.info:4000/v1"
  }]
}`}
                </pre>
              </div>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Cline (VSCode)</h3>
              <div className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                <p style={{ marginBottom: '10px' }}>Once our PR is merged, you'll be able to select "AI Stupid Level" directly in Cline's provider settings!</p>
              </div>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Any OpenAI-Compatible App</h3>
              <div className="terminal-text--dim" style={{ lineHeight: '1.6' }}>
                <p style={{ marginBottom: '10px' }}>Most AI apps support custom OpenAI endpoints. Just use:</p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>Base URL: <code className="terminal-text--green">http://aistupidlevel.info:4000/v1</code></li>
                  <li>API Key: Your universal key</li>
                  <li>Model: Any routing mode (see <a href="/router/docs" className="terminal-text--green" style={{ textDecoration: 'underline' }}>docs</a>)</li>
                </ul>
              </div>
            </div>
          </HelpSection>

          {/* Routing Strategies */}
          <HelpSection
            id="routing-strategies"
            title="ROUTING STRATEGIES"
            icon="target"
            isOpen={openSection === 'routing-strategies'}
            onToggle={() => toggleSection('routing-strategies')}
          >
            <div className="help-section-content">
              <p className="terminal-text--dim" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                Choose the routing strategy that best fits your use case. You can specify this as the "model" parameter 
                in your API requests, or set a default in your <a href="/router/preferences" className="terminal-text--green" style={{ textDecoration: 'underline' }}>preferences</a>.
              </p>

              <div style={{ display: 'grid', gap: '15px' }}>
                <StrategyCard
                  name="best_overall"
                  description="Automatically selects the best-performing model across all categories. Great for general-purpose use."
                  useCase="Default choice for most applications"
                />
                <StrategyCard
                  name="best_for_coding"
                  description="Optimized for code generation, debugging, and software development tasks."
                  useCase="IDEs, code assistants, development tools"
                />
                <StrategyCard
                  name="best_for_reasoning"
                  description="Selects models that excel at complex problem-solving and logical thinking."
                  useCase="Math problems, analysis, strategic planning"
                />
                <StrategyCard
                  name="best_for_creative"
                  description="Optimized for creative writing, brainstorming, and generating innovative ideas."
                  useCase="Content creation, storytelling, marketing"
                />
                <StrategyCard
                  name="fastest"
                  description="Prioritizes speed over everything else. Selects the fastest-responding model."
                  useCase="Real-time applications, chatbots, quick queries"
                />
                <StrategyCard
                  name="cheapest"
                  description="Optimizes for cost while maintaining acceptable quality."
                  useCase="High-volume applications, budget-conscious usage"
                />
              </div>
            </div>
          </HelpSection>

          {/* Monitoring & Analytics */}
          <HelpSection
            id="monitoring"
            title="MONITORING & ANALYTICS"
            icon="analytics"
            isOpen={openSection === 'monitoring'}
            onToggle={() => toggleSection('monitoring')}
          >
            <div className="help-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Dashboard Overview</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                Your <a href="/router" className="terminal-text--green" style={{ textDecoration: 'underline' }}>dashboard</a> shows 
                real-time statistics including total requests, costs, success rates, and recent activity.
              </p>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Analytics Page</h3>
              <p className="terminal-text--dim" style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                The <a href="/router/analytics" className="terminal-text--green" style={{ textDecoration: 'underline' }}>analytics page</a> provides 
                detailed insights:
              </p>
              <ul className="terminal-text--dim" style={{ marginLeft: '20px', marginBottom: '15px', lineHeight: '1.6' }}>
                <li>Usage timeline (hourly/daily breakdown)</li>
                <li>Cost savings compared to worst-case scenario</li>
                <li>Provider and model distribution</li>
                <li>Performance metrics per model</li>
                <li>Request history with full details</li>
              </ul>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px', marginTop: '20px' }}>Cost Tracking</h3>
              <p className="terminal-text--dim" style={{ lineHeight: '1.6' }}>
                Every request is tracked with precise cost calculations. You can see exactly how much you're spending 
                and how much you're saving by using intelligent routing instead of always using the most expensive model.
              </p>
            </div>
          </HelpSection>

          {/* FAQ */}
          <HelpSection
            id="faq"
            title="FREQUENTLY ASKED QUESTIONS"
            icon="help"
            isOpen={openSection === 'faq'}
            onToggle={() => toggleSection('faq')}
          >
            <div className="help-section-content">
              <FAQItem
                question="How much does AI Router cost?"
                answer="AI Router itself is free during beta. You only pay for the actual API usage from your provider keys (OpenAI, Anthropic, etc.). We help you save 50-70% on those costs through intelligent routing."
              />
              <FAQItem
                question="Is my data secure?"
                answer="Yes! Your provider API keys are encrypted at rest. We never log your request content. All requests are proxied directly to the providers without storing the actual messages."
              />
              <FAQItem
                question="What happens if a model fails?"
                answer="We have automatic failover. If the selected model fails, we immediately try the next best model. You can configure fallback behavior in your preferences."
              />
              <FAQItem
                question="Can I use this with streaming?"
                answer="Yes! All routing modes support streaming. Just set stream: true in your request, and we'll stream the response from whichever model is selected."
              />
              <FAQItem
                question="How often are benchmarks updated?"
                answer="We run continuous benchmarks 24/7. Model rankings are updated in real-time as new benchmark results come in, ensuring you always get routed to the current best model."
              />
              <FAQItem
                question="Can I exclude certain models or providers?"
                answer="Yes! Go to your preferences and add models or providers to your exclusion list. The router will never select them for your requests."
              />
              <FAQItem
                question="What if I want to use a specific model?"
                answer="You can! Just specify the exact model name (e.g., 'gpt-4o', 'claude-3-5-sonnet-20241022') instead of a routing strategy. The router will use that specific model."
              />
            </div>
          </HelpSection>

          {/* Best Practices */}
          <HelpSection
            id="best-practices"
            title="BEST PRACTICES"
            icon="sparkles"
            isOpen={openSection === 'best-practices'}
            onToggle={() => toggleSection('best-practices')}
          >
            <div className="help-section-content">
              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Cost Optimization</h3>
              <ul className="terminal-text--dim" style={{ marginLeft: '20px', marginBottom: '20px', lineHeight: '1.6' }}>
                <li>Use <code className="terminal-text--green">cheapest</code> routing for high-volume, simple tasks</li>
                <li>Set cost limits in preferences to prevent expensive models</li>
                <li>Monitor your analytics to identify cost-heavy patterns</li>
                <li>Add multiple providers to increase routing options</li>
              </ul>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Performance Optimization</h3>
              <ul className="terminal-text--dim" style={{ marginLeft: '20px', marginBottom: '20px', lineHeight: '1.6' }}>
                <li>Use <code className="terminal-text--green">fastest</code> routing for real-time applications</li>
                <li>Set latency limits to ensure responsive experiences</li>
                <li>Enable streaming for better perceived performance</li>
                <li>Use task-specific routing (coding, reasoning, creative)</li>
              </ul>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Security</h3>
              <ul className="terminal-text--dim" style={{ marginLeft: '20px', marginBottom: '20px', lineHeight: '1.6' }}>
                <li>Never share your universal API keys publicly</li>
                <li>Create separate keys for different applications</li>
                <li>Revoke keys immediately if compromised</li>
                <li>Regularly rotate your provider API keys</li>
                <li>Monitor usage for unexpected patterns</li>
              </ul>

              <h3 className="terminal-text--green" style={{ fontSize: '1em', marginBottom: '10px' }}>Monitoring</h3>
              <ul className="terminal-text--dim" style={{ marginLeft: '20px', lineHeight: '1.6' }}>
                <li>Check your dashboard regularly for anomalies</li>
                <li>Review cost savings to validate routing effectiveness</li>
                <li>Analyze model performance to optimize preferences</li>
                <li>Track success rates to identify issues early</li>
              </ul>
            </div>
          </HelpSection>

          {/* Troubleshooting */}
          <HelpSection
            id="troubleshooting"
            title="TROUBLESHOOTING"
            icon="warning"
            isOpen={openSection === 'troubleshooting'}
            onToggle={() => toggleSection('troubleshooting')}
          >
            <div className="help-section-content">
              <TroubleshootItem
                problem="401 Unauthorized Error"
                solution="Check that your universal API key is correct and hasn't been revoked. Make sure you're including it in the Authorization header as 'Bearer aism_your_key'."
              />
              <TroubleshootItem
                problem="No Models Available"
                solution="You need to add at least one provider API key. Go to Providers and add keys for OpenAI, Anthropic, Google, or xAI."
              />
              <TroubleshootItem
                problem="High Costs"
                solution="Set cost limits in your preferences, use 'cheapest' routing mode, or exclude expensive models. Check analytics to see which models are costing the most."
              />
              <TroubleshootItem
                problem="Slow Responses"
                solution="Use 'fastest' routing mode, set latency limits in preferences, or exclude slow models. Check if your provider keys are valid and not rate-limited."
              />
              <TroubleshootItem
                problem="Provider Key Validation Failed"
                solution="Double-check that you copied the API key correctly. Make sure the key has the necessary permissions and isn't expired. Try generating a new key from the provider."
              />
            </div>
          </HelpSection>

        </div>

        {/* Footer */}
        <div className="dashboard-footer" style={{ marginTop: '40px' }}>
          <div className="terminal-text--dim">
            Need more help? Check the <a href="/router/docs" className="footer-link">API Documentation</a> or contact support
          </div>
        </div>
      </div>

      <style jsx>{`
        .help-content {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .help-section-content {
          padding: 20px;
          line-height: 1.6;
        }

        .code-block {
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid var(--phosphor-green);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          background: rgba(0, 255, 65, 0.2);
          transform: translateY(-2px);
        }
      `}</style>
    </RouterLayout>
  );
}

// Collapsible Section Component
function HelpSection({ 
  id, 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children 
}: { 
  id: string; 
  title: string; 
  icon: string; 
  isOpen: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="section-card">
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 20px',
          cursor: 'pointer',
          borderBottom: isOpen ? '1px solid rgba(0, 255, 65, 0.3)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PixelIcon name={icon} size={24} />
          <span className="terminal-text--green" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
            {title}
          </span>
        </div>
        <span className="terminal-text--green" style={{ fontSize: '1.2em' }}>
          {isOpen ? '−' : '+'}
        </span>
      </div>
      {isOpen && children}
    </div>
  );
}

// Strategy Card Component
function StrategyCard({ name, description, useCase }: { name: string; description: string; useCase: string }) {
  return (
    <div style={{
      padding: '15px',
      background: 'rgba(0, 255, 65, 0.05)',
      border: '1px solid rgba(0, 255, 65, 0.3)',
      borderRadius: '4px',
    }}>
      <div className="terminal-text--green" style={{ fontSize: '1em', fontWeight: 'bold', marginBottom: '8px' }}>
        {name}
      </div>
      <p className="terminal-text--dim" style={{ fontSize: '0.9em', marginBottom: '8px', lineHeight: '1.5' }}>
        {description}
      </p>
      <div className="terminal-text--amber" style={{ fontSize: '0.85em' }}>
        Use case: {useCase}
      </div>
    </div>
  );
}

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div className="terminal-text--amber" style={{ fontSize: '0.95em', fontWeight: 'bold', marginBottom: '8px' }}>
        Q: {question}
      </div>
      <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.6', paddingLeft: '15px' }}>
        A: {answer}
      </div>
    </div>
  );
}

// Troubleshoot Item Component
function TroubleshootItem({ problem, solution }: { problem: string; solution: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div className="terminal-text--red" style={{ fontSize: '0.95em', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <PixelIcon name="warning" size={16} />
        {problem}
      </div>
      <div className="terminal-text--dim" style={{ fontSize: '0.9em', lineHeight: '1.6', paddingLeft: '24px' }}>
        {solution}
      </div>
    </div>
  );
}
