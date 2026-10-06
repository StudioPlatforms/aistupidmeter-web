'use client';

/**
 * The project's monthly budget and each person's cap in it. The budget decides what happens when
 * the month's spend reaches it (alert only, refuse, or switch to the cheapest models); caps are
 * always hard. Thresholds email the owner and managers once each per month.
 */
import { useState } from 'react';
import { wsApi, money, pct, dateTime } from '../ws';
import type { ProjectData } from './types';

const MODES: Array<{ id: 'alert' | 'block' | 'downgrade'; label: string; help: string }> = [
  { id: 'alert', label: 'Alert only', help: 'Requests continue past the budget; the owner and managers are emailed at each threshold.' },
  { id: 'downgrade', label: 'Switch to the cheapest models', help: 'Past the budget, routed requests go to the cheapest models and requests that name a model are refused. Work continues at the lowest cost.' },
  { id: 'block', label: 'Stop at the budget', help: 'A request that could take the month past the budget is refused (HTTP 429, with the reason) until the 1st or until the budget is raised.' },
];
const MARKS = [25, 50, 75, 80, 90];

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

  return (
    <>
      <section className="ws-section">
        <h2>This month</h2>
        <div className="ws-tiles">
          <div className="ws-tile">
            <div className="ws-tile-label">Spent so far</div>
            <div className="ws-tile-value">{money(m.spendUsd)}</div>
            <div className="ws-tile-sub">{m.requests.toLocaleString()} requests, day {Math.ceil(m.daysElapsed)} of {m.daysInMonth}</div>
          </div>
          <div className="ws-tile">
            <div className="ws-tile-label">Budget</div>
            <div className="ws-tile-value">{b.monthlyUsd ? money(b.monthlyUsd) : 'None'}</div>
            <div className="ws-tile-sub">{b.monthlyUsd ? `${pct(used)} used · ${MODES.find(x => x.id === b.mode)?.label.toLowerCase()}` : 'set one below'}</div>
          </div>
          <div className="ws-tile">
            <div className="ws-tile-label">At this rate, by month end</div>
            <div className="ws-tile-value">{m.forecastUsd !== null ? money(m.forecastUsd) : '—'}</div>
            <div className="ws-tile-sub">{m.forecastUsd === null ? 'shown from the second day of spending' : forecastShare !== null ? `${pct(forecastShare)} of the budget` : 'a straight-line estimate'}</div>
          </div>
          <div className="ws-tile">
            <div className="ws-tile-label">Your cap here</div>
            <div className="ws-tile-value">{d.me.monthlyCapUsd ? money(d.me.monthlyCapUsd) : 'None'}</div>
            <div className="ws-tile-sub">you have spent {money(d.me.monthSpendUsd)}</div>
          </div>
        </div>
        {b.monthlyUsd && (
          <>
            <div className={`ws-bar${used !== null && used >= 1 ? ' bad' : used !== null && used >= 0.8 ? ' warn' : ''}`} style={{ height: 10 }}
              title={`${pct(used)} of the budget${forecastShare !== null ? `; forecast ${pct(forecastShare)}` : ''}`}>
              <i style={{ width: `${Math.min(100, (used ?? 0) * 100)}%` }} />
              {forecastShare !== null && forecastShare <= 1 && <b style={{ left: `${forecastShare * 100}%` }} title="Forecast at the current rate" />}
            </div>
            <p className="ws-note" style={{ marginTop: 6 }}>
              {used !== null && used >= 1
                ? b.mode === 'block' ? `The budget is reached: requests are refused until ${resets} or until it is raised.`
                  : b.mode === 'downgrade' ? `The budget is reached: routed requests use the cheapest models until ${resets}.`
                  : 'The budget is passed; this budget only sends alerts.'
                : `Resets on ${resets}.`}
              {' '}Spend is estimated at list prices from the tokens used; your provider&rsquo;s invoice is the final word.
            </p>
          </>
        )}
      </section>

      {d.me.canManage ? (
        <section className="ws-section">
          <h2>Budget and caps</h2>
          <form onSubmit={async e => {
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
            <div className="ws-grid-2">
              <label className="ws-field"><span>Monthly budget for the project ($)</span>
                <input name="budget" type="number" min={0.01} step="0.01" className="ws-input" defaultValue={b.monthlyUsd ?? ''} placeholder="No budget" /></label>
              <label className="ws-field"><span>Monthly cap per person ($)</span>
                <input name="cap" type="number" min={0.01} step="0.01" className="ws-input" defaultValue={b.memberCapUsd ?? ''} placeholder="No cap" />
                <small className="ws-note">Everyone&rsquo;s default; set a different one per person below. A person at their cap is refused, whatever the budget mode.</small></label>
            </div>
            <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
              <legend className="ws-note" style={{ marginBottom: 8 }}>When the month&rsquo;s spend reaches the budget</legend>
              {MODES.map(x => (
                <label key={x.id} className="ws-check" style={{ marginBottom: 8 }}>
                  <input type="radio" name="mode" checked={mode === x.id} onChange={() => setMode(x.id)} />
                  <span>{x.label}<small>{x.help}</small></span>
                </label>
              ))}
            </fieldset>
            <fieldset style={{ border: 'none', padding: 0, margin: '8px 0 0' }}>
              <legend className="ws-note" style={{ marginBottom: 8 }}>Email the owner and managers at</legend>
              <div className="ws-form">
                {MARKS.map(x => (
                  <label key={x} className="ws-check"><input type="checkbox" name={`m${x}`} defaultChecked={b.thresholds.some(t => Math.round(t * 100) === x)} /><span>{x}%</span></label>
                ))}
                <span className="ws-note">and 100%, always</span>
              </div>
            </fieldset>
            <button className="ws-btn primary" style={{ marginTop: 14 }}>Save budget</button>
          </form>
        </section>
      ) : (
        <section className="ws-section">
          <h2>Budget and caps</h2>
          <div className="ws-facts">
            <div>Monthly budget</div><div>{b.monthlyUsd ? `${money(b.monthlyUsd)} — ${MODES.find(x => x.id === b.mode)?.label.toLowerCase()}` : 'None'}</div>
            <div>Cap per person</div><div>{b.memberCapUsd ? money(b.memberCapUsd) : 'None'}</div>
            <div>Your cap</div><div>{d.me.monthlyCapUsd ? money(d.me.monthlyCapUsd) : 'None'}</div>
          </div>
        </section>
      )}

      {d.me.canSeeSpendDetail && (
        <section className="ws-section">
          <h2>People this month</h2>
          <div className="ws-table-wrap">
            <table className="ws-table ws-stack">
              <thead><tr><th>Person</th><th className="num">Spent</th><th className="num">Cap</th><th style={{ minWidth: 120 }} className="ws-hide-sm">Used</th>{d.me.canManage && <th>Their own cap</th>}</tr></thead>
              <tbody>
                {d.members.filter(p => p.wsRole !== 'viewer').map(p => {
                  const share = p.effectiveCapUsd && p.monthSpendUsd !== null ? p.monthSpendUsd / p.effectiveCapUsd : null;
                  return (
                    <tr key={p.userId}>
                      <td className="ws-name">{p.name}</td>
                      <td className="num" data-label="Spent">{money(p.monthSpendUsd)}</td>
                      <td className="num" data-label="Cap">{p.effectiveCapUsd ? money(p.effectiveCapUsd) : '—'}{p.capUsd ? '' : p.effectiveCapUsd ? <span className="dim"> (default)</span> : ''}</td>
                      <td className="ws-hide-sm">{share !== null && <div className={`ws-bar${share >= 1 ? ' bad' : share >= 0.8 ? ' warn' : ''}`}><i style={{ width: `${Math.min(100, share * 100)}%` }} /></div>}</td>
                      {d.me.canManage && (
                        <td>
                          {p.listed ? (
                            <form className="ws-form inline" style={{ flexWrap: 'nowrap' }} onSubmit={async e => {
                              e.preventDefault();
                              const v = String(new FormData(e.currentTarget).get('cap') ?? '');
                              const r = await wsApi(`/projects/${d.project.id}/members/${p.userId}`, { method: 'PATCH', body: { monthlyCapUsd: v === '' ? null : Number(v) } });
                              flash(r.ok ? `Cap saved for ${p.name}.` : (r.error ?? 'Could not save'), !r.ok);
                              if (r.ok) reload();
                            }}>
                              <input name="cap" type="number" min={0.01} step="0.01" defaultValue={p.capUsd ?? ''} placeholder="Default" className="ws-input" style={{ width: 100 }} />
                              <button className="ws-btn small">Save</button>
                            </form>
                          ) : <span className="dim" style={{ fontSize: 12.5 }}>Owner: no cap</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="ws-section">
        <h2>Budget notices</h2>
        {d.budgetEvents.length === 0 ? <p className="ws-empty">No thresholds crossed yet.</p> : (
          <table className="ws-table">
            <tbody>
              {d.budgetEvents.map((e, i) => (
                <tr key={i}>
                  <td className="nowrap dim">{dateTime(e.at)}</td>
                  <td>
                    {e.kind === 'threshold' && <>The project reached {pct(e.threshold)} of its {money(e.limitUsd)} budget</>}
                    {e.kind === 'exceeded' && <>The project reached its {money(e.limitUsd)} budget</>}
                    {e.kind === 'member_cap_warning' && <>{e.person} used 80% of their {money(e.limitUsd)} cap</>}
                    {e.kind === 'member_cap_reached' && <>{e.person} reached their {money(e.limitUsd)} cap</>}
                    <span className="dim"> · {money(e.spendUsd)} spent</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
