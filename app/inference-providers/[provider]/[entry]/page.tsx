import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ReadingPage, RdSection, RdProse, RdFacts, RdCode, tocNumber } from '@/components/landing/Reading';
import HostLogo from '@/components/marketplace/HostLogo';
import ReportListing from '@/components/marketplace/ReportListing';
import JsonLd from '@/components/seo/JsonLd';
import { pageMeta, SITE, breadcrumbLd } from '@/lib/seo';
import { providerSignupOpenCached } from '@/lib/provider-public';
import { countryName } from '@/lib/countries';
import { connectable, marketplaceRead, providerTags, safeHttps, usd, tokens, longDay, userTestsRead, type EntryPageDTO } from '@/lib/marketplace-public';
import MeasuredScores from '@/components/marketplace/MeasuredScores';
import UserTests from '@/components/marketplace/UserTests';
import Offers from '@/components/marketplace/Offers';
import '@/styles/marketplace-public.css';

/**
 * One hosted entry (Phase 3 plan §4.6), e.g. "DeepSeek V4 Pro (FP8) — hosted by Together AI", published without
 * scores in M5: the listing's facts, its prices and limits, the measurement notes the readiness check gave, the
 * other hosts of the same open model, and its `mp/` id. Per-task results are never shown. noindex until measured.
 */
export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const PROVIDER_REL = 'nofollow ugc noopener noreferrer';

async function read(provider: string, entry: string) {
  if (!SLUG.test(provider) || !SLUG.test(entry)) return null;
  return marketplaceRead<EntryPageDTO>(`/marketplace/public/providers/${provider}/${entry}`, [...providerTags(provider), `mp:entry:${provider}/${entry}`]);
}

export async function generateMetadata(props: { params: Promise<{ provider: string; entry: string }> }): Promise<Metadata> {
  const params = await props.params;
  const r = await read(params.provider, params.entry);
  if (!r || r.kind !== 'ok') return { title: 'Page not found', robots: { index: false, follow: true } };
  const { provider: p, entry: e } = r.data;
  const model = e.openModel?.name ?? e.upstreamModel;
  return pageMeta({
    title: `${model} on ${p.displayName}: benchmark & price`,
    description: `${e.label}: price per million tokens, context, output limit and how AI Stupid Level tests it.`.slice(0, 155),
    path: e.path,
    noindex: e.noindex || r.preview,
  });
}

