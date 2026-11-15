import { Fragment } from 'react';
import Pane from '@/components/studio/Pane';
import { Tag } from '@/components/studio/Bits';
import type { ModelSwitching, StrategyScope, TieBreak } from '@/lib/api-client';
import {
  MATCH, OWN_BENCHMARK, SAMPLE, SCOPE, SWITCHING, capLabel, capOptions, costExampleLine, switchingOptions, type AdaptiveFacts,
} from '@/lib/router-adaptive';

/**
 * Routing preferences' A2 settings (adaptive-routing plan §5.2; lib/router-adaptive holds the words): Match each
 * request, Apply this strategy to, the Model switching pane and the preview's sample request. Rendered by
 * app/router/preferences only when GET /router/preferences carries the settings, and never under Model source
 * "Only my endpoints" (Match and Model switching), so without them the page is as before.
 *
 * Each extends a control the page already has: the toggle is the page's st-toggle; Apply this strategy to is the
 * tie-break pane's segmented control with the chosen option described under it; Model switching is the Model source
 * pane's list of choices (sr-src-list, one row per choice); the cost limits are a segmented control again.
 */

/** Words with code between backticks, the code in the studio's inline-code style. */
export function Rich({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => <Fragment key={i}>{i % 2 ? <code className="st-ic">{part}</code> : part}</Fragment>)}</>;
}

/**
 * Match each request, under the Best overall and Best value cards. Always available while requests sent as `auto`
 * use the strategy (it also decides `auto-best`, `auto-value` and `auto-task`); with "Every routed request" it can
 * change nothing unless the strategy is Best overall or Best value, so it is disabled then.
 */
export function MatchBlock({ on, strategy, scope, tieBreak, onChange }: {
  on: boolean; strategy: string; scope: StrategyScope; tieBreak: TieBreak; onChange: (on: boolean) => void;
}) {
  const inert = scope === 'all' && strategy !== 'best_overall' && strategy !== 'best_value';
  return (
    <div className={`sr-match${inert ? ' is-inert' : ''}`}>
      <label className="st-toggle">
        <input type="checkbox" className="st-check" checked={on} disabled={inert} onChange={e => onChange(e.target.checked)} />
        <span>
          <b>{MATCH.label}</b>
          <span>{MATCH.sub}</span>
        </span>
      </label>
      <div className="sr-match-body">
        <p className="st-hint">{MATCH.body}</p>
        <p className="st-hint"><Rich text={MATCH.scope} /></p>
        {OWN_BENCHMARK.has(strategy) && <p className="sr-note-line">{MATCH.ownBenchmark}</p>}
        {tieBreak !== 'highest' && <p className="sr-note-line">{MATCH.tieHint}</p>}
      </div>
    </div>
  );
}

/** Apply this strategy to: requests sent as `auto`, or every routed request. */
export function ScopeControl({ value, note, onChange }: { value: StrategyScope; note: string | null; onChange: (v: StrategyScope) => void }) {
  const current = SCOPE.options.find(o => o.id === value) ?? SCOPE.options[0];
  return (
    <div className="sr-scope">
      <p className="st-label" id="sr-scope-l">{SCOPE.label}</p>
      <div className="st-seg is-scroll" role="group" aria-labelledby="sr-scope-l">
        {SCOPE.options.map(o => (
          <button type="button" key={o.id} aria-pressed={current.id === o.id} onClick={() => onChange(o.id)}>{o.name}</button>
        ))}
      </div>
      <p className="st-hint"><Rich text={current.desc} /></p>
      {note && <p className="sr-note-line"><Rich text={note} /></p>}
    </div>
  );
}

