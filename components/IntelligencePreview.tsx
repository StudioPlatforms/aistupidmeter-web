'use client';

import { ENTRY_PAID_PLAN, monthlyLong } from '@/lib/pricing-display';
import { upgradeHref } from '@/lib/checkout-url';
import { PLANS } from '@/lib/entitlements';

import { useEffect, useState, type CSSProperties } from 'react';
import { slugifyModelName } from '../lib/model-slug';
import { PageHead, Pane, Stats, Stat, CountUp, Loader, Tag, Pill, ProviderMark, PROVIDER_LABEL } from '@/components/studio';
import '@/styles/studio-intel.css';

interface Model {
  id: string;
  name: string;
  displayName?: string;
  provider: string;
  currentScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

/** The page's lead, shared by the Pro view, the access check and this preview so the header never changes under the reader. */
export const INTEL_LEAD = 'Live benchmark scores, analytics and comparison tools for every model we track.';

/** "openai" → "OpenAI", as on the landing page; unknown providers are capitalised. */
export const providerName = (p: string): string =>
  PROVIDER_LABEL[(p || '').toLowerCase()] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1) : '');

const TRENDS: Record<string, { label: string; tone?: 'good' | 'bad' }> = {
  up: { label: 'Trending up', tone: 'good' },
  down: { label: 'Trending down', tone: 'bad' },
  stable: { label: 'Stable' },
};

/** A model's score trend as a tag: up, down, or stable (anything else reads as stable, as before). */
export function TrendTag({ trend }: { trend: string }) {
  const t = TRENDS[trend] ?? TRENDS.stable;
  return <Tag tone={t.tone}>{t.label}</Tag>;
}

export interface IntelCardProps {
  name: string;
  provider: string;
  /** null when the model has no current score. */
  score: number | null;
  rank: number;
  trend: string;
  category?: string;
  href: string;
  /** Key for the reorder slide (the page measures cards by it). */
  flipKey?: string;
  selected?: boolean;
  /** Four models are already selected and this is not one of them. */
  capped?: boolean;
  /** Omitted on the Free preview: no compare control, the card is not selectable. */
  onToggle?: () => void;
  onDownload: () => void;
  /** Free preview: Download leads to the upgrade, marked Pro. */
  downloadLocked?: boolean;
}

/**
 * One model on the rankings grid: leaderboard rank, provider mark, name, score with its trend and a
 * bar of it out of 100, and the actions. On the Pro view the whole card toggles it into the
 * comparison (as before); the Compare pill is the same toggle for keyboard and screen readers.
 */
export function IntelCard({ name, provider, score, rank, trend, category, href, flipKey, selected, capped, onToggle, onDownload, downloadLocked }: IntelCardProps) {
  const pct = score === null ? 0 : Math.min(100, Math.max(0, score));
  const cls = ['si-card', selected && 'is-on', capped && 'is-capped', !onToggle && 'is-static'].filter(Boolean).join(' ');
  return (
    <article className={cls} data-flip={flipKey} onClick={onToggle && !capped ? onToggle : undefined}>
      <div className="si-card-top">
        <Tag tone="accent">#{rank}</Tag>
        {onToggle && (
          <button
            type="button"
            className="si-pick"
            aria-pressed={!!selected}
            disabled={capped}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            <span className="si-pick-box" aria-hidden="true" />
            Compare<span className="st-sr"> {name}</span>
          </button>
        )}
      </div>
      <div className="si-card-id">
        <ProviderMark provider={provider} />
        <div>
          <h3 className="si-card-name">{name}</h3>
          <p className="si-card-sub">{providerName(provider)}{category ? ` · ${category}` : ''}</p>
        </div>
      </div>
      <div className="si-card-mid">
        <span className="si-score">{score === null ? 'N/A' : score.toFixed(1)}</span>
        <TrendTag trend={trend} />
      </div>
      <div className="si-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <div className="si-card-act">
        <a href={href} className="st-btn is-sm" onClick={(e) => e.stopPropagation()}>View details</a>
        <button type="button" className="st-btn is-sm is-quiet" onClick={(e) => { e.stopPropagation(); onDownload(); }}>
          Download{downloadLocked && <Tag tone="accent">Pro</Tag>}
        </button>
      </div>
    </article>
  );
}

const BENEFITS = [
  { title: 'Model comparison', desc: 'Compare up to 4 models with overlaid charts and detailed analytics' },
  { title: 'Data export', desc: 'Download comprehensive model data in CSV or JSON format' },
  { title: 'Advanced filters', desc: 'Filter by category, provider, test type, and custom time periods' },
  { title: 'Historical trends', desc: 'View 30-day performance trends and identify degradation patterns' },
];

