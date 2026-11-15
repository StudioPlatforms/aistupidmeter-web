'use client';

/**
 * The project's Smart Router: its keys, the rules every key in it follows, its own servers (R5),
 * and whose provider keys pay for each provider. Managers change the rules; everyone in the project
 * can read them, because they decide what happens to their requests.
 *
 * R5 (staff only): "Servers for this project" is the Providers page's endpoints pane in its project
 * scope, and Model source is one more control in these routing rules, not a second policy screen.
 * Without the API's capability (`policy.modelSource` in the project GET, D45) and a 200 from the
 * project's servers, this tab is exactly what it was.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Pane, Tag, Note, CodeBlock, ProviderMark } from '@/components/studio';
import type { EndpointScope } from '@/components/router/EndpointsPane';
import { isEndpointEntry, isModelSource, type ModelSource } from '@/lib/api-client';
import {
  wsApi, money, day, ago, STRATEGIES, strategyLabel, PROVIDERS, providerLabel, type ModelOption,
} from '../ws';
import { useTeamServers, useOwnEndpoints, readyServers, type ServersState } from '../servers';
import type { ProjectData, Policy } from './types';
import { MATCH, SWITCHING, capLabel, capOptions, hasAdaptive, switchingOptions } from '@/lib/router-adaptive';
import { Rich } from '@/components/router/AdaptiveSettings';

const API_BASE = 'https://aistupidlevel.info/v1';

/** The servers pane is loaded only once the project's servers answered (staff), so nobody else downloads it. */
const EndpointsPane = dynamic(() => import('@/components/router/EndpointsPane'), { ssr: false });

/** The project's saved Model source when the API has the setting (D45), else null: no select, no change. */
const savedSourceOf = (p: Policy): ModelSource | null => (isModelSource(p.modelSource) ? p.modelSource : null);

/** The rules without the source: the form edits these; the source is an edit of its own (`SourceEdit`). */
function withoutSource(p: Policy): Policy {
  const { modelSource: _source, ...rest } = p;
  return rest;
}

/** Whether two sets of rules (without the source) are the same, field by field, whatever order the API sends them in. */
function sameRules(a: Policy, b: Policy): boolean {
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(x), ...Object.keys(y)])).filter(k => k !== 'modelSource').sort();
  return keys.every(k => JSON.stringify(x[k]) === JSON.stringify(y[k]));
}

/**
 * The form after the stored rules changed under it (any reload: a save, a key, a provider key, a 409): the
 * settings this page changed since `oldBase` keep the page's value, every other one takes the stored value
 * (R4b's rule), so a reload never turns another person's change into this page's edit.
 */
function rebase(form: Policy, oldBase: Policy, stored: Policy): Policy {
  const out = { ...withoutSource(stored) } as unknown as Record<string, unknown>;
  const f = form as unknown as Record<string, unknown>;
  const o = oldBase as unknown as Record<string, unknown>;
  for (const k of Object.keys(f)) if (k !== 'modelSource' && JSON.stringify(f[k]) !== JSON.stringify(o[k])) out[k] = f[k];
  return out as unknown as Policy;
}

/**
 * A Model source the person picked in this form: `to`, and `from`, the saved source the form showed when
 * they picked it (never a value read later), which the PUT sends as modelSourceFrom (compare-and-set).
 */
interface SourceEdit { to: ModelSource; from: ModelSource }

export default function RouterTab({ d, catalog, reload, flash }: {
  d: ProjectData; catalog: ModelOption[]; reload: () => void; flash: (t: string, bad?: boolean) => void;
}) {
  const servers = useTeamServers(d.project.id);
  const source = savedSourceOf(d.policy);
  const list = servers.state.kind === 'ok' ? servers.state.list : null;
  // Who may change the project's servers: the API's word (R5 contract §3 `canManage`), else the page's.
  const canAdd = typeof list?.canManage === 'boolean' ? list.canManage : d.me.canManage && d.workspace.planActive;
  const own = useOwnEndpoints(canAdd && !!list);
  // Models the project's keys can be routed to now (contract §3/§4 `readyModels`); counted here from the
  // list when an answer lacks it; null while unknown.
  const readyCount = list
    ? (typeof list.readyModels === 'number' ? list.readyModels : (readyServers(servers.state) ?? []).reduce((n, e) => n + (e.enabledModelCount ?? 0), 0))
    : typeof d.readyModels === 'number' ? d.readyModels : null;
  const scope = useMemo<EndpointScope>(() => ({
    kind: 'project', projectId: d.project.id, canManage: canAdd, isOwner: d.me.isOwner, modelSource: source,
  }), [d.project.id, canAdd, d.me.isOwner, source]);
  // Whether anything about Model source may be shown (R5 review MUST-1). Every R5 project GET carries
  // policy.modelSource, also for workspaces endpoints are not on for, so the capability alone is not
  // enough: the project's servers must answer (the list is readable by everyone in the project), or the
  // saved source is not All (the way back is always shown).
  const sourceShown = !!source && (servers.state.kind === 'ok' || source !== 'all');

  return (
    <>
      <Keys d={d} reload={reload} flash={flash} source={source} readyCount={readyCount} />
      <PolicyEditor d={d} catalog={catalog} reload={reload} flash={flash} servers={servers.state} readyCount={readyCount} sourceShown={sourceShown} />
      {servers.state.kind === 'ok' && (
        <div id="project-servers">
          <EndpointsPane list={servers.state.list} reload={servers.reload} scope={scope} api={servers.api} importable={own} />
        </div>
      )}
      <ProviderKeys d={d} reload={reload} flash={flash} source={source} />
    </>
  );
}

// ── Keys ───────────────────────────────────────────────────────────────────

