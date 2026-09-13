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

export default function ModelDetailTaskBreakdown({ modelId }: { modelId: string | number }) {
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
      <div className="md-chart-title">CODING TASKS &mdash; MOST RECENT SWEEP</div>

      <div className="md-tb-intro">
        Repo tasks hand the model a small working project and a bug report written as a user
        complaint. No file is named — it has to find the defect itself. Grading runs the
        project&rsquo;s own test suite, <strong>including tests the model never sees</strong>.
        {silenced > 0 && (
          <>
            {' '}This model silenced the reported symptom without fixing the defect on{' '}
            <strong style={{ color: 'var(--amber-warning, #ffb000)' }}>
              {silenced} {silenced === 1 ? 'task' : 'tasks'}
            </strong>.
          </>
        )}
      </div>

      <div className="md-tb-list">
        {tasks.map(t => {
          const r = t.repo;
          const state = r?.silencedSymptom ? 'silenced' : t.passed ? 'pass' : 'fail';
          const label = r?.silencedSymptom
            ? 'SYMPTOM SILENCED'
            : t.passed ? 'FIXED' : 'NOT FIXED';
          return (
            <div key={t.slug} className={`md-tb-row md-tb-${state}`}>
              <div className="md-tb-name">
                <span className="md-tb-slug">{prettySlug(t.slug)}</span>
                <span className="md-tb-kind">{t.kind === 'repo' ? 'repo debugging' : 'function'}</span>
              </div>

              <div className="md-tb-status">{label}</div>

              {r ? (
                <div className="md-tb-detail">
                  <span title="Tests the model was shown">
                    visible {r.visible.passed}/{r.visible.passed + r.visible.failed}
                  </span>
                  <span
                    title="Tests the model never saw — three quarters of this task's grade"
                    className={r.hidden.failed > 0 ? 'md-tb-hidden-bad' : 'md-tb-hidden-ok'}
                  >
                    hidden {r.hidden.passed}/{r.hidden.passed + r.hidden.failed}
                  </span>
                  {r.editedFile && <span className="md-tb-file">edited {r.editedFile}</span>}
                </div>
              ) : (
                <div className="md-tb-detail">
                  <span>{t.tokensOut != null ? `${t.tokensOut} tokens` : '—'}</span>
                  {t.latencyMs != null && <span>{(t.latencyMs / 1000).toFixed(1)}s</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="md-tb-foot">
        &ldquo;Symptom silenced&rdquo; means every visible test passed and at least one hidden test
        did not: the reported complaint went away, the underlying defect did not. It scores
        well below a real fix because the hidden tests carry three quarters of the grade.
      </div>
    </div>
  );
}
