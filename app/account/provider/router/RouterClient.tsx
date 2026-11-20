'use client';

/**
 * Router & offers (Phase 3 plan §2.14, §2.15 "Router & offers", §8.6, §8.7, §8.8; M8): per listing, whether people can
 * reach it through the Smart Router with their own key (the §2.14 dialog), and the traffic they sent (requests a day
 * over 30 days, success rate, p50 latency; fewer than 5 users reads "fewer than 5"; no prompt and no user identity);
 * the signature panel (the header, the current kid, the public keys, the verifiers' page, and [Send a signed test
 * request] to the provider's own endpoint); the offers editor (display only: a person reviews each offer before it
 * goes live, at most 3 live, terms on a verified domain, codes shown as plain text, never applied automatically).
 * M21: each listing's Usage (the API's `usage`, absent before M21's tables stand): over 7 and 30 days the requests, how
 * many it answered, the people who sent them, tokens in and out, failed calls at the endpoint and the requests another
 * model answered after one; and once for the account, the people with a key connected and in use. Counts only: every count
 * of people under 5 reads "fewer than 5", the windows' and connections' people come rounded down to a multiple of 5 ("20+":
 * the API never sends their exact count). And "Where the router would choose you" (the API's `ranking`): per routing mode,
 * the listing's place among the listings of the same model in the order automatic routing gives them, from our
 * measurements and the declared prices only, never from which users chose what.
 *
 * The router toggle lives here only (the Models page links here), so the console offers it once.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Pane, Loader, Note, Pill, Modal, Tag } from '@/components/studio';
import { ProviderHead, FieldError, useProviderSummary } from '@/components/marketplace/ProviderBits';
import { mpApi, type ProviderSummary } from '@/lib/provider-account';
import '@/styles/studio-provider-models.css';

interface TrafficDay { day: string; requests: number; successes: number; p50Ms: number | null; users: number | 'fewer than 5' }
/** A count of people over a window or of the connections, as the API sends it: "fewer than 5", or rounded down as "20+". */
type People = 'fewer than 5' | `${number}+`;
interface WindowUsage { requests: number; successes: number; successRate: number | null; tokensIn: number; tokensOut: number; failures: number; rescued: number; users: People | null }
interface ListingUsage { windows: { '7d': WindowUsage; '30d': WindowUsage }; usersCountedAt: string | null; connectedUsers: People }
/** One routing mode's place for a listing (the API's ranking rows). */
interface RankRow {
  strategy: string; strategies?: string[]; label: string; status: 'ranked' | 'not_measured' | 'not_measured_recently' | 'not_routable' | 'not_in_router';
  place: number | null; of: number | null; hosts: number | null; tiedWith: number | null;
}
interface RouterListing {
  id: number; publicId: string; label: string; mpId: string | null; state: string;
  routerEnabled: boolean; routerEnabledAt: string | null; canToggle: boolean;
  traffic: { days: TrafficDay[]; requests: number; successRate: number | null };
  /** M21; null or absent before the API has it. */
  usage?: ListingUsage | null;
  /** M21: where automatic routing would place it among the listings of the same model; absent before the API has it. */
  ranking?: { model: string; rows: RankRow[] };
}
interface Offer {
  id: number; kind: string; kindLabel: string; title: string; details: string | null; code: string | null; percent: number | null; termsUrl: string;
  startsAt: string; endsAt: string | null; listingId: number | null; state: 'draft' | 'in_review' | 'live' | 'expired' | 'removed'; createdAt: string;
}
interface Data {
  listings: RouterListing[];
  /** M21: people with a key connected and in use for this account ("fewer than 5" or "20+"); absent before the API has it. */
  connectedUsers?: People;
  signature: { kid: string | null; keys: Array<{ kid: string; alg: string; x: string; not_before: number; not_after: number }>; header: string };
  offers: Offer[];
  canManage: boolean;
  offerLimits: { livePerProvider: number; title: number; details: number; code: number; maxDays: number };
  offerKinds: Array<{ kind: string; label: string }>;
}
/** M12: the API keeps the sent signature header server-side (it could be replayed to that host); it returns its key id, time and request id. */
type TestResult = { ok: true; status: number | null; answered: boolean; signed: boolean; kid: string | null; t: number | null; rid: string | null; host: string } | { ok: false; message: string };

