'use client';

import { useEffect, useState } from 'react';
import type { PreferencesPreview, PreviewCandidate } from '@/lib/api-client';
import { metricKind, type LandingRow, type LandingStrategy, type LandingTag, type MetricKind } from '@/components/landing/types';

/**
 * A signed-in caller's own routing preview (POST /router/preferences/preview) in the shape the
 * landing's RankList and RouterDemo draw, so the app shows the same animated ranking — fed with
 * this account's keys and preferences instead of the landing's example caller.
 *
 * Row order is the order the router would actually try: the pick, its fallbacks, the rest of the
 * eligible models, then the ones ruled out (dimmed, with the reason as a tag).
 */
export function previewToSnap(
  p: PreferencesPreview | null | undefined,
  names: Record<string, string> = {},
  limit = 8,
): { snap: LandingStrategy; kind: MetricKind } | null {
  if (!p || !p.details) return null;
  const d = p.details;
  // Points-per-dollar and run-to-run spread are not in the preview; those modes show the score.
  let kind = metricKind(d.effectiveStrategy);
  if (kind === 'value' || kind === 'spread') kind = 'score';

  const weight = new Map((d.split ?? []).map(s => [s.model, s.weight]));
  const metric = (c: PreviewCandidate): { v: number | null; est?: boolean } => {
    switch (kind) {
      case 'price': return { v: c.costPer1kBlended * 1000 };
      case 'latency': return { v: c.latencyMs, est: !c.latencyMeasured };
      case 'weight': return { v: weight.get(c.model) ?? null };
      default: return { v: c.rankable ? c.score : null };
    }
  };
  const tagOf = (c: PreviewCandidate): { tag: LandingTag | null; note?: string } => {
    if (c.circuitOpen) return { tag: 'outage', note: 'Provider failing right now: the router skips it until it recovers' };
    if (c.driftFlag) return { tag: 'drift', note: c.driftFlag };
    switch (c.status) {
      case 'no_key': return { tag: 'no_key', note: `Add a ${c.provider} key to use this model` };
      case 'excluded': return { tag: 'excluded' };
      case 'over_cost': return { tag: 'over_cost' };
      case 'over_latency': return { tag: 'over_latency' };
      case 'no_tools': case 'no_forced_tools': return { tag: 'no_tools' };
      default: return { tag: null };
    }
  };

  const primary = p.ok ? p.primary.model : null;
  const fallbacks = p.ok ? p.fallbacks.map(f => f.model) : [];
  const byModel = new Map(d.candidates.map(c => [c.model, c]));
  const order: PreviewCandidate[] = [];
  const push = (c: PreviewCandidate | undefined) => { if (c && !order.includes(c)) order.push(c); };
  if (primary) push(byModel.get(primary));
  fallbacks.forEach(m => push(byModel.get(m)));
  if (kind === 'weight') (d.split ?? []).forEach(s => push(byModel.get(s.model)));
  d.candidates.filter(c => c.status === 'eligible').forEach(push);
  d.candidates.forEach(push);

  const rows: LandingRow[] = order.slice(0, limit).map(c => {
    const m = metric(c);
    const t = tagOf(c);
    return {
      model: c.model,
      displayName: names[c.model] ?? c.model,
      provider: c.provider,
      score: c.score,
      metric: m.v,
      estimated: m.est,
      tag: t.tag,
      note: t.note,
      role: c.model === primary ? 'primary' : fallbacks.includes(c.model) ? 'fallback' : null,
    };
  });

  const top = primary ? byModel.get(primary) : undefined;
  const snap: LandingStrategy = {
    strategy: d.requestedStrategy,
    effectiveStrategy: d.effectiveStrategy,
    taskRule: d.taskRule,
    primary: {
      model: primary ?? '',
      displayName: primary ? names[primary] ?? primary : '',
      provider: top?.provider ?? '',
      latencyMs: top?.latencyMs ?? null,
      reasoning: p.ok ? p.primary.reasoning : '',
    },
    fallbacks,
    rows,
  };
  return { snap, kind };
}

let namesCache: Promise<Record<string, string>> | null = null;

/** Model id → display name ("gpt-6.1-sol" → "GPT-6.1 Sol"), from the public model list. Fetched once per page. */
export function useModelNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    namesCache ??= fetch('/api/models')
      .then(r => (r.ok ? r.json() : []))
      .then((list: any[]) => Object.fromEntries((Array.isArray(list) ? list : []).filter(m => m?.name).map(m => [String(m.name), String(m.displayName || m.name)])))
      .catch(() => ({}));
    let alive = true;
    namesCache.then(n => { if (alive) setNames(n); });
    return () => { alive = false; };
  }, []);
  return names;
}
