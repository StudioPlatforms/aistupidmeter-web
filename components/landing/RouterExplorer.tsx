'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import RankList from './RankList';
import { metricKind, RANKS_ON, type LandingSnapshot, type LandingStrategy } from './types';
import { scoreLabel, useReducedMotion } from './util';

const GROUPS = ['Best quality', 'Best value', 'Speed, cost, stability', 'Adaptive'];

interface Mode { id: string; key: string; group: number; name: string; desc: string; order: string }

const MODES: Mode[] = [
  { id: 'auto-best', key: 'best_overall', group: 0, name: 'Best overall', order: 'Quality (effective score)',
    desc: 'The highest combined score among the models you have keys for.' },
  { id: 'auto-coding', key: 'best_coding', group: 0, name: 'Best coding', order: 'Quality (effective score)',
    desc: 'The current leader on real repository bug fixes, re-measured every 4 hours.' },
  { id: 'auto-reasoning', key: 'best_reasoning', group: 0, name: 'Best reasoning', order: 'Quality (effective score)',
    desc: 'The leader on long, multi-turn engineering sessions whose requirements are checked by code.' },
  { id: 'auto-tooling', key: 'best_tooling', group: 0, name: 'Best tool use', order: 'Quality (effective score)',
    desc: 'The model that finishes sandboxed agent tasks with real tools most reliably.' },
  { id: 'auto-value', key: 'best_value', group: 1, name: 'Best value', order: 'Points per measured dollar, among contenders',
    desc: 'Among models within 5 points of the best, the most combined points per measured dollar.' },
  { id: 'auto-value-coding', key: 'best_value_coding', group: 1, name: 'Best value for code', order: 'Points per measured dollar, among contenders',
    desc: 'Coding quality per dollar, among models within 5 points of the coding leader.' },
  { id: 'auto-value-reasoning', key: 'best_value_reasoning', group: 1, name: 'Best value for reasoning', order: 'Points per measured dollar, among contenders',
    desc: 'Reasoning quality per dollar, among models within 5 points of the reasoning leader.' },
  { id: 'auto-value-tooling', key: 'best_value_tooling', group: 1, name: 'Best value for agents', order: 'Points per measured dollar, among contenders',
    desc: 'Tool-use quality per dollar, among models within 5 points of the tool-use leader.' },
  { id: 'auto-fastest-quality', key: 'fastest_quality', group: 2, name: 'Fastest quality', order: 'Measured latency, among contenders',
    desc: 'The fastest measured model among those within 5 points of the best. Never ranks on estimates.' },
  { id: 'auto-fastest', key: 'fastest', group: 2, name: 'Fastest', order: 'Latency',
    desc: 'The lowest latency, full stop — for autocomplete, titles and other short, time-critical calls.' },
  { id: 'auto-cheapest', key: 'cheapest', group: 2, name: 'Cheapest', order: 'Blended list price',
    desc: 'The lowest blended list price per token — for bulk classification, tagging and extraction.' },
  { id: 'auto-consistent', key: 'best_consistent', group: 2, name: 'Most consistent', order: 'Smallest run-to-run spread, among contenders',
    desc: 'Among contenders, the model whose coding score moves least from run to run.' },
  { id: 'auto-task', key: 'match_task', group: 3, name: 'Match each request', order: 'As the matched strategy',
    desc: 'Reads each request and picks the strategy for it: tools go to tool use, design questions to reasoning, large code to coding.' },
  { id: 'auto-split', key: 'custom_split', group: 3, name: 'Your traffic split', order: 'Weighted draw per request',
    desc: 'Up to 10 models with your own weights. Each request draws its primary by weight; the rest of the split become its fallbacks.' },
  { id: 'auto', key: 'preference', group: 3, name: 'Your saved preference', order: 'As configured',
    desc: 'Whatever you saved in the dashboard: a strategy plus exclusions, cost and latency caps and your own fallback order.' },
];

