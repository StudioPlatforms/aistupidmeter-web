import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Claude vs GPT vs Gemini Comparison 2025 | AI Model Performance Test Results',
  description: 'Compare Claude vs GPT vs Gemini AI models with real-time benchmark results. See which AI model is best for coding, debugging, and software development in 2025.',
  keywords: [
    'Claude vs GPT vs Gemini',
    'Claude vs GPT comparison',
    'GPT vs Gemini comparison',
    'Claude vs Gemini comparison',
    'AI model comparison 2025',
    'best AI model for coding',
    'Claude Opus 4 vs GPT-5',
    'Gemini 2.5 vs Claude',
    'AI performance comparison',
    'LLM comparison chart',
    'AI benchmark comparison',
    'which AI is better',
    'AI model rankings 2025'
  ],
  openGraph: {
    title: 'Claude vs GPT vs Gemini - AI Model Comparison 2025',
    description: 'Real-time performance comparison of Claude, GPT, and Gemini AI models. See benchmark results, coding performance, and which AI is best for development.',
    url: 'https://aistupidlevel.info/compare',
  },
  twitter: {
    title: 'Claude vs GPT vs Gemini - AI Model Comparison 2025',
    description: 'Real-time performance comparison of Claude, GPT, and Gemini AI models with comprehensive benchmark results.',
  },
  alternates: {
    canonical: '/compare',
  },
}

