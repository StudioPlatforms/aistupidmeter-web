import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Claude vs GPT vs Gemini Comparison 2026 | AI Model Performance Test Results',
  description: 'Compare Claude vs GPT vs Gemini AI models with real-time benchmark results. See which AI model is best for coding, debugging, and software development in 2026.',
  keywords: [
    'Claude vs GPT vs Gemini', 'Claude vs GPT comparison', 'GPT vs Gemini comparison',
    'Claude vs Gemini comparison', 'AI model comparison 2026', 'best AI model for coding',
    'Claude Opus 4 vs GPT-5', 'Gemini 2.5 vs Claude', 'AI performance comparison',
    'LLM comparison chart', 'AI benchmark comparison', 'which AI is better', 'AI model rankings 2026'
  ],
  openGraph: {
    title: 'Claude vs GPT vs Gemini - AI Model Comparison 2026',
    description: 'Real-time performance comparison of Claude, GPT, and Gemini AI models.',
    url: 'https://aistupidlevel.info/compare',
  },
  alternates: { canonical: '/compare' },
}

export default function ComparePage() {
  return (
    <div style={{ background: 'var(--terminal-black, #0a0a0a)', minHeight: '100vh', fontFamily: 'var(--font-mono, "Courier New", monospace)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>

        {/* Back link */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/" style={{ fontSize: '11px', color: 'var(--phosphor-dim, #4a7a4a)', textDecoration: 'none', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>
            ← BACK TO LIVE RANKINGS
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px', borderBottom: '2px solid rgba(192,192,192,0.3)', paddingBottom: '24px' }}>
          <h1 style={{ fontSize: 'clamp(18px, 3vw, 26px)', fontWeight: 'bold', color: 'var(--phosphor-green, #00ff41)', letterSpacing: '2px', marginBottom: '8px', textShadow: '0 0 6px rgba(0,255,65,0.4)' }}>
            CLAUDE vs GPT vs GEMINI<span className="blinking-cursor"></span>
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--phosphor-dim, #4a7a4a)', letterSpacing: '0.5px' }}>
            Real-time AI model comparison with comprehensive benchmark results
          </div>
        </div>

        {/* Performance Leaders */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning, #ffb000)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> CURRENT PERFORMANCE LEADERS (2026)
          </div>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '14px' }}>
            Based on continuous 4-hourly benchmarking cycles, here are the current top performers:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { rank: '01', label: 'Best for Coding', model: 'Claude Opus 4', detail: 'consistently leads in code generation and debugging tasks' },
              { rank: '02', label: 'Fastest Response', model: 'Gemini 2.5 Flash', detail: 'provides the quickest API response times' },
              { rank: '03', label: 'Most Reliable', model: 'GPT-5', detail: 'shows the most consistent performance across all test categories' },
              { rank: '04', label: 'Best Value', model: 'Claude Sonnet 4', detail: 'offers excellent performance-to-cost ratio' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,65,0.12)', borderLeft: '3px solid rgba(0,255,65,0.4)', borderRadius: '2px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: '1px' }}>{item.rank}</span>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}: </span>
                  <strong style={{ color: 'var(--phosphor-green)', fontSize: '11px' }}>{item.model}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}> — {item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Matrix */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> DETAILED COMPARISON MATRIX
          </div>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '16px' }}>
            Our 7-axis scoring methodology provides comprehensive insights into each model's strengths:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {[
              {
                provider: 'ANTHROPIC CLAUDE',
                items: [
                  { model: 'Claude Opus 4', desc: 'Premium model excelling in complex reasoning and code generation' },
                  { model: 'Claude Sonnet 4', desc: 'Balanced performance with excellent cost efficiency' },
                  { label: 'Strengths', value: 'Superior code quality, excellent debugging capabilities, strong refusal handling' },
                  { label: 'Best for', value: 'Software development, code review, complex problem solving' },
                ]
              },
              {
                provider: 'OPENAI GPT',
                items: [
                  { model: 'GPT-5', desc: 'Latest flagship model with enhanced reasoning capabilities' },
                  { model: 'O3 and O3-Mini', desc: 'Specialized models for different use cases and budgets' },
                  { label: 'Strengths', value: 'Consistent performance, broad knowledge base, reliable API' },
                  { label: 'Best for', value: 'General-purpose tasks, consistent results, production environments' },
                ]
              },
              {
                provider: 'GOOGLE GEMINI',
                items: [
                  { model: 'Gemini 2.5 Pro', desc: 'High-performance model with multimodal capabilities' },
                  { model: 'Gemini 2.5 Flash', desc: 'Speed-optimized variant for rapid responses' },
                  { label: 'Strengths', value: 'Fast response times, competitive pricing, Google integration' },
                  { label: 'Best for', value: 'High-throughput applications, cost-sensitive projects, speed-critical tasks' },
                ]
              },
            ].map((section, i) => (
              <div key={i} style={{ padding: '16px', border: '1px solid rgba(0,255,65,0.2)', borderRadius: '3px', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1px', marginBottom: '12px', borderBottom: '1px solid rgba(0,255,65,0.15)', paddingBottom: '8px' }}>
                  {section.provider}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {section.items.map((item, j) => (
                    <div key={j} style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>
                      {'model' in item ? (
                        <><strong style={{ color: 'var(--phosphor-green)' }}>{item.model}:</strong> {item.desc}</>
                      ) : (
                        <><strong style={{ color: 'var(--metal-silver, #c0c0c0)' }}>{item.label}:</strong> {item.value}</>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Best for Coding */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> WHICH AI MODEL IS BEST FOR CODING?
          </div>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '14px' }}>
            Based on comprehensive coding benchmarks, here are our recommendations by use case:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { medal: '#1', category: 'Complex Software Development', winner: 'Claude Opus 4', detail: 'leads with superior code architecture and debugging' },
              { medal: '#2', category: 'Production Reliability', winner: 'GPT-5', detail: 'offers the most consistent and reliable performance' },
              { medal: '#3', category: 'Speed and Efficiency', winner: 'Gemini 2.5 Flash', detail: 'provides fastest response times for rapid prototyping' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,65,0.12)', borderRadius: '2px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', fontFamily: 'var(--font-mono)', minWidth: '24px' }}>{item.medal}</span>
                <div>
                  <strong style={{ color: 'var(--phosphor-green)', fontSize: '11px' }}>{item.category}:</strong>
                  <span style={{ color: 'var(--metal-silver)', fontSize: '11px' }}> {item.winner}</span>
                  <span style={{ color: 'var(--phosphor-dim)', fontSize: '11px' }}> — {item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Real-time Benchmark Results */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> REAL-TIME BENCHMARK RESULTS
          </div>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '14px' }}>
            Our AI benchmark tool continuously monitors all models with hourly test cycles. Key metrics include:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {[
              { metric: 'Correctness', desc: 'Functional accuracy through 200+ automated unit tests' },
              { metric: 'Code Quality', desc: 'Static analysis, complexity measurement, best practices' },
              { metric: 'Efficiency', desc: 'API latency, token usage, algorithmic complexity' },
              { metric: 'Stability', desc: 'Consistency across multiple test runs and conditions' },
              { metric: 'Refusal Handling', desc: 'Appropriate task acceptance vs over-cautious rejections' },
              { metric: 'Recovery', desc: 'Error recovery and debugging capabilities' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,255,65,0.1)', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.metric}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> METHODOLOGY AND TRANSPARENCY
          </div>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '12px' }}>
            Our AI model comparison uses identical test conditions for fair evaluation:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              '147 unique coding challenges across multiple programming languages',
              'Standardized temperature (0.3) and parameters for consistent results',
              'Multiple test runs with median scoring to eliminate outliers',
              'Real production API calls with actual latency and token measurements',
              'Independent verification available through open source benchmarks',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.5' }}>
                <span style={{ color: 'var(--phosphor-green)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>→</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--phosphor-dim)' }}>
            Read our{' '}
            <Link href="/methodology" style={{ color: 'var(--phosphor-green)', textDecoration: 'underline' }}>
              detailed methodology
            </Link>
            {' '}to understand how we measure AI performance, or check our{' '}
            <Link href="/faq" style={{ color: 'var(--phosphor-green)', textDecoration: 'underline' }}>
              FAQ
            </Link>
            {' '}for common questions about our benchmarking approach.
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '24px', border: '2px solid rgba(0,255,65,0.3)', borderRadius: '3px', background: 'rgba(0,255,65,0.04)', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1.5px', marginBottom: '10px', textShadow: '0 0 6px rgba(0,255,65,0.3)' }}>
            SEE LIVE RESULTS
          </div>
          <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)', marginBottom: '20px', lineHeight: '1.6' }}>
            View real-time Claude vs GPT vs Gemini performance data with our interactive AI benchmark dashboard
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{
              display: 'inline-block', padding: '10px 22px',
              border: '1px solid var(--phosphor-green, #00ff41)', color: 'var(--phosphor-green, #00ff41)',
              background: 'transparent', borderRadius: '2px',
              fontSize: '11px', fontWeight: 'bold', textDecoration: 'none',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.8px',
              textTransform: 'uppercase', transition: 'all 0.15s',
            }}>
              VIEW LIVE RESULTS →
            </Link>
            <Link href="/about" style={{
              display: 'inline-block', padding: '10px 22px',
              border: '1px solid rgba(192,192,192,0.4)', color: 'var(--metal-silver, #c0c0c0)',
              background: 'transparent', borderRadius: '2px',
              fontSize: '11px', fontWeight: 'bold', textDecoration: 'none',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}>
              ABOUT US →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(192,192,192,0.15)', fontSize: '10px', color: 'var(--phosphor-dim)', textAlign: 'center' }}>
          AI Stupid Meter • Continuous benchmarking since 2024 • <Link href="/" style={{ color: 'var(--phosphor-green)', textDecoration: 'none' }}>View Full Rankings</Link>
        </div>

      </div>
    </div>
  );
}
