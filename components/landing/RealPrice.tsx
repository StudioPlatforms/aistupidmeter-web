'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { slugifyModelName } from '@/lib/model-slug';
import { PROVIDER_LABEL, type PriceModel, type PriceSnapshot, type RosterModel } from './types';
import { dayRange, duration, logoFor, pct, per1k, times } from './price-format';

type TabKey = 'coding' | 'reasoning' | 'tooling';

interface Row { name: string; displayName: string; vendor: string; quality: number; cost: number; ms: number | null }

const TABS: Array<{ key: TabKey; label: string; noun: string; quality: string; per: string; unit: string; about: (n: number) => string }> = [
  { key: 'coding', label: 'Coding', noun: 'coding', quality: 'Passed', per: 'per 1,000 correct fixes', unit: 'attempt',
    about: n => `${n} bug fixes in real code repositories. A fix counts only when the hidden tests pass.` },
  { key: 'reasoning', label: 'Reasoning', noun: 'reasoning', quality: 'Score', per: 'per 1,000 tasks', unit: 'task',
    about: n => `${n} long, multi-turn engineering sessions, each checked by code. Scored out of 100.` },
  { key: 'tooling', label: 'Agents & tools', noun: 'tool-use', quality: 'Score', per: 'per 1,000 tasks', unit: 'task',
    about: n => `${n} agent tasks with real tools in a sandbox. Scored out of 100.` },
];

const VENDOR_ORDER = ['openai', 'anthropic', 'google', 'deepseek', 'kimi', 'glm'];

function rowsFor(price: PriceSnapshot, tab: TabKey): Row[] {
  if (tab === 'coding') {
    return (price.coding?.models ?? [])
      .filter(m => m.costPerSuccess != null)
      .map(m => ({ name: m.name, displayName: m.displayName, vendor: m.vendor, quality: m.passRate, cost: m.costPerSuccess as number, ms: m.medianMs }));
  }
  return (price[tab]?.models ?? []).map(m => ({ name: m.name, displayName: m.displayName, vendor: m.vendor, quality: m.score, cost: m.costPerTask, ms: m.medianMs }));
}

/**
 * "Check your AI": pick a model and see what its results cost against every other model on the
 * same tasks, and which models did at least as well for less. Coding counts correct fixes; reasoning
 * and tool use, whose pass flags barely separate models, show the suite score beside the cost.
 *
 * Everything here is real test runs over the dated window, so the window is shown at the top, and
 * the picker lists every tracked model: one without enough runs in the window says so instead of
 * being left out (GPT-6.1 Sol had 4 real coding runs before the window closed on 14 Oct).
 */
