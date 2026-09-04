import type { Metadata } from 'next';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import EnterpriseContact from '@/components/EnterpriseContact';

export const metadata: Metadata = {
  title: 'Public Data API | Live AI Model Benchmark Data',
  description:
    'Free, keyed REST API for live AI model benchmark data: rankings, global intelligence index, degradation alerts, drift signatures and provider reliability for GPT, Claude, Gemini, DeepSeek, Kimi and GLM.',
  keywords: [
    'AI benchmark API',
    'LLM leaderboard API',
    'AI model performance API',
    'free LLM data API',
    'AI degradation detection API',
    'model drift API',
    'GPT Claude Gemini benchmark data',
  ],
  alternates: { canonical: '/api-docs' },
  openGraph: {
    title: 'Public Data API | Live AI Model Benchmark Data',
    description:
      'Free REST API for live AI model rankings, degradation alerts and drift data. Create a key in seconds.',
    url: 'https://aistupidlevel.info/api-docs',
    type: 'article',
  },
};

const s = {
  page: {
    background: 'var(--terminal-black, #f6f8fc)',
    minHeight: '100vh',
    fontFamily: 'var(--font-mono, "Courier New", monospace)',
    color: 'var(--phosphor-dim)',
  } as React.CSSProperties,
  container: { maxWidth: '900px', margin: '0 auto', padding: '32px 20px 80px' } as React.CSSProperties,
  pageTitle: {
    fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 'bold',
    color: 'var(--phosphor-green, #1a73e8)', letterSpacing: '2px',
    textShadow: '0 0 8px rgba(26, 115, 232,0.4)', margin: '0 0 8px', textAlign: 'center' as const,
  } as React.CSSProperties,
  pageSub: {
    fontSize: '12px', color: 'var(--phosphor-dim, #5f6368)', marginBottom: '28px',
    letterSpacing: '0.3px', lineHeight: '1.5', textAlign: 'center' as const,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '11px', fontWeight: 'bold', color: 'var(--amber-warning, #ffb000)',
    textTransform: 'uppercase' as const, letterSpacing: '1.5px', margin: '28px 0 12px',
    display: 'flex', alignItems: 'center', gap: '8px',
  } as React.CSSProperties,
  panel: {
    background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px', padding: '14px 16px', marginBottom: '12px',
  } as React.CSSProperties,
  panelTitle: {
    fontSize: '11px', fontWeight: 'bold', color: 'var(--phosphor-green)',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '8px',
  } as React.CSSProperties,
  text: { fontSize: '11px', color: 'var(--phosphor-dim)', lineHeight: '1.65' } as React.CSSProperties,
  code: {
    display: 'block', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(192,192,192,0.15)',
    borderRadius: '3px', padding: '10px 12px', fontSize: '10.5px', lineHeight: 1.6,
    color: 'var(--phosphor-green)', overflowX: 'auto' as const, whiteSpace: 'pre' as const, margin: '8px 0 0',
  } as React.CSSProperties,
  inline: {
    background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '2px',
    fontSize: '10.5px', color: 'var(--phosphor-green)',
  } as React.CSSProperties,
  cta: {
    display: 'inline-block', fontSize: '11px', fontWeight: 'bold', padding: '8px 16px',
    background: 'rgba(26, 115, 232,0.1)', border: '1px solid rgba(26, 115, 232,0.4)',
    color: 'var(--phosphor-green)', textDecoration: 'none', borderRadius: '3px', letterSpacing: '0.5px',
  } as React.CSSProperties,
  tableWrap: { overflowX: 'auto' as const, marginBottom: '12px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '10.5px', minWidth: '520px' } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '7px 10px', color: 'var(--amber-warning)',
    borderBottom: '1px solid rgba(192,192,192,0.2)', fontWeight: 'bold',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '7px 10px', borderBottom: '1px solid rgba(192,192,192,0.08)',
    color: 'var(--phosphor-dim)', verticalAlign: 'top' as const,
  } as React.CSSProperties,
  divider: { borderTop: '1px solid rgba(192,192,192,0.15)', margin: '28px 0' } as React.CSSProperties,
};

const ENDPOINTS: Array<{ path: string; desc: string; params?: string }> = [
  { path: 'GET /api/v1/models', desc: 'Current rankings with scores, trends and confidence intervals.', params: 'period, sortBy' },
  { path: 'GET /api/v1/models/:id', desc: 'Detail for one model, including per-axis breakdown.' },
  { path: 'GET /api/v1/models/:id/history', desc: 'Score time-series for one model.', params: 'period' },
  { path: 'GET /api/v1/index', desc: 'Global intelligence index — the aggregate score across all tracked models, with history.' },
  { path: 'GET /api/v1/alerts', desc: 'Active performance alerts for models scoring below their baseline.' },
  { path: 'GET /api/v1/incidents', desc: 'Recorded degradation incidents.', params: 'period, limit' },
  { path: 'GET /api/v1/providers', desc: 'Provider-level availability and status.' },
  { path: 'GET /api/v1/analytics/degradations', desc: 'Models currently degrading, with magnitude and direction.', params: 'period' },
  { path: 'GET /api/v1/analytics/recommendations', desc: 'Which model to use right now, by task type.', params: 'period' },
  { path: 'GET /api/v1/analytics/provider-reliability', desc: 'Reliability scoring per provider.', params: 'period' },
  { path: 'GET /api/v1/analytics/transparency', desc: 'Full scoring transparency data.', params: 'period' },
  { path: 'GET /api/v1/drift/:id', desc: 'CUSUM drift signature for one model.' },
  { path: 'GET /api/v1/me', desc: 'Your key, its tier, and your current quota.' },
];

