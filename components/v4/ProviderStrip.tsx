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

interface ProviderStripProps {
  modelScores: any[];
}

const PROVIDERS = [
  { key: 'openai', label: 'GPT', dot: 'openai' },
  { key: 'anthropic', label: 'CLAUDE', dot: 'anthropic' },
  { key: 'google', label: 'GEMINI', dot: 'google' },
  { key: 'deepseek', label: 'DEEPSEEK', dot: 'deepseek' },
  { key: 'glm', label: 'GLM', dot: 'glm' },
  { key: 'kimi', label: 'KIMI', dot: 'kimi' },
];

interface Health { status: string; responseTime: number | null; lastChecked: string | null; error: string | null }

export default function ProviderStrip({ modelScores }: ProviderStripProps) {
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

  // Only show providers we actually have models for, as before.
  const activeProviders = PROVIDERS.filter(p => modelScores.some(m => m.provider === p.key));

  const render = (key: string): { label: string; color: string; title: string } | null => {
    const h = health?.[key];
    if (!h || !h.status || h.status === 'unknown') return null;
    if (h.status === 'operational') {
      return {
        label: 'OK',
        color: 'var(--phosphor-green)',
        title: `Answered our last check${h.responseTime ? ` in ${(h.responseTime / 1000).toFixed(1)}s` : ''}`,
      };
    }
    if (h.status === 'degraded') {
      return { label: 'SLOW', color: 'var(--amber-warning)', title: 'Answered, but slowly' };
    }
    return { label: 'DOWN', color: 'var(--red-alert)', title: h.error ? h.error.slice(0, 120) : 'Did not answer our last check' };
  };

  return (
    <div className="v4-prov-strip">
      {activeProviders.map(p => {
        const s = render(p.key);
        return (
          <a
            key={p.key}
            className="v4-prov-chip"
            href="/status"
            title={s ? `${p.label}: ${s.title}` : `${p.label}: availability unknown`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className={`v4-prov-dot ${p.dot}`} style={{ width: '6px', height: '6px' }}></div>
            {p.label}{' '}
            {s && <span className="status" style={{ color: s.color }}>{s.label}</span>}
          </a>
        );
      })}
    </div>
  );
}
