'use client';

/**
 * Calibration and known-unknowns for one model.
 *
 * WHY THIS PANEL EXISTS
 * ---------------------
 * Every other number on this page measures capability: given a task, how well
 * does the model do it. None of them can tell you what happens when the model
 * is asked something it has no way of knowing — whether it declines, or invents
 * an answer and states it with confidence. In production that is frequently the
 * more expensive failure, because a wrong answer delivered confidently passes
 * review and a refusal does not.
 *
 * So this panel reports three things the leaderboard cannot:
 *   - fabrication rate: on questions with no answer, how often it answered anyway
 *   - accuracy: on questions with an answer, how often it was right
 *   - ECE: whether the confidence it states tracks how often it is actually right
 *
 * These figures deliberately never touch the composite score — a model that is
 * well calibrated is not thereby better at coding, and folding the two together
 * would make both numbers mean less. See api: jobs/calibration-suite.ts.
 *
 * PAID. The browser gate below only decides whether to ask; the real control is
 * the Next route it calls, which checks the session server-side.
 */

import { useEffect, useState } from 'react';
import { PLANS, planMeets, type Plan } from '../../lib/entitlements';
import { REQUIRED_PLAN } from '../../lib/capabilities';

interface Outcome {
  id: string;
  kind: string;
  unanswerable: boolean;
  abstained: boolean;
  correct: boolean;
  fabricated: boolean;
  confidence: number | null;
  unparseable: boolean;
}

interface CalibrationData {
  ts: string;
  items: number;
  scored: number;
  answerableItems: number;
  unanswerableItems: number;
  accuracy: number | null;
  abstentionRate: number | null;
  fabricationRate: number | null;
  meanConfidence: number | null;
  overconfidence: number | null;
  ece: number | null;
  brier: number | null;
  calibrationScore: number | null;
  outcomes: Outcome[];
}

interface Props {
  modelId: string | number;
  plan: Plan;
  hasProAccess: boolean;
  onShowProModal: (feature: 'calibration') => void;
}

