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
import { marketplaceRead, providerTags, safeHttps, usd, tokens, longDay, headlineText, type ProviderPageDTO, type EntryDTO } from '@/lib/marketplace-public';
import { HowWeTestSpotItems, HowWeTestSpotList } from '@/components/marketplace/SpotCopy';
import MeasuredScores from '@/components/marketplace/MeasuredScores';
import Offers from '@/components/marketplace/Offers';
import '@/styles/marketplace-public.css';

/**
 * A provider's page (Phase 3 plan §4.5), published without scores in M5: an approved provider's profile and its
 * listings, each "Listed · not measured yet" until a day's mean becomes public (§6.5). Rendered per request (the
 * staff preview of M1–M9 depends on the viewer), with its data fetched under the tags the API's outbox revalidates
 * and at most 60 s old. Text from providers is React text only; their links carry rel="nofollow ugc noopener".
 */
export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const PROVIDER_REL = 'nofollow ugc noopener noreferrer';

async function read(slug: string) {
  if (!SLUG.test(slug)) return null;
  return marketplaceRead<ProviderPageDTO>(`/marketplace/public/providers/${slug}`, providerTags(slug));
}

export async function generateMetadata(props: { params: Promise<{ provider: string }> }): Promise<Metadata> {
  const params = await props.params;
  const r = await read(params.provider);
  if (!r || r.kind !== 'ok') return { title: 'Page not found', robots: { index: false, follow: true } };
  const p = r.data.provider;
  return pageMeta({
    title: `${p.displayName} benchmarks, prices & uptime`,
    description: `${p.displayName}${p.operatedBy ? `, operated by ${p.operatedBy}` : ''}: the models it serves, their prices and context, and how AI Stupid Level tests its endpoints.`.slice(0, 155),
    path: `/inference-providers/${p.slug}`,
    noindex: r.data.noindex || r.preview,
  });
}

const STATUS_CHIP: Record<string, string> = {
  under_review: 'Under review', measurement_paused: 'Measurement paused', security_check: 'Endpoint paused for a security check',
  suspended: 'Suspended', no_longer_listed: 'No longer listed',
};

function measuredCell(e: EntryDTO): string {
  if (e.measurement.state === 'not_measured') return 'Not measured yet';
  // M6b: the headline mean ± SE over the newest counted runs of published days (whole number ± one decimal).
  const h = headlineText(e.scores?.headline.combined);
  if (h) return h;
  const m = e.scores?.measuring;
  if (m) return `Measuring: ${m.runs} of ${m.of} runs`;
  const last = e.measurement.daily.find(d => d.suite === 'combined');
  return last ? `${last.mean} (${longDay(last.day)})` : 'Not measured yet';
}

const pct = (x: number | null | undefined) => (typeof x === 'number' ? `${x.toFixed(1)}%` : '—');

function Unavailable() {
  return (
    <ReadingPage kicker="Inference providers" title="Temporarily unavailable" lead="Provider pages are not available right now. Try again in a few minutes." toc={[]}>
      <div />
    </ReadingPage>
  );
}