export default function ApiDocsPage() {
  return (
    <SubpageLayout>
      <div style={s.page}>
        <div style={s.container}>
          <h1 style={s.pageTitle}>PUBLIC DATA API</h1>
          <p style={s.pageSub}>
            Live AI model benchmark data as JSON. Free, keyed, and versioned.
          </p>

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Link href="/router/data-keys" style={s.cta}>GET A FREE API KEY →</Link>
          </div>

          {/* Why a key */}
          <h2 style={s.sectionTitle}>▸ WHY THIS NEEDS A KEY NOW</h2>
          <div style={s.panel}>
            <p style={s.text}>
              These endpoints used to be open, and plenty of people built genuinely good things on
              them — status bars, dashboards, monitoring bots. That open access also got used to
              re-publish the rankings wholesale as other people&apos;s leaderboards, with no
              attribution and no way for us to tell one from the other.
            </p>
            <p style={{ ...s.text, marginTop: '8px' }}>
              A key fixes exactly that: it costs nothing, takes about thirty seconds, and turns an
              anonymous user-agent string into something we can rate-limit, contact and — if it turns
              out to be a mirror rather than a client — revoke. If you were using the old open
              endpoints, create a key and add one header. Nothing else changes.
            </p>
          </div>

          {/* Auth */}
          <h2 style={s.sectionTitle}>▸ AUTHENTICATION</h2>
          <div style={s.panel}>
            <div style={s.panelTitle}>Bearer token</div>
            <p style={s.text}>
              Send your key in the <code style={s.inline}>Authorization</code> header. An{' '}
              <code style={s.inline}>X-API-Key</code> header works too if a bearer token is awkward
              in your client.
            </p>
            <code style={s.code}>{`curl -H "Authorization: Bearer asl_live_your_key_here" \\
  "https://aistupidlevel.info/api/v1/models?period=latest&sortBy=combined"`}</code>
          </div>

          <div style={s.panel}>
            <div style={s.panelTitle}>Base URL</div>
            <code style={s.code}>https://aistupidlevel.info/api/v1</code>
          </div>

          {/* Endpoints */}
          <h2 style={s.sectionTitle}>▸ ENDPOINTS</h2>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Endpoint</th>
                  <th style={s.th}>Description</th>
                  <th style={s.th}>Query</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.path}>
                    <td style={{ ...s.td, whiteSpace: 'nowrap', color: 'var(--phosphor-green)', fontWeight: 'bold' }}>{e.path}</td>
                    <td style={s.td}>{e.desc}</td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{e.params || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={s.panel}>
            <div style={s.panelTitle}>Query parameters</div>
            <p style={s.text}>
              <code style={s.inline}>period</code> — one of <code style={s.inline}>latest</code>,{' '}
              <code style={s.inline}>24h</code>, <code style={s.inline}>7d</code>,{' '}
              <code style={s.inline}>1m</code>. Defaults to <code style={s.inline}>latest</code>.
            </p>
            <p style={{ ...s.text, marginTop: '6px' }}>
              <code style={s.inline}>sortBy</code> — one of <code style={s.inline}>combined</code>,{' '}
              <code style={s.inline}>reasoning</code>, <code style={s.inline}>speed</code>,{' '}
              <code style={s.inline}>price</code>, <code style={s.inline}>coding</code>,{' '}
              <code style={s.inline}>7axis</code>, <code style={s.inline}>tooling</code>. Defaults to{' '}
              <code style={s.inline}>combined</code>.
            </p>
          </div>

          {/* Response */}
          <h2 style={s.sectionTitle}>▸ RESPONSE SHAPE</h2>
          <div style={s.panel}>
            <p style={s.text}>Every successful response uses the same envelope.</p>
            <code style={s.code}>{`{
  "success": true,
  "version": "1.0.0",
  "generated_at": "2026-09-04T07:48:00.000Z",
  "license": "Attribution required — cite aistupidlevel.info as the source.",
  "period": "latest",
  "sort_by": "combined",
  "count": 152,
  "data": [
    {
      "id": "275",
      "name": "gpt-5.6-sol",
      "provider": "openai",
      "currentScore": 75,
      "trend": "up",
      "status": "good",
      "confidenceLower": 76.2,
      "confidenceUpper": 84.6,
      "lastUpdated": "2026-09-04T06:54:01.041Z"
    }
  ]
}`}</code>
          </div>

          {/* Rate limits */}
          <h2 style={s.sectionTitle}>▸ RATE LIMITS</h2>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Tier</th>
                  <th style={s.th}>Per day</th>
                  <th style={s.th}>Per minute</th>
                  <th style={s.th}>How to get it</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...s.td, color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Free</td>
                  <td style={s.td}>10</td>
                  <td style={s.td}>1</td>
                  <td style={s.td}>Sign up and create a key</td>
                </tr>
                <tr>
                  <td style={{ ...s.td, color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Pro</td>
                  <td style={s.td}>10,000</td>
                  <td style={s.td}>60</td>
                  <td style={s.td}>Included with a Pro subscription</td>
                </tr>
                <tr>
                  <td style={{ ...s.td, color: 'var(--phosphor-green)', fontWeight: 'bold' }}>Enterprise</td>
                  <td style={s.td}>250,000</td>
                  <td style={s.td}>1,000</td>
                  <td style={s.td}>By arrangement — see below</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={s.panel}>
            <p style={s.text}>
              <strong style={{ color: 'var(--phosphor-green)' }}>Free is an evaluation tier.</strong>{' '}
              Ten calls a day is enough to wire a client up and see real data come back — it is not
              enough to poll on a schedule. Anything that refreshes by itself needs Pro.
            </p>
            <p style={{ ...s.text, marginTop: '8px' }}>
              Every response carries <code style={s.inline}>X-RateLimit-Limit</code>,{' '}
              <code style={s.inline}>X-RateLimit-Remaining</code> and{' '}
              <code style={s.inline}>X-RateLimit-Reset</code>. The daily quota resets at 00:00 UTC.
              Over quota returns <code style={s.inline}>429</code> with a JSON body explaining which
              limit you hit.
            </p>
            <p style={{ ...s.text, marginTop: '8px' }}>
              Scores update roughly hourly, so cache on your side rather than polling. One request an
              hour is plenty to stay current, and it keeps a Pro key nowhere near its ceiling.
            </p>
          </div>

          <div id="enterprise" style={{ ...s.panel, background: 'rgba(26, 115, 232,0.06)' }}>
            <div style={s.panelTitle}>Enterprise access</div>
            <p style={s.text}>
              Enterprise is not sold through a checkout — there is nothing to buy on this page. If
              you need volume beyond Pro, a commercial redistribution licence, or a guarantee we
              will not change something under you, get in touch and we will sort out limits that fit
              what you are actually building.
            </p>
            <div style={{ marginTop: '12px' }}>
              <EnterpriseContact label="Email us about Enterprise" />
            </div>
          </div>

          {/* Errors */}
          <h2 style={s.sectionTitle}>▸ ERRORS</h2>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={s.td}>400</td><td style={s.td}><code style={s.inline}>invalid_model_id</code></td><td style={s.td}>The model id in the path is malformed.</td></tr>
                <tr><td style={s.td}>401</td><td style={s.td}><code style={s.inline}>api_key_required</code></td><td style={s.td}>No key was sent.</td></tr>
                <tr><td style={s.td}>401</td><td style={s.td}><code style={s.inline}>invalid_api_key</code></td><td style={s.td}>The key is unknown or has been revoked.</td></tr>
                <tr><td style={s.td}>404</td><td style={s.td}><code style={s.inline}>model_not_found</code></td><td style={s.td}>No such model.</td></tr>
                <tr><td style={s.td}>429</td><td style={s.td}><code style={s.inline}>quota_exceeded</code></td><td style={s.td}>Daily quota spent. Resets at 00:00 UTC.</td></tr>
              </tbody>
            </table>
          </div>

          {/* Terms */}
          <h2 style={s.sectionTitle}>▸ TERMS OF USE</h2>
          <div style={s.panel}>
            <p style={s.text}>
              <strong style={{ color: 'var(--phosphor-green)' }}>Attribution is required.</strong>{' '}
              Anywhere you display this data, cite aistupidlevel.info as the source with a link.
            </p>
            <p style={{ ...s.text, marginTop: '8px' }}>
              Do not republish the rankings as your own leaderboard, and do not resell the data. Use
              one key per application rather than sharing a key across products. Keys that behave
              like a mirror rather than a client can be revoked without notice.
            </p>
            <p style={{ ...s.text, marginTop: '8px' }}>
              Building something that needs to run on a schedule? That is what Pro is for. Building
              something bigger than Pro, or that redistributes the data? Talk to us first — we would
              much rather agree terms with you than find out from the logs.
            </p>
          </div>

          <div style={s.divider} />

          <div style={{ textAlign: 'center' }}>
            <Link href="/router/data-keys" style={s.cta}>CREATE YOUR FREE KEY →</Link>
            <p style={{ ...s.text, marginTop: '12px' }}>
              See also: <Link href="/methodology" style={{ color: 'var(--phosphor-green)', fontWeight: 'bold' }}>how the scores are produced</Link>
            </p>
          </div>
        </div>
      </div>
    </SubpageLayout>
  );
}
