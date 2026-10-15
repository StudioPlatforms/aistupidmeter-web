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

import { useEffect, useState, type ReactNode } from 'react';
import { PLANS, planMeets, type Plan } from '../../lib/entitlements';
import { REQUIRED_PLAN } from '../../lib/capabilities';
import { Pane, Loader, Empty, Note, Locked } from '@/components/studio';
import '@/styles/studio-model-panels.css';

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

type Tone = 'warn' | 'bad' | null;

/** Lower is better for fabrication and ECE; higher is better for accuracy. */
const toneLowerBetter = (v: number | null, warn: number, bad: number): Tone =>
  v === null ? null : v >= bad ? 'bad' : v >= warn ? 'warn' : null;

const toneHigherBetter = (v: number | null, warn: number, bad: number): Tone =>
  v === null ? null : v <= bad ? 'bad' : v <= warn ? 'warn' : null;

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
  value, label, hint, tone,
}: { value: string; label: string; hint: string; tone?: Tone }) {
  return (
    <div className={`sq-fig${tone ? ` is-${tone}` : ''}`} title={hint}>
      <span className="sq-fig-v">{value}</span>
      <span className="sq-fig-l">{label}</span>
    </div>
  );
}

/** The pane every state renders in. Declared here, not inside the component: a component
 *  created during render is a new type each time, so React would remount the pane (and replay
 *  its reveal) on every state change. */
function Section({ children, when }: { children: ReactNode; when?: ReactNode }) {
  return (
    <Pane
      title="Calibration and known unknowns"
      sub="Re-measured every day · never part of the composite score"
      actions={when ? <span className="sq-when">{when}</span> : undefined}
    >
      {children}
    </Pane>
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

  // ── Locked ──────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <Section>
        <Locked
          plan={PLANS[required]?.label ?? 'Pro Intelligence'}
          title="Does this model know what it does not know?"
          onOpen={() => onShowProModal('calibration')}
        >
          See how often it invents an answer to a question that has none, and whether the
          confidence it states is worth anything.
        </Locked>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section>
        <Loader label="Loading calibration data…" minHeight={160} />
      </Section>
    );
  }

  if (error) {
    return (
      <Section>
        <Note tone="warn">{error}</Note>
      </Section>
    );
  }

  // Not measured yet. Saying "0% fabrication" here would assert something nobody
  // looked at — the opposite of what an empty table means.
  if (measured === false || !data) {
    return (
      <Section>
        <Empty title="Not measured yet.">
          This sweep runs once a day. A model added recently has not been through one
          yet, and a provider that was not answering is skipped rather than scored —
          so there is nothing to report either way, which is not the same as a clean
          result.
        </Empty>
      </Section>
    );
  }

  const fabricated = data.outcomes.filter(o => o.fabricated);
  const readable = data.outcomes.filter(o => !o.unparseable);

  return (
    <Section when={<>Last run {formatWhen(data.ts)}</>}>
      <div className="sq-stack">
        <p className="sq-p">
          Asked {data.items} questions: {data.answerableItems} with a correct answer and{' '}
          {data.unanswerableItems} with none — invented libraries, withheld details, facts a model
          cannot observe. Declining the second group is the correct behaviour, not a failure.
          These figures are reported on their own and never enter the composite score, and they
          are re-measured every day — the point is to catch the day a model stops behaving this
          way, not to rank models that all currently pass.
        </p>

        <div className="sq-figs">
          <Stat
            value={data.calibrationScore === null ? '—' : String(Math.round(data.calibrationScore))}
            label="calibration score"
            hint="0–100. Half behavioural accuracy, 30% confidence calibration, 20% restraint on unanswerable questions."
            tone={toneHigherBetter(data.calibrationScore === null ? null : data.calibrationScore / 100, 0.6, 0.4)}
          />
          <Stat
            value={pct(data.fabricationRate)}
            label="fabricated"
            hint="Of the questions with no answer, how often it produced one anyway."
            tone={toneLowerBetter(data.fabricationRate, 0.2, 0.5)}
          />
          <Stat
            value={pct(data.abstentionRate)}
            label="correctly declined"
            hint="Of the questions with no answer, how often it said so."
            tone={toneHigherBetter(data.abstentionRate, 0.7, 0.4)}
          />
          <Stat
            value={pct(data.accuracy)}
            label="accuracy"
            hint="Of the questions that do have an answer, how often it was right."
            tone={toneHigherBetter(data.accuracy, 0.7, 0.5)}
          />
          <Stat
            value={num3(data.ece)}
            label="calibration error"
            hint="Expected Calibration Error, over the questions it chose to answer: the average gap between stated confidence and how often it was actually right. 0 is perfect. Refusals are excluded, because confidence attached to a refusal is ambiguous."
            tone={toneLowerBetter(data.ece, 0.15, 0.3)}
          />
          <Stat
            value={data.overconfidence === null ? '—' : `${data.overconfidence > 0 ? '+' : ''}${Math.round(data.overconfidence * 100)}`}
            label="over/under-confidence"
            hint="Mean stated confidence minus actual accuracy on the questions it answered, in points. Positive means it claims more certainty than it earns."
            tone={toneLowerBetter(data.overconfidence === null ? null : Math.abs(data.overconfidence), 0.1, 0.25)}
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
            <p className="sq-p">
              {Math.abs(gap) <= 3 ? (
                <>In line with the rest of the fleet, which has a median of {Math.round(fleet.median)}. A difference this small is a tie, not a ranking.{range}</>
              ) : gap < 0 ? (
                <>{Math.round(-gap)} points below the fleet median of {Math.round(fleet.median)} — this model is behaving differently from the others on the same questions.{range}</>
              ) : (
                <>{Math.round(gap)} points above the fleet median of {Math.round(fleet.median)}.{range}</>
              )}
            </p>
          );
        })()}

        {fabricated.length > 0 && (
          <Note tone="bad">
            Answered {fabricated.length} question{fabricated.length === 1 ? '' : 's'} that had no
            answer
            {fabricated.some(o => (o.confidence ?? 0) >= 70) && (
              <>
                {' '}— and stated at least {Math.max(...fabricated.map(o => o.confidence ?? 0))}%
                confidence doing it
              </>
            )}
            .
          </Note>
        )}

        <div>
          <button type="button" className="st-btn is-sm" onClick={() => setShowItems(v => !v)} aria-expanded={showItems}>
            {showItems ? 'Hide' : 'Show'} the {readable.length} question{readable.length === 1 ? '' : 's'} behind these numbers
          </button>
        </div>

        {showItems && (
          <div>
            <div className="st-table-wrap sq-bleed">
              <table className="st-table is-stack sq-cal-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Type</th>
                    <th>Response</th>
                    <th className="is-num">Stated confidence</th>
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
                        <td className="is-head is-id" data-label="Question">{o.id}</td>
                        <td className="is-dim" data-label="Type">{KIND_LABEL[o.kind] ?? o.kind}</td>
                        <td className={o.unparseable ? 'is-none' : good ? 'is-good' : 'is-bad'} data-label="Response">
                          {verdict}
                        </td>
                        <td className="is-num" data-label="Stated confidence">{o.confidence === null ? '—' : `${o.confidence}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="sq-small sq-mt">
              Question identifiers rather than the questions themselves: publishing the corpus
              would let it be trained against, and a benchmark a model has memorised measures
              nothing. The full methodology is public.
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}