export default function RealPrice({ price, roster = [] }: { price: PriceSnapshot; roster?: RosterModel[] }) {
  const rolling = !!price.rolling;
  const windowDays = price.windowDays ?? 30;
  const tabs = TABS.filter(t => price[t.key]?.models.length);
  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? 'coding');
  const everyone = useMemo(() => {
    const m = new Map<string, PriceModel>();
    for (const t of TABS) {
      const s = price[t.key];
      for (const r of [...(s?.models ?? []), ...(s?.declined ?? [])]) m.set(r.name, r);
    }
    for (const r of roster) if (!m.has(r.name)) m.set(r.name, { id: 0, name: r.name, displayName: r.displayName, vendor: r.vendor });
    return Array.from(m.values()).sort((a, b) =>
      (VENDOR_ORDER.indexOf(a.vendor) - VENDOR_ORDER.indexOf(b.vendor)) || a.displayName.localeCompare(b.displayName));
  }, [price, roster]);
  const [sel, setSel] = useState<string>(price.finding?.a.name ?? rowsFor(price, tab)[0]?.name ?? '');
  // Cheapest first is the point of this section, but it is not a quality ranking: the switch and the
  // line above the list say which order is shown, so the first row is never read as "the best".
  const [order, setOrder] = useState<'cost' | 'quality'>('cost');

  const def = TABS.find(t => t.key === tab)!;
  const suite = price[tab];
  const rows = useMemo(() => rowsFor(price, tab).sort((a, b) =>
    order === 'cost' ? a.cost - b.cost : (b.quality - a.quality) || (a.cost - b.cost)), [price, tab, order]);
  if (!suite || !rows.length) return null;

  const me = rows.find(r => r.name === sel) ?? null;
  const chosen = everyone.find(m => m.name === sel);
  const declined = !me && !!suite.declined.find(d => d.name === sel);
  // At least as good and cheaper; failing that, the cheaper models within a hair of it (2 points of
  // pass rate, 1 point of score) — run-to-run noise is about that size.
  const tol = tab === 'coding' ? 0.02 : 1;
  const tolText = tab === 'coding' ? '2 points' : '1 point';
  const cheaper = me ? rows.filter(r => r.name !== me.name && r.cost < me.cost) : [];
  const better = me ? cheaper.filter(r => r.quality >= me.quality).slice(0, 3) : [];
  const alts = better.length || !me ? better : cheaper.filter(r => r.quality >= me.quality - tol).slice(0, 3);
  const altNames = new Set(alts.map(a => a.name));
  const max = Math.max(...rows.map(r => r.cost));
  const q = (v: number) => (tab === 'coding' ? pct(v) : v.toFixed(1));

  return (
    <div className="lp-pr">
      <p className="lp-pr-when">{rolling
        ? <><b>Last {windowDays} days</b> · {dayRange(suite.from, suite.to)}</>
        : <><b>Last measured</b> · real test runs, {dayRange(suite.from, suite.to)}</>}</p>
      <div className="lp-pr-tabs" role="tablist" aria-label="Kind of work">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === tab} aria-controls="lp-pr-panel" onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <p className="lp-pr-about">{def.about(suite.tasks)}</p>
      </div>

      <div className="lp-pr-grid" id="lp-pr-panel" role="tabpanel">
        <div className="lp-pr-card">
          <label className="lp-pr-pick">
            <span>Which model do you use?</span>
            <select value={sel} onChange={e => setSel(e.target.value)}>
              {VENDOR_ORDER.filter(v => everyone.some(m => m.vendor === v)).map(v => (
                <optgroup key={v} label={PROVIDER_LABEL[v] ?? v}>
                  {everyone.filter(m => m.vendor === v).map(m => <option key={m.name} value={m.name}>{m.displayName}</option>)}
                </optgroup>
              ))}
            </select>
          </label>

          {me ? (
            <>
              <dl className="lp-pr-me">
                <div><dt>{def.quality}</dt><dd>{q(me.quality)}</dd></div>
                <div><dt>Cost {def.per}</dt><dd>{per1k(me.cost)}</dd></div>
                <div><dt>Typical {def.unit}</dt><dd>{duration(me.ms)}</dd></div>
              </dl>
              <p className="lp-pr-h">{better.length ? 'Did at least as well, for less' : alts.length ? `Within ${tolText}, for less` : 'Nothing cheaper came close'}</p>
              {alts.length ? (
                <ol className="lp-pr-alts">
                  {alts.map(a => (
                    <li key={a.name}>
                      <span className="lp-lgc"><img src={logoFor(a.vendor)} alt="" width={18} height={18} loading="lazy" /></span>
                      <span className="lp-pr-an"><b>{a.displayName}</b><small>{q(a.quality)} · {per1k(a.cost)}</small></span>
                      <em>{times(me.cost / a.cost)} less</em>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="lp-pr-none">No cheaper model came within {tolText} of {me.displayName} on these tasks.</p>
              )}
            </>
          ) : (
            <p className="lp-pr-none">
              {declined
                ? `${chosen?.displayName ?? sel} declined some of these tasks, so it isn’t compared here: a model is compared only on the same tasks as the rest.`
                : `Not enough ${def.noun} test runs for ${chosen?.displayName ?? sel} between ${dayRange(suite.from, suite.to).replace(' – ', ' and ')} to compare it on the same tasks as the others.`}
            </p>
          )}
          <div className="lp-pr-go">
            {chosen && <a className="lp-more" href={`/models/${slugifyModelName(chosen.name)}`}>{chosen.displayName}’s full record</a>}
            <a className="lp-more" href="#router">How the router picks for value</a>
          </div>
        </div>

        <div className="lp-pr-list">
          <div className="lp-pr-order">
            <p>{order === 'cost' ? `Sorted by cost ${def.per}, not by quality.` : `Sorted by ${def.quality.toLowerCase()}, best first.`}</p>
            <div className="lp-pr-sort" role="group" aria-label="Sort the list">
              <button type="button" aria-pressed={order === 'cost'} onClick={() => setOrder('cost')}>Cheapest per result</button>
              <button type="button" aria-pressed={order === 'quality'} onClick={() => setOrder('quality')}>{tab === 'coding' ? 'Most passed' : 'Highest score'}</button>
            </div>
          </div>
          <div className="lp-pr-cols" aria-hidden="true"><span>Model</span><span>Cost {def.per}</span><span>{def.quality}</span></div>
          <div className="lp-pr-rows" style={{ '--rows': rows.length } as CSSProperties}>
            {rows.map((r, i) => (
              <button
                key={r.name}
                type="button"
                className={`lp-pr-row${r.name === sel ? ' is-me' : ''}${altNames.has(r.name) ? ' is-alt' : ''}`}
                style={{ transform: `translateY(calc(${i} * var(--rh)))`, '--w': Math.max(r.cost / max, 0.004) } as CSSProperties}
                aria-pressed={r.name === sel}
                onClick={() => setSel(r.name)}
              >
                <span className="lp-lgc"><img src={logoFor(r.vendor)} alt="" width={18} height={18} loading="lazy" /></span>
                <span className="lp-pr-nm">{r.displayName}</span>
                <span className="lp-pr-bar" aria-hidden="true"><i /></span>
                <span className="lp-pr-cost">{per1k(r.cost)}</span>
                <span className="lp-pr-q">{q(r.quality)}</span>
              </button>
            ))}
          </div>
          <p className="lp-pr-foot">
            The same tasks for every model, {dayRange(suite.from, suite.to)}. Every attempt is priced at the provider’s list price;
            bars to scale. The router’s value modes do not simply take the cheapest: they only consider models within
            5 points of the best score, then pick the cheapest of those.
          </p>
        </div>
      </div>
    </div>
  );
}
