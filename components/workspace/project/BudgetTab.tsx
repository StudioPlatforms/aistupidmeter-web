'use client';

/**
 * The project's monthly budget and each person's cap in it. The budget decides what happens when
 * the month's spend reaches it (alert only, refuse, or switch to the cheapest models); caps are
 * always hard. Thresholds email the owner and managers once each per month.
 */
import { useState, type ReactNode } from 'react';
import { Pane, Stats, Stat, CountUp } from '@/components/studio';
import { wsApi, money, pct, dateTime } from '../ws';
import type { ProjectData } from './types';

const MODES: Array<{ id: 'alert' | 'block' | 'downgrade'; label: string; help: string }> = [
  { id: 'alert', label: 'Alert only', help: 'Requests continue past the budget; the owner and managers are emailed at each threshold.' },
  { id: 'downgrade', label: 'Switch to the cheapest models', help: 'Past the budget, routed requests go to the cheapest models and requests that name a model are refused. Work continues at the lowest cost.' },
  { id: 'block', label: 'Stop at the budget', help: 'A request that could take the month past the budget is refused (HTTP 429, with the reason) until the 1st or until the budget is raised.' },
];
const MARKS = [25, 50, 75, 80, 90];

/** A dollar figure that counts up. */
const count = (n: number, format: (n: number) => string): ReactNode => <CountUp value={n} format={format} />;

