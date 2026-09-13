import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

export const metadata: Metadata = {
  title: 'About AI Stupid Level | Independent AI Benchmarking Platform',
  description: 'Learn about our mission to provide transparent, independent AI model benchmarking. Meet our team, explore enterprise data licensing, and see how we keep the measurement honest.',
  keywords: [
    'About AI benchmarking platform', 'Independent AI testing', 'AI model drift dataset',
    'AI performance history data', 'Enterprise AI benchmarking', 'AI model monitoring team',
    'Transparent AI evaluation', 'AI performance monitoring company', 'LLM regression detection',
  ],
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About AI Stupid Level | Independent AI Benchmarking',
    description: 'Independent watchdog platform for AI model performance. Published methodology, no vendor affiliations, no paid placement.',
    url: 'https://aistupidlevel.info/about',
    type: 'website',
  }
};

const styles = {
  page: {
    background: 'var(--terminal-black, #f6f8fc)',
    minHeight: '100vh',
    fontFamily: 'var(--font-mono, "Courier New", monospace)',
    color: 'var(--phosphor-dim)',
  } as React.CSSProperties,
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '32px 20px 80px',
  } as React.CSSProperties,
  pageTitle: {
    fontSize: 'clamp(20px, 3.5vw, 28px)',
    fontWeight: 'bold',
    color: 'var(--phosphor-green, #1a73e8)',
    letterSpacing: '2px',
    textShadow: '0 0 8px rgba(26, 115, 232,0.4)',
    margin: '0 0 8px',
  } as React.CSSProperties,
  pageSub: {
    fontSize: '12px',
    color: 'var(--phosphor-dim, #5f6368)',
    marginBottom: '28px',
    letterSpacing: '0.3px',
    lineHeight: '1.5',
  } as React.CSSProperties,
  heroPanel: {
    background: 'rgba(26, 115, 232,0.05)',
    border: '1px solid rgba(26, 115, 232,0.25)',
    borderLeft: '3px solid var(--phosphor-green, #1a73e8)',
    borderRadius: '3px',
    padding: '16px 20px',
    marginBottom: '24px',
    fontSize: '12px',
    lineHeight: '1.7',
    color: 'var(--phosphor-dim)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--amber-warning, #ffb000)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    margin: '24px 0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  panel: {
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px',
    padding: '14px 16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  panelTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--phosphor-green)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  } as React.CSSProperties,
  text: {
    fontSize: '11px',
    color: 'var(--phosphor-dim)',
    lineHeight: '1.65',
  } as React.CSSProperties,
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '10px',
    marginBottom: '12px',
  } as React.CSSProperties,
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
    marginBottom: '12px',
  } as React.CSSProperties,
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(26, 115, 232,0.1)',
    borderRadius: '2px',
    marginBottom: '6px',
  } as React.CSSProperties,
  check: {
    color: 'var(--phosphor-green)',
    fontSize: '12px',
    flexShrink: 0,
    marginTop: '1px',
    fontWeight: 'bold',
  } as React.CSSProperties,
  link: {
    color: 'var(--phosphor-green)',
    textDecoration: 'none',
    fontWeight: 'bold',
  } as React.CSSProperties,
  divider: {
    borderTop: '1px solid rgba(192,192,192,0.15)',
    margin: '24px 0',
  } as React.CSSProperties,
  ctaPanel: {
    background: 'rgba(26, 115, 232,0.04)',
    border: '2px solid rgba(26, 115, 232,0.3)',
    borderRadius: '3px',
    padding: '20px',
    marginTop: '24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  ctaTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--phosphor-green)',
    letterSpacing: '1.5px',
    marginBottom: '10px',
    textShadow: '0 0 6px rgba(26, 115, 232,0.4)',
  } as React.CSSProperties,
  ctaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginTop: '14px',
  } as React.CSSProperties,
  ctaCard: {
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(26, 115, 232,0.15)',
    borderRadius: '2px',
    padding: '12px',
    textDecoration: 'none',
    display: 'block',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  ctaCardTitle: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'var(--phosphor-green)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    marginBottom: '3px',
  } as React.CSSProperties,
  ctaCardText: {
    fontSize: '10px',
    color: 'var(--phosphor-dim)',
  } as React.CSSProperties,
};