/** The Model switching pane, after Routing strategy. */
export function SwitchingPane({ value, cap, matching, facts, nameOf, onSwitching, onCap }: {
  value: ModelSwitching; cap: number | null; matching: boolean; facts: AdaptiveFacts; nameOf: (model: string) => string;
  onSwitching: (v: ModelSwitching) => void; onCap: (v: number | null) => void;
}) {
  const options = switchingOptions({ driftExit: facts.driftExit, matching });
  const personal = costExampleLine(facts.switchCostExample, nameOf);
  return (
    <Pane title={SWITCHING.title} sub={SWITCHING.sub}>
      <div className="sr-src sr-switch">
        <div className="sr-src-list" role="radiogroup" aria-label={SWITCHING.title}>
          {options.map(o => (
            <button type="button" role="radio" key={o.id} aria-checked={value === o.id} className="sr-src-opt" onClick={() => onSwitching(o.id)}>
              <span className="sr-src-tick" aria-hidden="true" />
              <span className="sr-src-txt">
                <b>{o.name}{o.tag && <> <Tag tone="solid">{o.tag}</Tag></>}</b>
                <span>{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {value !== 'conversation' && (
          <div className="sr-switch-cost">
            <p className="st-hint">{SWITCHING.costIntro}</p>
            <div className="sr-switch-cap">
              <span id="sr-cap-l">{SWITCHING.costBefore}</span>
              <div className="st-seg" role="group" aria-labelledby="sr-cap-l">
                {capOptions(cap).map(v => (
                  <button type="button" key={v === null ? 'none' : String(v)} aria-pressed={cap === v} onClick={() => onCap(v)}>{capLabel(v)}</button>
                ))}
              </div>
              <span>{SWITCHING.costAfter}</span>
            </div>
            {personal && <p className="st-hint">{personal}</p>}
          </div>
        )}
        <p className="sr-note-line">{SWITCHING.note}</p>
      </div>
    </Pane>
  );
}

export interface SampleState {
  hasTools: boolean;
  toolNames: string;
  conversationModel: string;
  turnKind: 'new_message' | 'tool_result';
}
export const SAMPLE_EMPTY: SampleState = { hasTools: false, toolNames: '', conversationModel: '', turnKind: 'new_message' };

/**
 * The preview's sample request beyond its prompt: whether it offers tools and their names (what Match each request
 * reads), and the conversation it continues with its last message (what Model switching re-checks).
 */
export function SampleInputs({ value, onChange, showMatch, showConversation, models, nameOf }: {
  value: SampleState; onChange: (v: SampleState) => void; showMatch: boolean; showConversation: boolean;
  models: string[]; nameOf: (model: string) => string;
}) {
  const set = (patch: Partial<SampleState>) => onChange({ ...value, ...patch });
  return (
    <div className="sr-sample-more">
      {showMatch && (
        <>
          <label className="st-toggle sr-sample-tools">
            <input type="checkbox" className="st-check" checked={value.hasTools} onChange={e => set({ hasTools: e.target.checked })} />
            <span><b>{SAMPLE.hasTools}</b></span>
          </label>
          {value.hasTools && (
            <div className="st-field">
              <label className="st-field-label" htmlFor="rp-tools">{SAMPLE.toolNames} <small>optional</small></label>
              <input id="rp-tools" className="st-input" maxLength={8000} placeholder={SAMPLE.toolNamesHint}
                value={value.toolNames} onChange={e => set({ toolNames: e.target.value })} />
            </div>
          )}
        </>
      )}
      {showConversation && (
        <div className="sr-sample-conv">
          <div className="st-field">
            <label className="st-field-label" htmlFor="rp-conv">{SAMPLE.conversation}</label>
            <select id="rp-conv" className="st-select" value={value.conversationModel} onChange={e => set({ conversationModel: e.target.value })}>
              <option value="">{SAMPLE.conversationNone}</option>
              {models.map(m => <option key={m} value={m}>{nameOf(m)}</option>)}
            </select>
          </div>
          {value.conversationModel && (
            <div className="st-field">
              <label className="st-field-label" htmlFor="rp-turn">{SAMPLE.turnKind}</label>
              <select id="rp-turn" className="st-select" value={value.turnKind} onChange={e => set({ turnKind: e.target.value === 'tool_result' ? 'tool_result' : 'new_message' })}>
                <option value="new_message">{SAMPLE.turnNew}</option>
                <option value="tool_result">{SAMPLE.turnTool}</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