export default async function ProviderPage(props: { params: Promise<{ provider: string }> }) {
  const params = await props.params;
  const r = await read(params.provider);
  if (!r || r.kind === 'not_found') notFound();
  if (r.kind !== 'ok') {
    // Before the opening (ASL_MARKETPLACE=staff) an empty answer is the site's 404 for everyone but staff.
    if (!providerSignupOpenCached()) notFound();
    return <Unavailable />;
  }
  const { provider: p, entries, declaration, health } = r.data;
  const offers = r.data.offers ?? [];
  const live = entries.filter(e => e.status.kind !== 'no_longer_listed');
  const gone = entries.filter(e => e.status.kind === 'no_longer_listed');
  const spotted = live.filter(e => e.scores?.spotChecks);
  const spottedMonths = spotted.map(e => ({ publicId: e.publicId, label: e.label, spot: e.scores!.spotChecks! }));
  const standing = p.standing !== 'good' ? (p.standing === 'suspended' ? 'Suspended' : 'Under review') : null;
  const website = safeHttps(p.website); const getKey = safeHttps(p.getKeyUrl); const pricing = safeHttps(p.pricingUrl);
  const measured = live.filter(e => e.scores && e.scores.publishedDays > 0);
  const toc = [
    { id: 'models', label: 'Models and prices' },
    ...(measured.length ? [{ id: 'performance', label: 'Measured performance' }] : []),
    ...(offers.length ? [{ id: 'offers', label: 'Offers' }] : []),
    { id: 'use', label: 'How to use it' },
    ...(p.about ? [{ id: 'about', label: 'About' }] : []),
    { id: 'data', label: 'Data handling' },
    { id: 'testing', label: 'How we test this host' },
  ];
  const n = (id: string) => tocNumber(toc, id);
  const first = live[0];
  const priceChecked = live.map(e => e.price.checkedAt).filter(Boolean).sort().pop() ?? null;
  const operated = p.operatedBy ? `Operated by ${p.operatedBy}${p.country ? ` (${countryName(p.country)})` : ''}` : null;

  return (
    <>
      {r.preview && <div className="mp-staff-banner" role="note">Staff preview — not public</div>}
      <JsonLd data={breadcrumbLd([{ name: 'Inference providers', path: '/inference-providers' }, { name: p.displayName, path: `/inference-providers/${p.slug}` }])} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'WebPage', name: `${p.displayName} on AI Stupid Level`, url: `${SITE}/inference-providers/${p.slug}`,
        about: { '@type': 'Organization', name: p.displayName, ...(website ? { url: website } : {}), ...(p.logoUrl ? { logo: `${SITE}${p.logoUrl}` } : {}) },
        mainEntity: { '@type': 'ItemList', itemListElement: live.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.label, url: `${SITE}${e.path}` })) },
      }} />
      <ReadingPage
        className="mp-provider-page"
        kicker="Inference provider"
        title={p.displayName}
        lead={operated ?? undefined}
        actions={(
          <div className="mp-actions">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" href={`/router/providers?host=${p.slug}`}>Use {p.displayName} in the Smart Router</Link>
            {getKey && <a className="lp-btn lp-btn-ghost lp-btn-lg" href={getKey} rel={PROVIDER_REL} target="_blank">Get an API key ↗</a>}
            {website && <a className="lp-btn lp-btn-ghost lp-btn-lg" href={website} rel={PROVIDER_REL} target="_blank">Website ↗</a>}
          </div>
        )}
        aside={(
          <div className="mp-provider-aside">
            <HostLogo name={p.displayName} logoUrl={p.logoUrl} size={64} label={p.displayName} />
            <ul className="mp-tags">
              <li>{p.kind === 'company' ? 'Company' : 'Individual'}</li>
              {p.domains.slice(0, 3).map(d => <li key={d.domain}>Verified domain {d.domain}</li>)}
              {p.regions.slice(0, 6).map(x => <li key={x}>{x}</li>)}
              {p.publishedAt && <li>Listed since {new Date(p.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</li>}
              {standing && <li className="is-warn">{standing}</li>}
            </ul>
            {health.endpoints > 0 && (
              <p className="mp-live">{health.up === health.endpoints ? 'All endpoints up' : `${health.up} of ${health.endpoints} endpoints up`}{health.checkedAt ? ` · checked ${longDay(health.checkedAt)}` : ''}</p>
            )}
          </div>
        )}
        toc={toc}
      >
        <RdSection id="models" n={n('models')} title="Models and prices">
          {live.length === 0 ? <RdProse><p>No model is listed right now.</p></RdProse> : (
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead><tr><th scope="col">Model</th><th scope="col">Input $/1M</th><th scope="col">Output $/1M</th><th scope="col">Cached input</th><th scope="col">Context</th><th scope="col">Combined</th><th scope="col">Output tok/s</th><th scope="col">30-day availability</th><th scope="col">Drift</th><th scope="col"><span className="st-sr">Page</span></th></tr></thead>
                <tbody>
                  {live.map(e => (
                    <tr key={e.publicId}>
                      <td data-label="Model">
                        <Link href={e.path}>{e.openModel?.name ?? e.upstreamModel}</Link> <span className="mp-chip">{e.precisionLabel}</span>
                        {e.status.kind !== 'normal' && STATUS_CHIP[e.status.kind] && <span className="mp-chip is-warn">{STATUS_CHIP[e.status.kind]}</span>}
                      </td>
                      <td data-label="Input $/1M">{usd(e.price.inPerMTok)}</td>
                      <td data-label="Output $/1M">{usd(e.price.outPerMTok)}</td>
                      <td data-label="Cached input">{e.price.cachedInPerMTok === null ? '—' : usd(e.price.cachedInPerMTok)}</td>
                      <td data-label="Context">{tokens(e.contextTokens)}</td>
                      <td data-label="Combined">{measuredCell(e)}</td>
                      <td data-label="Output tok/s">{e.scores?.speed?.outputTpsP50 != null ? e.scores.speed.outputTpsP50.toFixed(1) : '—'}</td>
                      <td data-label="30-day availability">{pct(e.scores?.availability.apiReachability)}</td>
                      <td data-label="Drift">{e.scores?.drift.coding ?? (e.scores?.publishedDays ? 'No sustained change' : '—')}</td>
                      <td><Link href={e.path} aria-label={`${e.label}: details`}>→</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <RdProse>
            <p className="mp-caption">Prices declared by {p.displayName}{pricing ? <>, from <a href={pricing} rel={PROVIDER_REL} target="_blank">their pricing page</a></> : null}{priceChecked ? `, checked on ${longDay(priceChecked)}` : ''}. <Link href="/inference-providers/ranking-criteria">How hosts are ordered</Link></p>
            {gone.length > 0 && <p className="mp-caption">No longer listed: {gone.map(e => `${e.openModel?.name ?? e.upstreamModel} (since ${longDay(e.delistedAt)})`).join(', ')}.</p>}
          </RdProse>
        </RdSection>

        {measured.length > 0 && (
          <RdSection id="performance" n={n('performance')} title="Measured performance">
            {measured.map(e => <MeasuredScores key={e.publicId} title={e.label} scores={e.scores!} href={e.path} />)}
          </RdSection>
        )}

        {offers.length > 0 && (
          <RdSection id="offers" n={n('offers')} title="Offers">
            <Offers offers={offers} providerName={p.displayName} />
          </RdSection>
        )}

        <RdSection id="use" n={n('use')} title="How to use it">
          <RdProse>
            <ol>
              <li>Create an API key on {p.displayName}{getKey ? <>&apos;s site (<a href={getKey} rel={PROVIDER_REL} target="_blank">get a key ↗</a>)</> : '’s site'}.</li>
              <li>Add it on your Providers page in the Smart Router.</li>
              <li>Name the model in your requests. Once a model is measured, the router can also choose it automatically among the hosts you connected, when Model source in your routing preferences prefers them.</li>
            </ol>
            {first && <p>At {p.displayName} this model is called <code>{first.upstreamModel}</code>.</p>}
          </RdProse>
          {first && (
            <RdCode title="A request" label="curl" code={`curl https://aistupidlevel.info/v1/chat/completions \\\n  -H "Authorization: Bearer $AISM_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "${first.mpId}", "messages": [{"role": "user", "content": "Hello"}]}'`} />
          )}
        </RdSection>

        {p.about && (
          <RdSection id="about" n={n('about')} title={`About ${p.displayName}`}>
            <RdProse>{p.about.split(/\n{2,}/).slice(0, 4).map((t, i) => <p key={i}>{t}</p>)}</RdProse>
            <RdFacts rows={[
              ...(p.foundedYear ? [['Founded', String(p.foundedYear)] as [string, string]] : []),
              ...(p.hqCity ? [['Headquarters', p.hqCity] as [string, string]] : []),
            ]} />
          </RdSection>
        )}

        <RdSection id="data" n={n('data')} title="Data handling">
          <RdProse>
            {declaration ? (
              <>
                <p>Declared by {p.displayName} on {longDay(declaration.declaredAt)}. Not audited by AI Stupid Level.</p>
                <ul>
                  <li>Prompts and outputs kept: {declaration.promptsRetention === 'none' ? 'Not kept' : declaration.promptsRetention === 'days' ? `${declaration.retentionDays ?? '?'} days` : 'Not stated'}</li>
                  <li>Used for training: {({ never: 'Never', opt_in: 'Only if you opt in', opt_out: 'Unless you opt out', yes: 'Yes', not_stated: 'Not stated' } as Record<string, string>)[declaration.trainingUse] ?? 'Not stated'}</li>
                  {declaration.logContents && <li>What logs contain: {declaration.logContents}</li>}
                  {declaration.processingRegions.length > 0 && <li>Where requests are processed: {declaration.processingRegions.join(', ')}</li>}
                  {declaration.subprocessors.length > 0 && <li>Sub-processors: {declaration.subprocessors.join(', ')}</li>}
                  {declaration.certifications.length > 0 && <li>Certifications (self-declared): {declaration.certifications.join(', ')}</li>}
                </ul>
                <p>
                  {safeHttps(declaration.privacyUrl) && <a href={safeHttps(declaration.privacyUrl) as string} rel={PROVIDER_REL} target="_blank">Privacy policy ↗</a>}{' '}
                  {safeHttps(declaration.termsUrl) && <a href={safeHttps(declaration.termsUrl) as string} rel={PROVIDER_REL} target="_blank">Terms ↗</a>}{' '}
                  {safeHttps(declaration.dpaUrl) && <a href={safeHttps(declaration.dpaUrl) as string} rel={PROVIDER_REL} target="_blank">Data processing agreement ↗</a>}
                </p>
              </>
            ) : <p>{p.displayName} has not declared how it handles requests yet.</p>}
          </RdProse>
        </RdSection>

        <RdSection id="testing" n={n('testing')} title="How we test this host">
          <RdProse>
            <ul>
              <li>We choose the times of every test run, and never announce them.</li>
              <li>The host pays for its own test traffic, with the key on its endpoint.</li>
              <li>A refused key or exhausted credit pauses measurement; such a run never counts.</li>
              <li>We publish each day&apos;s mean one to two days after the day ends, never single runs.</li>
              {/* M7: spot checks, from each listing's newest PUBLISHED month only (never a count before its monthly publication, §6.7).
                  M9b (D-C7): the practice sentences only with a published month among the recent ones (the API's spotPractice). */}
              <HowWeTestSpotItems spotPractice={r.data.spotPractice} spotted={spottedMonths} />
            </ul>
            <HowWeTestSpotList spotted={spottedMonths} />
            <p><Link href="/methodology">Our methodology</Link> · <Link href="/inference-providers/ranking-criteria">The ranking criteria</Link></p>
          </RdProse>
        </RdSection>

        <footer className="mp-page-foot">
          <p>Listing details supplied by {p.operatedBy ?? p.displayName}{p.country ? ` (${countryName(p.country)})` : ''}. Measurements by AI Stupid Level.</p>
          <ReportListing provider={p.slug} path={`/inference-providers/${p.slug}`} />
          <p><Link href="/inference-providers">Are you an inference provider? List your models →</Link></p>
          <p className="mp-router-cta">The Smart Router is one OpenAI-compatible endpoint whose routing modes choose a model for each request; with your own key it can reach {p.displayName}. <Link href="/router">Explore the Smart Router →</Link></p>
        </footer>
      </ReadingPage>
    </>
  );
}
