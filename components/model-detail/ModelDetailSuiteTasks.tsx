'use client';

/**
 * What this model was asked in each suite's most recent run, and what happened — per task.
 *
 * Follows the page's scoring mode: COMBINED shows all three suites, CODING / REASONING /
 * TOOLING show that suite alone with room for detail. The leaderboard is one number wide; this
 * is where the number comes apart into the tasks that produced it.
 *
 * Tiers: everyone sees every task with its outcome and score. Pro (and above) sees the numbers
 * behind each outcome — hidden-test results, turns and tokens, tool calls and errors — and a
 * 14-day per-task trend. Plans with exports can download the run as JSON.
 */

import { useEffect, useMemo, useState } from 'react';
import { PLANS, planMeets, type Plan } from '../../lib/entitlements';

type Suite = 'hourly' | 'deep' | 'tooling';
type Mode = 'combined' | 'reasoning' | 'speed' | 'tooling';

interface CodingRepo {
  editedFile: string | null;
  visible: { passed: number; failed: number };
  hidden: { passed: number; failed: number };
  silencedSymptom: boolean;
  note: string | null;
}
interface TaskRow {
  slug: string;
  label: string;
  difficulty?: string | number | null;
  status: 'pass' | 'fail' | 'partial' | 'declined' | 'silenced' | 'error';
  score: number | null;          // 0–100
  latencyMs?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  // coding
  kind?: 'repo' | 'function';
  repo?: CodingRepo | null;
  // reasoning
  turns?: number | null;
  plannedTurns?: number | null;
  steps?: Array<{ turnIndex: number; id: string | null; refused: boolean; tokensOut: number | null; latencyMs: number | null }>;
  // tooling
  toolCalls?: { total: number; ok: number; failed: number } | null;
  tools?: string[];
  errors?: number;
}
interface SuitePayload {
  suite: Suite;
  runAt: string | null;
  tasks: TaskRow[];
  refusals?: { count: number; bySuite: Record<string, number> } | null;
}
type History = Record<string, Array<{ day: string; value: number }>>;

const SUITE_META: Record<Suite, { title: string; runWord: string; unit: string; blurb: string }> = {
  hourly: {
    title: 'CODING TASKS',
    runWord: 'sweep',
    unit: 'tests',
    blurb: 'Repo tasks (●) hand the model a small project and a bug report written as a user complaint — no file is named. Grading runs the project’s own test suite, including tests the model never sees.',
  },
  deep: {
    title: 'REASONING TASKS',
    runWord: 'run',
    unit: 'turns',
    blurb: 'Multi-turn scenarios scored across thirteen axes. All four run every day; a task the provider declines is left out of the mean rather than scored zero.',
  },
  tooling: {
    title: 'TOOL-USE TASKS',
    runWord: 'run',
    unit: 'tool calls',
    blurb: 'Nine tasks in a live sandbox: the model chooses tools, runs commands and checks results. A session that never completed is not a score.',
  },
};

const MODE_SUITES: Record<Mode, Suite[]> = {
  combined: ['hourly', 'deep', 'tooling'],
  speed: ['hourly'],
  reasoning: ['deep'],
  tooling: ['tooling'],
};