export default function IntelligencePreview() {
  const [models, setModels] = useState<Model[]>([]);
  // The whole field, not just the eight cards shown: "Live models 8" undercounted what we track.
  const [field, setField] = useState<{ models: number; providers: number }>({ models: 0, providers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopModels();
  }, []);

  const fetchTopModels = async () => {
    try {
      const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
      // This preview is what non-paying accounts see, so it reads the 24-hour view: the newest run is
      // a paid view (lib/capabilities 'latest-scores').
      const response = await fetch(`${apiUrl}/dashboard/scores?period=24h&sortBy=combined`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const topModels = data.data.slice(0, 8).map((model: any, index: number) => ({
            id: model.id,
            name: model.name,
            displayName: model.displayName || model.name,
            provider: model.provider,
            currentScore: typeof model.currentScore === 'number' ? model.currentScore : 0,
            rank: index + 1,
            trend: model.trend || 'stable',
          }));
          setModels(topModels);
          setField({ models: data.data.length, providers: new Set(data.data.map((m: any) => m.provider)).size });
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = () => {
    window.location.href = upgradeHref(ENTRY_PAID_PLAN, 'monthly');
  };

  const trialButton = (label: string, cls: string) => (
    <button type="button" onClick={handleStartTrial} className={cls}>
      {label} <span className="st-ar" aria-hidden="true">→</span>
    </button>
  );

  const skel = <span className="st-skel si-skel" aria-hidden="true" />;

  return (
    <>
      <PageHead kicker="Monitoring" title="Model intelligence" lead={INTEL_LEAD} />

      <div className="st-body">
        {/* Preview notice: sticks under the top edge on wide screens, as the old banner did. */}
        <div className="si-lockbar" role="note">
          <Tag tone="accent">Preview</Tag>
          <div className="si-lockbar-t">
            <b>Preview mode: intelligence features are locked</b>
            <span>Unlock model comparison, downloads, and advanced analytics with Pro</span>
          </div>
          {trialButton('Start free trial', 'st-btn is-primary')}
        </div>

        <Stats columns={4}>
          <Stat value={loading ? skel : <CountUp value={field.models} />} label="Live models" />
          <Stat value={loading ? skel : <CountUp value={field.providers} />} label="Providers" />
          <Stat value="175K+" label="Scores recorded" tone="accent" />
          <Stat value="61K+" label="Tool sessions" />
        </Stats>

        {/* Live model rankings: visible on Free. */}
        <Pane title="Model rankings" sub="Average over the last 24 hours · the latest run is part of Pro" actions={<Pill tone="good" live>Live</Pill>}>
          {loading ? (
            <Loader label="Loading model data" />
          ) : (
            <div className="si-grid">
              {models.map((model) => (
                <IntelCard
                  key={model.id}
                  name={model.displayName || model.name}
                  provider={model.provider}
                  score={model.currentScore}
                  rank={model.rank}
                  trend={model.trend}
                  href={`/models/${slugifyModelName(model.name) || model.id}`}
                  onDownload={handleStartTrial}
                  downloadLocked
                />
              ))}
            </div>
          )}
        </Pane>

        {/* Locked features */}
        <div className="st-grid is-stretch">
          <section className="st-pane si-locked st-up">
            <div className="si-locked-art" aria-hidden="true">
              <p className="st-label">Comparison tool</p>
              <svg viewBox="0 0 320 110" preserveAspectRatio="none">
                <g stroke="var(--lp-line)" strokeWidth="1">
                  <line x1="0" y1="18" x2="320" y2="18" />
                  <line x1="0" y1="55" x2="320" y2="55" />
                  <line x1="0" y1="92" x2="320" y2="92" />
                </g>
                <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="0,62 40,54 80,58 120,40 160,46 200,30 240,36 280,22 320,26" stroke="var(--si-s1)" />
                  <polyline points="0,80 40,76 80,82 120,66 160,70 200,58 240,64 280,50 320,54" stroke="var(--si-s2)" />
                  <polyline points="0,98 40,90 80,94 120,86 160,78 200,82 240,72 280,76 320,66" stroke="var(--si-s3)" />
                </g>
              </svg>
            </div>
            <div className="si-locked-copy">
              <Tag tone="accent">Pro</Tag>
              <h3 className="si-locked-t">Unlock model comparison</h3>
              <p>Compare up to 4 models side-by-side with overlaid performance charts and deep analytics</p>
              {trialButton('Start free trial', 'st-btn is-primary')}
            </div>
          </section>

          <section className="st-pane si-locked st-up" style={{ '--d': '.06s' } as CSSProperties}>
            <div className="si-locked-art is-filters" aria-hidden="true">
              {['Category', 'Provider', 'Sort by', 'Time period'].map((f) => <span key={f}>{f}</span>)}
            </div>
            <div className="si-locked-copy">
              <Tag tone="accent">Pro</Tag>
              <h3 className="si-locked-t">Unlock advanced filters</h3>
              <p>Filter by category, provider, test type, and time period for targeted analysis</p>
              {trialButton('Start free trial', 'st-btn is-primary')}
            </div>
          </section>
        </div>

        {/* Upgrade */}
        <section className="st-pane is-accent st-lock st-up">
          <div className="st-lock-main">
            <p className="st-kicker">{PLANS[ENTRY_PAID_PLAN].label}</p>
            <h2 className="st-lock-t">Unlock full intelligence</h2>
            <p className="st-lock-price">{monthlyLong(ENTRY_PAID_PLAN)}</p>
            <p className="si-trial">7-day free trial · Cancel anytime</p>
            <div className="st-actions">
              {trialButton('Unlock intelligence now', 'st-btn is-primary is-lg')}
            </div>
          </div>
          <div className="st-lock-side">
            <p className="st-label">What you unlock</p>
            <ul className="st-lock-list">
              {BENEFITS.map((b) => (
                <li key={b.title}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div><b>{b.title}</b><span>{b.desc}</span></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="si-foot">Data sourced from AI Stupid Level · Real-time benchmarks · <a href="/">View main site</a></p>
      </div>
    </>
  );
}