const RULES: Array<[string, string, RegExp]> = [
  ['Offers tools', 'best_tooling', /offers tools/],
  ['Design or planning words, or 8+ turns', 'best_reasoning', /design|planning|long session/],
  ['Code, large or demanding', 'best_coding', /large or demanding/],
  ['Other code', 'best_value_coding', /^coding request/],
  ['Long or analytical text', 'best_overall', /long or analytical/],
  ['Everything else', 'best_value', /short general/],
];

/** Where most people start; the other modes are one click away. */
const STARTERS: Array<[string, string, string]> = [
  ['auto-best', 'Best performance', 'The highest combined score'],
  ['auto-value', 'Best value', 'Most quality per measured dollar'],
  ['auto-consistent', 'Most consistent', 'The steadiest results, run to run'],
];

const TASK_SAMPLES: Array<[string, string]> = [['match_task', 'Code'], ['match_task_design', 'Design'], ['match_task_tools', 'Tools']];
const SPLIT_COLORS = ['var(--lp-accent)', 'var(--lp-good)', 'var(--lp-warn)'];

export default function RouterExplorer({ snapshot }: { snapshot: LandingSnapshot }) {
  const reduced = useReducedMotion();
  const available = useMemo(() => MODES.filter(m => snapshot.strategies[m.key]), [snapshot]);
  const starters = useMemo(() => STARTERS.filter(([id]) => available.some(m => m.id === id)), [available]);
  const [all, setAll] = useState(starters.length < 2);
  const shown = useMemo(() => (all ? available : available.filter(m => starters.some(([id]) => id === m.id))), [all, available, starters]);
  const [modeId, setModeId] = useState(() => (starters[0]?.[0] ?? available.find(m => m.id === 'auto-coding')?.id ?? available[0]?.id));
  const [taskKey, setTaskKey] = useState('match_task');
  const [tab, setTab] = useState<'py' | 'ts' | 'sh'>('py');
  const [flash, setFlash] = useState(0);
  const autoRef = useRef(true);
  const inViewRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of Object.values(snapshot.strategies)) {
      if (!s) continue;
      m.set(s.primary.model, s.primary.displayName);
      for (const r of s.rows) m.set(r.model, r.displayName);
    }
    return m;
  }, [snapshot]);

  useEffect(() => {
    const io = new IntersectionObserver(es => { inViewRef.current = es[0].isIntersecting; }, { threshold: 0.25 });
    if (rootRef.current) io.observe(rootRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      if (!autoRef.current || !inViewRef.current || document.hidden) return;
      setModeId(prev => {
        const i = shown.findIndex(m => m.id === prev);
        return shown[(i + 1) % shown.length]?.id ?? prev;
      });
      setFlash(f => f + 1);
    }, 4600);
    return () => clearInterval(t);
  }, [shown, reduced]);

  const mode = available.find(m => m.id === modeId);
  if (!mode) return null;
  const snap: LandingStrategy | null = mode.key === 'match_task' ? snapshot.strategies[taskKey] : snapshot.strategies[mode.key];
  if (!snap) return null;

  const choose = (id: string) => { autoRef.current = false; setModeId(id); setFlash(f => f + 1); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const i = shown.findIndex(m => m.id === modeId);
    const next = shown[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length];
    choose(next.id);
    (rootRef.current?.querySelector(`[data-mode="${next.id}"]`) as HTMLElement | null)?.focus();
  };

  const kind = metricKind(snap.effectiveStrategy);
  const ranksOn = mode.key === 'match_task'
    ? `Decided per request — this one: ${snap.taskRule ?? snap.effectiveStrategy}`
    : mode.key === 'preference'
      ? `Example: ${snapshot.examplePreference.strategy}, ${snapshot.examplePreference.excludeProviders.map(p => p[0].toUpperCase() + p.slice(1)).join(', ')} excluded, at most $${snapshot.examplePreference.maxCostPer1M} per 1M tokens`
      : RANKS_ON[snap.effectiveStrategy] ?? snap.effectiveStrategy;
  const chain = [snap.primary.model, ...snap.fallbacks.slice(0, 2)].map(n => names.get(n) ?? n);
  const p = snap.primary;
  const tok = <span key={flash} className="lp-tok is-flash">&quot;{mode.id}&quot;</span>;

  return (
    <div ref={rootRef}>
      {!all && (
        <div className="lp-start lp-up">
          <div className="lp-start-row" role="tablist" aria-label="Routing modes" onKeyDown={onKey}>
            {starters.map(([id, name, sub]) => (
              <button key={id} type="button" role="tab" className="lp-start-b" data-mode={id}
                aria-selected={id === modeId} aria-controls="lp-ex-panel" tabIndex={id === modeId ? 0 : -1}
                onClick={() => choose(id)}>
                <b>{name}</b><span>{sub}</span><code>{id}</code>
              </button>
            ))}
          </div>
          <button type="button" className="lp-start-all" onClick={() => setAll(true)}>All {available.length} routing modes</button>
        </div>
      )}
      {/* Opened by a click, the full board mounts after the scroll reveals were wired, so it carries no lp-up. */}
      {all && <div className={`lp-board${starters.length < 2 ? ' lp-up' : ''}`} role="tablist" aria-label="Routing modes" onKeyDown={onKey}>
        {GROUPS.map((g, gi) => (
          <div className="lp-board-g" key={g}>
            <p>{g}</p>
            <div>
              {available.filter(m => m.group === gi).map(m => (
                <button key={m.id} type="button" role="tab" className="lp-chip" data-mode={m.id}
                  aria-selected={m.id === modeId} aria-controls="lp-ex-panel" tabIndex={m.id === modeId ? 0 : -1}
                  onClick={() => choose(m.id)}>{m.id}</button>
              ))}
            </div>
          </div>
        ))}
      </div>}

      <div className="lp-ex lp-up" style={{ '--d': '.08s' } as CSSProperties}>
        <div className="lp-pane" role="tabpanel" id="lp-ex-panel">
          <div className="lp-ex-name"><h3>{mode.name}</h3><code>{mode.key === 'preference' ? 'your settings' : snap.strategy}</code></div>
          <p className="lp-ex-desc">{mode.desc}</p>
          <dl className="lp-kv">
            <div><dt>Ranks on</dt><dd>{ranksOn}</dd></div>
            <div><dt>Ordered by</dt><dd>{mode.order}</dd></div>
            <div><dt>Always</dt><dd>Only models you have a key for; drift-flagged models and open circuits go last</dd></div>
          </dl>
          {mode.key === 'match_task' && (
            <div className="lp-special">
              <div className="lp-samples" role="group" aria-label="Sample request">
                {TASK_SAMPLES.filter(([k]) => snapshot.strategies[k]).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={taskKey === k} onClick={() => { autoRef.current = false; setTaskKey(k); }}>{label}</button>
                ))}
              </div>
              <p className="lp-sample"><b>Sample request:</b> {taskKey === 'match_task_design' ? snapshot.samples.design : taskKey === 'match_task_tools' ? `${snapshot.samples.tools} (with calendar and email tools)` : 'Refactor the payment retry loop: it has a race condition under concurrent requests. (Go code attached)'}</p>
              <ol className="lp-rules">
                {RULES.map(([label, strat, re]) => (
                  <li key={label} className={re.test(snap.taskRule ?? '') ? 'is-hit' : ''}>{label} <b>{strat}</b></li>
                ))}
              </ol>
            </div>
          )}
          {mode.key === 'custom_split' && (
            <div className="lp-special">
              <div className="lp-split" aria-label="Example traffic split">
                {snap.rows.filter(r => r.metric != null && r.tag !== 'not_in_split').map((r, i) => (
                  <span key={r.model} style={{ flex: r.metric ?? 1, background: SPLIT_COLORS[i % SPLIT_COLORS.length] }}>
                    {(r.metric ?? 0) >= 25 ? `${r.displayName} · ${r.metric}` : r.metric}
                  </span>
                ))}
              </div>
            </div>
          )}
          {mode.key === 'preference' && (
            <div className="lp-special lp-prefs">
              <span>{snapshot.examplePreference.strategy}</span>
              {snapshot.examplePreference.excludeProviders.map(pv => <span key={pv}>{pv[0].toUpperCase() + pv.slice(1)} excluded</span>)}
              <span>≤ ${snapshot.examplePreference.maxCostPer1M} per 1M tokens</span>
            </div>
          )}
        </div>

        <div className="lp-pane">
          <div className="lp-rank-head"><span>If you sent a request now</span><span>{scoreLabel(snap.effectiveStrategy, kind)}</span></div>
          <RankList rows={snap.rows} kind={kind} winLabel="primary" />
          <div className="lp-chain">
            <span>Primary</span> <b>{chain[0]}</b>
            {chain.slice(1).map(n => <span key={n}><span aria-hidden="true">→</span> fallback <b>{n}</b></span>)}
          </div>
        </div>

        <div className="lp-pane lp-codepane">
          <div className="lp-tabs" role="tablist" aria-label="Code sample language">
            {([['py', 'Python'], ['ts', 'TypeScript'], ['sh', 'cURL']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" className="lp-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          {tab === 'py' && (
            <pre className="lp-code"><span className="k">from</span> openai <span className="k">import</span> OpenAI{'\n\n'}client = <span className="f">OpenAI</span>({'\n'}    base_url=<span className="s">&quot;https://aistupidlevel.info/v1&quot;</span>,{'\n'}    api_key=<span className="s">&quot;aism_…&quot;</span>,  <span className="c"># your ASL router key</span>{'\n'}){'\n\n'}reply = client.chat.completions.<span className="f">create</span>({'\n'}    model=<span className="s">{tok}</span>,{'\n'}    messages=[{'{'}<span className="s">&quot;role&quot;</span>: <span className="s">&quot;user&quot;</span>, <span className="s">&quot;content&quot;</span>: prompt{'}'}],{'\n'}    stream=<span className="n">True</span>,{'\n'})</pre>
          )}
          {tab === 'ts' && (
            <pre className="lp-code"><span className="k">import</span> OpenAI <span className="k">from</span> <span className="s">&quot;openai&quot;</span>;{'\n\n'}<span className="k">const</span> client = <span className="k">new</span> <span className="f">OpenAI</span>({'{'}{'\n'}  baseURL: <span className="s">&quot;https://aistupidlevel.info/v1&quot;</span>,{'\n'}  apiKey: process.env.ASL_ROUTER_KEY, <span className="c">{'// aism_…'}</span>{'\n'}{'}'});{'\n\n'}<span className="k">const</span> reply = <span className="k">await</span> client.chat.completions.<span className="f">create</span>({'{'}{'\n'}  model: <span className="s">{tok}</span>,{'\n'}  messages: [{'{'} role: <span className="s">&quot;user&quot;</span>, content: prompt {'}'}],{'\n'}{'}'});</pre>
          )}
          {tab === 'sh' && (
            <pre className="lp-code"><span className="f">curl</span> https://aistupidlevel.info/v1/chat/completions \{'\n'}  -H <span className="s">&quot;Authorization: Bearer $ASL_ROUTER_KEY&quot;</span> \{'\n'}  -H <span className="s">&quot;Content-Type: application/json&quot;</span> \{'\n'}  -d <span className="s">{"'{\"model\": "}</span><span className="s">{tok}</span><span className="s">{', "messages": [{"role": "user", "content": "…"}]}\''}</span></pre>
          )}
          <div className="lp-hdrs">
            <p>Response headers</p>
            <pre>HTTP/1.1 200 OK{'\n'}<b>X-AISM-Model:</b> {p.model}{'\n'}<b>X-AISM-Provider:</b> {p.provider}{p.latencyMs != null && <>{'\n'}<b>X-AISM-Latency:</b> {Math.round(p.latencyMs)}</>}{'\n'}<b>X-AISM-Reasoning:</b> {p.reasoning}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
