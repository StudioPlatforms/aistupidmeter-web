'use client';

import { Pane, Stats, Stat, Tag, Note } from '@/components/studio';
import { EmptyRow } from './bits';
import { ChartPane, DayLines } from './AdminCharts';
import { ago, compact, fullDate, num } from './format';

export interface VisitorStats {
  today: { visits: number; unique: number; topPages: Record<string, number>; topCountries: Record<string, number> };
  totals: { visits: number; unique: number };
  sevenDays: { visits: number; unique: number };
  thirtyDays: { visits: number; unique: number };
  daily: Array<{ date: string; visits: number; unique: number; topPages: Record<string, number>; topCountries: Record<string, number> }>;
}

export interface RecentVisitor {
  id: number;
  path: string;
  timestamp: string;
  country: string | null;
  city: string | null;
  referer: string | null;
  isUnique: boolean;
}

function host(referer: string): string {
  try { return new URL(referer).hostname; } catch { return referer; }
}

const SERIES = [
  { key: 'visits', label: 'Visits', color: 'var(--ad-c1)' },
  { key: 'unique', label: 'Unique visitors', color: 'var(--ad-c2)' },
];

export default function TrafficTab({ visitors, recent, onUpdateDaily, updating, updateNote }: {
  visitors: VisitorStats | null;
  recent: RecentVisitor[];
  onUpdateDaily: () => void;
  updating: boolean;
  updateNote: { tone: 'good' | 'bad'; text: string } | null;
}) {
  if (!visitors) return <Note title="Visitor statistics are loading">If this stays, the API's /visitors/stats is not answering.</Note>;
  const daily = [...visitors.daily].sort((x, y) => x.date.localeCompare(y.date));
  const dates = daily.map(d => d.date);
  const pages = Object.entries(visitors.today.topPages).slice(0, 10);
  const countries = Object.entries(visitors.today.topCountries || {}).slice(0, 10);

  return (
    <>
      <Stats columns={6}>
        <Stat value={num(visitors.today.visits)} label="Visits today" tone="accent" />
        <Stat value={num(visitors.today.unique)} label="Unique today" />
        <Stat value={num(visitors.sevenDays.visits)} label="Visits, 7 days" sub={`${num(visitors.sevenDays.unique)} unique`} />
        <Stat value={num(visitors.thirtyDays.visits)} label="Visits, 30 days" sub={`${num(visitors.thirtyDays.unique)} unique`} />
        <Stat
          value={<span title={num(visitors.totals.visits)}>{visitors.totals.visits >= 1e6 ? compact(visitors.totals.visits) : num(visitors.totals.visits)}</span>}
          label="Total visits"
          sub="All time"
        />
        <Stat value={num(visitors.totals.unique)} label="Unique visitors" sub="Last 90 days" />
      </Stats>

      <div className="ad-toolbar">
        <p className="st-hint">Daily totals are rolled up every hour. Update daily stats recomputes them now.</p>
        <button type="button" className="st-btn is-sm" onClick={onUpdateDaily} disabled={updating}>{updating ? 'Updating…' : 'Update daily stats'}</button>
        {updateNote && <span className={updateNote.tone === 'good' ? 'ad-ok' : 'st-error'} role="status">{updateNote.text}</span>}
      </div>

      <ChartPane
        title="Visits per day"
        sub={`Daily history, last ${daily.length} days. Today is still counting.`}
        dates={dates}
        series={SERIES}
        values={[daily.map(d => d.visits), daily.map(d => d.unique)]}
      >
        <DayLines dates={dates} series={SERIES} values={[daily.map(d => d.visits), daily.map(d => d.unique)]} />
      </ChartPane>

      <div className="st-grid">
        <Pane title="Top pages today" ruled flush>
          <div className="st-table-wrap">
            <table className="st-table">
              <tbody>
                {pages.length === 0 && <EmptyRow cols={2}>No visits yet today.</EmptyRow>}
                {pages.map(([page, count]) => (
                  <tr key={page}><td className="ad-path" title={page}>{page}</td><td className="is-num">{num(count)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
        <Pane
          title="Top countries today"
          ruled flush delay={0.06}
          foot={<a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="ad-ext">IP Geolocation by DB-IP</a>}
        >
          <div className="st-table-wrap">
            <table className="st-table">
              <tbody>
                {countries.length === 0 && <EmptyRow cols={2}>Locating today&apos;s visitors — filled in within a minute of each visit.</EmptyRow>}
                {countries.map(([country, count]) => (
                  <tr key={country}><td>{country}</td><td className="is-num">{num(count)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Pane>
      </div>

      <Pane title="Recent visitors" sub={`Last ${recent.length} visits. Location comes from the visitor's IP, which is never shown.`} ruled flush>
        <div className="st-table-wrap ad-scroll is-tall">
          <table className="st-table">
            <thead><tr><th className="is-num">When</th><th>Page</th><th>Location</th><th className="ad-hide-sm">From</th></tr></thead>
            <tbody>
              {recent.length === 0 && <EmptyRow cols={4}>No visits recorded yet.</EmptyRow>}
              {recent.map(v => (
                <tr key={v.id}>
                  <td className="is-num" title={fullDate(v.timestamp)}>{ago(v.timestamp)}</td>
                  <td className="ad-path" title={v.path}>{v.path}{v.isUnique && <> <Tag tone="accent">new visitor</Tag></>}</td>
                  <td className="is-dim">{v.country ? `${v.city ? `${v.city}, ` : ''}${v.country}` : 'Locating…'}</td>
                  <td className="is-dim ad-hide-sm ad-path" title={v.referer ?? undefined}>{v.referer ? host(v.referer) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Pane>
    </>
  );
}
