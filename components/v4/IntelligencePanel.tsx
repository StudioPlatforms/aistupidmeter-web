'use client';

import Link from 'next/link';
import { routerPrice } from '@/lib/pricing-display';

import { SAVINGS_PCT } from '@/lib/savings-estimate';

import { useSession } from 'next-auth/react';
import { isVolatile } from '../../lib/fleet-buckets';
import ProviderLogo from '../ProviderLogo';
import { openIncidents, providerIncidentLabel } from '@/lib/incidents';
import { Locked } from '../studio';
import { PLANS } from '@/lib/entitlements';
import { REQUIRED_PLAN } from '@/lib/capabilities';
import '../../styles/studio-boards.css';

interface IntelligencePanelProps {
  recommendations: any;
  degradations: any[];
  providerReliability: any[];
  modelScores: any[];
  driftIncidents: any[];
  /** A free account (lib/capabilities 'board-insights'): the recommendations become a Pro card. */
  locked?: boolean;
  onUnlock?: () => void;
}

// Ids whose public name is not their formatted id. DeepSeek retired V4 Flash: requests to
// deepseek-v4-flash are served by DeepSeek-V4.1-Flash (models.display_name says so too).
const RENAMED: Record<string, string> = { 'deepseek-v4-flash': 'DeepSeek V4.1 Flash' };

export const getCompactName = (name: string): string => {
  if (!name) return name;
  if (RENAMED[name]) return RENAMED[name];
  // Auto-format: capitalize each segment, handle common patterns
  return name
    .split('-')
    .map(w => (w === 'gpt' ? 'GPT' : w === 'glm' ? 'GLM' : w === 'deepseek' ? 'DeepSeek' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\.\s/g, '.')
    .replace(/\s(\d)/g, ' $1')
    .replace(/^(GPT|GLM) (\d)/, '$1-$2');
};

const PROVIDER_NAME: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek', glm: 'GLM', kimi: 'Kimi', xai: 'xAI',
};

/** A provider's mark on a white chip (styles/studio-boards.css .sl-logo). */
function Mark({ provider }: { provider?: string }) {
  if (!provider) return null;
  return <span className="sl-logo is-xs" aria-hidden="true"><ProviderLogo provider={provider} size={12} /></span>;
}

/**
 * The left rail of the drift view on a wide screen: recommendations, active degradations,
 * provider trust, the Smart Router and the latest activity, as a stack of panes.
 */
