'use client';

/**
 * Context rot (pilot) for one model: what happens to its answers as the document grows.
 *
 * The page /context-rot compares the pilot models; this panel answers the question a model
 * page is for — how far can I trust THIS model's context window. It shows the model's
 * accuracy at each length per skill (the "what breaks first" view), a chart with the other
 * pilot models in grey for scale, and where in the document it loses facts.
 *
 * Three cases, decided by /api/pro/context-rot?model=<name>:
 *   - not in the pilot: a short note saying so (no upgrade prompt — there is nothing to unlock)
 *   - in the pilot, below Pro Intelligence: what the panel contains, never a figure
 *   - in the pilot, Pro Intelligence and up: the results
 * The route checks the session server-side; the browser only decides how to render.
 *
 * Figures come from their own table and never enter the composite score.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PLANS } from '../../lib/entitlements';
import { REQUIRED_PLAN } from '../../lib/capabilities';
import { HeatGrid, HeatLegend, NoAnswerMark, SKILLS, k, listJoin, noAnswerSummary, noAnswerText, pct, type CrtModel } from '../context-rot/shared';
import { Pane, Loader, Note, Locked, Tag } from '@/components/studio';
import '../../styles/context-rot.css';
import '@/styles/studio-model-panels.css';

interface Other { name: string; displayName: string; buckets: Array<{ bucket: number; runnable: boolean; accuracy: number | null }> }
interface PanelData { buckets: number[]; depths: number[]; model: CrtModel; others: Other[] }

interface Props {
  modelName: string;
  onShowProModal: (feature: 'context-rot') => void;
}

/** 1,048,576 → "1M", 262,144 → "256K": windows are quoted in binary units by every provider here. */
const windowLabel = (w: number) => (w >= 1_000_000 ? `${Math.round((w / 1_048_576) * 10) / 10}M` : `${Math.round(w / 1024)}K`);

const formatDay = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function PilotLine({ pilotModels }: { pilotModels: string[] }) {
  return (
    <>
      The pilot covers {pilotModels.length ? listJoin(pilotModels) : 'DeepSeek, Kimi and GLM models'} for now.
      OpenAI, Anthropic, Google and more providers will follow.
    </>
  );
}

/** The pane every state renders in (module level, so a state change never remounts it). */
function Section({ children, when }: { children: ReactNode; when?: ReactNode }) {
  return (
    <Pane
      title={<span className="sq-crt-title">Context rot <Tag tone="accent">Pilot</Tag></span>}
      sub="How its answers hold up as a document grows from 8K to 1M tokens"
      actions={when ? <span className="sq-when">{when}</span> : undefined}
    >
      {children}
    </Pane>
  );
}

