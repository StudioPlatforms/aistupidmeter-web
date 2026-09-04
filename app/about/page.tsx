import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';

export const metadata: Metadata = {
  title: 'About AI Stupid Level | Independent AI Benchmarking Platform',
  description: 'Learn about our mission to provide transparent, independent AI model benchmarking. Meet our team, explore enterprise data licensing, and discover why we built an open-source platform for AI performance monitoring.',
  keywords: [
    'About AI benchmarking platform', 'Independent AI testing', 'AI safety dataset',
    'AI bias detection data', 'Enterprise AI benchmarking', 'AI model monitoring team',
    'Open source AI benchmarking', 'Transparent AI evaluation', 'AI performance monitoring company',
  ],
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About AI Stupid Level | Independent AI Benchmarking',
    description: 'Independent watchdog platform for AI model performance. 100% transparent, open source, no vendor affiliations.',
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
            Built from frustration. Driven by transparency. Community-owned.
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
              ['Existing benchmarks are incomplete', 'Single measurements, no confidence intervals, no drift detection'],
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
          <div style={styles.panel}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--phosphor-green)', marginBottom: '3px' }}>The Architect</div>
            <div style={{ fontSize: '9px', color: 'var(--phosphor-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Lead Researcher and Platform Engineer</div>
            {[
              '10+ years in AI/ML infrastructure and performance optimization',
              'Former Senior Engineer at enterprise AI platforms',
              'Expert in statistical analysis and algorithm design',
              'Open source contributor to ML tooling ecosystem',
            ].map((item, i) => (
              <div key={i} style={{ fontSize: '10px', color: 'var(--phosphor-dim)', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                <span style={{ color: 'var(--phosphor-green)', flexShrink: 0 }}>&rarr;</span>{item}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
              <a href="https://x.com/GOATGameDev" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Twitter/X &rarr;
              </a>
              <a href="https://github.com/studioplatforms" target="_blank" rel="noopener noreferrer" style={styles.link}>
                GitHub &rarr;
              </a>
              <a href="https://www.linkedin.com/in/ionut-visan-205ab01a5/" target="_blank" rel="noopener noreferrer" style={styles.link}>
                LinkedIn &rarr;
              </a>
            </div>
          </div>

          <div style={{ ...styles.text, ...styles.panel }}>
            The methodology is open to review by anyone who wants to check it — the scoring code, the tasks and the
            drift constants are all public. Corrections and contributions are welcome; several scoring fixes have come
            from people reading the repo. Check our GitHub:{' '}
            <a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer" style={styles.link}>Web</a>
            {' '}&bull;{' '}
            <a href="https://github.com/StudioPlatforms/aistupidmeter-api" target="_blank" rel="noopener noreferrer" style={styles.link}>API</a>
          </div>

          <hr style={styles.divider} />

          {/* Independence guarantee */}
          <h2 style={styles.sectionTitle}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> FUNDING AND INDEPENDENCE
          </h2>
          {[
            ['No Vendor Money', 'Funded by Pro subscriptions, paid API tiers, data licensing to non-vendor organisations, and out of pocket. Not a cent from any AI model provider.'],
            ['No Vendor Relationships', 'Zero financial relationships with OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu, or any AI model provider.'],
            ['No Affiliate Links', 'We don\'t earn commissions from API signups or referrals. All rankings are merit-based.'],
            ['Own Infrastructure', 'All benchmarks run on our servers using our API keys. No vendor influence whatsoever.'],
            ['Transparent Methodology', 'Complete source code, benchmark tasks, and scoring algorithms are publicly auditable.'],
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
                ['Community Support', 'Donations from developers who value independent AI monitoring'],
                ['Out of Pocket', 'The gap, which is most of it. Benchmarking every model every four hours is not cheap'],
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
              ['Open Source Since 2025', 'Community code reviews, public issue tracking, full transparency in implementation'],
              ['Nothing Hidden', 'Scoring weights, the task list and the drift constants are all in the public repo. If you think a weight is wrong, you can point at the line.'],
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
                items: ['173,000+ scored runs since August 2025', '9-axis breakdown, not just headline scores', 'Confidence intervals and per-trial variance'],
              },
              {
                title: 'Drift and Regression Dataset',
                desc: 'Detected change points, drift incidents and the Page-Hinkley statistic behind each one, correlated with provider announcements where we have them.',
                items: ['900+ recorded incidents and change points', 'Per-model detector state and thresholds', 'Benchmark-config versioning, so methodology changes are separable from model changes'],
              },
              {
                title: 'Tool-Calling Sessions',
                desc: 'Full agent transcripts from real Docker sandbox executions: which tools were chosen, with what parameters, and what happened.',
                items: ['60,000+ recorded sessions', 'Per-tool selection and parameter accuracy', 'Execution traces and error recovery behaviour'],
              },
              {
                title: 'Deep Reasoning Sessions',
                desc: 'Multi-turn dialogues scored on 13 axes including memory retention, plan coherence and hallucination rate.',
                items: ['4,200+ multi-turn sessions', 'Turn-by-turn scoring', 'Raw outputs retained where retention policy allows'],
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
            <span style={{ fontFamily: 'var(--font-mono)' }}>[&rarr;]</span> OPEN SOURCE AND TRANSPARENCY
          </h2>
          <div style={styles.grid2}>
            {[
              { title: 'Full Source Code', desc: 'Every line of code is public on GitHub. Audit our methodology, suggest improvements, or run locally.', links: [{ label: 'Frontend (Web) \u2192', url: 'https://github.com/StudioPlatforms/aistupidmeter-web' }, { label: 'Backend (API) \u2192', url: 'https://github.com/StudioPlatforms/aistupidmeter-api' }] },
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
              ['Scientific Rigor', 'We use proper statistical methods, confidence intervals, and peer-reviewed algorithms. No hand-waving, no marketing fluff — just math.'],
              ['Radical Transparency', 'Everything is open source. Every decision documented. Every benchmark reproducible. Trust through verification, not through claims.'],
              ['Independence', 'No vendor funding. No affiliate revenue. No conflicts of interest. Our only loyalty is to developers who need accurate data.'],
              ['Community First', 'Built by developers, for developers. We listen to feedback, accept contributions, and evolve based on community needs.'],
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
                { label: 'Twitter/X: @GOATGameDev \u2192', url: 'https://x.com/GOATGameDev' },
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
              <a href="https://github.com/StudioPlatforms/aistupidmeter-web/discussions" target="_blank" rel="noopener noreferrer" style={{ ...styles.link, display: 'block', fontSize: '10px' }}>GitHub Discussions &rarr;</a>
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
              "sameAs": ["https://x.com/GOATGameDev", "https://github.com/StudioPlatforms", "https://www.reddit.com/r/aistupidlevel/"]
            })
          }}
        />
      </div>
    </SubpageLayout>
  );
}
