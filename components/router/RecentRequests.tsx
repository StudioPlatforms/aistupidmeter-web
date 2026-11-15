import { Fragment } from 'react';
import { ProviderMark, Tag } from '@/components/studio/Bits';
import { PROVIDER_LABEL } from '@/components/landing/types';
import WhyThisModel from './WhyThisModel';
import type { RecentRequest } from '@/lib/api-client';
import { askedFor, refusedBeforeRouting, whyThisModel } from '@/lib/recent-requests';
import { conversationTag, rankedOn } from '@/lib/router-adaptive';

/**
 * One routed request as the account's own pages list it: a row of Recent activity on /router
 * (ActivityRow) and the rows of Recent requests on /router/analytics (RequestLogRows). Moved here
 * from those two pages as they were, so tests/aw1 can render them, with two additions (AW1):
 * - what the request asked for, in the workspace Requests view's words (lib/recent-requests
 *   askedFor), shown only when the API sends `requestedModel` (its A1 release);
 * - "Why this model": the stored routing reason, folded until opened (WhyThisModel).
 * AW2 (plan §7.5) adds, from the fields the API's A1 release already sends:
 * - the benchmark the request was ranked on ("Ranked on"), when recorded;
 * - a Kept or Switched tag when Model switching (A2) re-checked the conversation (lib/router-adaptive).
 * A row without them (older rows, an API before A1) is exactly as before.
 * Styles: studio.css (st-row, st-table) and the pages' own sheets (sr-act, sa-log).
 */

/** A provider id as the dashboard names it. */
export const providerName = (p: string) => PROVIDER_LABEL[p] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Provider');

/** Who served a row: a listed host's label (M8: "<Host> · <model> (listed host)", never its ep:<id>), else the provider. */
const servedBy = (req: RecentRequest) => req.providerLabel ?? providerName(req.provider);

/** Why a request failed, in the words a customer acts on (the API's `cause`). */
const FAILURE: Record<string, (provider: string) => string> = {
  client_quota: p => `${p} account out of credit`,
  // A routing mode refused for want of any key has no provider of its own.
  no_provider_key: p => (p === 'Provider' ? 'Refused: no provider key saved' : `Refused: no ${p} key saved`),
  refused: () => 'Refused before routing (see the message in Analytics)',
  client_auth: p => `${p} rejected the key`,
  client_rate_limit: p => `${p} key rate-limited`,
  client_request: p => `${p} rejected the request`,
  refusal: () => 'The model declined the request',
  model: () => 'The model did not answer',
  transport: () => 'Network error or timeout',
};

function ago(ts: string): string {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Recent activity (/router): model, what was asked for and the outcome; "Why this model" under them. */
export function ActivityRow({ req, names }: { req: RecentRequest; names: Record<string, string> }) {
  const when = ago(req.timestamp);
  const asked = askedFor(req);
  const why = whyThisModel(req);
  const ranked = refusedBeforeRouting(req) ? null : rankedOn(req);
  const tag = conversationTag(req);
  return (
    <div className="st-row" title={!req.success && req.error ? req.error : undefined}>
      <ProviderMark provider={req.provider} />
      <div className="st-row-main">
        <div className="st-row-t" title={req.model}>{names[req.model] ?? req.model}</div>
        <div className={`st-row-s${asked ? ' sr-asked' : ''}`}>
          {asked && <>{asked} · </>}
          {ranked && <>ranked on {ranked.toLowerCase()} · </>}
          {!req.success && req.cause && FAILURE[req.cause]
            ? <>{FAILURE[req.cause](req.providerLabel ? req.providerLabel.replace(/ \(listed host\)$/, '') : providerName(req.provider))}{when ? ` · ${when}` : ''}</>
            : <>
                {servedBy(req)} · {(req.tokensIn + req.tokensOut).toLocaleString()} {req.tokensIn + req.tokensOut === 1 ? 'token' : 'tokens'}
                {req.latency != null ? ` · ${Number(req.latency).toLocaleString()} ms` : ''}{when ? ` · ${when}` : ''}
              </>}
        </div>
      </div>
      <div className="st-row-end">
        <span className="sr-cost">${req.cost}</span>
        {tag && <Tag tone="line">{tag}</Tag>}
        {req.success ? <Tag tone="good">Success</Tag> : <Tag tone="bad">Failed</Tag>}
      </div>
      {why && <WhyThisModel reason={why} />}
    </div>
  );
}

/** A log time: the clock time for today's entries, the date as well for older ones. */
function when(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString()
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Columns of the Recent requests table (Status, Model, Provider, Tokens, Cost, Latency, Time). */
export const REQUEST_LOG_COLUMNS = 7;

/** The table has its "Ranked on" column when some request carries the benchmark it was ranked on (API A1 and later). */
export const hasRankedOn = (rows: RecentRequest[]): boolean => rows.some(r => !refusedBeforeRouting(r) && rankedOn(r) !== null);

/**
 * Recent requests (/router/analytics): the request's row, then "Why this model" on a row of its own. `rankedCol`: the
 * table shows "Ranked on" after Model (hasRankedOn); a request with no benchmark recorded shows a dash there.
 */
export function RequestLogRows({ req, names, rankedCol = false }: { req: RecentRequest; names: Record<string, string>; rankedCol?: boolean }) {
  const asked = askedFor(req);
  const why = whyThisModel(req);
  const ranked = refusedBeforeRouting(req) ? null : rankedOn(req);
  const tag = conversationTag(req);
  return (
    <Fragment>
      <tr className={why ? 'has-why' : undefined}>
        <td className="sa-c-end" data-label="Status">
          {req.success ? <Tag tone="good">OK</Tag> : <Tag tone="bad">Failed</Tag>}
        </td>
        <td className="sa-c-head" data-label="Model">
          {names[req.model] ? <span className="sa-name" title={req.model}>{names[req.model]}</span> : <span className="sa-id">{req.model}</span>}
          {asked && <span className="sa-asked">{asked}</span>}
          {tag && <span className="sa-conv"><Tag tone="line">{tag}</Tag></span>}
        </td>
        {rankedCol && (
          <td className="sa-c-meta sa-ranked" data-label="Ranked on">
            {ranked ? <><span className="sa-ranked-k">Ranked on </span>{ranked}</> : <span className="is-dim">—</span>}
          </td>
        )}
        <td className="sa-c-meta is-dim" data-label="Provider">{req.providerLabel ?? PROVIDER_LABEL[req.provider] ?? req.provider}</td>
        <td className="sa-c-meta is-num" data-label="Tokens">{(req.tokensIn + req.tokensOut).toLocaleString()}<span className="sa-unit"> tokens</span></td>
        <td className="sa-c-meta is-num" data-label="Cost">${req.cost}</td>
        <td className="sa-c-meta is-num is-dim" data-label="Latency">{req.latency == null ? '—' : `${req.latency.toLocaleString()} ms`}</td>
        <td className="sa-c-meta is-num is-dim sa-when" data-label="Time" title={new Date(req.timestamp).toLocaleString()}>{when(req.timestamp)}</td>
      </tr>
      {why && (
        <tr className="sa-why-row">
          <td colSpan={REQUEST_LOG_COLUMNS + (rankedCol ? 1 : 0)}><WhyThisModel reason={why} /></td>
        </tr>
      )}
    </Fragment>
  );
}
