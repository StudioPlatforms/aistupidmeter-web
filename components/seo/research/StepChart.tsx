/**
 * A before→after chart: one row per dated event, a hollow mark at the value before the step, a
 * filled mark at the value after, joined by a line, with the size of the change labelled at the
 * new value. Positions are percentages of the row, so the plot fits any width without scaling
 * its text. Every row carries a native tooltip (<title>) and the same numbers sit in the table
 * beside the chart, so nothing is readable only by colour or hover.
 */
export interface StepItem {
  label: string;
  sub?: string;
  before: number;
  after: number;
  /** The change as the source states it, e.g. "−28%". */
  change: string;
}

const pct = (v: number, max: number) => `${((Math.max(0, Math.min(v, max)) / max) * 100).toFixed(2)}%`;

export function StepChart({ title, caption, items, max, unit, ticks }: {
  title: string;
  caption: string;
  items: StepItem[];
  /** Top of the scale, in `unit`. */
  max: number;
  unit: string;
  ticks: number[];
}) {
  if (!items.length) return null;
  return (
    <figure className="rs-fig lp-up">
      <figcaption><b>{title}</b><span>{caption}</span></figcaption>
      <div className="rs-db" role="img" aria-label={`${title}: ${items.map((it) => `${it.label} ${it.before} to ${it.after} ${unit} (${it.change})`).join('; ')}`}>
        {items.map((it) => {
          const fell = it.after < it.before;
          const x1 = pct(it.before, max);
          const x2 = pct(it.after, max);
          return (
            <div key={`${it.label}-${it.sub ?? ''}`} className="rs-db-row">
              <p className="rs-db-label">{it.label}{it.sub && <small>{it.sub}</small>}</p>
              <svg className="rs-db-plot" aria-hidden="true">
                <title>{`${it.label}: ${it.before} ${unit} → ${it.after} ${unit} (${it.change})`}</title>
                <rect className="hit" x="0" y="0" width="100%" height="32" />
                {ticks.map((t) => <line key={t} className="grid" x1={pct(t, max)} x2={pct(t, max)} y1="2" y2="30" />)}
                <line className="link" x1={x1} x2={x2} y1="16" y2="16" />
                <circle className="before" cx={x1} cy="16" r="5" />
                <circle className="after" cx={x2} cy="16" r="5" />
                <text x={x2} dx={fell ? -11 : 11} y="20" textAnchor={fell ? 'end' : 'start'}>{it.change}</text>
              </svg>
            </div>
          );
        })}
        <div className="rs-db-axis" aria-hidden="true">
          <span />
          <svg>
            {ticks.map((t) => <text key={t} x={pct(t, max)} y="12" textAnchor={t === 0 ? 'start' : t === max ? 'end' : 'middle'}>{t} {unit}</text>)}
          </svg>
        </div>
      </div>
      <p className="rs-legend"><span><i />before the step</span><span className="after"><i />after the step</span></p>
    </figure>
  );
}
