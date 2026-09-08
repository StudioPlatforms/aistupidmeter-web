'use client';

/**
 * Task-level regressions for one model.
 *
 * WHY THIS PANEL EXISTS
 * ---------------------
 * Everything else on this page is an aggregate. The composite score, the CUSUM
 * curve and the performance matrix all summarise across the whole task set, and
 * a single task failing is arithmetically invisible to all of them: one task in
 * ten collapsing moves the composite by roughly 3 points against a 5-point
 * alert floor. This is the only view on the page that can show it.
 *
 * The detector behind it (api: lib/slice-drift.ts) reads execution records
 * rather than composite scores, so it also stays meaningful when the suites are
 * falling back to modelled scores during a provider outage.
 */

import { useEffect, useState } from 'react';

interface SliceRegression {
  id: number;
  modelId: number;
  modelName: string;
  taskId: number;
  taskSlug: string;
  detectedAt: string;
  windowDays: number;
  baselinePassRate: number;
  recentPassRate: number;
  /** Fraction, 0-1. */
  drop: number;
  baselineRuns: number;
  recentRuns: number;
  pValue: number;
  qValue: number;
  persistence: number;
  resolvedAt: string | null;
  open: boolean;
}

interface Props {
  modelId: string | number;
  /** Show resolved episodes as well as open ones. */
  includeResolved?: boolean;
  limit?: number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Severity by size of the drop, using the page's existing status colours. */
const dropColor = (drop: number): string =>
  drop >= 0.5 ? 'var(--red-alert)' : drop >= 0.35 ? 'var(--amber-warning)' : 'var(--phosphor-dim)';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
};

export default function ModelDetailSliceRegressions({
  modelId,
  includeResolved = false,
  limit = 20,
}: Props) {
  const [rows, setRows] = useState<SliceRegression[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Client component: an empty base means a same-origin request through nginx,
    // which is what we want in production. Only the dev server needs the host.
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(
      `${apiUrl}/api/drift/slice-regressions/${modelId}` +
        `?limit=${limit}&includeResolved=${includeResolved ? 'true' : 'false'}`
    )
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data?.success) setRows(Array.isArray(data.data) ? data.data : []);
        else setError(data?.error || 'Failed to load task-level regressions');
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Network error');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelId, limit, includeResolved]);

  return (
    <div className="md-chart-section">
      <div className="md-chart-title">🧩 TASK-LEVEL REGRESSIONS</div>

      {loading && (
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner" style={{ color: 'var(--phosphor-dim)' }}>
            Loading task-level data…
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner">
            <div className="md-chart-empty-icon">⚠️</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner" style={{ color: 'var(--phosphor-dim)' }}>
            <div style={{ marginBottom: 6 }}>No task-level regressions detected.</div>
            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
              Every benchmark task is passing at its usual rate for this model. This check runs
              nightly and compares each task against its own recent history.
            </div>
          </div>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div
            style={{
              fontSize: '0.85em',
              color: 'var(--phosphor-dim)',
              margin: '0 0 12px 0',
              lineHeight: 1.5,
            }}
          >
            Individual tasks whose pass rate fell significantly against their own baseline. A
            single task can regress without moving the overall score enough to register, so these
            are reported separately rather than folded into the headline number.
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--phosphor-dim)' }}>
                  <th style={{ padding: '6px 10px 6px 0' }}>Task</th>
                  <th style={{ padding: '6px 10px' }}>Pass rate</th>
                  <th style={{ padding: '6px 10px' }}>Change</th>
                  <th style={{ padding: '6px 10px' }}>Window</th>
                  <th style={{ padding: '6px 10px' }}>Runs</th>
                  <th style={{ padding: '6px 10px' }}>Detected</th>
                  <th style={{ padding: '6px 0 6px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
                    <td style={{ padding: '8px 10px 8px 0', fontWeight: 600 }}>{r.taskSlug}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {pct(r.baselinePassRate)} → {pct(r.recentPassRate)}
                    </td>
                    <td style={{ padding: '8px 10px', color: dropColor(r.drop), fontWeight: 600 }}>
                      −{Math.round(r.drop * 100)} pts
                    </td>
                    <td style={{ padding: '8px 10px' }}>{r.windowDays}d</td>
                    <td style={{ padding: '8px 10px', color: 'var(--phosphor-dim)' }}>
                      {r.recentRuns} vs {r.baselineRuns}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--phosphor-dim)' }}>
                      {formatDate(r.detectedAt)}
                    </td>
                    <td style={{ padding: '8px 0 8px 10px' }}>
                      {r.open ? (
                        <span style={{ color: 'var(--amber-warning)' }}>Open</span>
                      ) : (
                        <span style={{ color: 'var(--phosphor-dim)' }}>
                          Resolved {r.resolvedAt ? formatDate(r.resolvedAt) : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              fontSize: '0.8em',
              color: 'var(--phosphor-dim)',
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            Findings are corrected for multiple comparisons across every model and task tested, so
            the expected share of false findings among those shown is held at 5%. Each also
            requires a drop of at least 25 points and evidence that it persisted rather than
            occurring on one day.
          </div>
        </>
      )}
    </div>
  );
}