const pct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`);
const num3 = (v: number | null): string => (v === null ? '—' : v.toFixed(3));

/** Lower is better for fabrication and ECE; higher is better for accuracy. */
const toneLowerBetter = (v: number | null, warn: number, bad: number): string =>
  v === null ? 'var(--phosphor-dim)' : v >= bad ? 'var(--red-alert)' : v >= warn ? 'var(--amber-warning)' : 'var(--phosphor-bright, inherit)';

const toneHigherBetter = (v: number | null, warn: number, bad: number): string =>
  v === null ? 'var(--phosphor-dim)' : v <= bad ? 'var(--red-alert)' : v <= warn ? 'var(--amber-warning)' : 'var(--phosphor-bright, inherit)';

const KIND_LABEL: Record<string, string> = {
  answerable: 'Has an answer',
  unanswerable_nonexistent: 'Does not exist',
  unanswerable_underspecified: 'Information withheld',
  unanswerable_unobservable: 'Cannot be observed',
};

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hours = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

function Stat({
  value, label, hint, color,
}: { value: string; label: string; hint: string; color?: string }) {
  return (
    <div className="md-cal-stat" title={hint}>
      <span className="md-cal-stat-v" style={color ? { color } : undefined}>{value}</span>
      <span className="md-cal-stat-k">{label}</span>
    </div>
  );
}

export default function ModelDetailCalibration({ modelId, plan, hasProAccess, onShowProModal }: Props) {
  const required = REQUIRED_PLAN.calibration;
  const unlocked = hasProAccess || planMeets(plan, required);

  const [data, setData] = useState<CalibrationData | null>(null);
  const [fleet, setFleet] = useState<{ measured: number; percentile: number | null; median: number | null; min: number | null; max: number | null } | null>(null);
  const [measured, setMeasured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    // No fetch when locked. Fetching and then hiding would still ship the data to
    // the browser, where it is one devtools tab away.
    if (!unlocked) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Same-origin: the Next route verifies the session before it touches the API.
    fetch(`/api/pro/calibration/${modelId}`)
      .then(res => {
        if (res.status === 401 || res.status === 403) throw new Error('This panel requires an active subscription');
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(json => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Failed to load calibration data');
        setMeasured(!!json.measured);
        setData(json.data ?? null);
        setFleet(json.fleet ?? null);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [modelId, unlocked]);

  const Section = ({ children }: { children: React.ReactNode }) => (
    <div className="md-chart-section">
      <div className="md-chart-title">CALIBRATION &amp; KNOWN UNKNOWNS</div>
      {children}
    </div>
  );

  // ── Locked ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <Section>
        <div
          className="md-chart-empty"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => onShowProModal('calibration')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onShowProModal('calibration'); }}
        >
          <div className="md-chart-empty-inner">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Calibration is a {PLANS[required]?.label ?? 'paid'} feature
            </div>
            <div style={{ color: 'var(--phosphor-dim)', fontSize: 12, maxWidth: 460, margin: '0 auto' }}>
              Does this model know what it does not know? See how often it invents an answer
              to a question that has none, and whether the confidence it states is worth
              anything.
            </div>
          </div>
        </div>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner" style={{ color: 'var(--phosphor-dim)' }}>
            Loading calibration data…
          </div>
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner">
            <div>{error}</div>
          </div>
        </div>
      </Section>
    );
  }

  // Not measured yet. Saying "0% fabrication" here would assert something nobody
  // looked at — the opposite of what an empty table means.
  if (measured === false || !data) {
    return (
      <Section>
        <div className="md-chart-empty">
          <div className="md-chart-empty-inner" style={{ color: 'var(--phosphor-dim)' }}>
            <div style={{ marginBottom: 6 }}>Not measured yet.</div>
            <div style={{ fontSize: '0.85em', opacity: 0.85, maxWidth: 460, margin: '0 auto' }}>
              This sweep runs once a day. A model added recently has not been through one
              yet, and a provider that was not answering is skipped rather than scored —
              so there is nothing to report either way, which is not the same as a clean
              result.
            </div>
          </div>
        </div>
      </Section>
    );
  }

  const fabricated = data.outcomes.filter(o => o.fabricated);
  const readable = data.outcomes.filter(o => !o.unparseable);

  return (
    <Section>
      <div className="md-cal-intro">
        Asked {data.items} questions: {data.answerableItems} with a correct answer and{' '}
        {data.unanswerableItems} with none — invented libraries, withheld details, facts a model
        cannot observe. Declining the second group is the correct behaviour, not a failure.
        These figures are reported on their own and never enter the composite score, and they
        are re-measured every day — the point is to catch the day a model stops behaving this
        way, not to rank models that all currently pass.
        <span className="md-cal-when"> Last run {formatWhen(data.ts)}.</span>
      </div>

      <div className="md-cal-stats">
        <Stat
          value={data.calibrationScore === null ? '—' : String(Math.round(data.calibrationScore))}
          label="calibration score"
          hint="0–100. Half behavioural accuracy, 30% confidence calibration, 20% restraint on unanswerable questions."
          color={toneHigherBetter(data.calibrationScore === null ? null : data.calibrationScore / 100, 0.6, 0.4)}
        />
        <Stat
          value={pct(data.fabricationRate)}
          label="fabricated"
          hint="Of the questions with no answer, how often it produced one anyway."
          color={toneLowerBetter(data.fabricationRate, 0.2, 0.5)}
        />
        <Stat
          value={pct(data.abstentionRate)}
          label="correctly declined"
          hint="Of the questions with no answer, how often it said so."
          color={toneHigherBetter(data.abstentionRate, 0.7, 0.4)}
        />
        <Stat
          value={pct(data.accuracy)}
          label="accuracy"
          hint="Of the questions that do have an answer, how often it was right."
          color={toneHigherBetter(data.accuracy, 0.7, 0.5)}
        />
        <Stat
          value={num3(data.ece)}
          label="calibration error"
          hint="Expected Calibration Error, over the questions it chose to answer: the average gap between stated confidence and how often it was actually right. 0 is perfect. Refusals are excluded, because confidence attached to a refusal is ambiguous."
          color={toneLowerBetter(data.ece, 0.15, 0.3)}
        />
        <Stat
          value={data.overconfidence === null ? '—' : `${data.overconfidence > 0 ? '+' : ''}${Math.round(data.overconfidence * 100)}`}
          label="over/under-confidence"
          hint="Mean stated confidence minus actual accuracy on the questions it answered, in points. Positive means it claims more certainty than it earns."
          color={toneLowerBetter(data.overconfidence === null ? null : Math.abs(data.overconfidence), 0.1, 0.25)}
        />
      </div>

      {/* Fleet context, stated against the pack rather than as a rank.
          A percentile alone misleads badly: almost every model scores 99 or 100, so a
          model on 99 is "better than 6% of the fleet" — true, and a slander. Distance
          from the median is used instead, and a min/max spread is deliberately not the
          test, because one outlier widens it and pushes everything else into a
          comparison that reads as failure. Within a few points of the median is a tie
          and is said to be one. */}
      {fleet && fleet.measured >= 3 && fleet.median !== null && data.calibrationScore !== null && (() => {
        const gap = data.calibrationScore - fleet.median;
        const range = fleet.min !== null && fleet.max !== null
          ? ` The ${fleet.measured} models measured on this question set run from ${Math.round(fleet.min)} to ${Math.round(fleet.max)}.`
          : '';
        return (
          <div className="md-cal-fleet">
            {Math.abs(gap) <= 3 ? (
              <>In line with the rest of the fleet, which has a median of {Math.round(fleet.median)}. A difference this small is a tie, not a ranking.{range}</>
            ) : gap < 0 ? (
              <>{Math.round(-gap)} points below the fleet median of {Math.round(fleet.median)} — this model is behaving differently from the others on the same questions.{range}</>
            ) : (
              <>{Math.round(gap)} points above the fleet median of {Math.round(fleet.median)}.{range}</>
            )}
          </div>
        );
      })()}

      {fabricated.length > 0 && (
        <div className="md-cal-flag">
          Answered {fabricated.length} question{fabricated.length === 1 ? '' : 's'} that had no
          answer
          {fabricated.some(o => (o.confidence ?? 0) >= 70) && (
            <>
              {' '}— and stated at least {Math.max(...fabricated.map(o => o.confidence ?? 0))}%
              confidence doing it
            </>
          )}
          .
        </div>
      )}

      <button className="md-cal-toggle" onClick={() => setShowItems(v => !v)}>
        {showItems ? 'Hide' : 'Show'} the {readable.length} question{readable.length === 1 ? '' : 's'} behind these numbers
      </button>

      {showItems && (
        <div className="md-cal-table-wrap">
          <table className="md-cal-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th>Response</th>
                <th>Stated confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.outcomes.map(o => {
                const good = o.unanswerable ? o.abstained : o.correct;
                const verdict = o.unparseable
                  ? 'No readable answer'
                  : o.unanswerable
                    ? (o.abstained ? 'Declined — correct' : 'Answered anyway — fabricated')
                    : (o.correct ? 'Correct' : o.abstained ? 'Declined a question it could answer' : 'Wrong');
                return (
                  <tr key={o.id}>
                    <td className="md-cal-td-id">{o.id}</td>
                    <td className="md-cal-td-kind">{KIND_LABEL[o.kind] ?? o.kind}</td>
                    <td style={{
                      color: o.unparseable
                        ? 'var(--phosphor-dim)'
                        : good ? 'var(--phosphor-bright, inherit)' : 'var(--red-alert)',
                      fontWeight: 600,
                    }}>
                      {verdict}
                    </td>
                    <td className="md-cal-td-conf">{o.confidence === null ? '—' : `${o.confidence}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="md-cal-note">
            Question identifiers rather than the questions themselves: publishing the corpus
            would let it be trained against, and a benchmark a model has memorised measures
            nothing. The full methodology is public.
          </div>
        </div>
      )}
    </Section>
  );
}