export default async function EntryPage(props: { params: Promise<{ provider: string; entry: string }> }) {
  const params = await props.params;
  const r = await read(params.provider, params.entry);
  if (!r || r.kind === 'not_found') notFound();
  if (r.kind !== 'ok') {
    if (!providerSignupOpenCached()) notFound();
    return <ReadingPage kicker="Inference providers" title="Temporarily unavailable" lead="This page is not available right now. Try again in a few minutes." toc={[]}><div /></ReadingPage>;
  }
  const { provider: p, entry: e, otherHosts, declaration } = r.data;
  const offers = e.offers ?? [];
  const model = e.openModel?.name ?? e.upstreamModel;
  // F7: user-run tests of this listing (nothing while the API's switch is off, or before its F7 release: not_found).
  const ut = await userTestsRead({ entry: [p.slug, e.entrySlug] }).catch(() => null);
  const tested = ut && ut.kind === 'ok' && ut.data.enabled && (ut.data.rows.length > 0 || ut.data.testable) ? ut.data : null;
  const toc = [
    { id: 'listing', label: 'The listing' },
    { id: 'measurement', label: 'Measurement' },
    ...(tested ? [{ id: 'tested', label: 'Tested by people' }] : []),
    ...(offers.length ? [{ id: 'offers', label: 'Offers' }] : []),
    // M13: a page no longer listed (a delisting, or its account's close) offers no way to use it, as its actions already don't.
    ...(e.status.kind === 'no_longer_listed' ? [] : [{ id: 'use', label: 'How to use it' }]),
    ...(otherHosts.length ? [{ id: 'hosts', label: 'Other hosts' }] : []),
  ];
  const n = (id: string) => tocNumber(toc, id);
  const modelUrl = safeHttps(e.modelUrl);
  const notMeasured = e.measurement.state === 'not_measured';
  const noLonger = e.status.kind === 'no_longer_listed';

  return (
    <>
      {r.preview && <div className="mp-staff-banner" role="note">Staff preview — not public</div>}
      <JsonLd data={breadcrumbLd([{ name: 'Inference providers', path: '/inference-providers' }, { name: p.displayName, path: `/inference-providers/${p.slug}` }, { name: model, path: e.path }])} />
      <ReadingPage
        className="mp-entry-page"
        kicker={`Hosted by ${p.displayName}`}
        title={model}
        accent={e.precision !== 'bf16' && e.precision !== 'fp16' ? `(${e.precisionLabel})` : undefined}
        lead={noLonger ? `No longer listed on AI Stupid Level (since ${longDay(e.delistedAt)}).` : notMeasured ? 'Listed · not measured yet.' : e.status.text || undefined}
        actions={noLonger ? undefined : (
          <div className="mp-actions">
            {/* M13 (privacy 1.9): only a host whose declared processing regions are covered can be connected. */}
            {connectable(p.connect)
              ? <Link className="lp-btn lp-btn-primary lp-btn-lg" href={`/router/providers?host=${p.slug}`}>Use {p.displayName} in the Smart Router</Link>
              : <p className="mp-muted mp-noconnect">{p.connect?.reason}</p>}
            <Link className="lp-btn lp-btn-ghost lp-btn-lg" href={`/inference-providers/${p.slug}`}>All {p.displayName} models</Link>
          </div>
        )}
        aside={<HostLogo name={p.displayName} logoUrl={p.logoUrl} size={64} label={p.displayName} />}
        toc={toc}
      >
        <RdSection id="listing" n={n('listing')} title="The listing">
          <RdFacts rows={[
            ['Model', `${model}${e.openModel?.maker ? ` (${e.openModel.maker})` : ''}`],
            ['Precision served', `${e.precisionLabel}${e.precisionNote ? ` — ${e.precisionNote}` : ''}`],
            ['Context served', `${tokens(e.contextTokens)} tokens`],
            ['Max output', `${tokens(e.maxOutputTokens)} tokens`],
            ['Input', `${usd(e.price.inPerMTok)} per 1M tokens`],
            ['Output', `${usd(e.price.outPerMTok)} per 1M tokens`],
            ...(e.price.cachedInPerMTok !== null ? [['Cached input', `${usd(e.price.cachedInPerMTok)} per 1M tokens`] as [string, string]] : []),
            ...(e.regions.length ? [['Regions', e.regions.join(', ')] as [string, string]] : []),
            ...(e.rateLimits ? [['Rate limits', e.rateLimits] as [string, string]] : []),
          ]} />
          <RdProse>
            <p className="mp-caption">Prices declared by {p.displayName}{e.price.checkedAt ? `, checked on ${longDay(e.price.checkedAt)}` : ''}. {modelUrl && <a href={modelUrl} rel={PROVIDER_REL} target="_blank">The model on {p.displayName}&apos;s site ↗</a>}</p>
          </RdProse>
        </RdSection>

        <RdSection id="measurement" n={n('measurement')} title="Measurement">
          <RdProse>
            {notMeasured
              ? <p>Not measured yet. We publish each day&apos;s mean score, rounded to a whole point, one to two days after the day ends, never when a run took place, and never a per-task result.</p>
              : <p>{e.measurement.publishedDays} published day{e.measurement.publishedDays === 1 ? '' : 's'}, {e.measurement.runs} counted run{e.measurement.runs === 1 ? '' : 's'}; the last published day is {longDay(e.measurement.lastPublishedDay)}.</p>}
          </RdProse>
          {!notMeasured && e.scores && <MeasuredScores scores={e.scores} daily={e.measurement.daily} publicDaily />}
          <RdProse>
            <h3>Measurement notes</h3>
            <ul>
              {e.notes.outputLimit !== null && <li>Output limit {e.notes.outputLimit.toLocaleString('en')} tokens, from the readiness check.</li>}
              {e.notes.refusedParameters.length > 0 && <li>Request parameters the host refused: {e.notes.refusedParameters.join(', ')}.</li>}
              {e.status.kind !== 'normal' && e.status.text && <li>{e.status.text}{e.status.since ? ` since ${longDay(e.status.since)}` : ''}.</li>}
              {e.notes.outputLimit === null && e.notes.refusedParameters.length === 0 && e.status.kind === 'normal' && <li>None yet.</li>}
            </ul>
          </RdProse>
        </RdSection>

        {tested && (
          <RdSection id="tested" n={n('tested')} title="Tested by people">
            <UserTests data={tested} scope="entry" testHref={`/router/test-keys?listing=${e.publicId}`} />
          </RdSection>
        )}

        {offers.length > 0 && (
          <RdSection id="offers" n={n('offers')} title="Offers">
            <Offers offers={offers} providerName={p.displayName} />
          </RdSection>
        )}

        {!noLonger && <RdSection id="use" n={n('use')} title="How to use it">
          <RdProse>
            {!connectable(p.connect) && <p><b>{p.connect?.reason}</b></p>}
            <p>The Smart Router id of this listing is <code>{e.mpId}</code>. At {p.displayName} the model is called <code>{e.upstreamModel}</code>.</p>
          </RdProse>
          <RdCode title="A request" label="curl" code={`curl https://aistupidlevel.info/v1/chat/completions \\\n  -H "Authorization: Bearer $AISM_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "${e.mpId}", "messages": [{"role": "user", "content": "Hello"}]}'`} />
        </RdSection>}

        {otherHosts.length > 0 && (
          <RdSection id="hosts" n={n('hosts')} title={`Other hosts of ${model}`}>
            <ul className="mp-host-list">
              {otherHosts.map(h => (
                <li key={h.entry.publicId}>
                  <HostLogo name={h.provider.displayName} logoUrl={h.provider.logoUrl} size={30} />
                  <Link href={h.entry.path}>{h.entry.label}</Link>
                  <span className="mp-muted">{h.entry.measurement.state === 'measured' ? 'Measured' : 'Not measured yet'} · {usd(h.entry.price.inPerMTok)} / {usd(h.entry.price.outPerMTok)} per 1M</span>
                </li>
              ))}
            </ul>
            <RdProse><p className="mp-caption"><Link href="/inference-providers/ranking-criteria">How hosts are ordered</Link></p></RdProse>
          </RdSection>
        )}

        <footer className="mp-page-foot">
          <p>Listing details supplied by {p.operatedBy ?? p.displayName}{p.country ? ` (${countryName(p.country)})` : ''}. Measurements by AI Stupid Level.{declaration ? ` Data handling declared by ${p.displayName} on ${longDay(declaration.declaredAt)}; not audited by AI Stupid Level.` : ''}</p>
          <ReportListing provider={p.slug} entry={e.entrySlug} path={e.path} />
          <p><Link href="/inference-providers">Are you an inference provider? List your models →</Link></p>
          <p className="mp-router-cta">The Smart Router is one OpenAI-compatible endpoint whose routing modes choose a model for each request{noLonger ? '' : <>; name <code>{e.mpId}</code> to reach this listing with your own key</>}. <Link href="/router">Explore the Smart Router →</Link></p>
        </footer>
      </ReadingPage>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebPage', name: e.label, url: `${SITE}${e.path}`, about: { '@type': 'Organization', name: p.displayName } }} />
    </>
  );
}