export default function ModelDetailContextRot({ modelName, onShowProModal }: Props) {
  const [state, setState] = useState<'loading' | 'ok' | 'locked' | 'absent' | 'error'>('loading');
  const [data, setData] = useState<PanelData | null>(null);
  const [pilotModels, setPilotModels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetch(`/api/pro/context-rot?model=${encodeURIComponent(modelName)}`, { cache: 'no-store' })
      .then(async r => {
        const body = await r.json().catch(() => null);
        if (cancelled) return;
        setPilotModels(Array.isArray(body?.pilotModels) ? body.pilotModels : []);
        if (body && body.inPilot === false) return setState('absent');
        if (r.status === 401 || r.status === 403) return setState('locked');
        if (!r.ok || !body?.success || !body.data) return setState('error');
        setData(body.data);
        setState('ok');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [modelName]);

  if (state === 'loading') {
    return (
      <Section>
        <Loader label="Loading context-rot results…" minHeight={160} />
      </Section>
    );
  }

  if (state === 'error') {
    return (
      <Section>
        <Note tone="warn">The context-rot results could not be loaded. Please try again shortly.</Note>
      </Section>
    );
  }

  if (state === 'absent') {
    return (
      <Section>
        <Note>
          <b>Not in the pilot yet.</b> Context rot measures how a model’s answers hold up as a document grows
          from 8K to 1M tokens. <PilotLine pilotModels={pilotModels} />{' '}
          <Link href="/context-rot">How the test works</Link>
        </Note>
      </Section>
    );
  }

  if (state === 'locked') {
    const required = REQUIRED_PLAN['context-rot'];
    return (
      <Section>
        <Locked
          plan={PLANS[required]?.label ?? 'Pro Intelligence'}
          title="How far this model’s context window really goes"
          onOpen={() => onShowProModal('context-rot')}
        >
          Its accuracy at each length from 8K to 1M tokens, what breaks first — finding, linking,
          tracking or counting — and where in the document it loses facts. <PilotLine pilotModels={pilotModels} />
        </Locked>
      </Section>
    );
  }

  if (!data) return null;
  const m = data.model;

  if (!m.sweeps) {
    return (
      <Section>
        <Note>
          <b>Not measured yet.</b> This model is in the pilot, which runs once a week, on Sundays. Its
          results appear here after its first run. <Link href="/context-rot">How the test works</Link>
        </Note>
      </Section>
    );
  }

  return (
    <Section when={<>Last run {formatDay(m.latestSweep)} · {m.sweeps} weekly run{m.sweeps === 1 ? '' : 's'} so far</>}>
      <Results data={data} pilotModels={pilotModels} />
    </Section>
  );
}

function Results({ data, pilotModels }: { data: PanelData; pilotModels: string[] }) {
  const m = data.model;
  const runs = m.buckets.filter(b => b.runnable && b.accuracy !== null);
  const first = runs[0];
  const last = runs[runs.length - 1];
  const runnable = m.buckets.filter(b => b.runnable);

  // What breaks first: the skill that lost the most between the shortest and the longest
  // length measured. A tie on zero is said plainly rather than inventing a loser.
  const drops = first && last && first !== last
    ? SKILLS.map(([s, label]) => {
        const a = first.skills[s]?.accuracy, b = last.skills[s]?.accuracy;
        return a === undefined || b === undefined ? null : { label, from: a, to: b, drop: a - b };
      }).filter((x): x is { label: string; from: number; to: number; drop: number } => !!x)
    : [];
  const worst = drops.length ? drops.reduce((a, b) => (b.drop > a.drop ? b : a)) : null;

  return (
    <div className="sq-stack sq-crt">
      <p className="sq-p">
        One long, dated archive and sixteen questions about it, asked at every length from 8K tokens up
        to {k(runnable[runnable.length - 1]?.bucket ?? 8000)}: finding a fact, linking facts across the
        document, tracking a value that changed, and counting. Graded exactly; never part of the composite
        score. <PilotLine pilotModels={pilotModels} />{' '}
        <Link href="/context-rot">How it works</Link>
      </p>

      <div className="sq-figs">
        <div className="sq-fig" title={`The longest length that keeps at least ${Math.round(m.holdRatio * 100)}% of its own 8K accuracy.${m.effectiveIsLowerBound ? ' It held at every length measured so far; a longer one has not been measured yet.' : ''}`}>
          <span className="sq-fig-v">{m.effectiveContext ? `${m.effectiveIsLowerBound ? '≥ ' : ''}${k(m.effectiveContext)}` : '—'}</span>
          <span className="sq-fig-l">holds up to</span>
        </div>
        <div className="sq-fig" title={first ? `${first.correct}/${first.total} questions correct${first.noAnswer ? ` · ${noAnswerText(first)}` : ''}` : undefined}>
          <span className="sq-fig-v">{pct(first?.accuracy)}{first ? <NoAnswerMark b={first} /> : null}</span>
          <span className="sq-fig-l">accuracy at {first ? k(first.bucket) : '8K'}</span>
        </div>
        {last && last !== first && (
          <div className="sq-fig" title={`${last.correct}/${last.total} questions correct${last.tokens ? ` · ${last.tokens.toLocaleString()} tokens sent` : ''}${last.noAnswer ? ` · ${noAnswerText(last)}` : ''}`}>
            <span className="sq-fig-v">{pct(last.accuracy)}<NoAnswerMark b={last} /></span>
            <span className="sq-fig-l">accuracy at {k(last.bucket)}</span>
          </div>
        )}
        <div className="sq-fig" title={`${m.window.toLocaleString()} tokens, from the provider’s documentation`}>
          <span className="sq-fig-v">{windowLabel(m.window)}</span>
          <span className="sq-fig-l">context window</span>
        </div>
      </div>

      {worst && (
        <p className="sq-p">
          {worst.drop > 0
            ? <>What breaks first: <b>{worst.label.toLowerCase()}</b>, {pct(worst.from)} at {k(first!.bucket)} → {pct(worst.to)} at {k(last!.bucket)}.</>
            : <>No skill lost accuracy between {k(first!.bucket)} and {k(last!.bucket)}.</>}
        </p>
      )}

      {/* Desktop: two columns — the table with the position grid under it, the chart that draws
          the table beside it. Narrow screens: one column, table → chart → grid (CSS order). */}
      <div className="sq-crt-figs">
        <div className="sq-crt-col">
          <div className="sq-crt-wrap">
            <table className="sq-crt-table">
              <caption>Accuracy at each length, latest weekly run</caption>
              <thead>
                <tr><th>Questions</th>{data.buckets.map(b => <th key={b}>{k(b)}</th>)}</tr>
              </thead>
              <tbody>
                <tr className="is-total">
                  <td>All sixteen</td>
                  {m.buckets.map(b => (
                    <td key={b.bucket} title={cellTitle(b, m.window)}>
                      {!b.runnable ? <span className="sq-na">n/a</span> : <>{pct(b.accuracy)}<NoAnswerMark b={b} /></>}
                    </td>
                  ))}
                </tr>
                {SKILLS.map(([s, label]) => (
                  <tr key={s}>
                    <td>{label}</td>
                    {m.buckets.map(b => {
                      const st = b.skills[s];
                      return (
                        <td key={b.bucket} title={!b.runnable ? `Beyond its ${m.window.toLocaleString()}-token window` : st ? `${st.correct}/${st.total} correct` : 'Not measured'}>
                          {!b.runnable ? <span className="sq-na">n/a</span> : pct(st?.accuracy)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {noAnswerSummary(m.buckets) && (
            <p className="sq-small sq-crt-noanswer">
              <sup className="crt-mark">*</sup> No answer within the output limit, counted as wrong in this row:{' '}
              {noAnswerSummary(m.buckets)}. The skill rows count only the runs that answered.
            </p>
          )}
          <figure className="sq-crt-fig sq-crt-heat">
            <figcaption className="sq-crt-fig-t">Where in the document facts get lost</figcaption>
            <HeatGrid model={m} buckets={data.buckets} depths={data.depths} />
            <HeatLegend />
            <p className="sq-small sq-mt">
              Finding a fact, by how far through the document it sits (rows) and document length (columns).
              Pooled over the last {m.gridSweeps} weekly run{m.gridSweeps === 1 ? '' : 's'}, counting the runs
              that gave an answer; hover a cell for the count.
            </p>
          </figure>
        </div>
        <div className="sq-crt-col">
          <LengthChart data={data} />
          <p className="sq-small sq-crt-defs">
            Holds up to: the longest length that keeps at least {Math.round(m.holdRatio * 100)}% of the model’s own
            8K accuracy. n/a: longer than its context window. A run with no answer within the output limit counts
            as wrong in the totals. Provider errors are left out, never counted as wrong.
          </p>
        </div>
      </div>
    </div>
  );
}

function cellTitle(b: CrtModel['buckets'][number], window: number) {
  if (!b.runnable) return `Beyond its ${window.toLocaleString()}-token window`;
  if (!b.total) return b.excluded ? `${b.excluded} trial(s) excluded (provider error)` : 'Not measured';
  return `${b.correct}/${b.total} correct${b.tokens ? ` · ${b.tokens.toLocaleString()} tokens sent` : ''}${b.excluded ? ` · ${b.excluded} trial(s) excluded (provider error)` : ''}${b.noAnswer ? ` · ${noAnswerText(b)}` : ''}`;
}

/** This model in the accent colour; the other pilot models as thin grey lines for scale. */
function LengthChart({ data }: { data: PanelData }) {
  const [hover, setHover] = useState<number | null>(null);
  const m = data.model;
  const W = 520, H = 250, L = 52, R = 18, T = 14, B = 30;
  const xs = data.buckets.map((_, i) => L + (i * (W - L - R)) / (data.buckets.length - 1));

  // Same rule as the pilot page: start the axis at 50% only while every value is at or above it.
  const all = [m, ...data.others].flatMap(s => s.buckets.filter(b => b.runnable && b.accuracy !== null).map(b => b.accuracy as number));
  const floor = all.length && Math.min(...all) >= 0.5 ? 0.5 : 0;
  const ticks = floor === 0.5 ? [0.5, 0.75, 1] : [0, 0.25, 0.5, 0.75, 1];
  const y = (a: number) => T + ((1 - a) / (1 - floor)) * (H - T - B);
  const pts = (bs: Other['buckets']) => bs
    .map((b, j) => (b.runnable && b.accuracy !== null ? { x: xs[j], y: y(b.accuracy), a: b.accuracy, j } : null))
    .filter((p): p is { x: number; y: number; a: number; j: number } => !!p);

  const mine = pts(m.buckets);
  const others = useMemo(() => data.others.map(o => ({ o, p: pts(o.buckets) })).filter(s => s.p.length), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const end = mine[mine.length - 1];

  const hoverInfo = hover === null ? null : (() => {
    const b = m.buckets[hover];
    const vals = data.others.map(o => o.buckets[hover]).filter(x => x?.runnable && x.accuracy !== null).map(x => x.accuracy as number);
    return { b, lo: vals.length ? Math.min(...vals) : null, hi: vals.length ? Math.max(...vals) : null, n: vals.length };
  })();

  return (
    <figure className="sq-crt-fig sq-crt-chart">
      <figcaption className="sq-crt-fig-t">Accuracy by context length</figcaption>
      <div className="sq-legend" aria-hidden="true">
        <span><i className="sq-line is-self" />{m.displayName}</span>
        {others.length > 0 && <span><i className="sq-line" />Other pilot models</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sq-crt-svg" role="img"
        aria-label={`Line chart of ${m.displayName}'s accuracy at each context length, with the other pilot models in grey; the table above lists every value.`}
        onMouseLeave={() => setHover(null)}>
        {ticks.map(a => (
          <g key={a}>
            <line x1={L} x2={W - R} y1={y(a)} y2={y(a)} className="sq-crt-grid" />
            <text x={L - 8} y={y(a) + 4} className="sq-crt-axis" textAnchor="end">{Math.round(a * 100)}%</text>
          </g>
        ))}
        {xs.map((x, j) => (
          <text key={j} x={x} y={H - 8} className="sq-crt-axis" textAnchor="middle">{k(data.buckets[j])}</text>
        ))}
        {others.map(({ o, p }) => (
          <polyline key={o.name} points={p.map(q => `${q.x},${q.y}`).join(' ')} className="sq-crt-other" />
        ))}
        {hover !== null && <line x1={xs[hover]} x2={xs[hover]} y1={T} y2={H - B} className="sq-crt-cross" />}
        <polyline points={mine.map(q => `${q.x},${q.y}`).join(' ')} className="sq-crt-mine" />
        {mine.map(q => <circle key={q.j} cx={q.x} cy={q.y} r={hover === q.j ? 5 : 3.5} className="sq-crt-dot" />)}
        {end && hover === null && (
          <text x={end.x} y={end.y - 10} className="sq-crt-end" textAnchor={end.j === xs.length - 1 ? 'end' : 'middle'}>
            {pct(end.a)}
          </text>
        )}
        {xs.map((x, j) => (
          <rect key={j} x={x - (W - L - R) / (2 * (xs.length - 1))} y={T} width={(W - L - R) / (xs.length - 1)} height={H - T - B}
            fill="transparent" onMouseEnter={() => setHover(j)} />
        ))}
      </svg>
      {hoverInfo ? (
        <div className="sq-crt-tip" role="status">
          <b>{k(data.buckets[hover as number])}</b>
          <span>{m.displayName}: {!hoverInfo.b.runnable ? 'beyond its window' : `${pct(hoverInfo.b.accuracy)}${hoverInfo.b.total ? ` (${hoverInfo.b.correct}/${hoverInfo.b.total})` : ''}${hoverInfo.b.noAnswer ? ` · ${hoverInfo.b.noAnswer} of ${hoverInfo.b.trials} runs gave no answer` : ''}`}</span>
          {hoverInfo.n > 0 && (
            <span className="is-dim">
              Other pilot models: {hoverInfo.lo === hoverInfo.hi ? pct(hoverInfo.lo) : `${pct(hoverInfo.lo)}–${pct(hoverInfo.hi)}`}
            </span>
          )}
        </div>
      ) : (
        floor > 0 && <p className="sq-small sq-mt">The axis starts at 50%: every pilot model is above it at every length.</p>
      )}
    </figure>
  );
}
