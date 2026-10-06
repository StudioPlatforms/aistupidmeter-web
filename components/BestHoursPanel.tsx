'use client';

/**
 * Best and worst hours to use a model, from two weeks of hourly canary probes
 * (API: GET /api/models/:id/best-hours, lib/best-hours.ts).
 *
 * The headline is the answer: the fastest and slowest four-hour windows, in UTC and in the
 * reader's own time. The 24 columns behind it show median response time per UTC hour. The
 * windows are only coloured when the API's test says the difference is real — highlighting
 * the extremes of noise would draw a pattern the data does not have.
 *
 * Colours (validated with the dataviz palette checker, light #fff / dark #292a2d surfaces):
 * fastest blue, slowest amber, others grey — blue/amber stays distinct under red-green colour
 * blindness, where the theme's green/red pair did not (ΔE 5.0 / 3.1). Identity never rests on
 * colour alone: the windows are named in the tiles and labelled on the chart, and every value
 * is in the table view.
 */

import { useEffect, useMemo, useState } from 'react';

interface HourStat { hour: number; samples: number; failed: number; medianMs: number | null }
interface WindowStat { startHour: number; endHour: number; medianMs: number; samples: number; failed: number }
interface BestHours {
  days: number; samples: number; failed: number; daysCovered: number;
  hours: HourStat[]; best: WindowStat | null; worst: WindowStat | null;
  slowerPct: number | null; pValue: number | null;
  verdict: 'clear' | 'weak' | 'none' | 'insufficient';
}

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/** The reader's local clock time for a UTC hour today (DST-correct for today). */
function localHour(utcHour: number): string {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function windowHours(w: WindowStat): number[] {
  return [0, 1, 2, 3].map(k => (w.startHour + k) % 24);
}

/** Round tick values for the y-axis, in seconds: at most four lines. */
function ticks(maxMs: number): number[] {
  const max = maxMs / 1000;
  const step = [0.5, 1, 2, 5, 10, 20, 30, 60].find(s => max / s <= 4) ?? 60;
  const out: number[] = [];
  for (let v = step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export default function BestHoursPanel({ modelId, modelName }: { modelId: number | null; modelName?: string }) {
  const [data, setData] = useState<BestHours | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!modelId) return;
    let live = true;
    setState('loading');
    fetch(`/api/models/${modelId}/best-hours`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!live) return; if (j?.success) { setData(j.data); setState('ready'); } else setState('error'); })
      .catch(() => { if (live) setState('error'); });
    return () => { live = false; };
  }, [modelId]);

  const real = data?.verdict === 'clear' || data?.verdict === 'weak';
  const fast = useMemo(() => new Set(real && data?.best ? windowHours(data.best) : []), [data, real]);
  const slow = useMemo(() => new Set(real && data?.worst ? windowHours(data.worst) : []), [data, real]);
  const maxMs = Math.max(1, ...(data?.hours ?? []).map(h => h.medianMs ?? 0));
  const gridTicks = ticks(maxMs);
  const top = Math.max(maxMs, (gridTicks[gridTicks.length - 1] ?? 0) * 1000);

  const name = modelName || 'this model';

  return (
    <div className="rv4-panel bh-panel" style={{ marginBottom: '16px' }}>
      <div className="rv4-panel-header">
        <span className="rv4-panel-title">Best and worst hours to use {name}</span>
        <span className="bh-caption">last {data?.days ?? 14} days · hourly probe</span>
      </div>
      <div className="rv4-panel-body bh-body">
        {state === 'loading' && !data && <div className="bh-muted">Loading two weeks of hourly probes…</div>}
        {state === 'error' && <div className="bh-muted">The hourly timings could not be loaded right now.</div>}

        {data && data.verdict === 'insufficient' && (
          <p className="bh-text">
            Not enough data yet: {data.samples} hourly probes over {data.daysCovered} day{data.daysCovered === 1 ? '' : 's'}.
            Best and worst hours appear once there are a few days of probes for every hour.
          </p>
        )}

        {data && data.verdict !== 'insufficient' && data.best && data.worst && (
          <>
            {real ? (
              <div className="bh-tiles">
                <div className="bh-tile">
                  <div className="bh-tile-label"><span className="bh-key bh-key-fast" aria-hidden />Fastest hours</div>
                  <div className="bh-tile-value">{pad(data.best.startHour)}–{pad(data.best.endHour)} UTC</div>
                  <div className="bh-tile-sub">
                    {localHour(data.best.startHour)}–{localHour(data.best.endHour)} your time · median {secs(data.best.medianMs)}
                  </div>
                </div>
                <div className="bh-tile">
                  <div className="bh-tile-label"><span className="bh-key bh-key-slow" aria-hidden />Slowest hours</div>
                  <div className="bh-tile-value">{pad(data.worst.startHour)}–{pad(data.worst.endHour)} UTC</div>
                  <div className="bh-tile-sub">
                    {localHour(data.worst.startHour)}–{localHour(data.worst.endHour)} your time · median {secs(data.worst.medianMs)}
                    {data.slowerPct !== null && <> · {data.slowerPct}% slower</>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bh-tiles">
                <div className="bh-tile">
                  <div className="bh-tile-label">Best time to use it</div>
                  <div className="bh-tile-value">Any time</div>
                  <div className="bh-tile-sub">No hour of the day is reliably faster or slower.</div>
                </div>
              </div>
            )}

            <p className="bh-text">
              {data.verdict === 'clear' && <>
                <strong>A consistent pattern.</strong> {name} answered {data.slowerPct}% slower in its slowest
                four hours than in its fastest, and the gap held from one day to the next — shuffling the hours
                at random produced a gap that large in only {(Math.max(data.pValue ?? 0, 0.002) * 100).toFixed(1)}% of tries.
                Schedule heavy or time-sensitive work in the fastest hours.
              </>}
              {data.verdict === 'weak' && <>
                <strong>A slight pattern.</strong> The slowest four hours ran {data.slowerPct}% slower than the
                fastest, but the gap is not dependable every day (it turned up in {((data.pValue ?? 0) * 100).toFixed(1)}% of
                random shuffles of the hours). Prefer the fastest hours if it costs you nothing.
              </>}
              {data.verdict === 'none' && <>
                The fastest four hours ({pad(data.best.startHour)}–{pad(data.best.endHour)} UTC, median {secs(data.best.medianMs)})
                and the slowest ({pad(data.worst.startHour)}–{pad(data.worst.endHour)} UTC, {secs(data.worst.medianMs)}) differ
                by {data.slowerPct}%, but a gap that size appears in {((data.pValue ?? 0) * 100).toFixed(0)}% of random shuffles of
                the hours: it is day-to-day noise, not a pattern you can plan around.
              </>}
              {data.failed > 0 && <> {data.failed} of {data.samples + data.failed} probes failed in this period (shown per hour in the table).</>}
            </p>

            {/* 24 columns: median response time by UTC hour */}
            <div className="bh-chart" role="img"
              aria-label={`Median response time by hour of day (UTC) for ${name}. Values are in the table below.`}>
              <div className="bh-plot">
                {gridTicks.map(t => (
                  <div key={t} className="bh-grid" style={{ bottom: `${(t * 1000 / top) * 100}%` }}>
                    <span>{t} s</span>
                  </div>
                ))}
                <div className="bh-cols">
                  {data.hours.map(h => {
                    const kind = fast.has(h.hour) ? 'fast' : slow.has(h.hour) ? 'slow' : 'neutral';
                    const pct = h.medianMs ? (h.medianMs / top) * 100 : 0;
                    return (
                      <div key={h.hour} className="bh-col"
                        // Mouse: hover. Touch: tap to show, tap again to hide (a touch fires
                        // pointerleave right after the tap, which would hide it at once).
                        onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(h.hour); }}
                        onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(null); }}
                        onClick={() => setHover(hover === h.hour ? null : h.hour)}>
                        {data.best && real && h.hour === data.best.startHour && <span className="bh-label">Fastest</span>}
                        {data.worst && real && h.hour === data.worst.startHour && <span className="bh-label">Slowest</span>}
                        <div className={`bh-bar bh-${kind}${hover === h.hour ? ' bh-hover' : ''}`} style={{ height: `${pct}%` }} />
                        {hover === h.hour && (
                          <div className={`bh-tip${h.hour >= 18 ? ' bh-tip-end' : h.hour <= 5 ? ' bh-tip-start' : ''}`} role="tooltip">
                            <strong>{h.medianMs ? secs(h.medianMs) : 'no data'}</strong>
                            <span>{pad(h.hour)} UTC · {localHour(h.hour)} your time</span>
                            <span>{h.samples} probes{h.failed ? ` · ${h.failed} failed` : ''}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bh-axis" aria-hidden>
                {data.hours.map(h => <span key={h.hour}>{h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}</span>)}
              </div>
              <div className="bh-axis-title" aria-hidden>Hour of day, UTC</div>
            </div>

            <details className="bh-table">
              <summary>Show the 24 hours as a table</summary>
              <table>
                <thead><tr><th>Hour (UTC)</th><th>Your time</th><th>Median</th><th>Probes</th><th>Failed</th></tr></thead>
                <tbody>
                  {data.hours.map(h => (
                    <tr key={h.hour}>
                      <td>{pad(h.hour)}{fast.has(h.hour) ? ' · fastest' : slow.has(h.hour) ? ' · slowest' : ''}</td>
                      <td>{localHour(h.hour)}</td>
                      <td>{h.medianMs ? secs(h.medianMs) : '—'}</td>
                      <td>{h.samples}</td>
                      <td>{h.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            <p className="bh-note">
              From {data.samples} hourly probes over {data.daysCovered} days: the same two short tasks every
              hour, timed end to end. Medians, with each probe compared against its own day so one slow day does
              not make its hours look slow.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
