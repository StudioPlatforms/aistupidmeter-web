import type { CSSProperties } from 'react';
import type { PriceSnapshot } from './types';
import { PROVIDER_LABEL } from './types';
import { dayRange, logoFor, oftenWord, pct, per1k, times } from './price-format';

/**
 * The hero's finding: what 1,000 correct fixes cost on two models, bars to scale. The pair is
 * chosen by the API's fixed rule (the model whose correct fixes cost the most, against the cheapest
 * that passed at least as often), so it changes only when the measurements do.
 */
export default function PriceFinding({ price }: { price: PriceSnapshot }) {
  const f = price.finding;
  const c = price.coding;
  if (!f || !c || f.a.costPerSuccess == null || f.b.costPerSuccess == null) return null;
  const rows = [
    { m: f.a, cost: f.a.costPerSuccess, w: 1, cls: 'is-a' },
    { m: f.b, cost: f.b.costPerSuccess, w: Math.max(f.b.costPerSuccess / f.a.costPerSuccess, 0.012), cls: 'is-b' },
  ];
  return (
    <figure className="lp-find" aria-label="What a correct fix costs">
      <figcaption className="lp-find-head"><b>What a correct fix really costs</b><span><i />Coding · measured {dayRange(c.from, c.to)}</span></figcaption>
      <div className="lp-find-rows">
        {rows.map(({ m, cost, w, cls }, i) => (
          <div key={m.name} className={`lp-find-row ${cls}`} style={{ '--w': w, '--i': i } as CSSProperties}>
            <div className="lp-find-top">
              <span className="lp-lgc"><img src={logoFor(m.vendor)} alt="" width={18} height={18} /></span>
              <span className="lp-find-nm"><b>{m.displayName}</b><small>{PROVIDER_LABEL[m.vendor] ?? m.vendor}</small></span>
              <em>{per1k(cost)}</em>
            </div>
            <span className="lp-find-bar" aria-hidden="true"><i /></span>
            <div className="lp-find-sub"><span><b>{pct(m.passRate)}</b> of attempts passed</span><span>per 1,000 correct fixes</span></div>
          </div>
        ))}
      </div>
      <p className="lp-find-say">
        <b>{times(f.ratio)} less</b> per correct fix, and {f.b.displayName} passed {oftenWord(f.a.passRate, f.b.passRate)}.
      </p>
      <p className="lp-find-foot">
        Same {c.tasks} bug-fix tasks for both, {dayRange(c.from, c.to)}, every attempt at the provider’s list price.
        Picked by rule: the model whose correct fixes cost the most, next to the cheapest that passed at least as often.
      </p>
    </figure>
  );
}
