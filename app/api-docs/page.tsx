import type { Metadata } from 'next';
import Link from 'next/link';
import EnterpriseContact from '@/components/EnterpriseContact';
import { ReadingPage, RdSection, RdProse, RdFacts, RdCode, RdFinal, highlightCode, tocNumber } from '@/components/landing/Reading';
import { DATA_API_LIMITS } from '@/lib/entitlements';
import '@/styles/data-api.css';

/** How each Data API tier is obtained. The limits themselves come from the plan table. */
const HOW_TO_GET: Record<'free' | 'pro' | 'developer' | 'teams' | 'enterprise', string> = {
  free: 'Sign up and create a key',
  pro: 'Included with Pro',
  developer: 'Included with Developer',
  teams: 'Included with Teams',
  enterprise: 'By arrangement — see below',
};

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
  { path: 'GET /api/v1/drift/:id', desc: 'Drift signature for one model: Page-Hinkley statistic, regime and per-axis trends.' },
  { path: 'GET /api/v1/me', desc: 'Your key, its tier, and your current quota.' },
];

const ERRORS: [string, string, string][] = [
  ['400', 'invalid_model_id', 'The model id in the path is malformed.'],
  ['401', 'api_key_required', 'No key was sent.'],
  ['401', 'invalid_api_key', 'The key is unknown or has been revoked.'],
  ['404', 'model_not_found', 'No such model.'],
  ['429', 'quota_exceeded', 'Daily quota spent. Resets at 00:00 UTC.'],
];

const CURL = `curl -H "Authorization: Bearer asl_live_your_key_here" \\
  "https://aistupidlevel.info/api/v1/models?period=24h&sortBy=combined"`;

const RESPONSE = `{
  "success": true,
  "version": "1.0.0",
  "generated_at": "2026-09-04T07:48:00.000Z",
  "license": "Attribution required — cite aistupidlevel.info as the source.",
  "period": "24h",
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
}`;


const TOC = [
  { id: 'why', label: 'Why this needs a key' },
  { id: 'auth', label: 'Authentication' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'params', label: 'Query parameters' },
  { id: 'response', label: 'Response shape' },
  { id: 'limits', label: 'Rate limits' },
  { id: 'enterprise', label: 'Enterprise access' },
  { id: 'errors', label: 'Errors' },
  { id: 'terms', label: 'Terms of use' },
];
const num = (id: string) => tocNumber(TOC, id);

/**
 * The Data API reference in the landing page's look (components/landing/Reading.tsx), with the
 * landing's code cards for the samples. Every limit is read from the shared plan table.
 */
