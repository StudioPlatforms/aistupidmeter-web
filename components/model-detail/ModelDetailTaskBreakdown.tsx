'use client';

/**
 * What this model was actually asked, and what happened.
 *
 * The leaderboard is one number wide, and a composite hides the thing most worth knowing about
 * a coding benchmark: on the repo debugging tasks, did the model FIX the defect or did it
 * merely silence the symptom it was shown?
 *
 * Those two outcomes are indistinguishable in every aggregate. A fix that special-cases the
 * customer named in the bug report passes every test the model was given and fails the hidden
 * ones it was not. This panel is the only place that distinction is visible.
 */

import { useEffect, useState } from 'react';

interface RepoDetail {
  editedFile: string | null;
  visible: { passed: number; failed: number };
  hidden: { passed: number; failed: number };
  silencedSymptom: boolean;
  note: string | null;
}

interface TaskRow {
  slug: string;
  kind: 'repo' | 'function';
  difficulty: number;
  passed: boolean;
  ts: string;
  tokensOut: number | null;
  latencyMs: number | null;
  repo: RepoDetail | null;
}

interface Refusals {
  count: number;
  bySuite: Record<string, number>;
  latest: { suite: string; task: string | null; ts: string; category: string | null } | null;
}

const SUITE_LABEL: Record<string, string> = { hourly: 'coding', tooling: 'tool use', deep: 'reasoning' };

function prettySlug(slug: string) {
  return slug.replace(/^py\//, '').replace(/^repo_/, '').replace(/_/g, ' ');
}

export default function ModelDetailTaskBreakdown({
  modelId,
  hasProAccess = false,
  onShowProModal,
}: {
  modelId: string | number;
  hasProAccess?: boolean;
  onShowProModal?: () => void;
}) {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [refusals, setRefusals] = useState<Refusals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Same-origin in production so the site's origin-token fetch wrapper attaches the header;
    // see lib/asl-token.ts, which guards every /dashboard/ path.
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    fetch(`${apiUrl}/dashboard/model-tasks/${modelId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => {
        if (!alive) return;
        setTasks(j?.data?.tasks ?? []);
        setRefusals(j?.data?.refusals ?? null);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [modelId]);

  // Render nothing rather than an empty shell when there is nothing to describe.
  const declined = refusals?.count ?? 0;
  if (failed || !tasks || (tasks.length === 0 && declined === 0)) return null;

  // A refusal is the provider's decision, not a measurement. The task leaves the score entirely
  // (numerator and denominator) — which is exactly why it has to be said out loud somewhere.
  const refusalLine = declined > 0 && refusals ? (
    <div className="md-tb-refusals">
      Declined {declined} {declined === 1 ? 'task' : 'tasks'} in the last 7 days
      {' ('}
      {Object.entries(refusals.bySuite).map(([suite, n]) => `${SUITE_LABEL[suite] ?? suite} ${n}`).join(', ')}
      {')'}. Refusals are not scored as failures &mdash; each one drops out of the score instead.
    </div>
  ) : null;

  if (tasks.length === 0) {
    return (
      <div className="md-chart-section">
        <div className="md-chart-title">CODING TASKS &mdash; LAST SWEEP</div>
        {refusalLine}
      </div>
    );
  }

  const repoTasks = tasks.filter(t => t.kind === 'repo');
  // Only the ones carrying a grade. Runs recorded before repo grades were persisted have
  // repo === null, and the detail table below dereferences it — which crashed the whole model
  // page client-side for every model whose last sweep predated that change. `t.repo!` is an
  // assertion, not a check, and this is what it costs when the data is older than the code.
  const gradedRepoTasks = repoTasks.filter((t): t is TaskRow & { repo: RepoDetail } => t.repo != null);
  const silenced = gradedRepoTasks.filter(t => t.repo.silencedSymptom).length;

  return (
    <div className="md-chart-section">
      <div className="md-chart-title">
        CODING TASKS &mdash; LAST SWEEP
        <span className="md-tb-count">{tasks.length} tasks</span>
      </div>

      {/* One compact row of chips. A model that fixed everything is the common case and should
          take one line, not fifteen; the panel only grows when there is something to explain. */}
      <div className="md-tb-chips">
        {tasks.map(t => {
          const r = t.repo;
          const state = r?.silencedSymptom ? 'silenced' : t.passed ? 'pass' : 'fail';
          const detail = r
            ? `${prettySlug(t.slug)} — visible ${r.visible.passed}/${r.visible.passed + r.visible.failed}, hidden ${r.hidden.passed}/${r.hidden.passed + r.hidden.failed}${r.editedFile ? `, edited ${r.editedFile}` : ''}`
            : `${prettySlug(t.slug)} — ${t.passed ? 'passed' : 'failed'}${t.tokensOut != null ? `, ${t.tokensOut} tokens` : ''}`;
          return (
            <span key={t.slug} className={`md-tb-chip md-tb-${state}`} title={hasProAccess ? detail : prettySlug(t.slug)}>
              {t.kind === 'repo' && <span className="md-tb-dot" aria-hidden="true">&#9679;</span>}
              {prettySlug(t.slug)}
            </span>
          );
        })}
      </div>

      {refusalLine}

      <div className="md-tb-legend">
        <span><span className="md-tb-key md-tb-pass" /> fixed</span>
        <span><span className="md-tb-key md-tb-fail" /> not fixed</span>
        <span><span className="md-tb-key md-tb-silenced" /> symptom silenced</span>
        <span className="md-tb-legend-note">&#9679; = repo debugging task</span>
      </div>

      {/* The finding, stated only when there is one. */}
      {silenced > 0 ? (
        <div className="md-tb-finding">
          On {silenced} {silenced === 1 ? 'task' : 'tasks'} this model passed every test it was
          shown and failed hidden ones: the reported symptom went away, the defect did not.
          {!hasProAccess && (
            <button type="button" className="md-tb-locked-inline" onClick={onShowProModal}>
              see which tests &middot; Pro
            </button>
          )}
        </div>
      ) : (
        <div className="md-tb-foot">
          Repo tasks (&#9679;) hand the model a small project and a bug report written as a user
          complaint &mdash; no file is named, so it has to find the defect itself. Grading runs the
          project&rsquo;s own test suite, including tests the model never sees.
        </div>
      )}

      {hasProAccess && gradedRepoTasks.length > 0 && (
        <details className="md-tb-details">
          <summary>Per-task detail</summary>
          <div className="md-tb-table">
            {gradedRepoTasks.map(t => (
              <div key={t.slug} className="md-tb-trow">
                <span className="md-tb-tname">{prettySlug(t.slug)}</span>
                <span>visible {t.repo.visible.passed}/{t.repo.visible.passed + t.repo.visible.failed}</span>
                <span className={t.repo.hidden.failed > 0 ? 'md-tb-hidden-bad' : 'md-tb-hidden-ok'}>
                  hidden {t.repo.hidden.passed}/{t.repo.hidden.passed + t.repo.hidden.failed}
                </span>
                <span className="md-tb-file">{t.repo.editedFile ?? '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
