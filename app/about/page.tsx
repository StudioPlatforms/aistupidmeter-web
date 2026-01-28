import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'About AI Stupid Level | Independent AI Benchmarking Platform',
  description: 'Learn about our mission to provide transparent, independent AI model benchmarking. Meet our team, explore enterprise data licensing, and discover why we built an open-source platform for AI performance monitoring.',
  keywords: [
    'About AI benchmarking platform',
    'Independent AI testing',
    'AI safety dataset',
    'AI bias detection data',
    'Enterprise AI benchmarking',
    'AI model monitoring team',
    'Open source AI benchmarking',
    'Transparent AI evaluation',
    'AI performance monitoring company',
    'AI security vulnerability data',
    'EU AI Act compliance data'
  ],
  openGraph: {
    title: 'About AI Stupid Level | Independent AI Benchmarking',
    description: 'Independent watchdog platform for AI model performance. 100% transparent, open source, no vendor affiliations.',
    type: 'website',
  }
};

export default function AboutPage() {
  return (
    <article className="max-w-4xl mx-auto px-4 py-12 prose prose-invert">
      <h1>About AI Stupid Level</h1>
      
      <div className="not-prose bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/50 p-6 rounded-lg my-8">
        <p className="text-xl leading-relaxed">
          We're an <strong>independent watchdog platform</strong> monitoring AI model performance 
          to protect developers and businesses from undisclosed capability reductions.
        </p>
      </div>

      <section>
        <h2>Our Mission</h2>
        
        <p>
          In early 2024, developers noticed something troubling: AI models they relied on seemed 
          to be performing worse over time. OpenAI's GPT-4 appeared "dumber" than at launch. 
          Claude started refusing more requests. But no one was systematically tracking these changes.
        </p>

        <p>
          <strong>AI Stupid Level was born from frustration.</strong> We built this platform because:
        </p>

        <ul>
          <li><strong>AI vendors don't disclose model changes:</strong> Silent updates, capability reductions, 
          and performance shifts happen without warning</li>
          <li><strong>Existing benchmarks are incomplete:</strong> Single measurements, no confidence intervals, 
          no drift detection</li>
          <li><strong>Developers deserve transparency:</strong> You need reliable data to choose AI providers</li>
          <li><strong>The industry needs accountability:</strong> Independent monitoring keeps vendors honest</li>
        </ul>

        <div className="not-prose bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-lg my-6">
          <p className="text-sm">
            <strong>🎯 Our Goal:</strong> Provide the most rigorous, transparent, and statistically sound 
            AI benchmarking platform available—completely free and open source.
          </p>
        </div>
      </section>

      <section>
        <h2>Our Team</h2>
        
        <div className="not-prose bg-slate-800 p-6 rounded-lg my-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">
              TA
            </div>
            <div>
              <h3 className="text-xl font-bold">The Architect</h3>
              <p className="text-blue-400 text-sm mb-2">Lead Researcher & Platform Engineer</p>
              
              <ul className="text-sm space-y-1 text-slate-300">
                <li>• 10+ years in AI/ML infrastructure and performance optimization</li>
                <li>• Former Senior Engineer at enterprise AI platforms</li>
                <li>• Expert in statistical analysis and algorithm design</li>
                <li>• Open source contributor to ML tooling ecosystem</li>
              </ul>

              <div className="flex gap-3 mt-3">
                <a 
                  href="https://x.com/GOATGameDev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Twitter/X →
                </a>
                <a 
                  href="https://github.com/ionutvi" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  GitHub →
                </a>
              </div>
            </div>
          </div>
        </div>

        <h3>Contributing Researchers</h3>
        <p>
          Our methodology has been reviewed and validated by statisticians, ML researchers, and
          industry practitioners. We welcome contributions from the community—check our GitHub repositories:
          {' '}<a href="https://github.com/StudioPlatforms/aistupidmeter-web" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Web</a>
          {' '}•{' '}<a href="https://github.com/StudioPlatforms/aistupidmeter-api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">API</a> to get involved.
        </p>
      </section>

      <section>
        <h2>Methodology Validation</h2>
        
        <p>Our statistical approach and benchmarking framework has been:</p>

        <div className="grid md:grid-cols-2 gap-4 my-6">
          <div className="not-prose bg-green-900/20 border border-green-500/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h4 className="font-bold">Open Source Since 2024</h4>
            </div>
            <p className="text-sm text-slate-300">
              500+ GitHub stars, community code reviews, full transparency in implementation
            </p>
          </div>

          <div className="not-prose bg-green-900/20 border border-green-500/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h4 className="font-bold">Peer Reviewed</h4>
            </div>
            <p className="text-sm text-slate-300">
              Statistical methodology reviewed by academic researchers in ML evaluation
            </p>
          </div>

          <div className="not-prose bg-green-900/20 border border-green-500/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h4 className="font-bold">Community Validated</h4>
            </div>
            <p className="text-sm text-slate-300">
              Referenced in technical blogs, Reddit discussions, and developer communities
            </p>
          </div>

          <div className="not-prose bg-green-900/20 border border-green-500/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✅</span>
              <h4 className="font-bold">User Verifiable</h4>
            </div>
            <p className="text-sm text-slate-300">
              "Test Your Keys" feature allows independent verification of all benchmarks
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Funding & Independence</h2>
        
        <div className="not-prose bg-blue-900/30 border border-blue-500/50 p-6 rounded-lg my-6">
          <h3 className="text-xl font-bold mb-4">Our Independence Guarantee</h3>
          
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-green-400 text-xl flex-shrink-0">✓</span>
              <div>
                <strong className="text-white">100% Independent Funding</strong>
                <p className="text-slate-300">Supported through community donations, sponsorships, and grant funding. No revenue from AI vendors.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-green-400 text-xl flex-shrink-0">✓</span>
              <div>
                <strong className="text-white">No Vendor Relationships</strong>
                <p className="text-slate-300">Zero financial relationships with OpenAI, Anthropic, Google, xAI, or any AI model provider.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-green-400 text-xl flex-shrink-0">✓</span>
              <div>
                <strong className="text-white">No Affiliate Links</strong>
                <p className="text-slate-300">We don't earn commissions from API signups or referrals. All rankings are merit-based.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-green-400 text-xl flex-shrink-0">✓</span>
              <div>
                <strong className="text-white">Own Infrastructure</strong>
                <p className="text-slate-300">All benchmarks run on our servers using our API keys. No vendor influence.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-green-400 text-xl flex-shrink-0">✓</span>
              <div>
                <strong className="text-white">Transparent Methodology</strong>
                <p className="text-slate-300">Complete source code, benchmark tasks, and scoring algorithms are publicly auditable.</p>
              </div>
            </li>
          </ul>
        </div>

        <h3>How We Fund Operations</h3>
        <ul>
          <li><strong>Enterprise Data Licensing:</strong> Premium datasets for security teams, compliance officers, and ML researchers</li>
          <li><strong>Community Support:</strong> Donations from developers who value independent AI monitoring</li>
          <li><strong>Sponsorships:</strong> Non-vendor companies supporting open source AI infrastructure</li>
          <li><strong>Grants:</strong> Research grants for AI evaluation and transparency projects</li>
        </ul>

        <p className="text-sm text-slate-400">
          <em>We explicitly do not accept funding from AI model providers to maintain independence and objectivity.
          Enterprise data licensing revenue helps keep our public platform free while maintaining our independence.</em>
        </p>
      </section>

      <section>
        <h2>Enterprise Data Licensing</h2>
        
        <div className="not-prose bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/50 p-6 rounded-lg my-6">
          <p className="text-lg leading-relaxed mb-4">
            Beyond our free public platform, we offer <strong>premium enterprise datasets</strong> that provide
            deeper insights into AI model behavior, safety vulnerabilities, and performance patterns.
          </p>
        </div>

        <h3>Available Enterprise Datasets</h3>
        
        <div className="grid md:grid-cols-2 gap-4 my-6">
          <div className="not-prose bg-slate-800 p-5 rounded-lg border border-blue-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🛡️</span>
              <h4 className="font-bold text-lg">Safety & Security Dataset</h4>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Comprehensive adversarial testing results including jailbreak attempts, prompt injection
              vulnerabilities, safety bypass patterns, and model-specific security weaknesses.
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• 10,000+ adversarial test results per month</li>
              <li>• Vulnerability profiles by model and attack type</li>
              <li>• Safety bypass success rates and patterns</li>
              <li>• Compliance-ready security reports</li>
            </ul>
          </div>

          <div className="not-prose bg-slate-800 p-5 rounded-lg border border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">⚖️</span>
              <h4 className="font-bold text-lg">Bias & Fairness Dataset</h4>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Statistical analysis of performance variations across demographic groups, gender bias indicators,
              and fairness metrics required for EU AI Act compliance.
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• 5,000+ demographic variant tests per month</li>
              <li>• Gender, ethnicity, and age bias analysis</li>
              <li>• EU AI Act compliance documentation</li>
              <li>• Fairness score reports and recommendations</li>
            </ul>
          </div>

          <div className="not-prose bg-slate-800 p-5 rounded-lg border border-orange-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🎯</span>
              <h4 className="font-bold text-lg">Robustness & Reliability Dataset</h4>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Prompt sensitivity analysis, consistency metrics across paraphrasing variations, hallucination
              patterns, and behavioral stability measurements.
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• 15,000+ prompt variation tests per month</li>
              <li>• Hallucination detection and classification</li>
              <li>• Consistency and robustness scoring</li>
              <li>• Failure mode taxonomy and examples</li>
            </ul>
          </div>

          <div className="not-prose bg-slate-800 p-5 rounded-lg border border-cyan-500/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">📊</span>
              <h4 className="font-bold text-lg">Version & Regression Dataset</h4>
            </div>
            <p className="text-sm text-slate-300 mb-3">
              Model version tracking, performance regression root cause analysis, API update correlation,
              and historical performance genealogy for all major models.
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Complete version change timeline</li>
              <li>• Regression diagnostics and root causes</li>
              <li>• Task-level performance attribution</li>
              <li>• Automated incident detection and alerts</li>
            </ul>
          </div>
        </div>

        <h3>Who Benefits from Our Enterprise Data?</h3>
        
        <div className="not-prose grid md:grid-cols-3 gap-4 my-6 text-sm">
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">🏢 AI Safety Teams</h4>
            <p className="text-slate-300">
              Red teaming, security audits, and vulnerability assessment for AI deployment strategies.
            </p>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">📋 Compliance Officers</h4>
            <p className="text-slate-300">
              EU AI Act compliance, fairness audits, and regulatory documentation requirements.
            </p>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">🔬 ML Researchers</h4>
            <p className="text-slate-300">
              Academic research, model behavior analysis, and large-scale benchmarking studies.
            </p>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">💼 Enterprise Architects</h4>
            <p className="text-slate-300">
              Model selection, vendor evaluation, and production deployment risk assessment.
            </p>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">🛡️ Security Analysts</h4>
            <p className="text-slate-300">
              Threat intelligence, vulnerability tracking, and AI security posture management.
            </p>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="font-bold mb-2">📊 Data Scientists</h4>
            <p className="text-slate-300">
              Performance optimization, cost-benefit analysis, and model comparison research.
            </p>
          </div>
        </div>

        <div className="not-prose bg-blue-900/20 border border-blue-500/50 p-6 rounded-lg my-6">
          <h4 className="font-bold text-lg mb-3">Interested in Enterprise Data Access?</h4>
          <p className="text-sm text-slate-300 mb-4">
            Our enterprise datasets are continuously updated and include historical data going back to platform launch.
            Custom data packages, API access, and dedicated support available.
          </p>
          <a
            href="https://studioplatforms.eu/products/aistupidlevel/data-licensing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            <span>View Pricing & Contact Sales</span>
            <span>→</span>
          </a>
        </div>

        <p className="text-xs text-slate-400 italic">
          Note: Enterprise data licensing revenue helps fund our free public platform and keeps us independent
          from AI vendor influence. All enterprise datasets are derived from our open methodology.
        </p>
      </section>

      <section>
        <h2>Open Source & Transparency</h2>
        
        <p>
          Transparency is our core value. Everything about how we benchmark AI models is public:
        </p>

        <div className="not-prose grid md:grid-cols-2 gap-4 my-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">📂 Full Source Code</h4>
            <p className="text-sm text-slate-300 mb-2">
              Every line of code is public on GitHub. Audit our methodology, suggest improvements, or run locally.
            </p>
            <div className="space-y-1">
              <a
                href="https://github.com/StudioPlatforms/aistupidmeter-web"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block"
              >
                Frontend (Web) →
              </a>
              <a
                href="https://github.com/StudioPlatforms/aistupidmeter-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block"
              >
                Backend (API) →
              </a>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">📊 Public API</h4>
            <p className="text-sm text-slate-300 mb-2">
              All benchmark data accessible via API. Download historical scores, confidence intervals, and trends.
            </p>
            <code className="text-xs text-green-400">GET /api/dashboard</code>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">📖 Detailed Documentation</h4>
            <p className="text-sm text-slate-300 mb-2">
              Complete technical documentation of our 7-axis scoring, CUSUM drift detection, and statistical methods.
            </p>
            <Link href="/methodology" className="text-blue-400 hover:text-blue-300 text-sm">
              Read Methodology →
            </Link>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">🔑 Test Your Keys</h4>
            <p className="text-sm text-slate-300 mb-2">
              Run benchmarks with your own API keys to verify we're not making up numbers.
            </p>
            <Link href="/test" className="text-blue-400 hover:text-blue-300 text-sm">
              Test Now →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2>Why We Built This</h2>
        
        <p>
          The AI industry moves fast—too fast for proper accountability. Models get updated silently. 
          Capabilities change without notice. Developers building products on these APIs deserve better.
        </p>

        <div className="not-prose bg-slate-800 p-6 rounded-lg my-6">
          <h3 className="text-lg font-bold mb-3">Real Problems We're Solving</h3>
          
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-red-400 font-bold mb-1">❌ Problem: Silent Model Degradation</p>
              <p className="text-slate-300">AI providers update models without announcing performance changes</p>
              <p className="text-green-400 mt-1"><strong>✓ Our Solution:</strong> Continuous monitoring with drift detection alerts</p>
            </div>

            <div>
              <p className="text-red-400 font-bold mb-1">❌ Problem: Unreliable Benchmarks</p>
              <p className="text-slate-300">Most benchmarks show single measurements without uncertainty quantification</p>
              <p className="text-green-400 mt-1"><strong>✓ Our Solution:</strong> Multiple trials with confidence intervals and statistical rigor</p>
            </div>

            <div>
              <p className="text-red-400 font-bold mb-1">❌ Problem: Vendor Marketing</p>
              <p className="text-slate-300">Official benchmarks are optimized for marketing, not real-world performance</p>
              <p className="text-green-400 mt-1"><strong>✓ Our Solution:</strong> Independent testing with no vendor relationships</p>
            </div>

            <div>
              <p className="text-red-400 font-bold mb-1">❌ Problem: No Historical Tracking</p>
              <p className="text-slate-300">Can't tell if today's score is good or if the model declined</p>
              <p className="text-green-400 mt-1"><strong>✓ Our Solution:</strong> Complete historical database with trend analysis</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Our Values</h2>
        
        <div className="grid md:grid-cols-2 gap-4 my-6">
          <div className="not-prose">
            <h3 className="font-bold text-lg mb-2">🔬 Scientific Rigor</h3>
            <p className="text-sm text-slate-300">
              We use proper statistical methods, confidence intervals, and peer-reviewed algorithms. 
              No hand-waving, no marketing fluff—just math.
            </p>
          </div>

          <div className="not-prose">
            <h3 className="font-bold text-lg mb-2">🌐 Radical Transparency</h3>
            <p className="text-sm text-slate-300">
              Everything is open source. Every decision documented. Every benchmark reproducible. 
              Trust through verification, not through claims.
            </p>
          </div>

          <div className="not-prose">
            <h3 className="font-bold text-lg mb-2">⚖️ Independence</h3>
            <p className="text-sm text-slate-300">
              No vendor funding. No affiliate revenue. No conflicts of interest. 
              Our only loyalty is to developers who need accurate data.
            </p>
          </div>

          <div className="not-prose">
            <h3 className="font-bold text-lg mb-2">🤝 Community First</h3>
            <p className="text-sm text-slate-300">
              Built by developers, for developers. We listen to feedback, accept contributions, 
              and evolve based on community needs.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Get Involved</h2>
        
        <p>AI Stupid Level is a community project. Here's how you can contribute:</p>

        <div className="not-prose grid md:grid-cols-3 gap-4 my-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">💻 Contribute Code</h4>
            <p className="text-sm text-slate-300 mb-2">
              Help improve the platform, add features, fix bugs, or enhance documentation.
            </p>
            <div className="space-y-1">
              <a
                href="https://github.com/StudioPlatforms/aistupidmeter-web/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block"
              >
                Web Issues →
              </a>
              <a
                href="https://github.com/StudioPlatforms/aistupidmeter-api/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm block"
              >
                API Issues →
              </a>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">📣 Spread the Word</h4>
            <p className="text-sm text-slate-300 mb-2">
              Share our benchmarks, cite our data, or discuss our methodology in your communities.
            </p>
            <div className="flex gap-2 mt-2">
              <a 
                href="https://twitter.com/AIStupidlevel" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Twitter
              </a>
              <span className="text-slate-600">•</span>
              <a 
                href="https://www.reddit.com/r/aistupidlevel/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Reddit
              </a>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg">
            <h4 className="font-bold mb-2">🤝 Support Us</h4>
            <p className="text-sm text-slate-300 mb-2">
              Help keep our servers running and benchmarks free for everyone.
            </p>
            <p className="text-sm text-slate-400 italic">
              Coming soon: Sponsorship options
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Contact & Social</h2>
        
        <div className="not-prose bg-slate-800 p-6 rounded-lg my-6">
          <h3 className="font-bold mb-4">Connect With Us</h3>
          
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-bold mb-2">For General Inquiries</h4>
              <ul className="space-y-1">
                <li>• <a href="https://x.com/GOATGameDev" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Twitter/X: @GOATGameDev</a></li>
                <li>• <a href="https://github.com/ionutvi/aistupidlevel.info" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">GitHub: ionutvi/aistupidlevel.info</a></li>
                <li>• <a href="https://www.reddit.com/r/aistupidlevel/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Reddit: r/aistupidlevel</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-2">For Technical Questions</h4>
              <ul className="space-y-1">
                <li>• <Link href="/faq" className="text-blue-400 hover:text-blue-300">Read our FAQ</Link></li>
                <li>• <Link href="/methodology" className="text-blue-400 hover:text-blue-300">Review methodology docs</Link></li>
                <li>• <a href="https://github.com/ionutvi/aistupidlevel.info/discussions" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">GitHub Discussions</a></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="not-prose bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/50 p-6 rounded-lg my-8">
        <h2 className="text-2xl font-bold mb-4">Ready to Explore?</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <Link href="/" className="bg-slate-800 hover:bg-slate-700 p-4 rounded-lg transition-colors">
            <h3 className="font-bold mb-1">📊 View Rankings</h3>
            <p className="text-slate-300">See current AI model performance scores</p>
          </Link>

          <Link href="/methodology" className="bg-slate-800 hover:bg-slate-700 p-4 rounded-lg transition-colors">
            <h3 className="font-bold mb-1">🔬 Learn Methodology</h3>
            <p className="text-slate-300">Understand how we benchmark AI models</p>
          </Link>

          <Link href="/test" className="bg-slate-800 hover:bg-slate-700 p-4 rounded-lg transition-colors">
            <h3 className="font-bold mb-1">🔑 Test Your Keys</h3>
            <p className="text-slate-300">Verify benchmarks with your API keys</p>
          </Link>
        </div>
      </section>

      {/* Organization Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "AI Stupid Level",
            "alternateName": "aistupidlevel.info",
            "url": "https://aistupidlevel.info",
            "logo": "https://aistupidlevel.info/logo.png",
            "description": "Independent AI benchmarking platform providing transparent, statistically-rigorous performance monitoring for AI models",
            "foundingDate": "2024",
            "founder": {
              "@type": "Person",
              "name": "The Architect",
              "url": "https://x.com/GOATGameDev"
            },
            "sameAs": [
              "https://twitter.com/AIStupidlevel",
              "https://github.com/ionutvi/aistupidlevel.info",
              "https://www.reddit.com/r/aistupidlevel/"
            ],
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "Technical Support",
              "url": "https://github.com/ionutvi/aistupidlevel.info/issues"
            }
          })
        }}
      />
    </article>
  );
}