export default function AboutPage() {
  return (
    <SubpageLayout>
      <div style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.pageTitle}>About AI Stupid Level — Independent AI Model Performance Monitoring<span className="blinking-cursor"></span></h1>
          <div style={styles.pageSub}>Independent watchdog platform for AI model performance monitoring</div>

          {/* Hero statement */}
          <div style={styles.heroPanel}>
            We're an <strong style={{ color: 'var(--phosphor-green)' }}>independent watchdog platform</strong> monitoring
            AI model performance to protect developers and businesses from undisclosed capability reductions.
            Built from frustration. Driven by transparency. Independent of every vendor we measure.
          </div>

          {/* Mission */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> OUR MISSION
          </h2>
          <div style={styles.panel}>
            <div style={styles.text}>
              In early 2024, developers noticed something troubling: AI models they relied on seemed to be performing
              worse over time. OpenAI's GPT-4 appeared "dumber" than at launch. Claude started refusing more requests.
              But no one was systematically tracking these changes.
            </div>
            <div style={{ ...styles.text, marginTop: '10px' }}>
              <strong style={{ color: 'var(--phosphor-dim)' }}>AI Stupid Level was born from frustration.</strong> We
              started benchmarking in August 2025 and have not stopped since. We built this platform because:
            </div>
            {[
              ['AI vendors don\'t disclose model changes', 'Silent updates, capability reductions, and performance shifts happen without warning'],
              ['Existing benchmarks are incomplete', 'Single measurements, no standard errors, ranks that separate models by less than their noise, no drift detection'],
              ['Developers deserve transparency', 'You need reliable data to choose AI providers and build production systems'],
              ['The industry needs accountability', 'Independent monitoring keeps vendors honest'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ ...styles.checkItem, marginTop: i === 0 ? '12px' : '6px' }}>
                <span style={styles.check}>&rarr;</span>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <hr style={styles.divider} />

          {/* Team */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> OUR TEAM
          </h2>
          {[
            {
              name: 'Ionut Adrian Visan',
              role: 'Founder & CEO',
              bio: 'Ionut Adrian Visan is the Founder and CEO of AI Stupid Level. A technology entrepreneur and full-stack builder, he has spent his career building products across AI, software infrastructure, blockchain and real-time systems. At ASL, he leads the company\u2019s vision of creating an independent reliability and intelligence layer for AI \u2014 continuously measuring how models perform, detecting meaningful changes over time, and helping organizations make better decisions about the AI systems they depend on.',
              linkedin: 'https://www.linkedin.com/in/ionut-visan-205ab01a5/',
            },
            {
              name: 'Alexandra Chiril\u0103',
              role: 'AI Evaluation & Epistemology',
              bio: 'Alexandra Chiril\u0103, PhD, works at the intersection of philosophy, epistemology and AI evaluation. At AI Stupid Level, she contributes to the design and development of rigorous reasoning evaluations and to the broader question of how AI capabilities, reliability and risk should be measured and interpreted. Her work also spans Assurance 2.0 and safety-case review, bringing a critical perspective to how evidence about AI systems can support trustworthy real-world decisions.',
              linkedin: 'https://www.linkedin.com/in/alexandraa-chirila/',
            },
            {
              name: 'Marius R\u0103zvan Palimariu',
              role: 'AI Infrastructure Lead',
              bio: 'Marius R\u0103zvan Palimariu is the AI Infrastructure Lead at AI Stupid Level, bringing experience from IBM, NVIDIA and Nscale. He focuses on the infrastructure required to evaluate AI systems continuously and reliably at scale, from model execution and compute to the systems supporting ASL\u2019s benchmarking and intelligence platform. His experience across large-scale AI and infrastructure environments helps ASL turn rigorous model evaluation into a dependable production system.',
              linkedin: 'https://www.linkedin.com/in/palimariumarius/',
            },
          ].map((member) => (
            <div key={member.name} style={{ ...styles.panel, marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '3px' }}>{member.name}</div>
              <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{member.role}</div>
              <p style={{ fontSize: '11px', lineHeight: 1.7, color: 'var(--phosphor-dim)', margin: '0 0 10px' }}>{member.bio}</p>
              <a href={member.linkedin} target="_blank" rel="noopener noreferrer" style={styles.link}>
                LinkedIn &rarr;
              </a>
            </div>
          ))}

          <div style={{ ...styles.text, ...styles.panel }}>
            The methodology is open to review by anyone who wants to check it — the scoring weights, the statistical
            methods and the drift constants are all documented on the{' '}
            <Link href="/methodology" style={styles.link}>methodology page</Link>, and the full write-up is published as
            a paper:{' '}
            <a href="/asl-public-benchmark-methodology-2026.pdf" target="_blank" rel="noopener noreferrer" style={styles.link}>
              Public Benchmark Methodology (2026, PDF) &rarr;
            </a>
            . The benchmark backend — the task definitions, the runners and the scoring code — is deliberately private,
            because when it was public we saw providers optimising against the specific tasks, and a test you can study
            in advance stops measuring anything. Corrections are welcome. The front end is open source, so the site you
            are reading can be checked line by line:{' '}
            <a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer" style={styles.link}>
              Frontend repository &rarr;
            </a>
          </div>

          <hr style={styles.divider} />

          {/* Independence guarantee */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> FUNDING AND INDEPENDENCE
          </h2>
          {[
            ['No Vendor Money', 'Backed by venture funding, with revenue from Pro subscriptions, paid API tiers and data licensing to non-vendor organisations. No AI model provider funds us, and none of our investors is an AI model provider.'],
            ['No Vendor Relationships', 'Zero financial relationships with OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu, or any AI model provider.'],
            ['No Affiliate Links', 'We don\'t earn commissions from API signups or referrals. All rankings are merit-based.'],
            ['Own Infrastructure', 'All benchmarks run on our servers using our API keys. No vendor influence whatsoever.'],
            ['Published Methodology', 'The scoring weights, statistical tests and drift constants are published in full, and the front end is open source. The benchmark tasks are withheld so they cannot be trained against.'],
          ].map(([title, desc], i) => (
            <div key={i} style={styles.checkItem}>
              <span style={styles.check}>&rarr;</span>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{desc}</div>
              </div>
            </div>
          ))}

          <div style={{ ...styles.panel, marginTop: '12px' }}>
            <div style={styles.panelTitle}>HOW WE FUND OPERATIONS</div>
            <div style={styles.grid2}>
              {[
                ['Pro Subscriptions', 'Smart Router access, drift analytics and the higher Data API tiers'],
                ['Data Licensing', 'Historical benchmark data for teams that need it in bulk, licensed to non-vendors only'],
                ['Venture Funding', 'Our primary funding. It covers the gap revenue does not \u2014 benchmarking every model every four hours is not cheap \u2014 and none of it comes from a company we measure'],
              ].map(([title, desc], i) => (
                <div key={i} style={{ padding: '10px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(26, 115, 232,0.1)', borderRadius: '2px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <hr style={styles.divider} />

          {/* Methodology validation */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> METHODOLOGY VALIDATION
          </h2>
          <div style={styles.grid2}>
            {[
              ['Published Method', 'The scoring weights, the statistical tests and the drift constants are documented in full on the methodology page and in the 2026 methodology paper. If you think a weight is wrong, you can quote it back to us.'],
              ['Tasks Held Back On Purpose', 'The benchmark tasks are the one thing we do not publish. When they were public, providers optimised against them \u2014 and a test that can be studied in advance, or scraped into training data, stops measuring anything.'],
              ['Config-Versioned', 'Every score records the benchmark configuration it ran under, so a change we made is never mistaken for a change the model made'],
              ['User Verifiable', '"Test Your Keys" runs the same tasks with your own API keys, so you can reproduce our numbers yourself'],
            ].map(([title, desc], i) => (
              <div key={i} style={styles.panel}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</div>
                <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', lineHeight: '1.4' }}>{desc}</div>
              </div>
            ))}
          </div>

          <hr style={styles.divider} />

          {/* Enterprise data */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> ENTERPRISE DATA LICENSING
          </h2>
          <div style={{ ...styles.text, ...styles.panel, marginBottom: '12px' }}>
            Beyond the free public platform, we license the <strong style={{ color: 'var(--phosphor-green)' }}>underlying
            raw data</strong> in bulk to teams that need more than the API provides. Everything below is data we
            actually hold today &mdash; we do not sell datasets we have not collected. Adversarial-safety and
            bias testing are <Link href="/methodology" style={styles.link}>built but not yet running</Link>, so
            they are deliberately not offered here.
          </div>
          <div style={styles.grid2}>
            {[
              {
                title: 'Performance Time-Series',
                desc: 'Every score we have ever recorded, per model, per axis, per suite, with the benchmark configuration each run used.',
                items: ['176,000+ scored runs since August 2025', '9-axis breakdown, not just headline scores', 'Confidence intervals and per-trial variance'],
              },
              {
                title: 'Drift and Regression Dataset',
                desc: 'Detected change points, drift incidents and the Page-Hinkley statistic behind each one, correlated with provider announcements where we have them.',
                items: ['1,400+ recorded incidents and change points \u2014 and the 492 incidents retracted in September 2026 are kept, flagged and excluded, not deleted', 'Per-model, per-suite detector state and thresholds', 'Benchmark-config versioning, so methodology changes are separable from model changes'],
              },
              {
                title: 'Tool-Calling Sessions',
                desc: 'Full agent transcripts from real Docker sandbox executions: which tools were chosen, with what parameters, and what happened.',
                items: ['62,000+ recorded sessions', 'Per-tool selection and parameter accuracy', 'Execution traces and error recovery behaviour'],
              },
              {
                title: 'Deep Reasoning Sessions',
                desc: 'Multi-turn dialogues scored on 13 axes including memory retention, plan coherence and hallucination rate.',
                items: ['4,400+ multi-turn sessions', 'Turn-by-turn scoring', 'Raw outputs retained where retention policy allows'],
              },
            ].map((dataset, i) => (
              <div key={i} style={styles.panel}>
                <div style={styles.panelTitle}>{dataset.title}</div>
                <div style={{ ...styles.text, marginBottom: '10px' }}>{dataset.desc}</div>
                {dataset.items.map((item, j) => (
                  <div key={j} style={{ fontSize: '10px', color: 'var(--phosphor-dim)', display: 'flex', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--phosphor-green)', flexShrink: 0 }}>&rarr;</span>{item}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ ...styles.panel, textAlign: 'center', background: 'rgba(26, 115, 232,0.04)', border: '1px solid rgba(26, 115, 232,0.2)', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '8px', letterSpacing: '0.5px' }}>
              INTERESTED IN ENTERPRISE DATA ACCESS?
            </div>
            <div style={{ ...styles.text, marginBottom: '12px' }}>
              Continuously updated, with history back to our first benchmark on 8 August 2025.
              Custom extracts, bulk exports and dedicated support available. If you need something we
              do not currently collect, say so &mdash; we would rather tell you it does not exist yet
              than sell you a promise.
            </div>
            <a
              href="https://studioplatforms.eu/products/aistupidlevel/data-licensing"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '10px 22px',
                background: 'var(--phosphor-green)',
                color: 'var(--terminal-black)',
                fontWeight: 'bold',
                fontSize: '11px',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}
            >
              VIEW PRICING AND CONTACT SALES &rarr;
            </a>
          </div>

          <hr style={styles.divider} />

          {/* Open Source */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> TRANSPARENCY AND VERIFICATION
          </h2>
          <div style={styles.grid2}>
            {[
              { title: 'Open Web Application', desc: 'The site you are reading is open source. The benchmark repository is deliberately private: when it was public, providers optimised against the specific tasks, which destroys the measurement. The method itself is fully published.', links: [{ label: 'Frontend (Web) \u2192', url: 'https://github.com/StudioPlatforms/aistupidmeter-web' }] },
              { title: 'Public API', desc: 'All benchmark data accessible via a free, keyed REST API. Rankings, historical scores, confidence intervals, degradation alerts and drift signatures.', code: 'GET /api/v1/models', internalLink: { label: 'API Docs \u2192', href: '/api-docs' } },
              { title: 'Detailed Documentation', desc: 'Complete technical documentation of our 9-axis scoring, Page-Hinkley drift detection, and statistical methods.', internalLink: { label: 'Read Methodology \u2192', href: '/methodology' } },
              { title: 'Test Your Keys', desc: 'Run benchmarks with your own API keys to verify we\'re not making up numbers.', internalLink: { label: 'Test Now \u2192', href: '/router/test-keys' } },
            ].map((item, i) => (
              <div key={i} style={styles.panel}>
                <div style={styles.panelTitle}>{item.title}</div>
                <div style={{ ...styles.text, marginBottom: '8px' }}>{item.desc}</div>
                {item.code && (
                  <code style={{ fontSize: '10px', color: 'var(--phosphor-green)', background: 'rgba(26, 115, 232,0.08)', padding: '2px 6px', borderRadius: '2px' }}>{item.code}</code>
                )}
                {item.links?.map((l, j) => (
                  <a key={j} href={l.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.link, display: 'block', fontSize: '10px', marginTop: '4px' }}>{l.label}</a>
                ))}
                {item.internalLink && (
                  <Link href={item.internalLink.href} style={{ ...styles.link, fontSize: '10px' }}>{item.internalLink.label}</Link>
                )}
              </div>
            ))}
          </div>

          <hr style={styles.divider} />

          {/* Values */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> OUR VALUES
          </h2>
          <div style={styles.grid2}>
            {[
              ['Scientific Rigor', 'We use established statistical methods — Page-Hinkley change detection on each suite\'s own series, Welch\'s t-test for the hourly canary, standard errors measured from run-to-run repeatability, ranks that tie when a lead is inside the noise — and publish the constants and the measured false-alarm rates behind them. No hand-waving, no marketing fluff.'],
              ['Radical Transparency', 'Every scoring decision is documented and every result is reproducible with your own keys. Trust through verification, not through claims.'],
              ['Independence', 'No vendor funding. No affiliate revenue. No conflicts of interest. Our only loyalty is to developers who need accurate data.'],
              ['Community First', 'Built by developers, for developers. The front end is open to contributions, feedback shapes what we measure next, and corrections to the method are welcome.'],
            ].map(([title, desc], i) => (
              <div key={i} style={styles.panel}>
                <div style={styles.panelTitle}>{title}</div>
                <div style={styles.text}>{desc}</div>
              </div>
            ))}
          </div>

          <hr style={styles.divider} />

          {/* Contact */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> CONTACT AND SOCIAL
          </h2>
          <div style={styles.grid2}>
            <div style={styles.panel}>
              <div style={styles.panelTitle}>For General Inquiries</div>
              {[
                { label: 'Twitter/X: @AIStupidlevel \u2192', url: 'https://x.com/AIStupidlevel' },
                { label: 'LinkedIn: AI Stupid Level \u2192', url: 'https://www.linkedin.com/company/asl-aistupidlevel-info' },
                { label: 'GitHub: @studioplatforms \u2192', url: 'https://github.com/studioplatforms' },
                { label: 'Reddit: r/aistupidlevel \u2192', url: 'https://www.reddit.com/r/aistupidlevel/' },
              ].map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.link, display: 'block', fontSize: '10px', marginBottom: '4px' }}>{l.label}</a>
              ))}
            </div>
            <div style={styles.panel}>
              <div style={styles.panelTitle}>For Technical Questions</div>
              <Link href="/faq" style={{ ...styles.link, display: 'block', fontSize: '10px', marginBottom: '4px' }}>Read our FAQ &rarr;</Link>
              <Link href="/methodology" style={{ ...styles.link, display: 'block', fontSize: '10px', marginBottom: '4px' }}>Review methodology docs &rarr;</Link>
            </div>
          </div>

          {/* CTA */}
          <div style={styles.ctaPanel}>
            <div style={styles.ctaTitle}>READY TO EXPLORE?</div>
            <div style={{ fontSize: '11px', color: 'var(--phosphor-dim)', marginBottom: '0' }}>
              Start with our live rankings, learn the methodology, or verify our benchmarks yourself.
            </div>
            <div style={styles.ctaGrid}>
              {[
                { title: 'VIEW LIVE RANKINGS', desc: 'Current AI model performance scores', href: '/' },
                { title: 'LEARN METHODOLOGY', desc: 'Understand how we benchmark', href: '/methodology' },
                { title: 'TEST YOUR KEYS', desc: 'Verify benchmarks with your API keys', href: '/router/test-keys' },
              ].map((item, i) => (
                <Link key={i} href={item.href} style={styles.ctaCard}>
                  <div style={styles.ctaCardTitle}>{item.title} &rarr;</div>
                  <div style={styles.ctaCardText}>{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '10px', color: 'var(--phosphor-dim)', textAlign: 'center', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(192,192,192,0.12)' }}>
            AI Stupid Level &bull; Independent benchmarking since 2025 &bull; <Link href="/" style={styles.link}>View Rankings</Link>
          </div>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "AI Stupid Level",
              "url": "https://aistupidlevel.info",
              "description": "Independent AI benchmarking platform",
              "foundingDate": "2025",
              "sameAs": ["https://x.com/AIStupidlevel", "https://www.linkedin.com/company/asl-aistupidlevel-info", "https://github.com/StudioPlatforms", "https://www.reddit.com/r/aistupidlevel/"]
            })
          }}
        />
      </div>
    </SubpageLayout>
  );
}
