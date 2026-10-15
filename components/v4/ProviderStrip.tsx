'use client';

/**
 * Provider availability, on the homepage.
 *
 * WHAT THIS USED TO DO
 * --------------------
 * It said OK / WARN / DEGR / DOWN per provider, and derived all four from BENCHMARK
 * SCORE TRENDS: "DOWN" meant no model had a current score, "DEGR" meant more than half
 * the provider's models had a falling score. A model scoring lower this week is not a
 * provider being degraded, and nobody reading a green-or-red status strip thinks it is
 * about benchmark trends. Meanwhile the real signal — a probe against every provider
 * every ten minutes — was rendered nowhere on the site.
 *
 * It now shows the probe. Score trends belong on the leaderboard, which is directly
 * below this strip anyway.
 *
 * Degrades to showing nothing rather than guessing: if the status feed does not answer,
 * the strip renders no status text at all.
 */

import { useEffect, useState } from 'react';
import ProviderLogo from '../ProviderLogo';
import '../../styles/studio-boards.css';

interface ProviderStripProps {
  modelScores: any[];
}

const PROVIDERS = [
  { key: 'openai', label: 'GPT' },
  { key: 'anthropic', label: 'Claude' },
  { key: 'google', label: 'Gemini' },
  { key: 'deepseek', label: 'DeepSeek' },
  { key: 'glm', label: 'GLM' },
  { key: 'kimi', label: 'Kimi' },
];

export interface Health { status: string; responseTime: number | null; lastChecked: string | null; error: string | null }

/** The ten-minute availability probe per provider (/providers). null until it answers, and if it never does. */
export function useProviderHealth(): Record<string, Health> | null {
  const [health, setHealth] = useState<Record<string, Health> | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Same origin in production; nginx proxies /providers to the API.
        const base = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
        const r = await fetch(`${base}/providers`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j?.success) setHealth(j.data);
      } catch {
        /* availability is supplementary — never block or break the homepage on it */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return health;
}

/** OK / Slow / Down for one provider's probe, or null when there is nothing to say. `tone` is the
 *  status colour's name (styles/studio-boards.css .sl-status.is-good / is-warn / is-bad). */
export function providerStatus(h: Health | undefined): { label: string; color: string; tone: 'good' | 'warn' | 'bad'; title: string } | null {
  if (!h || !h.status || h.status === 'unknown') return null;
  if (h.status === 'operational') {
    return {
      label: 'OK',
      color: 'var(--lp-good)',
      tone: 'good',
      title: `Answered our last check${h.responseTime ? ` in ${(h.responseTime / 1000).toFixed(1)}s` : ''}`,
    };
  }
  if (h.status === 'degraded') {
    return { label: 'Slow', color: 'var(--lp-warn)', tone: 'warn', title: 'Answered, but slowly' };
  }
  return { label: 'Down', color: 'var(--lp-bad)', tone: 'bad', title: h.error ? h.error.slice(0, 120) : 'Did not answer our last check' };
}

export default function ProviderStrip({ modelScores }: ProviderStripProps) {
  const health = useProviderHealth();

  // Only show providers we actually have models for, as before.
  const activeProviders = PROVIDERS.filter(p => modelScores.some(m => m.provider === p.key));

  const render = (key: string) => providerStatus(health?.[key]);

  return (
    <div className="sl-pstrip" aria-label="Provider availability">
      {activeProviders.map(p => {
        const s = render(p.key);
        return (
          <a
            key={p.key}
            className="sl-pchip"
            href="/status"
            title={s ? `${p.label}: ${s.title}` : `${p.label}: availability unknown`}
          >
            <span className="sl-logo is-xs" aria-hidden="true"><ProviderLogo provider={p.key} size={12} /></span>
            {p.label}
            {s && <span className={`sl-status is-${s.tone}`}>{s.label}</span>}
          </a>
        );
      })}
    </div>
  );
}
