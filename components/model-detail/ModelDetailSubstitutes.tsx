'use client';

/**
 * Cheaper models that can stand in for this one.
 *
 * WHY THIS PANEL EXISTS
 * ---------------------
 * Everything else on this page compares models on their own terms — this one
 * scores 86, that one 91, and here is what each costs. None of it answers the
 * question someone actually choosing between them has: if I send my request to
 * the cheaper one instead, how often does something that would have worked now
 * break?
 *
 * That is a different quantity from the score gap. Two models can average the
 * same and fail on completely different tasks, and it is the overlap, not the
 * average, that decides whether substituting is free. On our own corpus the two
 * readings disagree outright: by average pass rate deepseek-v4-flash ranks above
 * gpt-5.6-luna, and by the measure below the order reverses — Luna breaks about
 * 1% of what the expensive models complete, DeepSeek Flash around 9%.
 *
 * The number comes from per-trial counts, not the run verdict. A verdict is the
 * median of 7 trials, so 4-of-7 and 7-of-7 both read as "passed", and a caller
 * issues one request rather than seven. Read from verdicts this panel would
 * report exactly zero for Luna against the entire expensive fleet; read from the
 * trials underneath it reports ~1%. See api: lib/substitution.ts.
 *
 * PAID. The gate here only decides whether to ask; the control is the Next route
 * it calls, which resolves the session and plan server-side.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { PLANS, planMeets, type Plan } from '../../lib/entitlements';
import { REQUIRED_PLAN } from '../../lib/capabilities';
import { Pane, Loader, Empty, Note, Locked, Tag, ProviderMark, PROVIDER_LABEL } from '@/components/studio';
import '@/styles/studio-model-panels.css';

type Verdict = 'safe' | 'caution' | 'unsafe' | 'insufficient';

type Suite = 'coding' | 'tooling' | 'reasoning';

interface SuiteRegret {
  suite: Suite;
  pairedCells: number;
  trials: number;
  expectedPasses: number;
  regret: number;
  regretLo: number;
  regretHi: number;
  regretFloor: number;
  rescue: number;
  /** False while the suite lacks the resolution to decide a verdict. */
  counts: boolean;
}

interface Substitute {
  modelId: number;
  name: string;
  vendor: string;
  blendedCostPer1M: number;
  cheaperBy: number | null;
  suites: SuiteRegret[];
  governingSuite: Suite | null;
  governingIsProvisional: boolean;
  pairedCells: number;
  trials: number;
  expectedPasses: number;
  regret: number;
  regretLo: number;
  regretHi: number;
  rescue: number;
  verdict: Verdict;
}

interface Report {
  modelId: number;
  name: string;
  vendor: string;
  blendedCostPer1M: number;
  basis: {
    suites: Suite[];
    benchConfigId: number;
    since: string;
    tasksBySuite: Record<string, number>;
    note: string;
  };
  substitutes: Substitute[];
}

interface Props {
  modelId: string | number;
  plan: Plan;
  hasProAccess: boolean;
  onShowProModal: (feature: 'substitutes') => void;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  safe: 'Safe',
  caution: 'Caution',
  unsafe: 'Unsafe',
  insufficient: 'Too few runs',
};

/** Short column labels; the full name is in the title attribute. */
const SUITE_ORDER: Suite[] = ['coding', 'tooling', 'reasoning'];
const SUITE_ABBR: Record<Suite, string> = { coding: 'cod', tooling: 'tool', reasoning: 'rsn' };
const SUITE_NAME: Record<Suite, string> = { coding: 'coding', tooling: 'tool use', reasoning: 'reasoning' };

const VERDICT_TONE: Record<Verdict, 'good' | 'warn' | 'bad' | undefined> = {
  safe: 'good',
  caution: 'warn',
  unsafe: 'bad',
  insufficient: undefined,
};

