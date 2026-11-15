import Link from 'next/link';
import type { PublishedScores, Headline } from '@/lib/marketplace-public';
import { monthName } from '@/lib/marketplace-spot';

/**
 * A listing's published measurement (Phase 3 plan §4.5 rows 2-6, §4.6; M6b), from published days only: the mean ±
 * SE per suite over its newest counted runs (whole number ± one decimal), the tasks each suite covered as counts, the
 * speed (measured with the host's benchmark key), 30 days of availability, drift and how many runs completed. Daily
 * means are rounded to whole points and appear one to two days after the day ends; no single run is shown.
 */
const SUITES: Array<[keyof PublishedScores['headline'], string]> = [
  ['combined', 'Combined'], ['coding', 'Coding'], ['reasoning', 'Reasoning'], ['tooling', 'Tool use'], ['canary', 'Hourly probe'],
];
const day = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const cell = (h: Headline | null) => (h ? (h.se === null ? `${h.mean}` : `${h.mean} ± ${h.se.toFixed(1)}`) : '—');
const pct = (x: number | null) => (x === null ? '—' : `${x.toFixed(1)}%`);

/** F5b: the daily means (newest first) in runs of the same task set: one run, or a run per series across the break. */
export function dailyRuns<T extends { fresh?: boolean }>(xs: readonly T[]): Array<{ fresh: boolean; days: T[] }> {
  const out: Array<{ fresh: boolean; days: T[] }> = [];
  for (const d of xs) {
    const f = d.fresh === true;
    if (out.length && out[out.length - 1].fresh === f) out[out.length - 1].days.push(d); else out.push({ fresh: f, days: [d] });
  }
  return out;
}

export default function MeasuredScores({ scores: s, title, href, daily }: {
  scores: PublishedScores; title?: string; href?: string; daily?: Array<{ day: string; suite: string; mean: number; runs: number; fresh?: true }>;
}) {
  const rows = SUITES.filter(([k]) => s.headline[k] || (k !== 'combined' && s.coverage[k as 'coding']));
  const recent = (daily ?? []).filter(d => d.suite === 'combined').slice(0, 14);
  const remeasuring = !!s.remeasuring && Object.keys(s.remeasuring).length > 0;
  const runs = dailyRuns(recent);
  return (
    <div className="mp-scores">
      {title && <h3 className="mp-scores-t">{href ? <Link href={href}>{title}</Link> : title}</h3>}
      {/* F5: a suite whose series broke when the listing moved to fresh task versions, until 3 runs are published; its
          "Re-measuring" line names the suites, so the general "Measuring" line (no combined headline yet) gives way to it. */}
      {s.measuring && !s.headline.combined && !remeasuring && <p className="mp-caption">Measuring: {s.measuring.runs} of {s.measuring.of} runs on the current task version.</p>}
      {remeasuring && (
        <p className="mp-caption">Re-measuring on fresh task versions: {SUITES.filter(([k]) => k !== 'combined' && s.remeasuring?.[k as 'coding']).map(([k, label]) => `${label} ${s.remeasuring?.[k as 'coding']?.runs} of ${s.remeasuring?.[k as 'coding']?.of} runs`).join(' · ')}.</p>
      )}
      {rows.length > 0 && (
        <div className="mp-table-wrap">
          <table className="mp-table">
            <thead><tr><th scope="col">Suite</th><th scope="col">Mean ± SE</th><th scope="col">Runs</th><th scope="col">Tasks</th><th scope="col">Last published day</th><th scope="col">Drift</th></tr></thead>
            <tbody>
              {rows.map(([k, label]) => {
                const h = s.headline[k];
                return (
                  <tr key={k}>
                    <td data-label="Suite">{label}</td>
                    <td data-label="Mean ± SE">{cell(h)}</td>
                    <td data-label="Runs">{h ? h.runs : '—'}</td>
                    <td data-label="Tasks">{k === 'combined' ? '—' : s.coverage[k as 'coding'] ?? '—'}</td>
                    <td data-label="Last published day">{h ? day(h.lastDay) : '—'}</td>
                    <td data-label="Drift">{k === 'combined' ? '—' : s.drift[k as 'coding'] ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <dl className="mp-kv">
        <div><dt>Time to first byte (p50)</dt><dd>{s.speed?.ttftP50Ms != null ? `${(s.speed.ttftP50Ms / 1000).toFixed(2)} s` : '—'}</dd></div>
        <div><dt>Output tokens per second (p50)</dt><dd>{s.speed?.outputTpsP50 != null ? s.speed.outputTpsP50.toFixed(1) : '—'}</dd></div>
        <div><dt>API reachability, 30 days</dt><dd>{pct(s.availability.apiReachability)}{s.availability.checks ? ` of ${s.availability.checks.toLocaleString('en')} checks` : ''}</dd></div>
        <div><dt>Hourly probes answered, 30 days</dt><dd>{pct(s.availability.inferenceAvailability)}{s.availability.probes ? ` of ${s.availability.probes.toLocaleString('en')}` : ''}</dd></div>
        {s.completion && <div><dt>Runs completed</dt><dd>{s.completion.completed} of {s.completion.total} in {s.completion.days} days</dd></div>}
      </dl>
      {s.speed && s.speed.source === 'spot' && s.speed.month && <p className="mp-caption">Speed measured through an ordinary customer account over {s.speed.runs} spot run{s.speed.runs === 1 ? '' : 's'} in {monthName(s.speed.month)}, published once a month; output tokens are the billed ones, reasoning included.</p>}
      {s.speed && s.speed.source !== 'spot' && <p className="mp-caption">Speed measured with the host&apos;s benchmark key over {s.speed.runs} published run{s.speed.runs === 1 ? '' : 's'}; output tokens are the billed ones, reasoning included.</p>}
      {/* F5b (web review SHOULD-4): a list that crosses the listing's move to fresh task versions says where its series breaks. */}
      {runs.length === 1 && <p className="mp-caption">Daily Combined means: {runs[0].days.map(d => `${day(d.day)} ${d.mean}`).join(' · ')}.</p>}
      {runs.length > 1 && (
        <p className="mp-caption">{runs.map((r, i) => `${i === 0 ? 'Daily Combined means, on' : ' Before that, on'} ${r.fresh ? 'fresh task versions' : 'the standard tasks'}: ${r.days.map(d => `${day(d.day)} ${d.mean}`).join(' · ')}.`).join('')}</p>
      )}
    </div>
  );
}
