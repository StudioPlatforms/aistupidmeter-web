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
import { Pane, Loader, Empty, Note, Tag } from '@/components/studio';
import '@/styles/studio-model-panels.css';

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

interface TaskRate {
  slug: string;
  runs: number;
  passRate: number | null;
  recentRuns: number;
  recentPassRate: number | null;
  testable: boolean;
}

interface Props {
  modelId: string | number;
  /** Show resolved episodes as well as open ones. */
  includeResolved?: boolean;
  limit?: number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Severity by size of the drop, in the page's status colours. */
const dropTone = (drop: number): 'bad' | 'warn' | 'dim' =>
  drop >= 0.5 ? 'bad' : drop >= 0.35 ? 'warn' : 'dim';

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
  // How much of this model the detector could actually test. Without it, "nothing found"
  // and "nothing was testable" render identically and mean opposite things.
  const [coverage, setCoverage] = useState<{ tasksSeen: number; tasksTestable: number; minBaselineRuns: number; baselineDays: number } | null>(null);
  // Per-task pass rates. Without these, finding nothing rendered as a sentence
  // asserting that every task passes at its usual rate — the conclusion with the
  // evidence withheld, and no way for a reader to see which task is weakest.
  const [tasks, setTasks] = useState<TaskRate[]>([]);
  const [recentDays, setRecentDays] = useState(7);

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
        setCoverage(data?.coverage ?? null);
        setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
        if (typeof data?.recentDays === 'number') setRecentDays(data.recentDays);
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


  const baselineDays = coverage?.baselineDays ?? 30;

  return (
    <Pane
      title="Task-level regressions"
      sub="Pass rate per coding task, against each task’s own history"
      foot={!loading && !error && rows.length > 0 ? (
        <>
          Findings are corrected for multiple comparisons across every model and task tested, so
          the expected share of false findings among those shown is held at 5%. Each also
          requires a drop of at least 25 points and evidence that it persisted rather than
          occurring on one day.
        </>
      ) : undefined}
    >
      <div className="sq-stack">
        {loading && <Loader label="Loading task-level data…" minHeight={160} />}

        {!loading && error && <Note tone="warn">{error}</Note>}

        {!loading && !error && rows.length === 0 && tasks.length === 0 && (
          coverage && coverage.tasksTestable === 0 ? (
            // Nothing could be tested. Saying "every task is passing at its usual rate" here
            // would be a reassurance nobody measured -- the same phantom the rest of this
            // codebase spends its time removing. The detector needs a run of history per
            // task before it will look at that task at all, and eight coding tasks were
            // retired and four added on 2026-09-13, so most of the corpus is legitimately
            // too new to have one yet.
            <Empty title="Not enough history to test yet.">
              This check compares each task against its own past, and needs at least{' '}
              {coverage.minBaselineRuns} runs of it within {coverage.baselineDays} days before
              it will judge one. None of this model&rsquo;s {coverage.tasksSeen || 'current'} tasks
              has reached that yet, so there is nothing to report either way &mdash; not an
              all-clear.
            </Empty>
          ) : (
            <Empty title="No task-level regressions detected.">
              {coverage
                ? `${coverage.tasksTestable} of ${coverage.tasksSeen} tasks had enough history to test.`
                : ''}{' '}
              This check runs nightly and compares each task against its own recent history.
            </Empty>
          )
        )}

        {/* The per-task grid. Rendered whenever we have rates, regressions or not: when
            the detector finds nothing this is the evidence behind the all-clear, and when
            it finds something it is the context the flagged rows sit in. Sorted weakest
            first, because the one question this answers that the composite cannot is
            "which task is this model worst at". */}
        {/* All-clear as a single line, not a box. The grid below is the evidence and
            should lead; a slab restating the conclusion above it just pushes the data
            down the page. */}
        {!loading && !error && rows.length === 0 && tasks.length > 0 && (
          <Note tone="good">
            <strong>No task-level regressions detected.</strong>{' '}
            {coverage
              ? `${coverage.tasksTestable} of ${coverage.tasksSeen} tasks had enough history to test.`
              : ''}{' '}
            Checked nightly against each task&rsquo;s own recent history.
          </Note>
        )}

        {!loading && !error && tasks.length > 0 && (
          <div>
            <div className="sq-subhead">
              <h3 className="sq-h3">Pass rate by task</h3>
              <span>last {recentDays} days vs the {baselineDays}-day baseline &middot; weakest first</span>
            </div>
            <div className="sq-sr-grid">
              {tasks.map(t => {
                const recent = t.recentPassRate;
                const base = t.passRate;
                const delta = recent !== null && base !== null ? recent - base : null;
                const tone = recent === null ? 'none' : recent >= 0.8 ? 'good' : recent >= 0.5 ? 'mid' : 'low';
                return (
                  <div key={t.slug} className="sq-sr-task" title={
                    `${t.slug}: ${t.recentRuns} run(s) in the last ${recentDays} days, ${t.runs} in the ${baselineDays}-day baseline.` +
                    (t.testable ? '' : ` Below the ${coverage?.minBaselineRuns ?? 5}-run minimum, so the detector is not testing this task yet.`)
                  }>
                    <div className="sq-sr-top">
                      <span className="sq-sr-name">{t.slug}</span>
                      <span className={`sq-sr-val is-${tone}`}>
                        {recent === null ? '—' : `${Math.round(recent * 100)}%`}
                      </span>
                    </div>
                    <span className={`sq-bar${tone === 'none' ? ' is-none' : tone === 'mid' ? ' is-warn' : tone === 'low' ? ' is-bad' : ''}`} aria-hidden="true">
                      {recent !== null && <i style={{ width: `${Math.round(recent * 100)}%` }} />}
                    </span>
                    <div className="sq-sr-foot">
                      <span>{t.recentRuns} run{t.recentRuns === 1 ? '' : 's'}</span>
                      {delta !== null && Math.abs(delta) >= 0.01 && (
                        <span className={delta < 0 ? 'is-dn' : 'is-up'}>
                          {delta > 0 ? '+' : '−'}{Math.abs(Math.round(delta * 100))} pts vs baseline
                        </span>
                      )}
                      {!t.testable && <span className="is-untested">not yet testable</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div>
            <p className="sq-p sq-mb">
              Individual tasks whose pass rate fell significantly against their own baseline. A
              single task can regress without moving the overall score enough to register, so these
              are reported separately rather than folded into the headline number.
            </p>
            <div className="st-table-wrap sq-bleed">
              <table className="st-table is-stack sq-sr-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Pass rate</th>
                    <th>Change</th>
                    <th>Window</th>
                    <th>Runs</th>
                    <th>Detected</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className="is-head" data-label="Task">{r.taskSlug}</td>
                      <td data-label="Pass rate">{pct(r.baselinePassRate)} → {pct(r.recentPassRate)}</td>
                      <td data-label="Change" className={`is-drop is-${dropTone(r.drop)}`}>−{Math.round(r.drop * 100)} pts</td>
                      <td data-label="Window">{r.windowDays}d</td>
                      <td data-label="Runs" className="is-dim">{r.recentRuns} vs {r.baselineRuns}</td>
                      <td data-label="Detected" className="is-dim">{formatDate(r.detectedAt)}</td>
                      <td data-label="Status">
                        {r.open ? (
                          <Tag tone="warn">Open</Tag>
                        ) : (
                          <Tag>Resolved {r.resolvedAt ? formatDate(r.resolvedAt) : ''}</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Pane>
  );
}
