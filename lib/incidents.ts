/**
 * How the leaderboard reads drift incidents (/dashboard/incidents returns a 7-day window,
 * resolved ones included).
 *
 * A provider-wide incident is stored against the FIRST model in its affected list, so read as a
 * model incident it pinned "GPT-5.6 Sol" and "Claude Opus 4.6" on the board for days after the
 * 14 Oct 2026 provider incidents, while nothing was wrong with either model. It is about the
 * provider, and says so.
 */

const PROVIDER_NAME: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', deepseek: 'DeepSeek', kimi: 'Kimi', glm: 'GLM', xai: 'xAI',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const isProviderIncident = (i: any): boolean => i?.incidentType === 'provider_wide_degradation';

/** Not resolved, and (with `withinMs`) detected inside that window. */
export function openIncidents(list: any[] | null | undefined, withinMs?: number): any[] {
  const now = Date.now();
  return (list ?? []).filter((i: any) => {
    if (!i || i.resolvedAt) return false;
    if (withinMs === undefined) return true;
    const t = Date.parse(i.detectedAt ?? '');
    return !Number.isNaN(t) && now - t <= withinMs;
  });
}

/** Open incidents from the last 24 hours, which is what the stat bar's label promises. */
export const incidentsLast24h = (list: any[] | null | undefined) => openIncidents(list, DAY_MS);

/** "OpenAI, 5 models" for a provider-wide incident; null for a model incident. */
export function providerIncidentLabel(i: any): string | null {
  if (!isProviderIncident(i)) return null;
  let meta = i.metadata;
  if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = null; } }
  const n = Array.isArray(meta?.affectedModels) ? meta.affectedModels.length : null;
  const name = PROVIDER_NAME[String(i.provider ?? '').toLowerCase()] ?? i.provider ?? 'Provider';
  return n ? `${name}, ${n} models` : name;
}
