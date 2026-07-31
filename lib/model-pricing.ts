/**
 * Model pricing — USD per 1M tokens.
 *
 * MIRROR of apps/api/src/lib/model-pricing.ts, which is the source of truth.
 * Separate repos mean no shared package, so update BOTH together — if they
 * diverge, the leaderboard and the model detail page will quote different
 * prices for the same model, which is exactly the bug this file was created to
 * end. Before this existed the same prices were duplicated five times across
 * the two repos and every copy had drifted.
 *
 * CONVENTIONS
 * - Standard list price on the provider's own first-party API.
 * - Input is the CACHE-MISS rate. Cached reads are far cheaper (DeepSeek
 *   V4-Flash is $0.14 cache-miss vs $0.0028 cache-hit) and quoting the cached
 *   rate as the headline understates real cost badly.
 * - Promotional/introductory rates are NOT used — they expire and go stale.
 *   Where one is live it is noted in a comment.
 * - Long-context surcharge tiers are not modelled; the base tier is quoted.
 *
 * Verified 2026-07-31. Most recent change: OpenAI cut GPT-5.6 Terra 20% and
 * Luna 80% on 2026-07-30.
 */

export interface ModelPrice {
  input: number;
  output: number;
}

export function getModelPricing(modelName: string, provider: string): ModelPrice {
  const name = (modelName || '').toLowerCase();
  const prov = (provider || '').toLowerCase();

  if (prov === 'openai') {
    // GPT-5.6 family (GA 2026-07-09) — specific tiers before the generic
    // gpt-5 catch-all, which would otherwise swallow every 5.x model.
    if (name.includes('gpt-5.6-terra')) return { input: 2, output: 12 };
    if (name.includes('gpt-5.6-luna')) return { input: 0.20, output: 1.20 };
    if (name.includes('gpt-5.6')) return { input: 5, output: 30 }; // sol + bare alias
    if (name.includes('gpt-5.5')) return { input: 5, output: 30 };
    if (name.includes('gpt-5.4')) return { input: 2.5, output: 15 };
    if (name.includes('gpt-5.3')) return { input: 1.75, output: 14 };
    if (name.includes('gpt-5.2') || name.includes('gpt-5-2')) return { input: 1.75, output: 14 };
    if (name.includes('gpt-5') && name.includes('turbo')) return { input: 10, output: 30 };
    if (name.includes('gpt-5') && name.includes('nano')) return { input: 0.05, output: 0.40 };
    if (name.includes('gpt-5') && name.includes('mini')) return { input: 0.25, output: 2.00 };
    if (name.includes('gpt-5') && name.includes('codex')) return { input: 1.25, output: 10 };
    if (name.includes('gpt-5')) return { input: 1.25, output: 10 };
    if (name.includes('o3-pro')) return { input: 60, output: 240 };
    if (name.includes('o3-mini')) return { input: 3.5, output: 14 };
    if (name.includes('o3')) return { input: 15, output: 60 };
    if (name.includes('gpt-4o') && name.includes('mini')) return { input: 0.15, output: 0.6 };
    if (name.includes('gpt-4o')) return { input: 2.50, output: 10 };
    return { input: 1.25, output: 10 };
  }

  if (prov === 'anthropic') {
    if (name.includes('fable-5') || name.includes('mythos-5')) return { input: 10, output: 50 };
    if (name.includes('opus-4-1') || name.includes('opus-4.1')) return { input: 15, output: 75 }; // legacy tier
    // Opus 4.5 through Opus 5 all sit at $5/$25.
    if (name.includes('opus')) return { input: 5, output: 25 };
    // Sonnet 5 carries an introductory $2/$10 through 2026-08-31; the standard
    // rate is quoted so the leaderboard does not silently shift on 2026-09-01.
    if (name.includes('sonnet')) return { input: 3, output: 15 };
    if (name.includes('haiku')) return { input: 0.25, output: 1.25 };
    return { input: 3, output: 15 };
  }

  if (prov === 'xai' || prov === 'x.ai') {
    if (name.includes('grok-code-fast')) return { input: 0.20, output: 1.50 };
    if (name.includes('grok-3') && name.includes('mini')) return { input: 0.30, output: 0.50 };
    if (name.includes('grok-3')) return { input: 3, output: 15 };
    if (name.includes('grok-4')) return { input: 3, output: 15 };
    return { input: 3, output: 15 };
  }

  if (prov === 'google') {
    // 3.1 Pro is the base (<=200K ctx) tier; above that it rises to $4/$18.
    if (name.includes('3.1-flash-lite')) return { input: 0.25, output: 1.50 };
    if (name.includes('3.1-flash')) return { input: 0.50, output: 3 };
    if (name.includes('3.1-pro')) return { input: 2, output: 12 };
    if (name.includes('gemini-3') && name.includes('pro')) return { input: 2, output: 12 };
    if (name.includes('gemini-3') && name.includes('flash')) return { input: 0.50, output: 3 };
    if (name.includes('2.5-pro')) return { input: 1.25, output: 10 };
    if (name.includes('2.5-flash-lite')) return { input: 0.10, output: 0.40 };
    if (name.includes('2.5-flash')) return { input: 0.30, output: 2.50 };
    if (name.includes('1.5-pro')) return { input: 1.25, output: 5 };
    if (name.includes('1.5-flash')) return { input: 0.075, output: 0.3 };
    return { input: 2, output: 12 };
  }

  if (prov === 'deepseek') {
    // Cache-miss rates. Cache hits are ~50x cheaper but are not the list price.
    if (name.includes('v4-pro')) return { input: 0.435, output: 0.87 };
    return { input: 0.14, output: 0.28 }; // V4-Flash and the legacy aliases
  }

  if (prov === 'glm') {
    if (name.includes('5.2') || name.includes('5.1')) return { input: 1.40, output: 4.40 };
    if (name.includes('4.7') || name.includes('4.6')) return { input: 0.60, output: 2.20 };
    return { input: 1.40, output: 4.40 };
  }

  if (prov === 'kimi') {
    if (name.includes('k3')) return { input: 3, output: 15 };
    if (name.includes('k2.7-code-highspeed')) return { input: 1.90, output: 8 };
    if (name.includes('k2.7')) return { input: 0.95, output: 4 };
    return { input: 0.60, output: 2.50 };
  }

  return { input: 3, output: 10 };
}

/**
 * Blended cost per 1M tokens, assuming a typical 40% input / 60% output mix.
 * This is what the leaderboard's price view ranks and displays.
 */
export function getBlendedCostPer1M(modelName: string, provider: string): number {
  const p = getModelPricing(modelName, provider);
  return p.input * 0.4 + p.output * 0.6;
}