export default function IntelligencePanel({
  recommendations,
  degradations,
  providerReliability,
  modelScores,
  driftIncidents,
  locked = false,
  onUnlock,
}: IntelligencePanelProps) {
  const { data: session } = useSession();

  const recoItems = buildRecoItems(recommendations, modelScores);
  const activityItems = buildActivityItems(degradations, modelScores, driftIncidents);

  // Provider trust data — show the top 4 providers by trust score.
  // xAI / Grok are excluded: the API no longer returns them, and the
  // fallback builder filters them as a safety net.
  const providerData = providerTrustList(providerReliability, modelScores).slice(0, 4);

  return (
    <div className="v4-panel v4-left-panel sl-rail">
      <div className="sl-rail-head">
        <p className="st-label">Intelligence center</p>
        <span className="st-pill is-good is-live">Live</span>
      </div>

      {/* Recommendations */}
      <section className="sl-pane st-up" aria-label="Smart recommendations">
        <h3 className="sl-pane-t">Smart recommendations</h3>
        {locked ? (
          <div className="sl-lock is-compact">
            <Locked plan={PLANS[REQUIRED_PLAN['board-insights']].label} title="Which model should you use right now?" onOpen={onUnlock ?? (() => {})}>
              The best model for code, the most reliable, the fastest and the best value, from the latest runs.
            </Locked>
          </div>
        ) : (
        <div className="sl-reco">
          {recoItems.length > 0 ? (
            recoItems.map((item, i) => (
              <div key={i} className={`sl-reco-item${item.danger ? ' is-bad' : ''}`}>
                <div style={{ minWidth: 0 }}>
                  <div className="sl-reco-type">{item.type}</div>
                  <div className="sl-reco-name"><Mark provider={item.providerDot} /><span>{item.name}</span></div>
                  <div className="sl-reco-detail">{item.detail}</div>
                </div>
                <div className="sl-reco-v">
                  <b>{item.score > 0 ? Math.round(item.score) : '—'}</b>
                  <small>{item.status}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="sl-pane-sub">Loading recommendations…</p>
          )}
        </div>
        )}
      </section>

      {/* Active Degradations */}
      {degradations.length > 0 && (
        <section className="sl-pane st-up" aria-label="Active degradations">
          <h3 className="sl-pane-t">Active degradations</h3>
          <div className="sl-deg">
            {degradations.slice(0, 4).map((deg: any, i: number) => (
              <div key={i} className={`st-note ${deg.severity === 'critical' ? 'is-bad' : 'is-warn'}`}>
                <div>
                  <div className="sl-deg-head">
                    <b>{deg.modelName || 'Unknown'}{deg.provider ? ` (${deg.provider})` : ''}</b>
                    <span className={`st-tag ${deg.severity === 'critical' ? 'is-bad' : 'is-warn'}`}>{deg.severity === 'critical' ? 'Critical' : 'Warning'}</span>
                  </div>
                  {deg.message || `Score dropped ${deg.dropPercentage || 0}%. ${deg.currentScore ? `Now at ${deg.currentScore}.` : ''}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Provider Trust */}
      <section className="sl-pane st-up" aria-label="Provider trust">
        <h3 className="sl-pane-t">Provider trust</h3>
        <div className="sl-trust-grid">
          {providerData.map((prov: any, i: number) => {
            const name = prov.name || prov.provider || '';
            const trust = trustOf(prov);
            return (
              <div key={i} className="sl-trust-card">
                <span><Mark provider={prov.provider || prov.name} /><span>{PROVIDER_NAME[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1)}</span></span>
                <b className={trust === null || trust >= 75 ? '' : 'is-warn'} title={trust === null ? 'Not measured yet' : 'Measured uptime minus 5 points per recorded incident'}>{trust ?? '—'}</b>
              </div>
            );
          })}
        </div>
      </section>

      {/*
        Sends signed-out visitors to /pricing, not /router. /router is behind
        auth, so an advert that landed there bounced the reader straight into a
        sign-in wall before they had been told what they would be buying.
      */}
      <Link href={session ? '/router' : '/pricing'} className="sl-cta st-up">
        <span className="st-kicker">Smart Router</span>
        <span className="sl-cta-sub">
          Every request goes to the model measuring best right now. Bring your own provider keys —
          in our benchmark the cheapest model matching the top score cost {SAVINGS_PCT}% less.
        </span>
        <span className="sl-cta-price">
          <b>{routerPrice().price}</b>
          <small>{routerPrice().plan} · {routerPrice().free}</small>
        </span>
      </Link>

      {/* Activity Feed */}
      <section className="sl-pane st-up" aria-label="Live activity">
        <h3 className="sl-pane-t">Live activity</h3>
        <ul className="sl-activity" style={{ marginTop: 10 }}>
          {activityItems.length > 0 ? (
            activityItems.slice(0, 8).map((a, i) => (
              <li key={i} className={`is-${a.tone}`}>
                <span className="sl-dot" aria-hidden="true" />
                <span className="sl-activity-text">
                  <b>{a.model}</b> {a.text}{a.tone !== 'crit' && a.tone !== 'warn' && a.value !== undefined ? <>: <b>{a.value}</b></> : null}
                </span>
                <span className="sl-activity-time">{a.time}</span>
              </li>
            ))
          ) : (
            <li><span className="sl-activity-time">—</span><span className="sl-activity-text">Waiting for activity data…</span></li>
          )}
        </ul>
      </section>
    </div>
  );
}

export function formatTimeAgo(date: Date | string): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Providers named by the board, with no trust score. A provider's trust comes only from
 * /analytics/provider-reliability (measured uptime and recorded incidents); this fallback used
 * to show the provider's average benchmark score in its place, which is a different number.
 */
function buildProviderTrustFromScores(modelScores: any[]): any[] {
  const names = new Set<string>();
  modelScores.forEach(m => {
    const vendor = String(m.provider || '').toLowerCase();
    if (!vendor || vendor === 'xai' || vendor === 'x.ai' || vendor === 'grok') return;
    names.add(m.provider);
  });
  return Array.from(names).sort().map(name => ({ name, provider: name, trustScore: null }));
}

/** A provider's trust score, or null when none was measured. */
export function trustOf(prov: any): number | null {
  const v = prov?.trustScore ?? prov?.score;
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

// ─── Shared builders ──────────────────────────────────────────────────────────
// Also used by the insights grid under the full-width leaderboards
// (components/insights/InsightsGrid.tsx), so the two views cannot disagree.

export interface RecoItem {
  /** best = a positive pick; poor = a price warning; avoid / unreliable = a genuine problem. */
  kind: 'best' | 'poor' | 'avoid' | 'unreliable';
  type: string;
  name: string;
  /** The model's API name, for a link to its page. */
  rawName?: string;
  detail: string;
  score: number;
  status: string;
  danger?: boolean;
  providerDot?: string;
}

export function buildRecoItems(recommendations: any, modelScores: any[]): RecoItem[] {
  const recoItems: RecoItem[] = [];

  // Every card below is one category computed from measurements by the API
  // (routes/analytics.ts /recommendations) and is shown under that category's own name.
  const nameOf = (x: any) => x?.displayName || getCompactName(x?.name);

  if (recommendations?.bestForCode?.name) {
    const b = recommendations.bestForCode;
    recoItems.push({
      kind: 'best', type: 'Best for code',
      name: nameOf(b), rawName: b.name,
      detail: b.reason || (typeof b.correctness === 'number' ? `${Math.round(b.correctness)}% correct` : 'top coding score'),
      score: b.codingScore ?? b.score ?? 0,
      status: 'Stable',
      providerDot: b.vendor || b.provider,
    });
  }

  if (recommendations?.mostReliable?.name) {
    const r = recommendations.mostReliable;
    recoItems.push({
      kind: 'best', type: 'Most reliable',
      name: nameOf(r), rawName: r.name,
      detail: r.reason || 'Lowest variance',
      score: r.score || 0,
      status: 'Stable',
      providerDot: r.vendor || r.provider,
    });
  }

  if (recommendations?.fastestResponse?.name) {
    const f = recommendations.fastestResponse;
    recoItems.push({
      kind: 'best', type: 'Fastest response',
      name: nameOf(f), rawName: f.name,
      detail: f.reason || 'Quick response time',
      score: f.score || 0,
      status: 'Fast',
      providerDot: f.vendor || f.provider,
    });
  }

  // Best value: points per MEASURED dollar of one identical coding run. This used to be
  // computed here from list price per token, which ranks verbose models backwards — a model
  // that writes four times as much costs four times as much per task at the same price.
  if (recommendations?.bestValue?.name) {
    const v = recommendations.bestValue;
    recoItems.push({
      kind: 'best', type: 'Best value',
      name: nameOf(v), rawName: v.name,
      detail: v.reason || 'Most points per dollar',
      score: v.score || 0,
      status: typeof v.costPerRun === 'number' ? `$${v.costPerRun < 0.1 ? v.costPerRun.toFixed(3) : v.costPerRun.toFixed(2)}` : 'Value',
      providerDot: v.vendor || v.provider,
    });
  }

  // Poor value: another ranked model scores at least as high for a third of the cost or less.
  // A price judgement, not a fault, so it is not styled as one.
  if (Array.isArray(recommendations?.poorValue)) {
    recommendations.poorValue.slice(0, 2).forEach((model: any) => {
      if (!model?.name) return;
      recoItems.push({
        kind: 'poor', type: 'Poor value',
        name: nameOf(model), rawName: model.name,
        detail: model.reason || 'A cheaper model scores as high',
        score: model.score || 0,
        status: 'Cost',
        providerDot: model.vendor || model.provider,
      });
    });
  }

  // Avoid now: genuine problems only (serious degradation or a failing score).
  if (Array.isArray(recommendations?.avoidNow)) {
    recommendations.avoidNow.slice(0, 2).forEach((model: any) => {
      if (!model?.name) return;
      recoItems.push({
        kind: 'avoid', type: 'Avoid now',
        name: nameOf(model), rawName: model.name,
        detail: model.reason || 'Performance problem',
        score: typeof model.score === 'number' ? model.score : 0,
        status: 'Avoid',
        danger: true,
        providerDot: model.provider,
      });
    });
  }

  // Genuinely noisy models, measured by the SAME standard error the front-page VOLATILE
  // count uses (lib/fleet-buckets), so the two cannot disagree in public again.
  //
  // This used to fire on `trend === 'down'` and label the result "UNRELIABLE · High
  // variance detected". Direction is not variance: on 15 September 2026 it called
  // gpt-5.6-terra unreliable for high variance while that model had one of the LOWEST
  // standard errors on the board and the stat bar's VOLATILE count read 0.
  const volatileModels = modelScores
    .filter(m =>
      typeof m.currentScore === 'number' &&
      isVolatile(m) &&
      !recoItems.some(ri => ri.name === getCompactName(m.name))
    )
    .slice(0, 1);

  volatileModels.forEach(m => {
    recoItems.push({
      kind: 'unreliable', type: 'Unreliable',
      name: getCompactName(m.name), rawName: m.name,
      detail: typeof m.standardError === 'number'
        ? `±${m.standardError.toFixed(1)} pts between identical runs`
        : 'High variance between identical runs',
      score: m.currentScore,
      status: 'Volatile',
      danger: true,
      providerDot: m.provider,
    });
  });

  return recoItems;
}

export interface ActivityItem { time: string; tone: 'crit' | 'warn' | 'good' | 'info'; model: string; text: string; value?: number }

export function buildActivityItems(degradations: any[], modelScores: any[], driftIncidents: any[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  degradations.slice(0, 3).forEach((deg: any) => {
    if (!deg.modelName) return;
    items.push({
      time: deg.detectedAt ? formatTimeAgo(deg.detectedAt) : 'recent',
      tone: deg.severity === 'critical' ? 'crit' : 'warn',
      model: getCompactName(deg.modelName),
      text: deg.message || 'performance issue',
    });
  });
  modelScores
    .filter(m => m.trend === 'up' && typeof m.currentScore === 'number')
    .slice(0, 2)
    .forEach(m => items.push({ time: formatTimeAgo(m.lastUpdated), tone: 'good', model: getCompactName(m.name), text: 'benchmarked', value: m.currentScore }));
  modelScores
    .filter(m => m.trend === 'stable' && typeof m.currentScore === 'number' && m.currentScore >= 80)
    .slice(0, 2)
    .forEach(m => items.push({ time: formatTimeAgo(m.lastUpdated), tone: 'good', model: getCompactName(m.name), text: 'stable', value: m.currentScore }));
  openIncidents(driftIncidents).slice(0, 2).forEach((inc: any) => {
    const provider = providerIncidentLabel(inc);
    items.push({
      time: inc.detectedAt ? formatTimeAgo(inc.detectedAt) : 'recent',
      tone: 'info',
      model: provider ?? getCompactName(inc.modelName || 'Model'),
      text: provider ? 'provider-wide drift' : inc.type || 'drift detected',
    });
  });
  return items;
}

/** Every provider, highest trust first. xAI / Grok are excluded: the API no longer returns them. */
export function providerTrustList(providerReliability: any[], modelScores: any[]): any[] {
  return (providerReliability.length > 0 ? providerReliability : buildProviderTrustFromScores(modelScores))
    .filter((prov: any) => {
      const key = String(prov.provider || prov.name || '').toLowerCase();
      return key !== 'xai' && key !== 'x.ai' && key !== 'grok';
    })
    .sort((a: any, b: any) => (trustOf(b) ?? -1) - (trustOf(a) ?? -1));
}
