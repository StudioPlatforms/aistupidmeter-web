import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Claude vs GPT vs Gemini Comparison 2026 | AI Model Performance Test Results',
  description: 'Compare Claude vs GPT vs Gemini AI models with real-time benchmark results. See which AI model is best for coding, debugging, and software development in 2026.',
  keywords: [
    'Claude vs GPT vs Gemini', 'Claude vs GPT comparison', 'GPT vs Gemini comparison',
    'Claude vs Gemini comparison', 'AI model comparison 2026', 'best AI model for coding',
    'Claude Opus 5 vs GPT-5.6', 'Gemini 3.1 vs Claude', 'AI performance comparison',
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
    <div style={{ background: 'var(--terminal-black, #f6f8fc)', minHeight: '100vh', fontFamily: 'var(--font-mono, "Courier New", monospace)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>

        {/* Back link */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/" style={{ fontSize: '11px', color: 'var(--phosphor-dim, #5f6368)', textDecoration: 'none', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>
            ← BACK TO LIVE RANKINGS
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px', borderBottom: '2px solid rgba(192,192,192,0.3)', paddingBottom: '24px' }}>
          <h1 style={{ fontSize: 'clamp(18px, 3vw, 26px)', fontWeight: 'bold', color: 'var(--phosphor-green, #1a73e8)', letterSpacing: '2px', marginBottom: '8px', textShadow: '0 0 6px rgba(26, 115, 232,0.4)' }}>
            CLAUDE vs GPT vs GEMINI<span className="blinking-cursor"></span>
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--phosphor-dim, #5f6368)', letterSpacing: '0.5px' }}>
            Real-time AI model comparison with comprehensive benchmark results
          </div>
        </div>

        {/* Performance Leaders */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning, #ffb000)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> CURRENT PERFORMANCE LEADERS (2026)
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '14px' }}>
            Benchmarks re-run every 4 hours and the order genuinely changes, so we do not freeze a
            winner into this page &mdash; a hardcoded list here would be wrong within weeks. Each
            category below links to the live sort, which is the authoritative answer:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { rank: '01', label: 'Best for Coding', model: 'View live', href: '/?sortBy=coding', detail: 'ranked by the executed-code benchmark: correctness, complexity, debugging' },
              { rank: '02', label: 'Best for Reasoning', model: 'View live', href: '/?sortBy=reasoning', detail: 'ranked by the multi-turn deep-reasoning suite' },
              { rank: '03', label: 'Fastest Response', model: 'View live', href: '/?sortBy=speed', detail: 'ranked by measured end-to-end API latency' },
              { rank: '04', label: 'Best Value', model: 'View live', href: '/?sortBy=price', detail: 'ranked by score against list price per token' },
              { rank: '05', label: 'Best at Tool Calling', model: 'View live', href: '/?sortBy=tooling', detail: 'ranked by the Docker-sandbox agent suite' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(26, 115, 232,0.12)', borderLeft: '3px solid rgba(26, 115, 232,0.4)', borderRadius: '2px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '10px', color: 'var(--phosphor-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: '1px' }}>{item.rank}</span>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}: </span>
                  <Link href={item.href} style={{ color: 'var(--phosphor-green)', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none' }}>{item.model} →</Link>
                  <span style={{ fontSize: '11px', color: 'var(--phosphor-dim)' }}> — {item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Matrix */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> DETAILED COMPARISON MATRIX
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '16px' }}>
            Our 9-axis scoring methodology provides comprehensive insights into each model's strengths:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {[
              {
                provider: 'ANTHROPIC CLAUDE',
                items: [
                  { model: 'Opus', desc: 'The heavyweight line — strongest on complex reasoning and code architecture' },
                  { model: 'Sonnet / Fable', desc: 'Faster, cheaper lines that stay close to Opus on ordinary coding work' },
                  { label: 'Typically strong at', value: 'Code quality, debugging, tool calling' },
                  { label: 'Models tracked', value: 'The largest family on our leaderboard' },
                ]
              },
              {
                provider: 'OPENAI GPT',
                items: [
                  { model: 'GPT-5.x', desc: 'The flagship line, several variants tuned differently' },
                  { model: 'Codex', desc: 'Coding-specialised variant, frequently at or near the top of our combined ranking' },
                  { label: 'Typically strong at', value: 'Correctness and reasoning consistency' },
                  { label: 'Models tracked', value: 'Second-largest family on our leaderboard' },
                ]
              },
              {
                provider: 'GOOGLE GEMINI',
                items: [
                  { model: 'Gemini Pro', desc: 'High-performance line with multimodal capabilities' },
                  { model: 'Gemini Flash / Flash-Lite', desc: 'Speed-optimised variants for high-throughput work' },
                  { label: 'Typically strong at', value: 'Latency and price-per-token' },
                  { label: 'Best for', value: 'High-throughput and cost-sensitive workloads' },
                ]
              },
              {
                provider: 'DEEPSEEK',
                items: [
                  { model: 'V4 Pro / V4 Flash', desc: 'Open-weight-derived line that scores competitively on reasoning' },
                  { label: 'Typically strong at', value: 'Reasoning score relative to cost' },
                  { label: 'Best for', value: 'Analysis and reasoning work on a budget' },
                ]
              },
              {
                provider: 'MOONSHOT KIMI',
                items: [
                  { model: 'K3 / K2.x Code', desc: 'Long-context line with a coding-specialised variant' },
                  { label: 'Typically strong at', value: 'Long-context retention and coding tasks' },
                  { label: 'Best for', value: 'Large-codebase and long-document work' },
                ]
              },
              {
                provider: 'ZHIPU GLM',
                items: [
                  { model: 'GLM 5.x', desc: 'Competitively priced general-purpose line' },
                  { label: 'Typically strong at', value: 'Cost efficiency' },
                  { label: 'Best for', value: 'Volume workloads where price dominates' },
                ]
              },
            ].map((section, i) => (
              <div key={i} style={{ padding: '16px', border: '1px solid rgba(26, 115, 232,0.2)', borderRadius: '3px', background: 'rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1px', marginBottom: '12px', borderBottom: '1px solid rgba(26, 115, 232,0.15)', paddingBottom: '8px' }}>
                  {section.provider}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {section.items.map((item, j) => (
                    <div key={j} style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>
                      {'model' in item ? (
                        <><strong style={{ color: 'var(--phosphor-green)' }}>{item.model}:</strong> {item.desc}</>
                      ) : (
                        <><strong style={{ color: 'var(--phosphor-dim)' }}>{item.label}:</strong> {item.value}</>
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
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> WHICH AI MODEL IS BEST FOR CODING?
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '14px' }}>
            The honest answer is &ldquo;it depends, and it changed since you asked&rdquo;. What we can
            tell you is how to read the data rather than which name to trust this month:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { medal: '#1', category: 'Check the confidence intervals first', detail: 'the top few models are usually separated by less than their error bars, which means the ranking order between them is not statistically meaningful' },
              { medal: '#2', category: 'Sort by the axis you actually care about', detail: 'the coding, reasoning, speed, price and tool-calling sorts produce genuinely different orders' },
              { medal: '#3', category: 'Watch the drift alerts, not just the score', detail: 'a model that is quietly degrading is a worse bet than one scoring slightly lower but holding steady' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(26, 115, 232,0.12)', borderRadius: '2px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', fontFamily: 'var(--font-mono)', minWidth: '24px' }}>{item.medal}</span>
                <div>
                  <strong style={{ color: 'var(--phosphor-green)', fontSize: '11px' }}>{item.category}</strong>
                  <span style={{ color: 'var(--phosphor-dim)', fontSize: '11px' }}> — {item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Real-time Benchmark Results */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> REAL-TIME BENCHMARK RESULTS
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.7', marginBottom: '14px' }}>
            Our AI benchmark tool continuously monitors all models with hourly test cycles. Key metrics include:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {[
              { metric: 'Correctness (40%)', desc: 'Generated code is executed against 35 test cases across 10 tasks, 175 executions per model per cycle' },
              { metric: 'Complexity (20%)', desc: 'Whether the model actually grasped the algorithmic problem' },
              { metric: 'Code Quality (15%)', desc: 'Static analysis, structure, maintainability' },
              { metric: 'Stability (10%)', desc: 'Consistency across the 5 trials of each task' },
              { metric: 'Efficiency (5%)', desc: 'Algorithmic complexity of the solution produced' },
              { metric: 'Edge Cases, Debugging, Format, Safety', desc: 'The remaining 10%: boundary handling, fixing broken code, output discipline, and avoiding dangerous operations' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(26, 115, 232,0.1)', borderRadius: '2px' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.metric}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[→]</span> METHODOLOGY AND TRANSPARENCY
          </h2>
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
        <section style={{ padding: '24px', border: '2px solid rgba(26, 115, 232,0.3)', borderRadius: '3px', background: 'rgba(26, 115, 232,0.04)', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', letterSpacing: '1.5px', marginBottom: '10px', textShadow: '0 0 6px rgba(26, 115, 232,0.3)' }}>
            SEE LIVE RESULTS
          </div>
          <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)', marginBottom: '20px', lineHeight: '1.6' }}>
            View real-time Claude vs GPT vs Gemini performance data with our interactive AI benchmark dashboard
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{
              display: 'inline-block', padding: '10px 22px',
              border: '1px solid var(--phosphor-green, #1a73e8)', color: 'var(--phosphor-green, #1a73e8)',
              background: 'transparent', borderRadius: '2px',
              fontSize: '11px', fontWeight: 'bold', textDecoration: 'none',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.8px',
              textTransform: 'uppercase', transition: 'all 0.15s',
            }}>
              VIEW LIVE RESULTS →
            </Link>
            <Link href="/about" style={{
              display: 'inline-block', padding: '10px 22px',
              border: '1px solid rgba(192,192,192,0.4)', color: 'var(--phosphor-dim)',
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
          AI Stupid Meter • Continuous benchmarking since 2025 • <Link href="/" style={{ color: 'var(--phosphor-green)', textDecoration: 'none' }}>View Full Rankings</Link>
        </div>

      </div>
    </div>
  );
}