export default function ApiDocsPage() {
  return (
    <ReadingPage
      className="rd-api"
      kicker="Data API"
      title="Public Data API"
      accent="Free, keyed, versioned"
      lead="Live AI model benchmark data as JSON: rankings, the global intelligence index, degradation alerts, drift signatures and provider reliability."
      actions={(
        <>
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/account/data-keys">Get a free API key <span className="lp-ar" aria-hidden="true">→</span></Link>
          <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#endpoints">See the endpoints</a>
        </>
      )}
      aside={(
        <div className="lp-codecard da-hero-code">
          <div className="lp-cc-head"><b>GET /api/v1/models</b><span>asl_ key</span></div>
          <pre className="lp-code">{highlightCode(`curl "https://aistupidlevel.info/api/v1/models?period=24h" \\
  -H "X-API-Key: $ASL_DATA_KEY"`)}</pre>
          <pre className="lp-code">{highlightCode(`{
  "success": true,
  "period": "24h",
  "sort_by": "combined",
  "data": [
    { "name": "gpt-5.6-sol", "currentScore": 75,
      "confidenceLower": 76.2, "confidenceUpper": 84.6, … }
  ]
}`)}</pre>
        </div>
      )}
      toc={TOC}
      final={(
        <RdFinal
          title="Create your free key"
          lead="It costs nothing and takes about thirty seconds. Then add one header."
          actions={(
            <>
              <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/account/data-keys">Create your free key <span className="lp-ar" aria-hidden="true">→</span></Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/methodology">How the scores are produced</Link>
            </>
          )}
        />
      )}
    >
      <RdSection id="why" n={num('why')} title="Why this needs a key now">
        <RdProse>
          <p>
            These endpoints used to be open, and plenty of people built genuinely good things on
            them — status bars, dashboards, monitoring bots. That open access also got used to
            re-publish the rankings wholesale as other people&apos;s leaderboards, with no
            attribution and no way for us to tell one from the other.
          </p>
          <p>
            A key fixes exactly that: it costs nothing, takes about thirty seconds, and turns an
            anonymous user-agent string into something we can rate-limit, contact and — if it turns
            out to be a mirror rather than a client — revoke. If you were using the old open
            endpoints, create a key and add one header. Nothing else changes.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="auth" n={num('auth')} title="Authentication">
        <RdProse>
          <h3>Bearer token</h3>
          <p>
            Send your key in the <code>Authorization</code> header. An <code>X-API-Key</code> header
            works too if a bearer token is awkward in your client.
          </p>
        </RdProse>
        <RdCode title="Request" label="curl" code={CURL} />
        <RdCode title="Base URL" code="https://aistupidlevel.info/api/v1" />
      </RdSection>

      <RdSection id="endpoints" n={num('endpoints')} title="Endpoints">
        <ul className="da-eps lp-up">
          {ENDPOINTS.map((e) => {
            const [method, path] = e.path.split(' ');
            return (
              <li key={e.path}>
                <span className="da-m">{method}</span>
                <code className="da-path">{path}</code>
                <p>{e.desc}</p>
                <span className="da-q">
                  {e.params
                    ? e.params.split(', ').map((p) => <code key={p}>{p}</code>)
                    : <span className="da-none" aria-label="No query parameters">—</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </RdSection>

      <RdSection id="params" n={num('params')} title="Query parameters">
        <RdFacts rows={[
          [<code key="p">period</code>, <>One of <code>latest</code>, <code>24h</code>, <code>7d</code>, <code>1m</code>. The latest run is part of the paid plans: a paid key defaults to <code>latest</code>, while a free key defaults to <code>24h</code> and gets a 403 with <code>latest_requires_plan</code> when it asks for <code>latest</code>. On a free key, <code>/models/:id</code> leaves out <code>latestScore</code>.</>],
          [<code key="s">sortBy</code>, <>One of <code>combined</code>, <code>reasoning</code>, <code>speed</code>, <code>price</code>, <code>coding</code>, <code>7axis</code>, <code>tooling</code>. Defaults to <code>combined</code>.</>],
        ]} />
      </RdSection>

      <RdSection id="response" n={num('response')} title="Response shape" lead="Every successful response uses the same envelope.">
        <RdCode title="200 OK" label="application/json" code={RESPONSE} />
      </RdSection>

      <RdSection id="limits" n={num('limits')} title="Rate limits">
        {/* Rendered from the shared limit table so the docs cannot drift from what the rate limiter
            enforces. The hand-written version of this table had lost the Teams row entirely. */}
        <div className="rd-table-wrap is-narrow lp-up">
          <table className="rd-table da-tiers">
            <thead><tr><th>Tier</th><th className="num">Per day</th><th className="num">Per minute</th><th>How to get it</th></tr></thead>
            <tbody>
              {(['free', 'pro', 'developer', 'teams', 'enterprise'] as const).map((tier) => (
                <tr key={tier}>
                  <th scope="row">{DATA_API_LIMITS[tier].label}</th>
                  <td className="num">{DATA_API_LIMITS[tier].daily.toLocaleString()}</td>
                  <td className="num">{DATA_API_LIMITS[tier].perMinute.toLocaleString()}</td>
                  <td className="muted">{HOW_TO_GET[tier]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <RdProse>
          <p>
            <b>Free is an evaluation tier.</b> Ten calls a day is enough to wire a client up and see
            real data come back — it is not enough to poll on a schedule. Anything that refreshes by
            itself needs Pro.
          </p>
          <p>
            Every response carries <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and{' '}
            <code>X-RateLimit-Reset</code>. The daily quota resets at 00:00 UTC. Over quota returns{' '}
            <code>429</code> with a JSON body explaining which limit you hit.
          </p>
          <p>
            Scores update roughly hourly, so cache on your side rather than polling. One request an
            hour is plenty to stay current, and it keeps a Pro key nowhere near its ceiling.
          </p>
        </RdProse>
      </RdSection>

      <RdSection id="enterprise" n={num('enterprise')} title="Enterprise access">
        <div className="da-ent lp-up">
          <p>
            Enterprise is not sold through a checkout — there is nothing to buy on this page. If you
            need volume beyond Pro, a commercial redistribution licence, or a guarantee we will not
            change something under you, get in touch and we will sort out limits that fit what you
            are actually building.
          </p>
          <EnterpriseContact variant="landing" label="Email us about Enterprise" />
        </div>
      </RdSection>

      <RdSection id="errors" n={num('errors')} title="Errors">
        <div className="rd-table-wrap is-narrow lp-up">
          <table className="rd-table da-errors">
            <thead><tr><th>Status</th><th>Code</th><th>Meaning</th></tr></thead>
            <tbody>
              {ERRORS.map(([status, code, meaning]) => (
                <tr key={code}>
                  <th scope="row" className="num da-status">{status}</th>
                  <td><code>{code}</code></td>
                  <td className="muted">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RdSection>

      <RdSection id="terms" n={num('terms')} title="Terms of use">
        <RdProse>
          <p>
            <b>Attribution is required.</b> Anywhere you display this data, cite aistupidlevel.info as
            the source with a link.
          </p>
          <p>
            Do not republish the rankings as your own leaderboard, and do not resell the data. Use one
            key per application rather than sharing a key across products. Keys that behave like a
            mirror rather than a client can be revoked without notice.
          </p>
          <p>
            Building something that needs to run on a schedule? That is what Pro is for. Building
            something bigger than Pro, or that redistributes the data? Talk to us first — we would
            much rather agree terms with you than find out from the logs.
          </p>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