export default function BudgetTab({ d, reload, flash }: { d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void }) {
  const b = d.budget;
  const m = b.month;
  const used = m.budgetUsed;
  const forecastShare = b.monthlyUsd && m.forecastUsd !== null ? m.forecastUsd / b.monthlyUsd : null;
  const [mode, setMode] = useState(b.mode);
  const resets = (() => {
    const [y, mo] = m.month.split('-').map(Number);
    return new Date(Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1)).toLocaleDateString(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  })();

  const tone = (share: number | null) => share !== null && share >= 1 ? ' is-bad' : share !== null && share >= 0.8 ? ' is-warn' : '';
  const modeLabel = MODES.find(x => x.id === b.mode)?.label.toLowerCase();

  return (
    <>
      <Stats columns={4}>
        <Stat value={count(m.spendUsd, money)} label="Spent so far" sub={`${m.requests.toLocaleString()} requests, day ${Math.ceil(m.daysElapsed)} of ${m.daysInMonth}`} />
        <Stat value={b.monthlyUsd ? count(b.monthlyUsd, money) : 'None'} label="Budget" sub={b.monthlyUsd ? `${pct(used)} used · ${modeLabel}` : 'set one below'} />
        <Stat
          value={m.forecastUsd !== null ? count(m.forecastUsd, money) : '—'}
          label="At this rate, by month end"
          sub={m.forecastUsd === null ? 'shown from the second day of spending' : forecastShare !== null ? `${pct(forecastShare)} of the budget` : 'a straight-line estimate'}
          tone={forecastShare !== null && forecastShare > 1 ? 'warn' : undefined}
        />
        <Stat value={d.me.monthlyCapUsd ? count(d.me.monthlyCapUsd, money) : 'None'} label="Your cap here" sub={`you have spent ${money(d.me.monthSpendUsd)}`} />
      </Stats>

      {b.monthlyUsd && (
        <Pane
          title="This month"
          sub={<>
            {used !== null && used >= 1
              ? b.mode === 'block' ? `The budget is reached: requests are refused until ${resets} or until it is raised.`
                : b.mode === 'downgrade' ? `The budget is reached: routed requests use the cheapest models until ${resets}.`
                : 'The budget is passed; this budget only sends alerts.'
              : `Resets on ${resets}.`}
            {' '}Spend is estimated at list prices from the tokens used; your provider&rsquo;s invoice is the final word.
          </>}
          delay={0.04}
        >
          <div className="sw-figure">
            <b>{pct(used)}</b>
            <small>of the {money(b.monthlyUsd)} budget used</small>
          </div>
          <div className="sw-budget" title={`${pct(used)} of the budget${forecastShare !== null ? `; forecast ${pct(forecastShare)}` : ''}`}>
            <div className={`st-meter sw-meter-lg${tone(used)}`}><i style={{ width: `${Math.min(100, (used ?? 0) * 100)}%` }} /></div>
            {forecastShare !== null && forecastShare <= 1 && <span className="sw-forecast" style={{ left: `${forecastShare * 100}%` }} title="Forecast at the current rate" />}
          </div>
          <div className="sw-legend">
            <span><span className={`st-key${used !== null && used >= 1 ? ' is-bad' : used !== null && used >= 0.8 ? ' is-warn' : ' is-accent'}`} aria-hidden="true" />Spent {money(m.spendUsd)}</span>
            {m.forecastUsd !== null && (
              <span><span className="sw-forecast-key" aria-hidden="true" />Forecast at the current rate: {money(m.forecastUsd)}{forecastShare !== null && forecastShare > 1 ? ` (${pct(forecastShare)} of the budget)` : ''}</span>
            )}
          </div>
        </Pane>
      )}

      {d.me.canManage ? (
        <Pane title="Budget and caps" ruled delay={0.06}>
          <form className="sw-stack" onSubmit={async e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const marks = MARKS.filter(x => f.get(`m${x}`));
            const r = await wsApi(`/projects/${d.project.id}/budget`, { method: 'PUT', body: {
              monthlyUsd: f.get('budget') === '' ? null : Number(f.get('budget')), mode,
              thresholds: [...marks, 100], memberCapUsd: f.get('cap') === '' ? null : Number(f.get('cap')),
            } });
            flash(r.ok ? 'Budget saved. It applies to the next request.' : (r.error ?? 'Could not save'), !r.ok);
            if (r.ok) reload();
          }}>
            <div className="sw-grid2">
              <label className="st-field">
                <span className="st-field-label">Monthly budget for the project <small>$</small></span>
                <input name="budget" type="number" min={0.01} step="0.01" className="st-input" defaultValue={b.monthlyUsd ?? ''} placeholder="No budget" />
              </label>
              <label className="st-field">
                <span className="st-field-label">Monthly cap per person <small>$</small></span>
                <input name="cap" type="number" min={0.01} step="0.01" className="st-input" defaultValue={b.memberCapUsd ?? ''} placeholder="No cap" />
                <small className="st-hint">Everyone&rsquo;s default; set a different one per person below. A person at their cap is refused, whatever the budget mode.</small>
              </label>
            </div>
            <fieldset className="sw-fieldset sw-gap-top">
              <legend>When the month&rsquo;s spend reaches the budget</legend>
              <div className="st-cards sw-modes">
                {MODES.map(x => (
                  <label key={x.id} className={`st-card sw-choice${mode === x.id ? ' is-on' : ''}`}>
                    <span className="st-card-t">
                      <input type="radio" name="mode" className="st-check" checked={mode === x.id} onChange={() => setMode(x.id)} />
                      {x.label}
                    </span>
                    <span className="st-card-d">{x.help}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="sw-fieldset sw-gap-top">
              <legend>Email the owner and managers at</legend>
              <div className="sw-marks">
                {MARKS.map(x => (
                  <label key={x} className="sw-mark">
                    <input type="checkbox" className="st-check" name={`m${x}`} defaultChecked={b.thresholds.some(t => Math.round(t * 100) === x)} />
                    <span>{x}%</span>
                  </label>
                ))}
                <span className="st-hint">and 100%, always</span>
              </div>
            </fieldset>
            <div className="st-actions sw-rule-top"><button type="submit" className="st-btn is-primary">Save budget</button></div>
          </form>
        </Pane>
      ) : (
        <Pane title="Budget and caps" delay={0.06}>
          <dl className="st-kv sw-kv">
            <div><dt>Monthly budget</dt><dd>{b.monthlyUsd ? `${money(b.monthlyUsd)} — ${modeLabel}` : 'None'}</dd></div>
            <div><dt>Cap per person</dt><dd>{b.memberCapUsd ? money(b.memberCapUsd) : 'None'}</dd></div>
            <div><dt>Your cap</dt><dd>{d.me.monthlyCapUsd ? money(d.me.monthlyCapUsd) : 'None'}</dd></div>
          </dl>
        </Pane>
      )}

      {d.me.canSeeSpendDetail && (
        <Pane title="People this month" ruled flush delay={0.06}>
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead><tr><th>Person</th><th className="is-num">Spent</th><th className="is-num">Cap</th><th className="sw-hide-sm sw-used-col">Used</th>{d.me.canManage && <th>Their own cap</th>}</tr></thead>
              <tbody>
                {d.members.filter(p => p.wsRole !== 'viewer').map(p => {
                  const share = p.effectiveCapUsd && p.monthSpendUsd !== null ? p.monthSpendUsd / p.effectiveCapUsd : null;
                  return (
                    <tr key={p.userId}>
                      <td className="is-head"><span className="sw-t">{p.name}</span></td>
                      <td className="is-num" data-label="Spent">{money(p.monthSpendUsd)}</td>
                      <td className="is-num" data-label="Cap"><span>{p.effectiveCapUsd ? money(p.effectiveCapUsd) : '—'}{p.capUsd ? '' : p.effectiveCapUsd ? <span className="sw-dim"> (default)</span> : ''}</span></td>
                      <td className="sw-hide-sm">
                        {share !== null && <div className={`st-meter sw-meter${tone(share)}`} title={pct(share)}><i style={{ width: `${Math.min(100, share * 100)}%` }} /></div>}
                      </td>
                      {d.me.canManage && (
                        <td className="sw-mid" data-label="Their own cap">
                          {p.listed ? (
                            <form className="sw-capform" onSubmit={async e => {
                              e.preventDefault();
                              const v = String(new FormData(e.currentTarget).get('cap') ?? '');
                              const r = await wsApi(`/projects/${d.project.id}/members/${p.userId}`, { method: 'PATCH', body: { monthlyCapUsd: v === '' ? null : Number(v) } });
                              flash(r.ok ? `Cap saved for ${p.name}.` : (r.error ?? 'Could not save'), !r.ok);
                              if (r.ok) reload();
                            }}>
                              <input name="cap" type="number" min={0.01} step="0.01" defaultValue={p.capUsd ?? ''} placeholder="Default" className="st-input" aria-label={`Monthly cap for ${p.name} ($)`} />
                              <button type="submit" className="st-btn is-sm">Save</button>
                            </form>
                          ) : <span className="sw-status">Owner: no cap</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Pane>
      )}

      <Pane title="Budget notices" ruled={d.budgetEvents.length > 0} flush delay={0.06}>
        {d.budgetEvents.length === 0 ? (
          <div className="sw-none">
            <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
            <p>No thresholds crossed yet.</p>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table is-stack sw-log">
              <tbody>
                {d.budgetEvents.map((e, i) => (
                  <tr key={i}>
                    <td className="is-head is-dim sw-when">{dateTime(e.at)}</td>
                    <td className="sw-log-text">
                      {e.kind === 'threshold' && <>The project reached {pct(e.threshold)} of its {money(e.limitUsd)} budget</>}
                      {e.kind === 'exceeded' && <>The project reached its {money(e.limitUsd)} budget</>}
                      {e.kind === 'member_cap_warning' && <>{e.person} used 80% of their {money(e.limitUsd)} cap</>}
                      {e.kind === 'member_cap_reached' && <>{e.person} reached their {money(e.limitUsd)} cap</>}
                      <span className="sw-dim"> · {money(e.spendUsd)} spent</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Pane>
    </>
  );
}
