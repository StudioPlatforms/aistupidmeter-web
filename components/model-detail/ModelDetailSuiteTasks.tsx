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

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLANS, planMeets, type Plan } from '../../lib/entitlements';
import { Pane, Tag, Locked } from '@/components/studio';
import '@/styles/studio-model-panels.css';

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
  status: 'pass' | 'fail' | 'partial' | 'declined' | 'silenced' | 'error' | 'incomplete';
  score: number | null;          // 0–100
  latencyMs?: number | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  // coding
  kind?: 'repo' | 'function';
  repo?: CodingRepo | null;
  /** Present when status is 'declined': what the provider's API sent instead of an answer. */
  refusal?: { signal?: string | null; category?: string | null; explanation?: string | null } | null;
  /** Why a session stopped without being graded, when status is 'incomplete' or 'error'. */
  failureReason?: string | null;
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

const SUITE_META: Record<Suite, { title: string; runWord: string; unit: string; blurb: ReactNode }> = {
  hourly: {
    title: 'Coding tasks',
    runWord: 'sweep',
    unit: 'tests',
    blurb: <>Repo tasks (<i className="sq-repo" role="img" aria-label="dot" />) hand the model a small project and a bug report written as a user complaint — no file is named. Grading runs the project’s own test suite, including tests the model never sees.</>,
  },
  deep: {
    title: 'Reasoning tasks',
    runWord: 'run',
    unit: 'turns',
    blurb: 'Multi-turn scenarios scored across thirteen axes. All four run every day; a task the provider declines is left out of the mean rather than scored zero.',
  },
  tooling: {
    title: 'Tool-use tasks',
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
  pass: 'passed', fail: 'failed', partial: 'partial', declined: 'refused', silenced: 'symptom silenced', error: 'did not run', incomplete: 'cut short',
};
const STATUS_TONE: Record<TaskRow['status'], 'good' | 'bad' | 'warn' | 'line' | undefined> = {
  pass: 'good', fail: 'bad', partial: 'warn', declined: 'line', silenced: 'warn', error: undefined, incomplete: 'line',
};

/** The small lock mark on a Pro-only cell. */
function LockMark() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="2" y="5.2" width="8" height="5.8" rx="1.3" fill="currentColor" />
      <path d="M4 5.4V3.9a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Tiny inline sparkline — no chart library for a 14-point line. */
function Spark({ points, unitMax = 100 }: { points: Array<{ day: string; value: number }>; unitMax?: number }) {
  if (!points || points.length < 2) return <span className="sq-spark-empty" title="Fewer than two days of history on this task">—</span>;
  const w = 84, h = 22, pad = 2;
  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / (points.length - 1));
  const ys = points.map(p => h - pad - (Math.max(0, Math.min(unitMax, p.value)) / unitMax) * (h - 2 * pad));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const last = points[points.length - 1].value, first = points[0].value;
  const tone = last - first <= -10 ? 'down' : last - first >= 10 ? 'up' : 'flat';
  return (
    <svg className={`sq-spark is-${tone}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`${points.length}-day trend, ${Math.round(first)} → ${Math.round(last)}`}>
      <path d={d} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.2" />
    </svg>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <span className="sq-bar is-none" aria-hidden="true" />;
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 80 ? '' : v >= 50 ? ' is-warn' : ' is-bad';
  return (
    <span className={`sq-bar${tone}`} title={`${Math.round(v)} / 100`}>
      <i style={{ width: `${v}%` }} />
    </span>
  );
}

export default function ModelDetailSuiteTasks({
  modelId,
  mode,
  plan,
  hasProAccess,
  onShowProModal,
  latestAllowed = true,
  onShowLatestModal,
}: {
  modelId: string | number;
  mode: Mode;
  plan: Plan;
  hasProAccess: boolean;
  onShowProModal: () => void;
  /** The last run, task by task, is the newest run: a paid view (lib/capabilities 'latest-scores'). */
  latestAllowed?: boolean;
  onShowLatestModal?: () => void;
}) {
  const suites = MODE_SUITES[mode] ?? MODE_SUITES.combined;
  const [data, setData] = useState<Partial<Record<Suite, SuitePayload | null>>>({});
  const [hist, setHist] = useState<Partial<Record<Suite, History>>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const proDetail = hasProAccess || planMeets(plan, 'pro');
  const canExport = !!PLANS[plan]?.exports;

  useEffect(() => {
    if (!latestAllowed) return; // the API refuses it too (apps/api middleware/latest-gate.ts)
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
  }, [modelId, mode, proDetail, latestAllowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => suites.map(s => ({ suite: s, payload: data[s] })), [suites, data]);

  if (!latestAllowed) {
    const one = suites.length === 1 ? SUITE_META[suites[0]] : null;
    return (
      <Pane title={one ? one.title : 'Last run, task by task'} sub={one ? `Last ${one.runWord}` : 'Coding, reasoning and tool use'}>
        <Locked
          plan={PLANS.pro.label}
          title="What it was asked in the last run, and what happened"
          action="See the plans"
          onOpen={onShowLatestModal ?? onShowProModal}
        >
          Every task in the newest run: passed, failed, declined, or a symptom silenced instead of
          fixed, with its score, tokens and time.
        </Locked>
      </Pane>
    );
  }
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
          return (
            <Pane key={suite} title={SUITE_META[suite].title} sub="Loading…">
              <div className="sq-st-loading" aria-hidden="true">
                <span className="st-skel" />
                <span className="st-skel" />
                <span className="st-skel" />
              </div>
            </Pane>
          );
        }
        if (!payload || payload.tasks.length === 0) return null;
        const meta = SUITE_META[suite];
        const tasks = payload.tasks;
        const passed = tasks.filter(t => t.status === 'pass').length;
        const measured = tasks.filter(t => t.status !== 'declined' && t.status !== 'error' && t.status !== 'incomplete');
        const scored = measured.filter(t => typeof t.score === 'number');
        const meanScore = scored.length ? scored.reduce((a, t) => a + (t.score as number), 0) / scored.length : null;
        const declined = tasks.filter(t => t.status === 'declined').length;
        const silenced = tasks.filter(t => t.status === 'silenced').length;
        const totalTokens = tasks.reduce((a, t) => a + (t.tokensOut ?? 0), 0);
        const expanded = mode !== 'combined';
        const h = hist[suite] ?? {};
        const when = ago(payload.runAt);

        return (
          <Pane
            key={suite}
            className={`sq-st${expanded ? ' is-expanded' : ''}`}
            title={meta.title}
            sub={<>Last {meta.runWord}{when ? <> &middot; {when}</> : null}</>}
            actions={canExport ? (
              <button type="button" className="st-btn is-sm" onClick={() => exportRun(suite)} title="Download this run as JSON">Export JSON</button>
            ) : undefined}
            ruled
            flush
            foot={(
              <>
                {meta.blurb}
                {payload.refusals && payload.refusals.count > 0 && (
                  <> Declined {payload.refusals.count} task{payload.refusals.count === 1 ? '' : 's'} in the last 7 days across suites — a refusal drops out of the score instead of counting as a failure.</>
                )}
              </>
            )}
          >
            {/* Summary strip */}
            <div className="sq-pad is-ruled">
              <div className="sq-figs">
                <div className="sq-fig"><span className="sq-fig-v">{passed}<small>/{measured.length}</small></span><span className="sq-fig-l">passed</span></div>
                {meanScore != null && <div className="sq-fig"><span className="sq-fig-v">{Math.round(meanScore)}</span><span className="sq-fig-l">mean score</span></div>}
                {suite === 'hourly' && <div className="sq-fig"><span className="sq-fig-v">{tasks.filter(t => t.kind === 'repo').length}</span><span className="sq-fig-l">repo tasks</span></div>}
                {suite === 'deep' && <div className="sq-fig"><span className="sq-fig-v">{tasks.reduce((a, t) => a + (t.turns ?? 0), 0)}</span><span className="sq-fig-l">turns</span></div>}
                {suite === 'tooling' && <div className="sq-fig"><span className="sq-fig-v">{tasks.reduce((a, t) => a + (t.toolCalls?.total ?? 0), 0)}</span><span className="sq-fig-l">tool calls</span></div>}
                {totalTokens > 0 && <div className="sq-fig"><span className="sq-fig-v">{fmtK(totalTokens)}</span><span className="sq-fig-l">tokens out</span></div>}
                {declined > 0 && <div className="sq-fig is-warn" title="The model's API returned a refusal instead of an answer. Left out of the score, not counted as zero."><span className="sq-fig-v">{declined}</span><span className="sq-fig-l">refused</span></div>}
                {silenced > 0 && <div className="sq-fig is-warn"><span className="sq-fig-v">{silenced}</span><span className="sq-fig-l">symptom silenced</span></div>}
              </div>
            </div>

            {/* Task rows */}
            <div className="sq-st-rows" role="table" aria-label={`${meta.title} results`}>
              <div className="sq-st-head" role="row">
                <span role="columnheader">Task</span>
                <span role="columnheader">Outcome</span>
                <span role="columnheader">Score</span>
                <span role="columnheader">{suite === 'hourly' ? 'Tests' : suite === 'deep' ? 'Turns · tokens · time' : 'Tool calls · turns · time'}</span>
                <span role="columnheader">14-day</span>
                <span role="columnheader"><span className="sq-sr">Details</span></span>
              </div>
              {tasks.map(t => {
                const key = `${suite}:${t.slug}`;
                const isOpen = !!open[key];
                const dw = diffWord(t.difficulty);
                let detail: React.ReactNode = null;
                if (suite === 'hourly') {
                  detail = t.repo
                    ? <>visible {t.repo.visible.passed}/{t.repo.visible.passed + t.repo.visible.failed} · <span className={t.repo.hidden.failed > 0 ? 'sq-warn-t' : ''}>hidden {t.repo.hidden.passed}/{t.repo.hidden.passed + t.repo.hidden.failed}</span></>
                    : <>{t.tokensOut != null ? `${fmtK(t.tokensOut)} tok` : '—'}{t.latencyMs != null ? ` · ${fmtMs(t.latencyMs)}` : ''}</>;
                } else if (suite === 'deep') {
                  detail = <>{t.turns ?? '—'}{t.plannedTurns ? `/${t.plannedTurns}` : ''} turns · {fmtK(t.tokensOut)} tok · {fmtMs(t.latencyMs)}</>;
                } else {
                  detail = <>{t.toolCalls ? <><span className={t.toolCalls.failed > 0 ? 'sq-warn-t' : ''}>{t.toolCalls.ok}</span>/{t.toolCalls.total} ok</> : '—'} · {t.turns ?? '—'} turns · {fmtMs(t.latencyMs)}</>;
                }
                // Why a task was refused is not a Pro detail: anyone reading a 5-of-7 row is owed it.
                const refused = t.status === 'declined';
                const cutShort = t.status === 'incomplete';
                const hasMore = refused || cutShort || (proDetail && (
                  (suite === 'hourly' && t.repo) || (suite === 'deep' && t.steps && t.steps.length > 0) || (suite === 'tooling' && ((t.tools && t.tools.length > 0) || (t.errors ?? 0) > 0))
                ));
                return (
                  <div key={key} className={`sq-st-row is-${t.status}${isOpen ? ' is-open' : ''}`} role="row">
                    <span className="sq-st-name" role="cell" title={t.label}>
                      {t.kind === 'repo' && <i className="sq-repo" aria-hidden="true" />}
                      <span className="sq-st-name-t">{pretty(t.slug)}</span>
                      {dw && <Tag tone="line">{dw}</Tag>}
                    </span>
                    <span className="sq-st-status" role="cell"><Tag tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Tag></span>
                    <span className="sq-st-score" role="cell"><ScoreBar value={t.score} /><span className="sq-st-score-n">{t.score == null ? '—' : Math.round(t.score)}</span></span>
                    <span className="sq-st-detail" role="cell">
                      {refused ? <span className="sq-warn-t">refused by the model&rsquo;s API</span>
                        : cutShort ? <span className="sq-warn-t">{t.turns ?? 0}/{t.plannedTurns ?? '?'} turns · {fmtK(t.tokensOut)} tok · {fmtMs(t.latencyMs)}</span>
                        : proDetail ? detail : <button type="button" className="sq-lock" onClick={onShowProModal}><LockMark />Details · Pro</button>}
                    </span>
                    <span className="sq-st-spark" role="cell">
                      {proDetail ? <Spark points={h[t.slug] ?? []} /> : <button type="button" className="sq-lock" onClick={onShowProModal} aria-label="14-day trend is a Pro feature"><LockMark />Pro</button>}
                    </span>
                    <span className="sq-st-more" role="cell">{hasMore && (
                      <button type="button" className="sq-more" onClick={() => setOpen(o => ({ ...o, [key]: !isOpen }))} aria-expanded={isOpen}>
                        {isOpen ? 'Less' : 'More'}
                        <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    )}</span>
                    {isOpen && hasMore && (
                      <div className="sq-st-expand" role="cell">
                        {cutShort && (
                          <p className="sq-x is-warn">
                            Cut short before it could be graded{t.failureReason ? `: ${t.failureReason}` : ''}.
                            It completed {t.turns ?? 0} of {t.plannedTurns ?? '?'} turns and produced{' '}
                            {fmtK(t.tokensOut)} output tokens, so the work happened — it simply never reached a
                            score. The task is left out of this run rather than counted as zero.
                          </p>
                        )}
                        {refused && (
                          <div className="sq-x is-warn">
                            Refused by the model: its API returned a refusal instead of an answer
                            {t.refusal?.signal ? ` (${t.refusal.signal})` : ''}{t.refusal?.category ? `, category ${t.refusal.category}` : ''}.
                            The task was left out of this score rather than counted as zero, which is why the score covers {measured.length} of {tasks.length} tasks.
                            {t.refusal?.explanation && <span className="sq-x-muted">{t.refusal.explanation}</span>}
                          </div>
                        )}
                        {suite === 'hourly' && t.repo && (
                          <>
                            <p className="sq-x"><b>Edited:</b> {t.repo.editedFile ? <code className="st-ic">{t.repo.editedFile}</code> : 'no file recorded'}</p>
                            {t.repo.silencedSymptom && <p className="sq-x is-warn">Passed every test it was shown and failed hidden ones: the reported symptom went away, the defect did not.</p>}
                            {t.repo.note && <p className="sq-x sq-x-muted">{t.repo.note}</p>}
                          </>
                        )}
                        {suite === 'deep' && t.steps && (
                          <ol className="sq-steps">
                            {t.steps.map(s => (
                              <li key={s.turnIndex} className={s.refused ? 'is-warn' : ''}>
                                <span className="sq-step-id">{s.id ?? `turn ${s.turnIndex + 1}`}</span>
                                <span className={s.refused ? 'sq-warn-t' : 'sq-x-muted'}>{s.refused ? 'declined' : `${fmtK(s.tokensOut)} tok · ${fmtMs(s.latencyMs)}`}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                        {suite === 'tooling' && (
                          <>
                            {t.tools && t.tools.length > 0 && <div className="sq-tools">{t.tools.map((name, i) => <Tag key={i} tone="line">{name}</Tag>)}</div>}
                            {(t.errors ?? 0) > 0 && <p className="sq-x is-warn">{t.errors} tool error{t.errors === 1 ? '' : 's'} during the session</p>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Pane>
        );
      })}
    </>
  );
}