function pretty(slug: string) {
  return slug.replace(/^py\//, '').replace(/^deep\//, '').replace(/^repo_/, '').replace(/_(easy|medium|hard)$/, '').replace(/_/g, ' ');
}
function diffWord(d: string | number | null | undefined): string | null {
  if (d == null) return null;
  if (typeof d === 'number') return d >= 4 ? 'expert' : d >= 3 ? 'hard' : d >= 2 ? 'medium' : 'easy';
  return String(d);
}
function fmtK(n: number | null | undefined) {
  if (n == null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
function fmtMs(ms: number | null | undefined) {
  if (ms == null) return '—';
  return ms >= 60000 ? `${(ms / 60000).toFixed(1)} min` : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}
function ago(ts: string | null) {
  if (!ts) return '';
  const h = (Date.now() - Date.parse(ts)) / 3600e3;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
const STATUS_LABEL: Record<TaskRow['status'], string> = {
  pass: 'passed', fail: 'failed', partial: 'partial', declined: 'declined', silenced: 'symptom silenced', error: 'did not run',
};

/** Tiny inline sparkline — no chart library for a 14-point line. */
function Spark({ points, unitMax = 100 }: { points: Array<{ day: string; value: number }>; unitMax?: number }) {
  if (!points || points.length < 2) return <span className="md-st-spark md-st-spark-empty" title="Fewer than two days of history on this task">·</span>;
  const w = 84, h = 22, pad = 2;
  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / (points.length - 1));
  const ys = points.map(p => h - pad - (Math.max(0, Math.min(unitMax, p.value)) / unitMax) * (h - 2 * pad));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const last = points[points.length - 1].value, first = points[0].value;
  const tone = last - first <= -10 ? 'down' : last - first >= 10 ? 'up' : 'flat';
  return (
    <svg className={`md-st-spark md-st-spark-${tone}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`${points.length}-day trend, ${Math.round(first)} → ${Math.round(last)}`}>
      <path d={d} fill="none" strokeWidth="1.5" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2" />
    </svg>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <div className="md-st-bar md-st-bar-none" aria-hidden="true" />;
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 80 ? 'good' : v >= 50 ? 'mid' : 'low';
  return (
    <div className="md-st-bar" title={`${Math.round(v)} / 100`}>
      <div className={`md-st-bar-fill md-st-bar-${tone}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export default function ModelDetailSuiteTasks({
  modelId,
  mode,
  plan,
  hasProAccess,
  onShowProModal,
}: {
  modelId: string | number;
  mode: Mode;
  plan: Plan;
  hasProAccess: boolean;
  onShowProModal: () => void;
}) {
  const suites = MODE_SUITES[mode] ?? MODE_SUITES.combined;
  const [data, setData] = useState<Partial<Record<Suite, SuitePayload | null>>>({});
  const [hist, setHist] = useState<Partial<Record<Suite, History>>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const proDetail = hasProAccess || planMeets(plan, 'pro');
  const canExport = !!PLANS[plan]?.exports;

  useEffect(() => {
    let alive = true;
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    suites.forEach(suite => {
      // Suite in the PATH: the edge cache keys /dashboard on a fixed set of query args, so a
      // query-string suite can be served another suite's cached body.
      fetch(`${apiUrl}/dashboard/model-tasks/${modelId}/${suite}`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(j => { if (alive) setData(prev => ({ ...prev, [suite]: j?.data ?? null })); })
        .catch(() => { if (alive) setData(prev => ({ ...prev, [suite]: null })); });
      if (proDetail) {
        fetch(`${apiUrl}/dashboard/model-task-history/${modelId}/${suite}?days=14`)
          .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then(j => { if (alive) setHist(prev => ({ ...prev, [suite]: j?.data?.tasks ?? {} })); })
          .catch(() => { /* the trend column simply stays empty */ });
      }
    });
    return () => { alive = false; };
  }, [modelId, mode, proDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => suites.map(s => ({ suite: s, payload: data[s] })), [suites, data]);
  if (sections.every(s => s.payload === null || (s.payload && s.payload.tasks.length === 0))) return null;

  const exportRun = (suite: Suite) => {
    const payload = data[suite];
    if (!payload) return;
    const blob = new Blob([JSON.stringify({ modelId, exportedAt: new Date().toISOString(), ...payload }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `model-${modelId}-${suite}-last-run.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      {sections.map(({ suite, payload }) => {
        if (payload === undefined) {
          return <div key={suite} className="md-chart-section"><div className="md-chart-title">{SUITE_META[suite].title}</div><div className="md-st-loading">Loading…</div></div>;
        }
        if (!payload || payload.tasks.length === 0) return null;
        const meta = SUITE_META[suite];
        const tasks = payload.tasks;
        const passed = tasks.filter(t => t.status === 'pass').length;
        const measured = tasks.filter(t => t.status !== 'declined' && t.status !== 'error');
        const scored = measured.filter(t => typeof t.score === 'number');
        const meanScore = scored.length ? scored.reduce((a, t) => a + (t.score as number), 0) / scored.length : null;
        const declined = tasks.filter(t => t.status === 'declined').length;
        const silenced = tasks.filter(t => t.status === 'silenced').length;
        const totalTokens = tasks.reduce((a, t) => a + (t.tokensOut ?? 0), 0);
        const expanded = mode !== 'combined';
        const h = hist[suite] ?? {};

        return (
          <div key={suite} className={`md-chart-section md-st ${expanded ? 'md-st-expanded' : ''}`}>
            <div className="md-chart-title">
              {meta.title} &mdash; LAST {meta.runWord.toUpperCase()}
              <span className="md-st-when">{ago(payload.runAt)}</span>
            </div>

            {/* Summary strip */}
            <div className="md-st-summary">
              <div className="md-st-stat"><span className="md-st-stat-v">{passed}<span className="md-st-stat-of">/{measured.length}</span></span><span className="md-st-stat-k">passed</span></div>
              {meanScore != null && <div className="md-st-stat"><span className="md-st-stat-v">{Math.round(meanScore)}</span><span className="md-st-stat-k">mean score</span></div>}
              {suite === 'hourly' && <div className="md-st-stat"><span className="md-st-stat-v">{tasks.filter(t => t.kind === 'repo').length}</span><span className="md-st-stat-k">repo tasks</span></div>}
              {suite === 'deep' && <div className="md-st-stat"><span className="md-st-stat-v">{tasks.reduce((a, t) => a + (t.turns ?? 0), 0)}</span><span className="md-st-stat-k">turns</span></div>}
              {suite === 'tooling' && <div className="md-st-stat"><span className="md-st-stat-v">{tasks.reduce((a, t) => a + (t.toolCalls?.total ?? 0), 0)}</span><span className="md-st-stat-k">tool calls</span></div>}
              {totalTokens > 0 && <div className="md-st-stat"><span className="md-st-stat-v">{fmtK(totalTokens)}</span><span className="md-st-stat-k">tokens out</span></div>}
              {declined > 0 && <div className="md-st-stat md-st-stat-warn"><span className="md-st-stat-v">{declined}</span><span className="md-st-stat-k">declined</span></div>}
              {silenced > 0 && <div className="md-st-stat md-st-stat-warn"><span className="md-st-stat-v">{silenced}</span><span className="md-st-stat-k">symptom silenced</span></div>}
              {canExport && <button type="button" className="md-st-export" onClick={() => exportRun(suite)} title="Download this run as JSON">Export JSON</button>}
            </div>

            {/* Task rows */}
            <div className="md-st-rows" role="table" aria-label={`${meta.title} results`}>
              <div className="md-st-head" role="row">
                <span>Task</span><span>Outcome</span><span>Score</span><span className="md-st-col-detail">{suite === 'hourly' ? 'Tests' : suite === 'deep' ? 'Turns · tokens · time' : 'Tool calls · turns · time'}</span><span className="md-st-col-spark">14-day</span>
              </div>
              {tasks.map(t => {
                const key = `${suite}:${t.slug}`;
                const isOpen = !!open[key];
                const dw = diffWord(t.difficulty);
                let detail: React.ReactNode = null;
                if (suite === 'hourly') {
                  detail = t.repo
                    ? <>visible {t.repo.visible.passed}/{t.repo.visible.passed + t.repo.visible.failed} · <span className={t.repo.hidden.failed > 0 ? 'md-st-bad' : ''}>hidden {t.repo.hidden.passed}/{t.repo.hidden.passed + t.repo.hidden.failed}</span></>
                    : <>{t.tokensOut != null ? `${fmtK(t.tokensOut)} tok` : '—'}{t.latencyMs != null ? ` · ${fmtMs(t.latencyMs)}` : ''}</>;
                } else if (suite === 'deep') {
                  detail = <>{t.turns ?? '—'}{t.plannedTurns ? `/${t.plannedTurns}` : ''} turns · {fmtK(t.tokensOut)} tok · {fmtMs(t.latencyMs)}</>;
                } else {
                  detail = <>{t.toolCalls ? <><span className={t.toolCalls.failed > 0 ? 'md-st-bad' : ''}>{t.toolCalls.ok}</span>/{t.toolCalls.total} ok</> : '—'} · {t.turns ?? '—'} turns · {fmtMs(t.latencyMs)}</>;
                }
                const hasMore = proDetail && (
                  (suite === 'hourly' && t.repo) || (suite === 'deep' && t.steps && t.steps.length > 0) || (suite === 'tooling' && ((t.tools && t.tools.length > 0) || (t.errors ?? 0) > 0))
                );
                return (
                  <div key={key} className={`md-st-row md-st-${t.status}${isOpen ? ' is-open' : ''}`} role="row">
                    <span className="md-st-name" title={t.label}>
                      {t.kind === 'repo' && <span className="md-st-dot" aria-hidden="true">&#9679;</span>}
                      {pretty(t.slug)}
                      {dw && <span className={`md-st-diff md-st-diff-${dw}`}>{dw}</span>}
                    </span>
                    <span className="md-st-status"><span className={`md-st-pill md-st-pill-${t.status}`}>{STATUS_LABEL[t.status]}</span></span>
                    <span className="md-st-score"><ScoreBar value={t.score} /><span className="md-st-score-n">{t.score == null ? '—' : Math.round(t.score)}</span></span>
                    <span className="md-st-col-detail md-st-detail">
                      {proDetail ? detail : <button type="button" className="md-st-lock" onClick={onShowProModal}>details · Pro</button>}
                    </span>
                    <span className="md-st-col-spark">
                      {proDetail ? <Spark points={h[t.slug] ?? []} /> : <button type="button" className="md-st-lock" onClick={onShowProModal} aria-label="14-day trend is a Pro feature">◆</button>}
                    </span>
                    {hasMore && (
                      <button type="button" className="md-st-more" onClick={() => setOpen(o => ({ ...o, [key]: !isOpen }))} aria-expanded={isOpen}>
                        {isOpen ? 'less' : 'more'}
                      </button>
                    )}
                    {isOpen && hasMore && (
                      <div className="md-st-expand">
                        {suite === 'hourly' && t.repo && (
                          <>
                            <div><b>Edited:</b> {t.repo.editedFile ?? 'no file recorded'}</div>
                            {t.repo.silencedSymptom && <div className="md-st-bad">Passed every test it was shown and failed hidden ones: the reported symptom went away, the defect did not.</div>}
                            {t.repo.note && <div className="md-st-muted">{t.repo.note}</div>}
                          </>
                        )}
                        {suite === 'deep' && t.steps && (
                          <ol className="md-st-steps">
                            {t.steps.map(s => (
                              <li key={s.turnIndex} className={s.refused ? 'md-st-bad' : ''}>
                                <span className="md-st-step-id">{s.id ?? `turn ${s.turnIndex + 1}`}</span>
                                <span className="md-st-muted">{s.refused ? 'declined' : `${fmtK(s.tokensOut)} tok · ${fmtMs(s.latencyMs)}`}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                        {suite === 'tooling' && (
                          <>
                            {t.tools && t.tools.length > 0 && <div className="md-st-tools">{t.tools.map((name, i) => <span key={i} className="md-st-tool">{name}</span>)}</div>}
                            {(t.errors ?? 0) > 0 && <div className="md-st-bad">{t.errors} tool error{t.errors === 1 ? '' : 's'} during the session</div>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="md-st-foot">
              {meta.blurb}
              {payload.refusals && payload.refusals.count > 0 && (
                <> Declined {payload.refusals.count} task{payload.refusals.count === 1 ? '' : 's'} in the last 7 days across suites — a refusal drops out of the score instead of counting as a failure.</>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
