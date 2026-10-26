import { AsOf } from '@/components/seo/Verdict';
import { utcStamp } from '@/lib/seo';
import { fleetCounts, numWord, type WorseData } from './worse-data';

/**
 * The "Drift monitor now" figures: how many models are on the 24-hour boards, how many of the
 * per-suite Page-Hinkley detectors are armed, how many have fired and how many are still in
 * their first ten days, with the time the figures were read. Counts come from the boards and
 * the drift signatures (worse-data.ts); the block renders nothing when neither answered, so the
 * page never shows a placeholder. Server component in the landing's figure strip (.lp-facts).
 */
export function DriftMonitorNow({ data }: { data: WorseData }) {
  const c = fleetCounts(data.models);
  if (!c.onBoard && !c.series) return null;
  const coldStart = data.models.flatMap((m) => m.detectors).find((d) => d.kind !== 'none')?.coldStart ?? 10;
  return (
    <div className="wr-monitor lp-up">
      <dl className="lp-facts">
        {c.onBoard > 0 && <div><dt>{c.onBoard}</dt><dd>models on the 24-hour boards, each with its own detector per suite</dd></div>}
        {c.series > 0 && <div><dt>{c.armed} of {c.series}</dt><dd>model-suite detectors armed, each on {numWord(coldStart)} days or more of daily medians</dd></div>}
        {c.series > 0 && <div><dt>{c.fired}</dt><dd>{c.fired === 1 ? 'detector has' : 'detectors have'} fired; {c.cold} {c.cold === 1 ? 'is' : 'are'} younger than {numWord(coldStart)} days</dd></div>}
      </dl>
      {data.asOf && <AsOf>As of {utcStamp(data.asOf)} · 24-hour boards and per-suite Page-Hinkley detectors · {c.flagged === 0 ? 'no model is below its recent baseline on any board' : `${c.flagged} ${c.flagged === 1 ? 'model shows' : 'models show'} a downward trend or a detection`}</AsOf>}
    </div>
  );
}
