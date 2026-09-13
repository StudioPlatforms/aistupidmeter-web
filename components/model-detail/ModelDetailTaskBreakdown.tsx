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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // Same-origin in production so the site's origin-token fetch wrapper attaches the header;
    // see lib/asl-token.ts, which guards every /dashboard/ path.
    const apiUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000';
    fetch(`${apiUrl}/dashboard/model-tasks/${modelId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => { if (alive) setTasks(j?.data?.tasks ?? []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [modelId]);

  // Render nothing rather than an empty shell when there is no coding run to describe.
  if (failed || !tasks || tasks.length === 0) return null;

  const repoTasks = tasks.filter(t => t.kind === 'repo');
  const silenced = repoTasks.filter(t => t.repo?.silencedSymptom).length;

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

      {hasProAccess && repoTasks.length > 0 && (
        <details className="md-tb-details">
          <summary>Per-task detail</summary>
          <div className="md-tb-table">
            {repoTasks.map(t => (
              <div key={t.slug} className="md-tb-trow">
                <span className="md-tb-tname">{prettySlug(t.slug)}</span>
                <span>visible {t.repo!.visible.passed}/{t.repo!.visible.passed + t.repo!.visible.failed}</span>
                <span className={t.repo!.hidden.failed > 0 ? 'md-tb-hidden-bad' : 'md-tb-hidden-ok'}>
                  hidden {t.repo!.hidden.passed}/{t.repo!.hidden.passed + t.repo!.hidden.failed}
                </span>
                <span className="md-tb-file">{t.repo!.editedFile ?? '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