const VERDICT_HINT: Record<Verdict, string> = {
  safe: 'Every suite with enough runs breaks under 2% of what this model completes, and under 5% even on the worst-case reading.',
  caution: 'At least one suite loses a measurable share of working requests. Worth the saving only if you can absorb that.',
  unsafe: 'At least one suite fails too much of what this model completes for the saving to be the deciding factor.',
  insufficient: 'No suite yet has enough paired runs on the current benchmark configuration to judge.',
};

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const pct0 = (v: number) => `${Math.round(v * 100)}%`;
/** Prices keep their cents: rounding $13.60 to "$14" loses a real difference. */
const money = (v: number) => (Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`);

/** How many times cheaper, rendered the way a person would say it. */
const savings = (x: number | null): string => {
  if (x === null || !Number.isFinite(x)) return '—';
  if (x >= 10) return `${Math.round(x)}× cheaper`;
  return `${x.toFixed(1)}× cheaper`;
};

/** The pane every state renders in (module level, so a state change never remounts it). */
function Section({ children, foot }: { children: ReactNode; foot?: ReactNode }) {
  return (
    <Pane
      title="Cheaper substitutes"
      sub="Cheaper models that can do this one’s work, and what switching costs"
      foot={foot}
    >
      {children}
    </Pane>
  );
}

export default function ModelDetailSubstitutes({ modelId, plan, hasProAccess, onShowProModal }: Props) {
  const required = REQUIRED_PLAN.substitutes;
  const unlocked = hasProAccess || planMeets(plan, required);

  const [report, setReport] = useState<Report | null>(null);
  const [measured, setMeasured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // No fetch when locked: fetching and hiding still ships the data to the
    // browser, where it is one devtools tab away.
    if (!unlocked) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/pro/substitutes/${modelId}`)
      .then(res => {
        if (res.status === 401 || res.status === 403) throw new Error('This panel requires an active subscription');
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(json => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Failed to load substitution data');
        setMeasured(!!json.measured);
        setReport(json.data ?? null);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [modelId, unlocked]);

  if (!unlocked) {
    return (
      <Section>
        <Locked
          plan={PLANS[required]?.label ?? 'Pro Intelligence'}
          title="Substitution analysis"
          onOpen={() => onShowProModal('substitutes')}
        >
          Which cheaper models can do this one&rsquo;s work, and the measured share of
          requests that would start failing if you switched.
        </Locked>
      </Section>
    );
  }

  if (loading) {
    return (
      <Section>
        <Loader label="Loading substitution analysis…" minHeight={160} />
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

  if (measured === false || !report) {
    return (
      <Section>
        <Empty title="Not enough per-trial history yet.">
          This compares trial-by-trial outcomes on the repository-repair tasks, which this
          model has not run on the current benchmark configuration.
        </Empty>
      </Section>
    );
  }

  const rows = report.substitutes;
  if (rows.length === 0) {
    return (
      <Section>
        <Note>
          <strong>Nothing cheaper can replace it.</strong>{' '}
          No model priced below {money(report.blendedCostPer1M)}/1M has enough paired runs on
          the current configuration to be judged.
        </Note>
      </Section>
    );
  }

  const shown = showAll ? rows : rows.slice(0, 5);
  const best = rows.find(r => r.verdict === 'safe') ?? null;
  // A caution-rated option that is meaningfully cheaper than the safe pick. Only
  // surfaced when the gap is large enough to be a real trade rather than noise.
  const cheaperRisk =
    best && best.cheaperBy
      ? rows.find(
          r =>
            r.verdict === 'caution' &&
            r.cheaperBy !== null &&
            r.cheaperBy >= best.cheaperBy! * 3
        ) ?? null
      : null;

  return (
    <Section foot={(
      <>
        Read from per-trial outcomes, not run verdicts — a verdict is the median of seven
        trials and hides the variance a single request sees. Each suite stands on its own and
        the headline takes the worst, never the average, because a safe coding score must not
        be able to cover a bad tool-use one. A degree mark (&deg;) means a suite has too few
        runs to confirm safety yet; it is judged on its lower bound, so it can still rule
        safety out. {report.basis.note}
      </>
    )}>
      <div className="sq-stack">
        {/* The recommendation, stated once, in money. Everything below is the evidence
            for it — a reader who stops here should still have the answer. */}
        {best && best.cheaperBy && best.cheaperBy > 1.5 && (
          <Note tone="good">
            <strong>{best.name}</strong> does this model&rsquo;s work at{' '}
            <strong>{savings(best.cheaperBy)}</strong>, failing at worst{' '}
            <strong>{pct1(best.regret)}</strong> of what it completes
            {best.governingSuite && <> (on {SUITE_NAME[best.governingSuite]}, its weakest suite)</>}
            {best.rescue >= 0.2 && <> — and completing <strong>{pct0(best.rescue)}</strong> of what it drops</>}.
            {/* The cheapest option is often one tier below safe. Saying so is the difference
                between a recommendation and a recommendation you can act on: a reader who
                can absorb 3% should not have to work it out of the table themselves. */}
            {cheaperRisk && (
              <>
                {' '}
                <span className="sq-sub-alt">
                  <strong>{cheaperRisk.name}</strong> is {savings(cheaperRisk.cheaperBy)} again, at{' '}
                  <strong>{pct1(cheaperRisk.regret)}</strong>
                  {cheaperRisk.governingSuite && <> on {SUITE_NAME[cheaperRisk.governingSuite]}</>} — worth
                  it only if you can absorb that.
                </span>
              </>
            )}
          </Note>
        )}

        <div>
          <div className="sq-sub-head">
            <span>
              <b>{report.name}</b> costs {money(report.blendedCostPer1M)}/1M blended
            </span>
            <span>
              {(['coding', 'tooling', 'reasoning'] as Suite[])
                .filter(x => report.basis.tasksBySuite[x])
                .map(x => `${report.basis.tasksBySuite[x]} ${SUITE_NAME[x]}`)
                .join(' · ')}{' '}
              tasks · config {report.basis.benchConfigId}
            </span>
          </div>

          <div className="sq-bleed sq-sub-table" role="table" aria-label="Cheaper substitutes">
            <div className="sq-sub-row is-head" role="row">
              <span role="columnheader">Model</span>
              <span role="columnheader">Price</span>
              <span role="columnheader" title="Of the requests this model completes, the share the substitute would fail — taken from its weakest suite, never averaged across them. The strip underneath gives every suite.">
                Would fail
              </span>
              <span role="columnheader" title="Of the requests this model fails, the share the substitute completes.">
                Rescues
              </span>
              <span role="columnheader">Verdict</span>
            </div>

            {shown.map(s => (
              <div key={s.modelId} className="sq-sub-row" role="row">
                {/* data-save carries the saving into the name cell for phones, where the
                    price column is dropped for width. Without it the one fact the panel
                    exists to deliver disappears on mobile. */}
                <span className="sq-sub-name" role="cell">
                  <ProviderMark provider={s.vendor} size="sm" />
                  <span className="sq-sub-name-t" data-save={savings(s.cheaperBy)}>
                    {s.name}
                    <span className="sq-sub-vendor">{PROVIDER_LABEL[s.vendor] ?? s.vendor}</span>
                  </span>
                </span>

                <span className="sq-sub-price" role="cell">
                  {money(s.blendedCostPer1M)}
                  <span className="sq-sub-save">{savings(s.cheaperBy)}</span>
                </span>

                <span className="sq-sub-regret" role="cell">
                  <span className={`sq-sub-v is-${s.verdict}`}>
                    {s.verdict === 'insufficient' ? '—' : pct1(s.regret)}
                  </span>
                  {s.governingSuite && (
                    <span className="sq-sub-gov">
                      {SUITE_NAME[s.governingSuite]}
                      {s.governingIsProvisional && <span className="sq-sub-prov" title="Decided by a suite still below the run floor: it cannot confirm safety, but the sample already rules it out.">&deg;</span>}
                    </span>
                  )}
                  {/* Every suite, so the headline can be checked rather than trusted.
                      Never averaged: a good coding number must not be able to hide a
                      bad tool-use one, which is the whole reason the verdict takes the
                      worst rather than the middle. */}
                  <span className="sq-sub-suites">
                    {/* Fixed order, not worst-first: a strip that reorders per row cannot be
                        compared down the column, and which suite decided is already said above. */}
                    {SUITE_ORDER.map(name => s.suites.find(q => q.suite === name)).filter(Boolean).map(q => (q!)).map(q => (
                      <span
                        key={q.suite}
                        className={`sq-sub-suite${q.counts ? '' : ' is-prov'}`}
                        title={
                          `${SUITE_NAME[q.suite]}: ${pct1(q.regret)} of what this model completes would fail` +
                          ` — ${q.pairedCells} paired tasks, ${q.trials} trial${q.trials === 1 ? '' : 's'}.` +
                          (q.counts
                            ? ''
                            : ` Below the run floor, so it cannot grant a verdict; it is read on its lower bound of ${pct1(q.regretFloor)}, which can still deny one.`)
                        }
                      >
                        {SUITE_ABBR[q.suite]} {pct1(q.regret)}{q.counts ? '' : '\u00b0'}
                      </span>
                    ))}
                  </span>
                </span>

                <span className="sq-sub-rescue" role="cell">
                  {s.verdict === 'insufficient' ? '—' : pct0(s.rescue)}
                </span>

                <span className="sq-sub-verdict" role="cell">
                  <Tag
                    tone={VERDICT_TONE[s.verdict]}
                    title={`${VERDICT_HINT[s.verdict]} Measured over ${s.pairedCells} paired tasks (${s.trials} trials).`}
                  >
                    {VERDICT_LABEL[s.verdict]}
                  </Tag>
                </span>
              </div>
            ))}
          </div>

          {rows.length > 5 && (
            <button type="button" className="st-btn is-sm sq-mt" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>
              {showAll ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}