export default function ComparePage() {
  return (
    <div className="vintage-container">
      <div className="crt-monitor">
        <div className="terminal-text">
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: 'Compare' }
          ]} />
          
          <div style={{ fontSize: '1.5em', marginBottom: '16px', textAlign: 'center' }}>
            <span className="terminal-text--green">CLAUDE vs GPT vs GEMINI</span>
            <span className="blinking-cursor"></span>
          </div>
          <div className="terminal-text--dim" style={{ textAlign: 'center', marginBottom: '24px' }}>
            Real-time AI model comparison with comprehensive benchmark results
          </div>

          <div style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '20px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                🏆 CURRENT PERFORMANCE LEADERS (2025)
              </div>
              <div className="terminal-text--dim">
                Based on our continuous 4-hourly benchmarking cycles, here are the current top performers across different categories:
              </div>
              <ul style={{ marginLeft: '20px', marginTop: '12px' }}>
                <li className="terminal-text--green" style={{ marginBottom: '8px' }}>
                  <strong>Best for Coding:</strong> Claude Opus 4 consistently leads in code generation and debugging tasks
                </li>
                <li className="terminal-text--green" style={{ marginBottom: '8px' }}>
                  <strong>Fastest Response:</strong> Gemini 2.5 Flash provides the quickest API response times
                </li>
                <li className="terminal-text--green" style={{ marginBottom: '8px' }}>
                  <strong>Most Reliable:</strong> GPT-5 shows the most consistent performance across all test categories
                </li>
                <li className="terminal-text--green" style={{ marginBottom: '8px' }}>
                  <strong>Best Value:</strong> Claude Sonnet 4 offers excellent performance-to-cost ratio
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                📊 DETAILED COMPARISON MATRIX
              </div>
              <div className="terminal-text--dim" style={{ marginBottom: '12px' }}>
                Our 7-axis scoring methodology provides comprehensive insights into each model's strengths:
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '16px',
                marginTop: '16px'
              }}>
                {/* Claude Section */}
                <div style={{ 
                  padding: '16px', 
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  borderRadius: '4px'
                }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                    🤖 ANTHROPIC CLAUDE
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Claude Opus 4:</strong> Premium model excelling in complex reasoning and code generation
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Claude Sonnet 4:</strong> Balanced performance with excellent cost efficiency
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Strengths:</strong> Superior code quality, excellent debugging capabilities, strong refusal handling
                    </div>
                    <div>
                      <strong>Best for:</strong> Software development, code review, complex problem solving
                    </div>
                  </div>
                </div>

                {/* GPT Section */}
                <div style={{ 
                  padding: '16px', 
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  borderRadius: '4px'
                }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                    🧠 OPENAI GPT
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>GPT-5:</strong> Latest flagship model with enhanced reasoning capabilities
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>O3 & O3-Mini:</strong> Specialized models for different use cases and budgets
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Strengths:</strong> Consistent performance, broad knowledge base, reliable API
                    </div>
                    <div>
                      <strong>Best for:</strong> General-purpose tasks, consistent results, production environments
                    </div>
                  </div>
                </div>

                {/* Gemini Section */}
                <div style={{ 
                  padding: '16px', 
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  backgroundColor: 'rgba(0, 255, 65, 0.05)',
                  borderRadius: '4px'
                }}>
                  <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                    ⚡ GOOGLE GEMINI
                  </div>
                  <div className="terminal-text--dim" style={{ fontSize: '0.85em' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Gemini 2.5 Pro:</strong> High-performance model with multimodal capabilities
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Gemini 2.5 Flash:</strong> Speed-optimized variant for rapid responses
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Strengths:</strong> Fast response times, competitive pricing, Google integration
                    </div>
                    <div>
                      <strong>Best for:</strong> High-throughput applications, cost-sensitive projects, speed-critical tasks
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                🎯 WHICH AI MODEL IS BEST FOR CODING?
              </div>
              <div className="terminal-text--dim">
                Based on our comprehensive coding benchmarks, here's our recommendation by use case:
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <span className="terminal-text--green">🥇 Complex Software Development:</span>
                  <span className="terminal-text--dim"> Claude Opus 4 leads with superior code architecture and debugging</span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span className="terminal-text--green">🥈 Production Reliability:</span>
                  <span className="terminal-text--dim"> GPT-5 offers the most consistent and reliable performance</span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <span className="terminal-text--green">🥉 Speed & Efficiency:</span>
                  <span className="terminal-text--dim"> Gemini 2.5 Flash provides fastest response times for rapid prototyping</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                📈 REAL-TIME BENCHMARK RESULTS
              </div>
              <div className="terminal-text--dim" style={{ marginBottom: '12px' }}>
                Our AI benchmark tool continuously monitors all models with hourly test cycles. Key metrics include:
              </div>
              <ul style={{ marginLeft: '20px' }}>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  <strong>Correctness:</strong> Functional accuracy through 200+ automated unit tests
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  <strong>Code Quality:</strong> Static analysis, complexity measurement, best practices
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  <strong>Efficiency:</strong> API latency, token usage, algorithmic complexity
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  <strong>Stability:</strong> Consistency across multiple test runs and conditions
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  <strong>Refusal Handling:</strong> Appropriate task acceptance vs over-cautious rejections
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div className="terminal-text--amber" style={{ fontSize: '1.1em', marginBottom: '8px' }}>
                🔬 METHODOLOGY & TRANSPARENCY
              </div>
              <div className="terminal-text--dim">
                Our AI model comparison uses identical test conditions for fair evaluation:
              </div>
              <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  147 unique coding challenges across multiple programming languages
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  Standardized temperature (0.3) and parameters for consistent results
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  Multiple test runs with median scoring to eliminate outliers
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  Real production API calls with actual latency and token measurements
                </li>
                <li className="terminal-text--dim" style={{ marginBottom: '6px' }}>
                  Independent verification available through open source benchmarks
                </li>
              </ul>
              <div className="terminal-text--dim" style={{ marginTop: '12px' }}>
                📖 <Link href="/methodology" className="text-blue-400 hover:text-blue-300 underline">Read our detailed methodology</Link> to understand how we measure AI performance, or
                check our <Link href="/faq" className="text-blue-400 hover:text-blue-300 underline">FAQ</Link> for common questions about our benchmarking approach.
              </div>
            </div>

            <div style={{ 
              textAlign: 'center', 
              marginTop: '32px',
              padding: '20px',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              backgroundColor: 'rgba(0, 255, 65, 0.05)',
              borderRadius: '4px'
            }}>
              <div className="terminal-text--green" style={{ fontSize: '1.1em', marginBottom: '12px' }}>
                🚀 SEE LIVE RESULTS
              </div>
              <div className="terminal-text--dim" style={{ marginBottom: '16px' }}>
                View real-time Claude vs GPT vs Gemini performance data with our interactive AI benchmark dashboard
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/" className="vintage-btn" style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  textDecoration: 'none',
                  color: 'var(--phosphor-green)',
                  border: '1px solid var(--phosphor-green)',
                  backgroundColor: 'transparent',
                  borderRadius: '4px',
                  fontSize: '1em'
                }}>
                  VIEW LIVE RESULTS
                </Link>
                <Link href="/about" className="vintage-btn" style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  textDecoration: 'none',
                  color: 'var(--phosphor-green)',
                  border: '1px solid var(--phosphor-green)',
                  backgroundColor: 'transparent',
                  borderRadius: '4px',
                  fontSize: '1em'
                }}>
                  ABOUT US
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