function Keys({ d, reload, flash, source, readyCount }: {
  d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void;
  /** The saved Model source (R5), null without the capability; readyCount: servers ready now, null when unknown. */
  source: ModelSource | null; readyCount: number | null;
}) {
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const live = d.keys.filter(k => !k.revoked && !k.expired);
  const old = d.keys.filter(k => k.revoked || k.expired);
  const only = source === 'only_endpoints';
  const noProviderKey = Object.keys(d.providerSources).length === 0;
  // A provider key matters unless the project uses only its servers, or prefers them and has one ready.
  const providerKeyNote = noProviderKey && !only && !(source === 'prefer_endpoints' && (readyCount ?? 0) > 0);

  return (
    <>
      {created && (
        <Pane tone="accent" title={`${created.name}: copy this key now — it is not shown again`}>
          <div className="sw-stack">
            <div className="st-secret">
              <code>{created.key}</code>
              <button type="button" className={`st-copy${copied ? ' is-done' : ''}`} onClick={async () => { try { await navigator.clipboard.writeText(created.key); setCopied(true); } catch { window.prompt('Copy the key:', created.key); } }}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="sw-quiet">Use it with base URL <code className="st-ic">{API_BASE}</code> and model <code className="st-ic">auto</code>:</p>
            <CodeBlock samples={[{ label: 'cURL', lang: 'bash', code: `curl ${API_BASE}/chat/completions \\\n  -H "Authorization: Bearer ${created.key.slice(0, 12)}…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'` }]} />
            <div className="st-actions"><button type="button" className="st-btn is-sm" onClick={() => { setCreated(null); setCopied(false); }}>Done</button></div>
          </div>
        </Pane>
      )}
      <Pane
        title="Keys"
        sub={<>
          A project key works like any Smart Router key (<code className="st-ic">aism_…</code>, in place of an OpenAI or Anthropic key) but routes by
          this project&rsquo;s rules below, {only
            ? <>only to its servers and the workspace&rsquo;s servers shared with it,</>
            : <>pays with the project&rsquo;s provider keys,</>} and counts against its budget and your cap
          in it. Each person makes their own key, so the report can say who spent what.
          {!d.me.canContribute && d.me.wsRole === 'viewer' && ' Viewers do not hold keys.'}
        </>}
        ruled
        flush
      >
        {providerKeyNote && (
          <div className="sw-pad">
            <Note tone="warn" title="This project has no provider key yet">
              Its router keys cannot answer until one is available: requests are refused with a message that says so.
              {d.me.canManage
                ? ' Add the project’s own key under “Who pays the providers” below'
                : ' Ask a project manager to add one'}
              {d.me.isOwner ? ', share one from the workspace page, or let members use their own keys in the rules below.' : '.'}
              {' '}Keys created now start working as soon as a provider key is added.
              {/* R5: a request that names one of the project's servers needs no provider key. */}
              {(readyCount ?? 0) > 0 && <> Requests that name one of this project&rsquo;s server models (<code className="st-ic">ep/team.…</code>) already work.</>}
            </Note>
          </div>
        )}
        {only && readyCount === 0 && (
          <div className="sw-pad">
            <Note tone="bad" title="No server is ready">
              This project uses only its own servers, and none of them is ready, so every request made with its keys fails
              with <code className="st-ic">no_endpoints</code> until one is. {d.me.canManage ? 'Add or test one under Servers for this project below.' : 'Ask a project manager to add or test one.'}
            </Note>
          </div>
        )}
        {live.length === 0 ? (
          <div className="sw-none">
            <span className="st-empty-mark" aria-hidden="true"><i /><i /><i /></span>
            <p>No active keys in this project yet.</p>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table is-stack">
              <thead><tr><th>Key</th><th>Holder</th><th className="sw-hide-sm">Created</th><th>Last used</th><th>Expires</th><th><span className="st-sr">Actions</span></th></tr></thead>
              <tbody>
                {live.map(k => (
                  <tr key={k.id}>
                    <td className="is-head"><div className="sw-t">{k.name}</div><div className="sw-s"><code className="st-ic">{k.prefix}…</code></div></td>
                    <td data-label="Holder">{k.mine ? 'You' : k.holder}</td>
                    <td className="sw-hide-sm is-dim">{day(k.createdAt)}</td>
                    <td className="is-dim" data-label="Last used">{k.lastUsedAt ? ago(k.lastUsedAt) : 'Never'}</td>
                    <td className="is-dim" data-label="Expires">{k.expiresAt ? day(k.expiresAt) : 'Never'}</td>
                    <td className="sw-acts-cell">
                      {(k.mine || d.me.canManage) && (
                        <div className="sw-acts">
                          <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => {
                            if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working immediately.`)) return;
                            const r = await wsApi(`/projects/${d.project.id}/keys/${k.id}`, { method: 'DELETE' });
                            flash(r.ok ? 'Key revoked.' : (r.error ?? 'Could not revoke'), !r.ok);
                            reload();
                          }}>Revoke</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {old.length > 0 && (
          <div className="sw-old">
            <details className="sw-details">
              <summary>{old.length} revoked or expired key{old.length === 1 ? '' : 's'}</summary>
              <div className="st-table-wrap">
                <table className="st-table"><tbody>
                  {old.map(k => <tr key={k.id}><td>{k.name} <span className="sw-dim">({k.mine ? 'you' : k.holder})</span></td><td className="is-dim">{k.revoked ? 'Revoked' : `Expired ${day(k.expiresAt)}`}</td></tr>)}
                </tbody></table>
              </div>
            </details>
          </div>
        )}
        {d.me.canContribute && (
          <form className="sw-addbar" onSubmit={async e => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const days = String(f.get('expires') || '');
            const r = await wsApi<any>(`/projects/${d.project.id}/keys`, { method: 'POST', body: { name: f.get('name'), expiresInDays: days ? Number(days) : null } });
            if (r.ok) { setCreated({ key: r.data.key, name: r.data.name }); form.reset(); reload(); }
            else flash(r.error ?? 'Could not create the key', true);
          }}>
            <p className="st-label">New key</p>
            <div className="sw-form-row">
              <label className="st-field is-wide">
                <span className="st-field-label">Name</span>
                <input name="name" required maxLength={60} className="st-input" placeholder="e.g. My laptop, CI pipeline" />
              </label>
              <label className="st-field is-narrow">
                <span className="st-field-label">Expires</span>
                <select name="expires" className="st-select" defaultValue="">
                  <option value="">Never</option><option value="7">In 7 days</option><option value="30">In 30 days</option>
                  <option value="90">In 90 days</option><option value="180">In 6 months</option><option value="365">In a year</option>
                </select>
              </label>
              <button type="submit" className="st-btn is-primary">Create key</button>
            </div>
          </form>
        )}
      </Pane>
    </>
  );
}

// ── Routing policy ─────────────────────────────────────────────────────────

/** Model source for a project (plan §6.4): the select's choices, each with its one-line summary. */
const SOURCE_NAME: Record<ModelSource, string> = {
  all: 'All connected',
  prefer_endpoints: 'Prefer our servers',
  only_endpoints: 'Only our own servers',
};
const SOURCE_SUMMARY: Record<ModelSource, string> = {
  all: 'Benchmarked cloud models; this project’s servers when a request names them',
  prefer_endpoints: 'This project’s servers first, then benchmarked cloud models',
  only_endpoints: 'This project’s servers and nothing else: no built-in provider is ever called',
};

/** The chosen source in full (§6.4, and the personal Model source pane's wording, said of this project's keys). */
function SourceExplanation({ id }: { id: ModelSource }) {
  if (id === 'all') {
    return (
      <p>
        This project&rsquo;s keys use benchmarked cloud models. Its servers answer only when a request names them
        (<code className="st-ic">ep/team.&lt;prefix&gt;/&lt;model&gt;</code>).
      </p>
    );
  }
  if (id === 'prefer_endpoints') {
    return (
      <p>
        This project&rsquo;s servers first: its own and the workspace&rsquo;s servers shared with it. If none of them can take a request,
        it goes to the best-ranked cloud model. If one fails, the next server and then the cloud models are tried when fallback is
        on. The <code className="st-ic">X-AISM-Provider</code> header says whether a server or a cloud provider answered, and{' '}
        <code className="st-ic">X-AISM-Endpoint</code> names the server.
      </p>
    );
  }
  return (
    <p>
      This project&rsquo;s keys never use a built-in provider (OpenAI, Anthropic, Google, DeepSeek, Kimi, GLM or xAI), including{' '}
      <code className="st-ic">/v1/messages</code> and <code className="st-ic">/v1/embeddings</code>, which stop working for them. Requests go
      only to its servers and the workspace&rsquo;s servers shared with it; if one of them is itself a gateway, such as OpenRouter or Azure,
      that service decides where the request goes next. When every server is down, requests fail with an error naming each one.
    </p>
  );
}

function summary(p: Policy, sourceShown: boolean): Array<[string, string]> {
  const src = sourceShown ? savedSourceOf(p) : null;
  const only = src === 'only_endpoints';
  const rows: Array<[string, string]> = [];
  if (src) rows.push(['Model source', `${SOURCE_NAME[src]} — ${SOURCE_SUMMARY[src]}`]);
  rows.push(
    ['Strategy for “auto”', `${strategyLabel(p.strategy)}${p.lockStrategy ? ' — used for every routed request' : ''}`],
    ['Naming a model', p.allowPinning ? 'Allowed' : 'Not allowed: every request is routed'],
  );
  // A2 (plan §5.2): the project's Match each request and Model switching, when the API sends them; they choose among
  // benchmarked models, so not under Only our own servers.
  if (!only && hasAdaptive(p)) {
    rows.push(['Match each request', p.requestMatching ? 'On' : 'Off']);
    rows.push(['Model switching', switchingSummary(p)]);
  }
  // Under Only, the cloud-only rules are kept for later but do nothing (R5, as on the Preferences page under Only).
  if (!only) rows.push(['Models', p.allowedModels.length ? `Only ${p.allowedModels.join(', ')}` : 'Any model we measure']);
  if (!only && p.excludedProviders.length) rows.push(['Providers not used', p.excludedProviders.map(providerLabel).join(', ')]);
  if (p.maxCostPer1k) rows.push(['Price limit', `Models up to ${money(p.maxCostPer1k)} per 1,000 tokens`]);
  if (p.maxLatencyMs) rows.push(['Speed limit', `Models answering within ${p.maxLatencyMs.toLocaleString()} ms`]);
  if (p.requireToolCalling) rows.push(['Tool calling', 'Only models that support it']);
  rows.push(['Fallback', only
    ? (p.fallbackEnabled ? 'On: the next server is tried when one fails' : 'Off')
    : p.fallbackEnabled ? (p.fallbackOrder.length ? `On, trying ${p.fallbackOrder.join(', ')} first` : 'On') : 'Off']);
  if (!only) {
    rows.push(['Drifting models', p.avoidDrifting ? 'Passed over while a drift alert is open' : 'Treated like any other']);
    // The tie-break by its name, as the Preferences page labels it: which tied models it chooses among depends on the
    // router's tie band (all of them, or those within one standard error of the leader), so "the cheaper one" is not said.
    rows.push(['When models are tied', p.tieBreak === 'faster' ? 'Faster' : p.tieBreak === 'highest' ? 'Highest score' : 'Cheaper']);
    if (p.strategy === 'custom_split') rows.push(['Traffic split', p.trafficSplit.map(x => `${x.model} ${x.weight}`).join(', ') || '—']);
  }
  rows.push(['Output per request', p.maxOutputTokens ? `At most ${p.maxOutputTokens.toLocaleString()} tokens` : 'No project limit']);
  rows.push(['Rate limit', p.rpmLimit ? `${p.rpmLimit} requests per minute per key` : 'None']);
  rows.push(['Prompt logging', p.promptLogging === 'on' ? 'On for every key (encrypted)' : p.promptLogging === 'off' ? 'Off for every key' : 'Each key’s own setting']);
  // R4 routing review S1: a person's own Model source covers their personal keys, not a project's.
  if (!only) rows.push(['People’s own provider keys', p.allowPersonalProviderKeys
    ? `Used when the project and workspace have none${src ? ', also for people whose own Model source is Only my endpoints' : ''}`
    : 'Never used']);
  return rows;
}

/** "At each new message — skips a move that would cost more than $0.50 to re-send" (A2). */
function switchingSummary(p: Policy): string {
  const sw = p.modelSwitching ?? 'conversation';
  const name = switchingOptions({ driftExit: false, matching: false }).find(o => o.id === sw)?.name ?? sw;
  if (sw === 'conversation') return name;
  const cap = p.switchCostCapUsd === undefined ? 0.5 : p.switchCostCapUsd;
  return cap === null ? `${name} — no limit on what a move may cost to re-send` : `${name} — skips a move that would cost more than ${capLabel(cap)} to re-send`;
}

/** A cost limit as a select value: the number, or "none" for no limit. */
const capKey = (v: number | null): string => (v === null ? 'none' : String(v));

/** What a save of the source came back as, when it did not take (D45; the Preferences page's wording). */
type SourceNotice = { otherSaved: boolean; kept: ModelSource | null };

function sourceNoticeText(n: SourceNotice): string {
  if (n.kept) return `Model source was not changed: the server kept ${SOURCE_NAME[n.kept]}.`;
  return n.otherSaved
    ? 'Model source is not available on this server yet, so it was not changed. Your other changes were saved.'
    : 'Model source is not available on this server yet. Nothing was changed.';
}

/** The saved source is not All, and only All can be chosen now (§6.2's banners, said of this project). */
function sourceBanner(saved: ModelSource): ReactNode {
  return saved === 'only_endpoints'
    ? <>Private endpoints are paused on AI Stupid Level. This project&rsquo;s Model source is still Only our own servers, so its requests fail with <code className="st-ic">endpoints_disabled</code> until servers are back or you switch to All connected.</>
    : 'Private endpoints are paused on AI Stupid Level. This project’s Model source is still Prefer our servers, so its requests go to benchmarked cloud models, as under All connected, until servers are back.';
}

function PolicyEditor({ d, catalog, reload, flash, servers, readyCount, sourceShown }: {
  d: ProjectData; catalog: ModelOption[]; reload: () => void; flash: (t: string, bad?: boolean) => void; servers: ServersState;
  /** Models the project's keys can be routed to now (R5), null while unknown. */
  readyCount: number | null;
  /** Whether Model source may be shown at all (RouterTab's one predicate, review MUST-1). */
  sourceShown: boolean;
}) {
  // The form holds the rules without the source; the source is the person's own edit, or the saved one.
  const [p, setP] = useState<Policy>(() => withoutSource(d.policy));
  const [srcEdit, setSrcEdit] = useState<SourceEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [notice, setNotice] = useState<SourceNotice | null>(null);
  // The rules the form's edits are measured against: the last stored rules read, or the rules a save sent.
  const base = useRef<Policy>(withoutSource(d.policy));
  // Every reload (a save, a key, a provider key, a 409) brings the stored rules: keep only this page's own
  // edits on top of them, and drop a source edit the stored source now equals (review MUST-2, SHOULD-1).
  useEffect(() => {
    const stored = withoutSource(d.policy);
    const oldBase = base.current; // read now: the updater may run after the next line
    setP(prev => rebase(prev, oldBase, stored));
    base.current = stored;
    setSrcEdit(e => (e && e.to === d.policy.modelSource ? null : e));
  }, [d.policy]);
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => { setP(prev => ({ ...prev, [k]: v })); setPreview(null); };
  const byVendor = useMemo(() => {
    const g = new Map<string, ModelOption[]>();
    for (const m of catalog) (g.get(m.vendor) ?? g.set(m.vendor, []).get(m.vendor)!).push(m);
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);
  const pool = p.allowedModels.length ? catalog.filter(m => p.allowedModels.includes(m.name)) : catalog;
  // A2: the API sent the project's Match each request and Model switching (the features apply to this workspace).
  const a2 = hasAdaptive(d.policy);
  const switchOptions = switchingOptions({ driftExit: false, matching: p.requestMatching === true });
  const cap = p.switchCostCapUsd === undefined ? 0.5 : p.switchCostCapUsd;

  // ── Model source (R5) ──
  // The saved value is the API's capability (D45). What the form shows is the person's own pick, else the
  // saved source as the latest load read it: a reload never turns an old value into an edit (MUST-2).
  const savedSource = savedSourceOf(d.policy);
  const source: ModelSource | null = savedSource ? (srcEdit ? srcEdit.to : savedSource) : null;
  const sourceChanged = !!srcEdit && !!savedSource && srcEdit.to !== savedSource;
  const dirty = !sameRules(p, withoutSource(d.policy)) || sourceChanged;
  const pickSource = (to: ModelSource) => {
    if (!savedSource) return;
    // `from`: the saved source shown when the person first picked, kept across further picks.
    setSrcEdit(prev => (to === savedSource && !prev ? null : { to, from: prev ? prev.from : savedSource }));
    setPreview(null);
  };
  const only = source === 'only_endpoints';
  // Servers switched off for this workspace (404) or unavailable (503): only All can be chosen, and a
  // saved Prefer or Only shows why. Shown at all once the servers answered, or whenever the saved
  // source is not All, so it can always be switched back.
  const paused = servers.kind === 'off' || servers.kind === 'unavailable' || preview?.endpointsPaused === true;
  const noneReady = servers.kind === 'ok' && (readyCount ?? 0) === 0;
  const showSource = !!savedSource && sourceShown;
  const sourceLocked = (id: ModelSource) => id !== 'all' && (servers.kind !== 'ok' || noneReady);
  const sourceHint: ReactNode = !savedSource || !showSource ? null
    : servers.kind === 'loading' ? 'Checking this project’s servers…'
    : servers.kind === 'error' ? 'This project’s servers could not be read, so only All connected can be chosen right now.'
    : noneReady
      ? <>Add and test a server for this project or the workspace before choosing Prefer our servers or Only our own servers (<a href="#project-servers" className="st-link-inline">Servers for this project</a>).</>
      : null;

  if (!d.me.canManage) {
    return (
      <Pane title="Routing rules" sub="Every key in this project follows these rules. A manager can change them." delay={0.06}>
        <dl className="st-kv sw-kv sw-rules">{summary(d.policy, sourceShown).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </Pane>
    );
  }

  /**
   * The body of a save or a preview: the rules as before. Model source (R5) goes only when the person picked
   * one in this form, with the source the form showed when they picked it (compare-and-set): a tab opened
   * earlier can never switch it back by saving something else, and a stale pick gets the API's 409.
   */
  const bodyOf = (forPreview: boolean): Record<string, unknown> => {
    const rest = withoutSource(p) as unknown as Record<string, unknown>;
    if (!savedSource || !source || !showSource) return rest; // no source shown: the body (and the answer) as before R5
    if (forPreview) return { ...rest, modelSource: source };
    return srcEdit && sourceChanged ? { ...rest, modelSource: srcEdit.to, modelSourceFrom: srcEdit.from } : rest;
  };

  const runPreview = async () => {
    const r = await wsApi<any>(`/projects/${d.project.id}/routing/preview`, { method: 'POST', body: bodyOf(true) });
    setPreview(r.ok ? r.data : { ok: false, message: r.error });
  };

  return (
    <Pane title="Routing rules" sub="Every key in this project follows these rules, whoever holds it and whatever tool it is used in." ruled delay={0.06}>
      <form className="sw-stack" onSubmit={async e => {
        e.preventDefault();
        setSaving(true);
        setNotice(null);
        const body = bodyOf(false);
        const sentRules = withoutSource(p);
        const sentSource = typeof body.modelSource === 'string' ? body.modelSource as ModelSource : null;
        const r = await wsApi<any>(`/projects/${d.project.id}/routing`, { method: 'PUT', body });
        setSaving(false);
        if (!r.ok) {
          flash(r.error ?? 'Could not save', true);
          // 409: the source changed elsewhere since the person picked theirs. The page shows what is stored
          // now and drops the pick (they choose again, from the current one); their other edits stay on top
          // of the stored rules (the reload's rebase).
          if (r.status === 409) { setSrcEdit(null); reload(); }
          return;
        }
        // The rules sent are stored now: the reload keeps only edits made since this save (none, usually).
        base.current = sentRules;
        setSrcEdit(null);
        // D45: a changed source counts as saved only when the answer's policy echoes it.
        const echoed = r.data?.policy?.modelSource;
        if (sentSource && echoed !== sentSource) {
          const others = (r.data?.changed ?? []).filter((k: string) => k !== 'modelSource');
          setNotice({ otherSaved: others.length > 0, kept: isModelSource(echoed) ? echoed : null });
          flash(isModelSource(echoed) ? `Model source was not changed: the server kept ${SOURCE_NAME[echoed]}.` : 'Model source is not available on this server yet.', true);
          reload();
          return;
        }
        flash(r.data?.changed?.length ? 'Routing rules saved. They apply to the next request.' : 'Nothing changed.');
        reload();
      }}>
        {/* D45: shown even when a re-read finds no capability (the API was rolled back under the page). */}
        {notice && !(showSource && source && savedSource) && <Note tone="warn">{sourceNoticeText(notice)}</Note>}
        {showSource && source && savedSource && (
          <div className="sw-source">
            {notice && <Note tone="warn">{sourceNoticeText(notice)}</Note>}
            {paused && savedSource !== 'all' && <Note tone={savedSource === 'only_endpoints' ? 'bad' : 'warn'}>{sourceBanner(savedSource)}</Note>}
            <label className="st-field">
              <span className="st-field-label">Model source</span>
              <select className="st-select" value={source} onChange={e => pickSource(e.target.value as ModelSource)}>
                {(Object.keys(SOURCE_NAME) as ModelSource[]).map(id => (
                  <option key={id} value={id} disabled={sourceLocked(id) && id !== savedSource}>{SOURCE_NAME[id]}</option>
                ))}
              </select>
            </label>
            {sourceHint && <p className="st-hint">{sourceHint}</p>}
            {only && !paused && noneReady && (
              <Note tone="bad">None of this project&rsquo;s servers is ready, so every request made with its keys would fail.</Note>
            )}
            <div className="sw-source-desc"><SourceExplanation id={source} /></div>
            <p className="sw-source-scope">
              Applies to this project&rsquo;s keys. People&rsquo;s personal keys follow their own Model source in Routing preferences.
            </p>
          </div>
        )}

        <div className="sw-grid2">
          <label className="st-field">
            <span className="st-field-label">Strategy for requests that say &ldquo;auto&rdquo;</span>
            <select className="st-select" value={p.strategy} onChange={e => set('strategy', e.target.value)}>
              {/* A2: Match each request is the toggle below, so it is not also offered as a strategy (unless stored as one). */}
              {STRATEGIES.filter(s => !(a2 && s.id === 'match_task' && p.strategy !== 'match_task')).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <small className="st-hint">
              {STRATEGIES.find(s => s.id === p.strategy)?.help}
              {/* R5: servers have no scores, so a strategy orders them by other means (plan §5.2). */}
              {only && <> This project&rsquo;s servers are not benchmarked: quality and value strategies keep their order and what you tagged each model for (Use for); Cheapest uses their declared prices; Fastest uses the latency measured on recent requests to them.</>}
              {source === 'prefer_endpoints' && <> This project&rsquo;s servers come first and are not benchmarked: quality and value strategies keep their order and what you tagged each model for (Use for); Cheapest uses their declared prices; Fastest uses the latency measured on recent requests to them. The cloud models after them are ranked as this strategy describes.</>}
            </small>
          </label>
          <div className="sw-toggles sw-toggles-top">
            {/* A2 (plan §5.2): the lock also holds this project's Match each request and Model switching. */}
            <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.lockStrategy} onChange={e => set('lockStrategy', e.target.checked)} />
              <span className="sw-toggle-text"><b>{a2 ? 'Use this strategy for every routed request' : 'Use it for every routed request'}</b><span>Requests asking for auto-coding, auto-cheapest and so on get this strategy too.{a2 ? ' It also locks Match each request and Model switching to this project’s settings.' : ''}</span></span></label>
            <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.allowPinning} onChange={e => set('allowPinning', e.target.checked)} />
              <span className="sw-toggle-text"><b>Allow naming a model</b><span>Off: requests for a specific model (and /v1/messages) are refused; everything is routed.</span></span></label>
          </div>
        </div>

        {/* A2 (plan §5.2): Match each request and Model switching for this project's keys, when the API sends them. */}
        {a2 && (only ? (
          <p className="st-hint">Match each request and Model switching choose among the models we benchmark, so they are off while this project uses only its own servers.</p>
        ) : (
          <div className="sw-grid2 sw-adaptive">
            <div className="sw-toggles">
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.requestMatching === true} onChange={e => set('requestMatching', e.target.checked)} />
                <span className="sw-toggle-text"><b>{MATCH.label}</b><span>{MATCH.sub} <Rich text={MATCH.scope} /></span></span></label>
            </div>
            <div className="sw-switch">
              <label className="st-field"><span className="st-field-label">{SWITCHING.title}</span>
                <select className="st-select" value={p.modelSwitching ?? 'conversation'}
                  onChange={e => set('modelSwitching', e.target.value === 'message' || e.target.value === 'request' ? e.target.value : 'conversation')}>
                  {switchOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <small className="st-hint">{switchOptions.find(o => o.id === (p.modelSwitching ?? 'conversation'))?.desc}</small>
              </label>
              {(p.modelSwitching === 'message' || p.modelSwitching === 'request') && (
                <label className="st-field"><span className="st-field-label">{SWITCHING.costBefore}</span>
                  <select className="st-select" value={capKey(cap)} onChange={e => set('switchCostCapUsd', e.target.value === 'none' ? null : Number(e.target.value))}>
                    {capOptions(cap).map(v => <option key={capKey(v)} value={capKey(v)}>{capLabel(v)}</option>)}
                  </select>
                  <small className="st-hint">{SWITCHING.costIntro}</small>
                </label>
              )}
            </div>
          </div>
        ))}

        {p.strategy === 'custom_split' && (only ? (
          <p className="st-hint">The traffic split chooses among cloud models, so it is not used while this project uses only its own servers: they are tried in their order. The split is kept.</p>
        ) : (
          <fieldset className="sw-fieldset sw-split">
            <legend>Traffic split <small>weights 1–100</small></legend>
            <div className="sw-split-rows">
              {p.trafficSplit.map((x, i) => (
                <div key={i} className="sw-split-row">
                  <select className="st-select" aria-label={`Model ${i + 1}`} value={x.model} onChange={e => set('trafficSplit', p.trafficSplit.map((y, j) => j === i ? { ...y, model: e.target.value } : y))}>
                    {pool.map(m => <option key={m.id} value={m.name}>{m.label}</option>)}
                  </select>
                  <input type="number" min={1} max={100} className="st-input" aria-label={`Weight of model ${i + 1}`} value={x.weight} onChange={e => set('trafficSplit', p.trafficSplit.map((y, j) => j === i ? { ...y, weight: Number(e.target.value) } : y))} />
                  <button type="button" className="st-btn is-sm is-quiet" onClick={() => set('trafficSplit', p.trafficSplit.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
            {p.trafficSplit.length < 10 && pool[0] && (
              <div className="st-actions sw-gap-top"><button type="button" className="st-btn is-sm" onClick={() => set('trafficSplit', [...p.trafficSplit, { model: pool[0].name, weight: 50 }])}>Add a model</button></div>
            )}
          </fieldset>
        ))}

        {/* Under Only our own servers the cloud lists are kept, unchanged, and hidden (plan §6.4). */}
        {!only && (
          <details className="sw-details sw-section" open={p.allowedModels.length > 0}>
            <summary>
              <span>Models this project may use: <strong>{p.allowedModels.length ? `${p.allowedModels.length} chosen` : 'any model we measure'}</strong></span>
            </summary>
            <div className="sw-section-body">
              <p className="st-hint">Tick models to allow only those, routed or named. None ticked means any model we benchmark.</p>
              <div className="sw-vendors">
                {byVendor.map(([vendor, list]) => (
                  <div key={vendor} className="sw-vendor">
                    <div className="sw-vendor-h"><ProviderMark provider={vendor} size="sm" /><span>{providerLabel(vendor)}</span></div>
                    {list.map(m => (
                      <label key={m.id} className="st-toggle sw-pick">
                        <input type="checkbox" className="st-check" checked={p.allowedModels.includes(m.name)} onChange={e => set('allowedModels', e.target.checked ? [...p.allowedModels, m.name] : p.allowedModels.filter(x => x !== m.name))} />
                        <b>{m.label}</b>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        <details className="sw-details sw-section">
          <summary><span>Limits, fallback and logging</span></summary>
          <div className="sw-section-body sw-policy">
            {!only && (
              <fieldset className="sw-fieldset">
                <legend>Providers this project does not use</legend>
                <div className="sw-toggles">
                  {PROVIDERS.map(pr => (
                    <label key={pr.id} className="st-toggle sw-pick">
                      <input type="checkbox" className="st-check" checked={p.excludedProviders.includes(pr.id)} onChange={e => set('excludedProviders', e.target.checked ? [...p.excludedProviders, pr.id] : p.excludedProviders.filter(x => x !== pr.id))} />
                      <b>{pr.label}</b>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="sw-stack">
              <label className="st-field"><span className="st-field-label">Most a model may cost, per 1,000 tokens <small>$</small></span>
                <input type="number" min={0} step="0.0001" className="st-input" value={p.maxCostPer1k ?? ''} placeholder="No limit" onChange={e => set('maxCostPer1k', e.target.value === '' ? null : Number(e.target.value))} />
                {source && source !== 'all' && <small className="st-hint">For a server, its declared price counts; one without a declared price is never left out.</small>}</label>
              <label className="st-field"><span className="st-field-label">Slowest a model may be <small>ms</small></span>
                <input type="number" min={100} step={100} className="st-input" value={p.maxLatencyMs ?? ''} placeholder="No limit" onChange={e => set('maxLatencyMs', e.target.value === '' ? null : Number(e.target.value))} />
                {source && source !== 'all' && <small className="st-hint">For a server, the latency measured on recent requests to it counts, once there are at least five.</small>}</label>
              <label className="st-field"><span className="st-field-label">Most output tokens per request</span>
                <input type="number" min={16} step={1} className="st-input" value={p.maxOutputTokens ?? ''} placeholder="No limit" onChange={e => set('maxOutputTokens', e.target.value === '' ? null : Number(e.target.value))} />
                <small className="st-hint">Reasoning models count their thinking in this, so a low cap can leave them no room to answer.</small></label>
              <label className="st-field"><span className="st-field-label">Requests per minute, per key</span>
                <input type="number" min={1} step={1} className="st-input" value={p.rpmLimit ?? ''} placeholder="No limit" onChange={e => set('rpmLimit', e.target.value === '' ? null : Number(e.target.value))} /></label>
            </div>
            <div className="sw-stack">
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.fallbackEnabled} onChange={e => set('fallbackEnabled', e.target.checked)} />
                {only
                  ? <span className="sw-toggle-text"><b>Try another server when one fails</b><span>The next one in the order, up to six attempts in all and three per server. Off: the request fails with that server&rsquo;s error.</span></span>
                  : <span className="sw-toggle-text"><b>Fall back to another model when one fails</b><span>Up to five more, other providers first.</span></span>}</label>
              {/* The fallback order names cloud models: hidden, and kept, under Only. */}
              {p.fallbackEnabled && !only && [0, 1, 2].map(i => (
                <label key={i} className="st-field"><span className="st-field-label">{['First', 'Second', 'Third'][i]} fallback <small>optional</small></span>
                  <select className="st-select" value={p.fallbackOrder[i] ?? ''} onChange={e => {
                    const next = [...p.fallbackOrder]; next[i] = e.target.value;
                    set('fallbackOrder', next.filter((x, j) => x && next.indexOf(x) === j).slice(0, 3));
                  }}>
                    <option value="">Automatic</option>
                    {pool.map(m => <option key={m.id} value={m.name}>{m.label}</option>)}
                  </select></label>
              ))}
            </div>
            <div className="sw-stack">
              {!only && (
                <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.avoidDrifting} onChange={e => set('avoidDrifting', e.target.checked)} />
                  <span className="sw-toggle-text"><b>Pass over models with an open drift alert</b><span>They are tried after the others, never removed.</span></span></label>
              )}
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.requireToolCalling} onChange={e => set('requireToolCalling', e.target.checked)} />
                <span className="sw-toggle-text"><b>Only models that call tools</b><span>For agents.</span></span></label>
              <label className="st-toggle"><input type="checkbox" className="st-check" checked={p.allowPersonalProviderKeys} onChange={e => set('allowPersonalProviderKeys', e.target.checked)} />
                <span className="sw-toggle-text"><b>Use people&rsquo;s own provider keys as a last resort</b><span>
                  {only
                    ? 'Not used while this project uses only its own servers. The choice is kept for All connected and Prefer our servers.'
                    : <>When neither the project nor the workspace has a key for a provider.{showSource ? ' This includes people whose own Model source is Only my endpoints: that setting covers their personal keys, not this project’s.' : ''}</>}
                </span></span></label>
              {!only && (
                // The Preferences page's own title and labels ("When models are tied": Cheaper, Faster, Highest score), each
                // with what it compares. They name the tie-break, true whichever tied models the router's band lets it
                // choose among, where "the cheaper one" of the tied models would not be.
                <label className="st-field"><span className="st-field-label">When models are tied</span>
                  <select className="st-select" value={p.tieBreak ?? 'cheaper'} onChange={e => set('tieBreak', e.target.value as NonNullable<Policy['tieBreak']>)}>
                    <option value="cheaper">Cheaper (measured cost per task)</option>
                    <option value="faster">Faster (measured latency)</option>
                    <option value="highest">Highest score, even within the noise</option>
                  </select></label>
              )}
              <label className="st-field"><span className="st-field-label">Prompt logging</span>
                <select className="st-select" value={p.promptLogging} onChange={e => set('promptLogging', e.target.value as Policy['promptLogging'])}>
                  <option value="key">Each key&rsquo;s own setting</option>
                  <option value="off">Off for every key</option>
                  <option value="on">On for every key (encrypted, secrets scrubbed)</option>
                </select></label>
            </div>
          </div>
        </details>

        <div className="st-actions sw-policy-acts">
          <button type="submit" className="st-btn is-primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save rules'}</button>
          <button type="button" className="st-btn" onClick={runPreview}>Preview what &ldquo;auto&rdquo; picks</button>
          {dirty && <button type="button" className="st-btn is-quiet" onClick={() => { setP(withoutSource(d.policy)); setSrcEdit(null); setPreview(null); setNotice(null); }}>Discard changes</button>}
        </div>
      </form>
      {preview && (
        <div className="sw-gap-top" role="status">
          {preview.ok ? (
            <Note tone="good">
              Right now <strong>auto</strong> would go to <strong>{preview.primary.model}</strong> ({chainLabel(preview.primary)})
              {preview.fallbacks?.length ? <>, then {preview.fallbacks.map((f: any) => f.model).join(', ')}</> : ''}.
              <span className="sw-note-sub">{preview.primary.reasoning}</span>
            </Note>
          ) : <Note tone="bad">Nothing could be routed with these rules: {preview.message}</Note>}
        </div>
      )}
    </Pane>
  );
}

/**
 * Who answers a step of the preview: a cloud provider by name, or one of this project's servers as
 * "GPU box A, your server · not benchmarked" (plan §6.4 preview note).
 */
function chainLabel(e: { model: string; provider: string; source?: string; endpointName?: string | null }): string {
  if (isEndpointEntry(e)) return `${e.endpointName ? `${e.endpointName}, ` : ''}your server · not benchmarked`;
  return providerLabel(e.provider);
}

// ── Provider keys ──────────────────────────────────────────────────────────

function ProviderKeys({ d, reload, flash, source }: {
  d: ProjectData; reload: () => void; flash: (t: string, bad?: boolean) => void; source: ModelSource | null;
}) {
  const own = d.providerKeys.filter(k => k.scope === 'project');
  // Under Only our own servers no provider key pays for anything (plan §6.4): the pane says so, and
  // the keys stored for the project stay one click away, kept for All connected and Prefer.
  const only = source === 'only_endpoints';
  const table = (
    <div className="st-table-wrap">
      <table className="st-table is-stack">
        <thead><tr><th>Provider</th><th>Paid by</th><th className="sw-hide-sm">Key</th>{d.me.canManage && <th><span className="st-sr">Actions</span></th>}</tr></thead>
        <tbody>
          {PROVIDERS.map(pr => {
            const src = d.providerSources[pr.id];
            const mine = own.find(x => x.provider === pr.id);
            const k = mine ?? d.providerKeys.find(x => x.provider === pr.id && x.scope === 'workspace');
            return (
              <tr key={pr.id}>
                <td className="is-head">
                  <div className="sw-prov"><ProviderMark provider={pr.id} size="sm" /><div className="sw-t">{pr.label}</div></div>
                </td>
                <td data-label="Paid by">
                  <div className="sw-cellbox sw-paid">
                    {src === 'project' ? <span>This project&rsquo;s key</span> : src === 'workspace' ? <span>The workspace&rsquo;s key</span> : src === 'members' ? <span className="sw-dim">Each person&rsquo;s own key, if they have one</span> : <span className="sw-dim">No key: requests to {pr.label} fail</span>}
                    {k?.validationError && (k.validationError.startsWith('[no_credit]')
                      ? <Tag tone="warn" title={k.validationError.replace('[no_credit] ', '')}>No credit at last check</Tag>
                      : <Tag tone="bad" title={k.validationError}>Refused at last check</Tag>)}
                  </div>
                </td>
                <td className="sw-hide-sm is-dim">{k ? <><code className="st-ic">…{k.hint}</code>{k.alias ? ` · ${k.alias}` : ''}</> : '—'}</td>
                {d.me.canManage && (
                  <td className="sw-acts-cell">
                    {mine && (
                      <div className="sw-acts">
                        <button type="button" className="st-btn is-sm" onClick={async () => {
                          const r = await wsApi<any>(`/projects/${d.project.id}/provider-keys/${own.find(x => x.provider === pr.id)!.id}/test`, { method: 'POST' });
                          flash(r.data?.message ?? (r.data?.valid ? `${pr.label} accepted the key.` : `${pr.label} refused the key: ${r.data?.error ?? r.error}`), !r.data?.valid);
                          reload();
                        }}>Check</button>
                        <button type="button" className="st-btn is-sm is-quiet sw-bad-text" onClick={async () => {
                          if (!window.confirm(`Remove this project's ${pr.label} key?`)) return;
                          await wsApi(`/projects/${d.project.id}/provider-keys/${own.find(x => x.provider === pr.id)!.id}`, { method: 'DELETE' });
                          reload();
                        }}>Remove</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  const addForm = d.me.canManage && (
    <form className="sw-addbar" autoComplete="off" onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      const r = await wsApi<any>(`/projects/${d.project.id}/provider-keys`, { method: 'POST', body: { provider: f.get('provider'), apiKey: f.get('apiKey'), alias: f.get('alias') } });
      flash(r.ok ? (r.message ?? 'Key added') : (r.error ?? 'Could not add the key'), !r.ok);
      if (r.ok) { form.reset(); reload(); }
    }}>
      <p className="st-label">Add a key</p>
      <div className="sw-form-row">
        <label className="st-field is-narrow">
          <span className="st-field-label">Provider</span>
          <select name="provider" className="st-select" defaultValue="openai">{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        <label className="st-field is-wide">
          <span className="st-field-label">This project&rsquo;s own API key</span>
          <input name="apiKey" type="password" required className="st-input is-code" placeholder="Paste the key" autoComplete="new-password" />
        </label>
        <label className="st-field">
          <span className="st-field-label">Label <small>optional</small></span>
          <input name="alias" maxLength={60} className="st-input" placeholder="Client's account" />
        </label>
        <button type="submit" className="st-btn is-primary">Add key</button>
      </div>
    </form>
  );
  return (
    <Pane
      title="Who pays the providers"
      sub={only
        ? <>Not used: this project uses only its own servers.</>
        : <>
            Requests are billed by the provider to whoever&rsquo;s key is used: the project&rsquo;s own key for that provider first
            (a client&rsquo;s account, say), then the workspace&rsquo;s shared key
            {d.policy.allowPersonalProviderKeys ? ', then the requester’s own key from their Providers page' : ''}.
            {d.me.isOwner && <> Workspace keys are on the <Link href="/account/team?tab=settings" className="st-link-inline">workspace page</Link>.</>}
          </>}
      ruled
      flush
      delay={0.06}
    >
      {only ? (
        <div className="sw-pad">
          <details className="sw-details sw-kept">
            <summary>Provider keys kept for All connected and Prefer our servers</summary>
            {table}
            {addForm}
          </details>
        </div>
      ) : (
        <>
          {table}
          {addForm}
        </>
      )}
    </Pane>
  );
}
