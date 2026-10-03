/**
 * Shared by the context-rot page (app/context-rot) and the model detail panel
 * (components/model-detail/ModelDetailContextRot): the response shape, number formatting,
 * and the position heatmap. Styles: styles/context-rot.css (crt-*).
 */

export type Skill = 'retrieval' | 'linking' | 'tracking' | 'counting';
export interface SkillStat { accuracy: number; correct: number; total: number }
export interface CrtBucket {
  bucket: number; runnable: boolean; trials: number; excluded: number;
  accuracy: number | null; correct: number; total: number; tokens: number | null;
  skills: Record<Skill, SkillStat | null>;
}
export interface CrtCell { bucket: number; depth: number; correct: number; total: number }
export interface CrtModel {
  name: string; displayName: string; vendor: string; window: number;
  sweeps: number; latestSweep: string | null;
  baseline: number | null; effectiveContext: number | null; effectiveIsLowerBound?: boolean; holdRatio: number;
  buckets: CrtBucket[]; grid: CrtCell[]; gridSweeps: number;
}

export const SKILLS: Array<[Skill, string]> = [
  ['retrieval', 'Finding a fact'], ['linking', 'Linking facts'], ['tracking', 'Tracking updates'], ['counting', 'Counting'],
];

/** 8000 → "8K", 1000000 → "1M". */
export const k = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}K`);
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

/** "A, B and C". */
export const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Colour key for HeatGrid. The ramp runs light→dark in light theme and dark→light in dark
 *  theme (more accurate = more contrast with the surface), so the key is drawn, not described. */
export function HeatLegend() {
  return (
    <div className="crt-heatkey" aria-hidden="true">
      <span>0%</span>
      {[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i} className={`crt-cell-${i}`} />)}
      <span>100%</span>
      <i className="crt-cell-empty" /><span>not measured</span>
    </div>
  );
}

/** Finding-a-fact accuracy by position (rows) and length (columns), one model. */
export function HeatGrid({ model, buckets, depths }: { model: CrtModel; buckets: number[]; depths: number[] }) {
  const shade = (a: number | null) => (a === null ? 'crt-cell-empty' : `crt-cell-${Math.min(6, Math.floor(a * 6.999))}`);
  return (
    <table className="crt-heat" aria-label={`${model.displayName}: finding-a-fact accuracy by position and length`}>
      <thead><tr><th />{buckets.map(b => <th key={b}>{k(b)}</th>)}</tr></thead>
      <tbody>
        {depths.map(d => (
          <tr key={d}>
            <th>{Math.round(d * 100)}%</th>
            {buckets.map(b => {
              const c = model.grid.find(g => g.bucket === b && g.depth === d);
              const a = c && c.total ? c.correct / c.total : null;
              return <td key={b} className={shade(a)} title={c && c.total ? `${Math.round(d * 100)}% through, ${k(b)}: ${c.correct}/${c.total}` : 'Not measured'} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