const OFFER_STATE: Record<Offer['state'], { label: string; tone?: 'good' | 'warn' | 'bad' }> = {
  draft: { label: 'Draft' }, in_review: { label: 'Awaiting approval', tone: 'warn' }, live: { label: 'Live', tone: 'good' }, expired: { label: 'Expired' }, removed: { label: 'Withdrawn' },
};
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const unixDay = (s: number) => new Date(s * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const num = (x: number) => x.toLocaleString('en-US');
const count = (x: number, one: string, many: string) => `${num(x)} ${x === 1 ? one : many}`;
const peopleOf = (u: People) => `${u} people`;

/** One window of a listing's usage as a sentence. */
function windowLine(w: WindowUsage): string {
  if (!w.requests && !w.failures && !w.rescued) return 'No requests.';
  const parts = [
    `${count(w.requests, 'request', 'requests')}${w.users !== null ? ` from ${peopleOf(w.users)}` : ''}${w.requests ? `, ${num(w.successes)} answered${w.successRate !== null ? ` (${w.successRate}%)` : ''}` : ''}`,
    `${num(w.tokensIn)} tokens in and ${num(w.tokensOut)} out`,
  ];
  if (w.failures) parts.push(`${count(w.failures, 'failed call', 'failed calls')} at your endpoint`);
  if (w.rescued) parts.push(`${count(w.rescued, 'request', 'requests')} answered by another model after your endpoint failed`);
  return `${parts.join('; ')}.`;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const RANK_STATUS: Record<Exclude<RankRow['status'], 'ranked'>, string> = {
  not_measured: 'Not measured yet', not_measured_recently: 'Not measured recently', not_routable: 'Not taken by automatic routing right now',
  not_in_router: 'Not in the Smart Router',
};

/** "1st of 3 hosts of DeepSeek V4 Pro, statistically tied with 1 other." */
function rankLine(r: RankRow, model: string): string {
  if (r.status !== 'ranked' || r.place === null || r.of === null) return `${RANK_STATUS[r.status as Exclude<RankRow['status'], 'ranked'>] ?? 'Not ranked'}.`;
  const what = r.hosts === r.of ? (r.of === 1 ? 'host' : 'hosts') : (r.of === 1 ? 'listing' : 'listings');
  const tied = r.tiedWith ? `, statistically tied with ${r.tiedWith} ${r.tiedWith === 1 ? 'other' : 'others'}` : '';
  return `${ordinal(r.place)} of ${r.of} ${what} of ${model}${tied}.`;
}

/** M21: "Where the router would choose you", from our measurements and the declared prices only. */
function RankingBlock({ ranking }: { ranking: { model: string; rows: RankRow[] } }) {
  const one = ranking.rows.every(r => r.status !== 'ranked' && r.status === ranking.rows[0]?.status) ? ranking.rows[0] : null;
  return (
    <div className="sw-stack">
      <p><b>Where the router would choose you</b></p>
      <p className="sw-quiet">
        How the Smart Router ranks your listing among the providers of the same model, from our measurements and your declared prices. It does not
        depend on which users chose what. Price only orders the hosts statistically tied with the leader: the highest price declared in the last
        7 days, each change counted 72 hours after it is made. Every other host is ordered by its measured score.
      </p>
      {one ? <p className="sw-quiet">{rankLine(one, ranking.model)}</p> : (
        <dl className="st-kv">
          {ranking.rows.map(r => <div key={r.strategy}><dt>{r.label}</dt><dd>{rankLine(r, ranking.model)}</dd></div>)}
        </dl>
      )}
    </div>
  );
}

/** M21: a listing's Usage, in plain sentences. */
function UsageBlock({ usage, everInRouter }: { usage: ListingUsage; everInRouter: boolean }) {
  const w30 = usage.windows['30d'];
  const none = !w30.requests && !w30.failures && !w30.rescued;
  return (
    <div className="sw-stack">
      <p><b>Usage</b></p>
      {none ? <p className="sw-quiet">{everInRouter ? 'No requests in the last 30 days.' : 'No requests yet.'}</p> : (
        <>
          <dl className="st-kv">
            <div><dt>Last 7 days</dt><dd>{windowLine(usage.windows['7d'])}</dd></div>
            <div><dt>Last 30 days</dt><dd>{windowLine(w30)}</dd></div>
          </dl>
        </>
      )}
    </div>
  );
}

export default function RouterClient({ initial }: { initial: ProviderSummary }) {
  const [summary] = useProviderSummary(initial);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [adding, setAdding] = useState<RouterListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<number, TestResult>>({});
  const [editing, setEditing] = useState<Offer | 'new' | null>(null);

  const load = useCallback(async () => {
    const r = await mpApi<Data>('/router');
    if (r.ok && r.data) { setData(r.data); setError(null); } else setError(r.error);
  }, []);
  useEffect(() => { void load(); }, [load, summary.provider?.publicId]);

  const providerName = summary.provider?.displayName ?? 'your service';
  const slug = summary.provider?.slug ?? '<provider>';
  const editable = !!data?.canManage;

  const toggle = async (l: RouterListing, enabled: boolean) => {
    setBusy(true);
    const r = await mpApi<{ routerEnabled: boolean }>(`/models/${l.id}/router`, { method: 'POST', body: { enabled } });
    setBusy(false);
    setAdding(null);
    setFlash(r.ok ? { tone: 'good', text: enabled ? `${l.label} is in the Smart Router.` : `${l.label} was removed from the Smart Router.` } : { tone: 'bad', text: r.error ?? 'Not changed.' });
    await load();
  };
  const remove = (l: RouterListing) => {
    if (!confirm(`Remove ${l.label} from the Smart Router? Requests that name ${l.mpId ?? 'it'} get 400 listing_not_routable, and automatic routing stops choosing it. You can add it again at any time.`)) return;
    void toggle(l, false);
  };
  const test = async (l: RouterListing) => {
    setBusy(true);
    const r = await mpApi<{ status: number | null; answered: boolean; signed: boolean; kid: string | null; t: number | null; rid: string | null; host: string }>('/router/test-request', { method: 'POST', body: { listingId: l.id } });
    setBusy(false);
    setTests(t => ({ ...t, [l.id]: r.ok && r.data ? { ok: true, ...r.data } : { ok: false, message: r.error ?? 'The test request was not sent.' } }));
  };
  const offerAction = async (o: Offer, action: 'submit' | 'withdraw') => {
    if (action === 'withdraw' && !confirm(`Withdraw the offer “${o.title}”? It leaves every page at once.`)) return;
    setBusy(true);
    const r = action === 'submit'
      ? await mpApi(`/offers/${o.id}/submit`, { method: 'POST', body: {} })
      : await mpApi(`/offers/${o.id}`, { method: 'DELETE' });
    setBusy(false);
    setFlash(r.ok
      ? { tone: 'good', text: action === 'submit' ? 'Sent for review. A person reviews each offer before it goes live.' : 'Withdrawn.' }
      : { tone: 'bad', text: [r.error, ...Object.values(r.fields ?? {})].filter(Boolean).join(' ') });
    await load();
  };

  if (!summary.provider) return null;
  return (
    <>
      <ProviderHead
        summary={summary}
        title="Router & offers"
        lead="Which of your models people can reach through the Smart Router with their own key, the traffic they send, the signature every request carries, and your offers."
      />
      <div className="st-body sw-stack">
        {error && <Note tone="bad" title="Not loaded">{error}</Note>}
        {flash && <Note tone={flash.tone === 'bad' ? 'bad' : 'good'}>{flash.text}</Note>}
        {!data && !error && <Loader label="Loading" />}
        {data && (
          <>
            <Pane title="In the Smart Router" sub="Each model joins the Smart Router when it is published, so people who add their own key for your service on their Providers page can send it requests; you bill them as usual. Remove any model here to take it out." ruled>
              {data.listings.length === 0 ? <p className="sw-quiet">No model is listed yet. <Link href="/account/provider/models">List one on Models</Link>.</p> : (
                <div className="sw-stack">
                  {data.connectedUsers !== undefined && (
                    <p>People with a key connected and in use for {providerName}: {data.connectedUsers}.</p>
                  )}
                  {data.listings.map(l => (
                    <div key={l.id} className="mp-router-row">
                      <div className="mp-bench-head">
                        <b>{l.label}</b>
                        {l.routerEnabled ? <Pill tone="good">In the Smart Router</Pill> : <Pill>Not in the Smart Router</Pill>}
                        {l.mpId && <code className="st-ic">{l.mpId}</code>}
                        {editable && (l.routerEnabled
                          ? <button type="button" className="st-btn is-sm" disabled={busy} onClick={() => remove(l)}>Remove from the Smart Router</button>
                          : <button type="button" className="st-btn is-sm is-primary" disabled={busy || !l.canToggle} title={l.canToggle ? undefined : 'A model is added once it is approved and listed.'} onClick={() => setAdding(l)}>Add to the Smart Router</button>)}
                      </div>
                      {!l.canToggle && !l.routerEnabled && <p className="sw-quiet">A model can be added once it is approved and listed.</p>}
                      {l.usage ? (
                        <>
                          {l.routerEnabledAt && <p className="sw-quiet">In the Smart Router since {when(l.routerEnabledAt)}.</p>}
                          <UsageBlock usage={l.usage} everInRouter={!!l.routerEnabledAt} />
                        </>
                      ) : (
                        <p className="sw-quiet">
                          Last 30 days: {l.traffic.requests.toLocaleString('en-US')} {l.traffic.requests === 1 ? 'request' : 'requests'}
                          {l.traffic.successRate !== null ? `, ${l.traffic.successRate}% answered` : ''}.
                          {l.routerEnabledAt ? ` In the Smart Router since ${when(l.routerEnabledAt)}.` : ''}
                        </p>
                      )}
                      {l.ranking && <RankingBlock ranking={l.ranking} />}
                      {l.traffic.days.length > 0 && (
                        <div className="mp-table-wrap">
                          <table className="mp-table">
                            <thead><tr><th scope="col">Day (UTC)</th><th scope="col">Requests</th><th scope="col">Answered</th><th scope="col">p50 latency</th><th scope="col">People</th></tr></thead>
                            <tbody>{[...l.traffic.days].reverse().map(d => (
                              <tr key={d.day}>
                                <td data-label="Day">{day(d.day)}</td>
                                <td data-label="Requests">{d.requests.toLocaleString('en-US')}</td>
                                <td data-label="Answered">{d.successes.toLocaleString('en-US')}</td>
                                <td data-label="p50 latency">{d.p50Ms === null ? '—' : `${(d.p50Ms / 1000).toFixed(1)} s`}</td>
                                <td data-label="People">{typeof d.users === 'number' ? d.users.toLocaleString('en-US') : d.users}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                  <p className="sw-quiet">Counts only, rolled up every hour: no prompt and no user identity ever reaches you through these statistics. Any count of people under 5 reads “fewer than 5”; the 7-day, 30-day and connected people are otherwise rounded down to a multiple of 5 (“20+”).</p>
                </div>
              )}
            </Pane>

            <Pane title="Signature" sub={`Every request the Smart Router sends to your endpoints carries an ${data.signature.header} header that you can verify with our public key.`} ruled>
              <div className="sw-stack">
                <dl className="st-kv">
                  <div><dt>Header</dt><dd><code className="st-ic">{data.signature.header}</code></dd></div>
                  <div><dt>Current key id</dt><dd>{data.signature.kid ? <code className="st-ic">{data.signature.kid}</code> : 'None yet: requests are sent unsigned until our signing key is set.'}</dd></div>
                  <div><dt>Public keys</dt><dd><a href="/.well-known/asl-router-keys.json" target="_blank" rel="noopener">/.well-known/asl-router-keys.json ↗</a></dd></div>
                </dl>
                {data.signature.keys.map(k => (
                  <p key={k.kid} className="sw-quiet mp-key">
                    <Tag tone="line">{k.kid}</Tag> {k.alg} · valid {unixDay(k.not_before)} to {unixDay(k.not_after)} · <code className="st-ic">x={k.x}</code>
                  </p>
                ))}
                <p className="sw-quiet"><Link href="/inference-providers/router-signature">How to verify it, with Node and Python verifiers →</Link></p>
                {editable && data.listings.some(l => l.state !== 'delisted') && (
                  <div className="sw-stack">
                    <p className="sw-quiet">[Send a signed test request] sends one request, with at most 1 output token, to your own endpoint with your own key, carrying the header a routed request carries.</p>
                    {data.listings.filter(l => l.state !== 'delisted').map(l => {
                      const t = tests[l.id];
                      return (
                        <div key={l.id} className="mp-bench-head">
                          <span>{l.label}</span>
                          <button type="button" className="st-btn is-sm" disabled={busy || !data.signature.kid} onClick={() => void test(l)}>Send a signed test request</button>
                          {t && (t.ok
                            ? <span className="sw-quiet" role="status">Sent to {t.host}: {t.answered ? `your endpoint answered HTTP ${t.status}` : 'your endpoint did not answer'}.{t.signed && t.rid && <> Signed with key <code className="st-ic">{t.kid}</code>{t.t ? ` at ${new Date(t.t * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC` : ''}, request id <code className="st-ic">{t.rid}</code>: look for it in your endpoint&apos;s logs.</>}</span>
                            : <span className="st-error" role="status">{t.message}</span>)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Pane>

            <Pane
              title="Offers"
              sub={`Shown on your pages and to people adding a key for ${providerName}, with the line “AI Stupid Level is not paid for this offer, and offers never affect rankings or routing.” At most ${data.offerLimits.livePerProvider} live; a person reviews each one first.`}
              actions={editable ? <button type="button" className="st-btn is-sm is-primary" onClick={() => setEditing('new')}>New offer</button> : undefined}
              ruled
            >
              {data.offers.length === 0 ? <p className="sw-quiet">No offer yet.</p> : (
                <div className="mp-table-wrap">
                  <table className="mp-table">
                    <thead><tr><th scope="col">Offer</th><th scope="col">State</th><th scope="col">Ends</th><th scope="col"><span className="st-sr">Actions</span></th></tr></thead>
                    <tbody>{data.offers.map(o => (
                      <tr key={o.id}>
                        <td data-label="Offer"><b>{o.title}</b><br /><span className="sw-quiet">{o.kindLabel}{o.percent != null ? `: ${o.percent}%` : ''}{o.code ? ` · code ${o.code}` : ''}</span></td>
                        <td data-label="State"><Pill tone={OFFER_STATE[o.state]?.tone}>{OFFER_STATE[o.state]?.label ?? o.state}</Pill></td>
                        <td data-label="Ends">{o.endsAt ? when(o.endsAt) : 'No end date'}</td>
                        <td data-label="Actions">
                          {editable && o.state === 'draft' && <button type="button" className="st-btn is-sm" disabled={busy} onClick={() => setEditing(o)}>Edit</button>}{' '}
                          {editable && o.state === 'draft' && <button type="button" className="st-btn is-sm is-primary" disabled={busy} onClick={() => void offerAction(o, 'submit')}>Send for review</button>}{' '}
                          {editable && (o.state === 'draft' || o.state === 'in_review' || o.state === 'live') && <button type="button" className="st-btn is-sm is-danger" disabled={busy} onClick={() => void offerAction(o, 'withdraw')}>Withdraw</button>}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Pane>
          </>
        )}
      </div>

      {/* §2.14, word for word. */}
      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        size="narrow"
        title={adding ? `Make ${adding.label} available in the Smart Router?` : ''}
        footer={adding ? (
          <>
            <button type="button" className="st-btn" onClick={() => setAdding(null)} disabled={busy}>Cancel</button>
            <button type="button" className="st-btn is-primary" onClick={() => void toggle(adding, true)} disabled={busy}>Add to the Smart Router</button>
          </>
        ) : undefined}
      >
        {adding && (
          <div className="sw-stack">
            <p>People who add their own {providerName} API key on their Providers page can send requests to this model through the Smart Router. Requests go to your endpoint with their key, and you bill them as usual. AI Stupid Level charges you nothing and pays you nothing.</p>
            <p>Until it has 3 measured runs of each suite a strategy needs, people reach it only by naming it: <code className="st-ic">{adding.mpId ?? `mp/${slug}/<entry>`}</code>. After that, people who connected your service and chose to prefer listed hosts may be routed to it automatically, among the hosts they connected, on its measured scores only. Automatic routing that mixes listed hosts with the leaderboard&apos;s models waits for our fresh task versions (ranking criterion P4).</p>
            <p>Every request carries an ASL-Router-Signature header that you can verify with our public key. <Link href="/inference-providers/router-signature">How to verify</Link></p>
          </div>
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="narrow" title={editing === 'new' ? 'New offer' : 'Edit offer'}>
        {editing !== null && data && (
          <OfferForm
            key={editing === 'new' ? 'new' : editing.id}
            offer={editing === 'new' ? null : editing}
            data={data}
            onDone={async text => { setEditing(null); if (text) setFlash({ tone: 'good', text }); await load(); }}
          />
        )}
      </Modal>
    </>
  );
}

/** A draft offer (§8.7): saved as a draft; "Send for review" on the list sends it to a person. */
function OfferForm({ offer, data, onDone }: { offer: Offer | null; data: Data; onDone: (text: string | null) => void }) {
  const [kind, setKind] = useState(offer?.kind ?? data.offerKinds[0]?.kind ?? 'promo_code');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const body: Record<string, unknown> = {
      kind, title: f.title, details: f.details || null, code: f.code || null, termsUrl: f.termsUrl,
      percent: kind === 'router_discount' && f.percent ? Number(f.percent) : null,
      endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59Z`).toISOString() : null,
      listingId: f.listingId ? Number(f.listingId) : null,
    };
    setBusy(true); setError(null); setFields({});
    const r = offer ? await mpApi(`/offers/${offer.id}`, { method: 'PATCH', body }) : await mpApi('/offers', { method: 'POST', body });
    setBusy(false);
    if (r.ok) onDone(offer ? 'Saved.' : 'Saved as a draft. Send it for review when it is ready.');
    else { setError(r.error); setFields(r.fields ?? {}); }
  };
  const L = data.offerLimits;
  return (
    <form className="sw-stack" onSubmit={submit}>
      <label className="st-field"><span className="st-field-label">Kind</span>
        <select className="st-select" value={kind} onChange={e => setKind(e.target.value)}>
          {data.offerKinds.map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
        <FieldError text={fields.kind} />
      </label>
      <label className="st-field"><span className="st-field-label">Title <small>at most {L.title} characters</small></span>
        <input className="st-input" name="title" required maxLength={L.title} defaultValue={offer?.title ?? ''} />
        <FieldError text={fields.title} />
      </label>
      <label className="st-field"><span className="st-field-label">Details <small>optional, at most {L.details}</small></span>
        <textarea className="st-textarea" name="details" rows={3} maxLength={L.details} defaultValue={offer?.details ?? ''} />
        <FieldError text={fields.details} />
      </label>
      {kind === 'router_discount' && (
        <label className="st-field"><span className="st-field-label">Discount, percent</span>
          <input className="st-input" name="percent" type="number" min={1} max={90} step={1} defaultValue={offer?.percent ?? ''} />
          <FieldError text={fields.percent} />
        </label>
      )}
      <label className="st-field"><span className="st-field-label">Code <small>optional; shown as plain text, never applied for anyone</small></span>
        <input className="st-input is-code" name="code" maxLength={L.code} defaultValue={offer?.code ?? ''} />
        <FieldError text={fields.code} />
      </label>
      <label className="st-field"><span className="st-field-label">Terms page <small>https, on one of your verified domains</small></span>
        <input className="st-input" name="termsUrl" type="url" required defaultValue={offer?.termsUrl ?? ''} placeholder="https://" />
        <FieldError text={fields.termsUrl} />
      </label>
      <label className="st-field"><span className="st-field-label">Ends <small>optional, at most {L.maxDays} days ahead</small></span>
        <input className="st-input" name="endsAt" type="date" defaultValue={offer?.endsAt ? offer.endsAt.slice(0, 10) : ''} />
        <FieldError text={fields.endsAt} />
      </label>
      <label className="st-field"><span className="st-field-label">For</span>
        <select className="st-select" name="listingId" defaultValue={offer?.listingId ? String(offer.listingId) : ''}>
          <option value="">All of your models</option>
          {data.listings.map(l => <option key={l.id} value={String(l.id)}>{l.label}</option>)}
        </select>
        <FieldError text={fields.listingId} />
      </label>
      {error && <Note tone="bad" title="Not saved">{error}</Note>}
      <div className="mp-form-actions">
        <button type="button" className="st-btn" onClick={() => onDone(null)} disabled={busy}>Cancel</button>
        <button type="submit" className="st-btn is-primary" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
      </div>
    </form>
  );
}
