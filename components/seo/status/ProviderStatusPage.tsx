import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import LandingEffects from '@/components/landing/LandingEffects';
import { RdFacts, RdFinal } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta, SignupCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { PLANS } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { breadcrumbLd, dayLabel, faqLd, graphLd, isoDay, utcStamp, webPageLd } from '@/lib/seo';
import {
  VENDORS, byDisplayName, episodesOf, getProviders, getRoster, modelsOfVendor, providerStatusOf, vendorMention,
  type ProviderEpisode, type ProviderStatus, type ProvidersStatus, type Vendor,
} from '@/lib/seo-data';
import { WeekGrid } from './WeekGrid';
import {
  DEFAULT_INTERVAL_MIN, ERROR_CODES, H1_OF, PROVIDER_PAGES, STATUS_COPY, apiNameOf, statusDescription,
} from './status-meta';
import {
  STATE_TEXT, STATE_TONE, ago, duration, isOurSide, outagesOf, parseUtc, pct, secs, slowOf, stamp, verdictFor, type Verdict,
} from './status-utils';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/status-page.css';

/**
 * /status/<provider>: one provider's probe record, server-rendered every minute from
 * GET /providers/status filtered to the vendor (lib/seo-data getProviders), in the hub's look.
 *
 * What the page may and may not say is the hub's rule, applied to one provider: a check that
 * failed on our side is "not measured", never an outage; "answered" counts only the checks we
 * could make and the denominators stay visible; the median is our own round trip. The verdict,
 * every figure and every timestamp come from the feed; the static copy names only the vendor,
 * the family, the host and the surfaces the probe does not touch. When the feed cannot answer,
 * the prose stays and the figures are left out: nothing is invented and no placeholder is shown.
 */

const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
/** Slow periods listed before the list is cut; the note above it says how many there were. */
const SLOW_SHOWN = 8;
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);
const up = (d?: string, cls = ''): { className: string; style?: CSSProperties } =>
  ({ className: `${cls} lp-up`.trim(), ...(d ? { style: { '--d': d } as CSSProperties } : {}) });

// Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do.
const FAILSAFE = "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();";

/** The feed's defaults when it cannot answer (apps/api/src/routes/health.ts writes the same values). */
const META_FALLBACK: ProvidersStatus['meta'] = {
  checkIntervalMinutes: DEFAULT_INTERVAL_MIN, retentionDays: 7, ourFaultSince: null, degradedAboveMs: 5000,
  probe: 'One short completion on our own key, from one machine in Germany.',
};

/** "ChatGPT", "claude.ai, Claude Code or the Anthropic Console". */
const orList = (xs: string[]): string => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;

function Logo({ provider }: { provider: string }) {
  return (
    <span className="lp-lgc" aria-hidden="true">
      <img src={`/logos/${provider}.svg`} alt="" width={18} height={18} loading="lazy" />
    </span>
  );
}

/** The outage CTAs: route around it, and be told when it stops and when it comes back. */
function OutageCtas({ page, section, primaryRouter }: { page: string; section: string; primaryRouter: boolean }) {
  const router = (
    <RouterCta
      cta={`${page}-${section}-router`}
      ghost={!primaryRouter}
      label="Route around it with the Smart Router →"
      sub={`Skips a provider that is not answering and routes to the next best model · your own keys · ${n(FREE.routerRequestsPerMonth)} requests a month free`}
    />
  );
  const alerts = (
    <SignupCta
      cta={`${page}-${section}-alerts`}
      ghost={primaryRouter}
      next="/account/settings#email"
      label="Email me when it stops answering →"
      sub="Free account · provider alerts on any plan · an email after 20 minutes without an answer, and again when it comes back"
    />
  );
  return <CtaRow>{primaryRouter ? <>{router}{alerts}</> : <>{alerts}{router}</>}</CtaRow>;
}

export default async function ProviderStatusPage({ vendor }: { vendor: Vendor }) {
  const [data, roster] = await Promise.all([getProviders(), getRoster()]);
  const now = new Date();
  const nowMs = now.getTime();
  const p: ProviderStatus | null = providerStatusOf(data, vendor.key);
  const episodes: ProviderEpisode[] = episodesOf(data, vendor.key);
  const meta = data?.meta ?? META_FALLBACK;
  const interval = meta.checkIntervalMinutes;
  const days = meta.retentionDays;
  const copy = STATUS_COPY[vendor.key];
  const apiName = apiNameOf(vendor);
  const mention = vendorMention(vendor);
  const page = `status-${vendor.key}`;
  const h1 = H1_OF(vendor);
  const description = statusDescription(vendor, interval);
  const path = vendor.statusPath;

  /* ── the verdict and the figures ── */
  const verdict: Verdict | null = p ? verdictFor(p, episodes, meta, apiName, nowMs) : null;
  const isDown = verdict?.state === 'down';
  const median = p ? secs(p.medianLatencyMs) : null;
  const total24 = p ? p.checks24h + p.unmeasured24h : 0;
  const total7 = p ? p.checks7d + p.unmeasured7d : 0;
  const asOf = p ? utcStamp(p.lastChecked) : null;

  const outages = outagesOf(episodes);
  const slow = slowOf(episodes);
  const slowMinutes = slow.reduce((s, e) => s + e.minutes, 0);
  // The hub's our-side list is only worth pointing at while its start is inside the window this page shows.
  const ourFaultSince = meta.ourFaultSince && parseUtc(meta.ourFaultSince) > nowMs - days * 86_400_000 ? meta.ourFaultSince : null;

  /** "100% of checks answered — 143 measured of 143 checks" with the our-side remainder spelled out. */
  const answeredLine = (uptime: number | null, measured: number, unmeasured: number): string | null => {
    if (uptime === null) return measured === 0 && unmeasured > 0
      ? `No check could be made from our side (${unmeasured} ${unmeasured === 1 ? 'attempt' : 'attempts'}), so there is no figure: that says nothing about the ${apiName} API.`
      : null;
    const total = measured + unmeasured;
    return `${pct(uptime)} of checks answered — ${n(measured)} measured of ${n(total)} ${total === 1 ? 'check' : 'checks'}` +
      (unmeasured > 0 ? `; the other ${n(unmeasured)} could not be made from our side and count as neither uptime nor downtime.` : '.');
  };
  const line24 = p ? answeredLine(p.uptime24h, p.checks24h, p.unmeasured24h) : null;
  const line7 = p ? answeredLine(p.uptime7d, p.checks7d, p.unmeasured7d) : null;

  const uptimeFacts: [ReactNode, ReactNode][] = [];
  if (line24) uptimeFacts.push(['Last 24 hours', line24]);
  if (line7) uptimeFacts.push([`Last ${days} days`, line7]);
  if (median) uptimeFacts.push(['Median response, last 24 hours', `${median} to one short completion on our own key, from one machine in Germany. The median, not the mean, so one slow check from a machine that is often running a benchmark sweep at the same time does not describe the API.`]);
  if (p) {
    const last = secs(p.responseTime);
    const ours = p.status === 'unmeasured' || isOurSide(p.cause);
    uptimeFacts.push(['Last check', ours
      ? `${utcStamp(p.lastChecked)}: not measured, an issue on our side.`
      : `${utcStamp(p.lastChecked)}: ${STATE_TEXT[p.status].toLowerCase()}${last && p.status !== 'down' ? ` in ${last}` : ''}${p.status === 'down' && p.error ? ` (${p.error})` : ''}.`]);
  }

  /* ── models from this provider, from the roster ── */
  const models = modelsOfVendor(roster, vendor.key).sort(byDisplayName);
  const others = VENDORS.filter((v) => v.key !== vendor.key);

  /* ── the measurement, in rows ── */
  const measureFacts: [ReactNode, ReactNode][] = [
    ['The check', `${meta.probe} It asks for a short reply and runs every ${interval} minutes; a provider that has not answered within 60 seconds is recorded as not answering. The same call goes to every provider, so the pages are comparable.`],
    ['The endpoint', <><code>{vendor.apiHost}</code> — {copy.endpointNote}</>],
    ['Not probed', <>
      We do not probe {orList(copy.notProbed)}. This page says nothing about {copy.notProbed.length > 1 ? 'those surfaces' : 'that surface'}.{' '}
      {vendor.officialStatusUrl
        ? <>For them, see {vendor.label}&rsquo;s own status page, <a href={vendor.officialStatusUrl} rel="noopener">{vendor.officialStatusUrl.replace(/^https?:\/\//, '')}</a>.</>
        : <>This page is our own measurement, not a mirror of a vendor status page.</>}
    </>],
    ['When a check fails', 'We ask again fifteen seconds later and record the second answer, so one dropped connection is not published as ten minutes of outage. If the provider still cannot be reached, we test our own side before blaming theirs: whether our server stalled while the check was in flight, whether other providers failed to connect at the same moment, and whether two independent control endpoints answer. Any of those means the failure was ours: it is published as not measured and counts as neither uptime nor downtime.'],
    ['What “answered” means', <>The provider returned usable content. It does not mean the model was correct, fast or good; that is what the <Link href="/">benchmarks</Link> are for.</>],
    ['Where from', `One probe, every ${interval} minutes, from one machine in Germany, on one account. A provider can be down for us and up for you, or the reverse; if your own traffic disagrees with this page, trust your own traffic.`],
    ['The same data by API', <>GET <code>/api/v1/providers</code> and GET <code>/api/v1/analytics/provider-reliability</code> return these figures with a free Data API key; both are on the <Link href="/api-docs">API reference</Link>.</>],
  ];

  /* ── FAQ: one array feeds the visible rows and the FAQPage structured data ── */
  const officialHost = vendor.officialStatusUrl ? vendor.officialStatusUrl.replace(/^https?:\/\//, '') : null;
  const faq: FaqItem[] = [
    {
      q: `Is the ${apiName} API down right now?`,
      a: p && verdict
        ? `As of ${asOf}: ${verdict.sentence}` +
          (p.uptime24h !== null ? ` ${pct(p.uptime24h)} of the ${n(p.checks24h)} checks we could make in the last 24 hours were answered` : '') +
          (p.uptime7d !== null ? `${p.uptime24h !== null ? ', and' : ' In'} ${pct(p.uptime7d)} of ${n(p.checks7d)} over the last ${days} days` : '') +
          `. We check every ${interval} minutes and this page is rebuilt from the feed about once a minute.`
        : `The feed behind this page is not answering at the moment, which says nothing about the ${apiName} API. We check it every ${interval} minutes with one real completion to ${vendor.apiHost} on our own account; try again in a minute, or see every provider on [the status hub](/status).`,
    },
    {
      q: `How do you check whether the ${apiName} API is down?`,
      a: `${meta.probe} Every ${interval} minutes we send one short request to ${vendor.apiHost} and record whether usable content came back and how long it took; a provider that has not answered within 60 seconds is recorded as not answering. A failed check is tried again fifteen seconds later and only the second answer is recorded, so a single dropped connection is never published as ten minutes of outage. "Slow" means the reply took longer than ${Math.round(meta.degradedAboveMs / 1000)} seconds from our machine, so the median sits next to it. The record is kept for ${days} days.`,
    },
    {
      q: 'Why does it say "not measured"?',
      a: `Because the check failed on our side, not the provider's: an issue with our own account, our own request or our own server (its event loop frozen while the check was in flight, several providers failing to connect at the same moment, or two independent control endpoints not answering either). We publish those checks as not measured rather than hiding them, and they count as neither uptime nor downtime, so a problem of ours never shows up as ${vendor.label}'s downtime and the uptime figure only ever divides real observations.`,
    },
    {
      q: officialHost ? `Is this the same as ${officialHost}?` : `Is this the same as ${vendor.label}'s official status page?`,
      a: (officialHost
        ? `No. [${officialHost}](${vendor.officialStatusUrl}) is ${vendor.label}'s own report of its own services, incident by incident. `
        : `No. This page is not a mirror of a vendor status page. `) +
        `This page is an independent measurement: one real completion to ${vendor.apiHost} every ${interval} minutes from our own account, with every check we could make counted and every check we could not make listed separately. The two can disagree; when they do, the one that matches your own traffic is the one to trust.` +
        (officialHost ? ` For ${orList(copy.notProbed)}, which we do not probe, ${officialHost} is the place to look.` : ''),
    },
    {
      q: `Does this cover ${orList(copy.notProbed)}?`,
      a: `No. We probe ${vendor.apiHost} only: ${copy.endpointNote} ` +
        (vendor.officialStatusUrl ? `For ${orList(copy.notProbed)}, see [${officialHost}](${vendor.officialStatusUrl}).` : `${orList(copy.notProbed)} ${copy.notProbed.length > 1 ? 'are' : 'is'} outside what this page measures.`),
    },
    {
      q: `Can I get an alert when the ${apiName} API goes down?`,
      a: `Yes, on any plan. A free account can turn on provider outage emails in [account settings](/account/settings#email): when a provider you track or have connected keys for stops answering our checks for 20 minutes or more you get an email, and another when it answers again. ` +
        `The [Smart Router](/router) handles the outage itself: it skips a provider that is not answering and routes the request to the next best model, on your own provider keys, with ${n(FREE.routerRequestsPerMonth)} routed requests a month free.`,
    },
  ];

  /* ── structured data ── */
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Provider status', path: '/status' }, { name: vendor.label, path }]),
    webPageLd({
      path,
      name: h1,
      description,
      ...(p ? { dateModified: isoDay(p.lastChecked) } : data ? { dateModified: isoDay(data.generatedAt) } : {}),
    }),
    faqLd(faq),
  ]);

  return (
    <SubpageLayout>
      <div className={`lp lp-sub lp-status ps-provider ${lpBody.variable} ${lpDisplay.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: FAILSAFE }} />
        <LandingEffects />
        <JsonLd data={ld} />

        {/* ── Hero: the question, the verdict, the figures ── */}
        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <p className="lp-kicker lp-intro" style={intro('.04s')}>
              <Link href="/status" className="ps-crumb">Provider status</Link> · {mention}
            </p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
              Is the {apiName} API down <span className="lp-b">right now?</span>
            </h1>
            <div className="lp-hero-row">
              <div>
                {p && verdict ? (
                  <>
                    <p className={`ps-banner is-${verdict.tone} lp-intro`} style={intro('.18s')} role="status">
                      <span className="ps-dot" aria-hidden="true" />
                      <span className="ps-verdict"><b>{verdict.head}</b> {verdict.text}</span>
                    </p>
                    <AsOf className="lp-intro ps-asof">
                      As of {asOf} · one real completion to {vendor.apiHost} every {interval} minutes, on our own account
                    </AsOf>
                  </>
                ) : (
                  <p className="lp-lead lp-intro" style={intro('.18s')}>
                    The status feed is not responding at the moment. That says nothing about the {apiName} API, only
                    about this page: we check {vendor.apiHost} every {interval} minutes with one real completion on our
                    own account, and the record is back as soon as the feed answers.
                  </p>
                )}
                <p className="lp-lead lp-intro ps-lead" style={intro('.24s')}>
                  This is the {apiName} API as an application sees it: {vendor.apiHost}, not {orList(copy.notProbed)}.
                  Every check we could make is counted; every check we could not make is listed as not measured and
                  counts as neither uptime nor downtime.
                </p>
                <div className="lp-cta lp-intro" style={intro('.3s')}>
                  <OutageCtas page={page} section="hero" primaryRouter={isDown} />
                </div>
              </div>
              {p && (p.uptime24h !== null || p.uptime7d !== null || median) && (
                <dl className="lp-facts lp-intro" style={intro('.34s')}>
                  {p.uptime24h !== null && (
                    <div><dt>{pct(p.uptime24h)}</dt><dd>of the {n(p.checks24h)} checks we could make in the last 24 hours were answered</dd></div>
                  )}
                  {p.uptime7d !== null && (
                    <div><dt>{pct(p.uptime7d)}</dt><dd>answered over the last {days} days — {n(p.checks7d)} measured of {n(total7)} checks</dd></div>
                  )}
                  {median && (
                    <div><dt>{median}</dt><dd>median reply to one short completion over the last 24 hours, from our machine in Germany</dd></div>
                  )}
                </dl>
              )}
            </div>
          </div>
        </header>

        {/* ── Last 24 hours and 7 days ── */}
        <section className="lp-sec lp-A" aria-labelledby="ps-uptime">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Last 24 hours and {days} days</p>
              <h2 className="lp-h2" id="ps-uptime">{apiName} API uptime over the last 24 hours and {days} days</h2>
              <p className="lp-lead">
                &ldquo;Answered&rdquo; counts only the checks we could make, and the denominator is printed beside every
                figure. The median reply is our own round trip to {vendor.apiHost}.
              </p>
            </div>
            {uptimeFacts.length > 0 ? <RdFacts rows={uptimeFacts} /> : (
              <p className="lp-lead lp-up">The figures return as soon as the status feed answers; the method below does not change.</p>
            )}
            {p && p.hours.length > 0 && (
              <div className="ps-week-block">
                <h3 className="lp-h3 lp-up">Hour by hour, last {days} days</h3>
                <p className="lp-fine lp-up">
                  One cell per hour, in UTC. A check that failed on our side is hatched and counts as neither uptime nor
                  downtime; an hour with no check stays faint, so a gap in the record shows as a gap.
                </p>
                <WeekGrid hours={p.hours} now={now} label={`${apiName} API`} />
              </div>
            )}
          </div>
        </section>

        {/* ── Outages we recorded ── */}
        <section className="lp-sec lp-B" aria-labelledby="ps-outages">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">The record</p>
              <h2 className="lp-h2" id="ps-outages">{apiName} API outages in the last {days} days</h2>
              <p className="lp-lead">
                An outage here is a run of checks the {apiName} API did not answer, with the provider&rsquo;s own words
                for why. Only provider-caused failures are listed; anything that failed on our side is not an outage.
              </p>
            </div>
            {!data ? (
              <p className="lp-lead lp-up">The record returns as soon as the status feed answers.</p>
            ) : outages.length === 0 ? (
              <p className="ps-empty lp-up">
                <span className="ps-empty-dot" aria-hidden="true" />
                None in the last {days} days{p && p.uptime7d === 100 ? `: every check we could make was answered` : ''}.
              </p>
            ) : (
              <div className="rd-table-wrap is-narrow lp-up">
                <table className="rd-table ps-outage-table">
                  <caption className="seo-table-cap">Runs of checks the {apiName} API did not answer, newest first. Times in UTC.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Started</th>
                      <th scope="col">Ended</th>
                      <th scope="col" className="num">Lasted</th>
                      <th scope="col" className="num">Checks</th>
                      <th scope="col">What the API said</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outages.map((e, i) => (
                      <tr key={`${e.startedAt}-${i}`}>
                        <th scope="row">{stamp(e.startedAt)}</th>
                        <td>{e.ongoing ? <span className="lp-pill bad">Ongoing</span> : stamp(e.endedAt)}</td>
                        <td className="num">{duration(e.minutes)}</td>
                        <td className="num">{n(e.checks)}</td>
                        <td className="muted">{e.error ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {p && p.unmeasured7d > 0 && (
              <p className="ps-note ps-ours lp-up">
                {n(p.unmeasured7d)} of the {n(total7)} checks in the last {days} days could not be made from our side.
                They are published as not measured and count as neither uptime nor downtime
                {ourFaultSince ? <>; that list is kept from {dayLabel(ourFaultSince)} on the <Link href="/status">status hub</Link></> : <>; the list is on the <Link href="/status">status hub</Link></>}.
              </p>
            )}

            {slow.length > 0 && (
              <div className="ps-slow lp-up">
                <h3 className="lp-h3">Slow periods</h3>
                <p className="ps-note">
                  {slow.length} {slow.length === 1 ? 'period' : 'periods'} of two or more consecutive checks slower than{' '}
                  {Math.round(meta.degradedAboveMs / 1000)} seconds in the last {days} days, {duration(slowMinutes)} in all. Measured
                  from our machine, which is often running a benchmark sweep at the same time, so read these next to the
                  median above rather than on their own.
                  {slow.length > SLOW_SHOWN ? ` The ${SLOW_SHOWN} most recent are listed.` : ''}
                </p>
                <ul className="ps-log is-warn">
                  {slow.slice(0, SLOW_SHOWN).map((e, i) => (
                    <li key={`${e.startedAt}-${i}`}>
                      <span className="ps-log-p">{stamp(e.startedAt)}</span>
                      <span className="ps-log-dur">lasted {duration(e.minutes)}</span>
                      <span className="ps-log-when">{n(e.checks)} checks slower than {Math.round(meta.degradedAboveMs / 1000)} s{e.ongoing ? ' — ongoing' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ── What we measure, and what we do not ── */}
        <section className="lp-sec lp-A" aria-labelledby="ps-measure">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Method</p>
              <h2 className="lp-h2" id="ps-measure">What does this page measure, and what does it not?</h2>
              <p className="lp-lead">
                One real completion, not a ping and not a mirror of {vendor.label}&rsquo;s own status page. The same check
                goes to every provider we benchmark, so every provider&rsquo;s page is comparable.
              </p>
            </div>
            <RdFacts rows={measureFacts} />
          </div>
        </section>

        {/* ── Error codes ── */}
        <section className="lp-sec lp-B" aria-labelledby="ps-codes">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Reference</p>
              <h2 className="lp-h2" id="ps-codes">What do {apiName} API error codes mean?</h2>
              <p className="lp-lead">
                What the codes mean in the providers&rsquo; own documentation, so an account problem is not mistaken for an
                outage. A reference, not a measurement from our probe.
              </p>
            </div>
            <div className="rd-table-wrap is-narrow lp-up">
              <table className="rd-table ps-codes-table">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Meaning</th>
                    <th scope="col">What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map(([code, meaning, what]) => (
                    <tr key={code}>
                      <th scope="row"><code>{code}</code></th>
                      <td>{meaning}</td>
                      <td className="muted">{what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {copy.codesNote && <p className="ps-note lp-up">{copy.codesNote}</p>}
          </div>
        </section>

        {/* ── What to do during an outage ── */}
        <section className="lp-sec lp-A" aria-labelledby="ps-outage-plan">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">During an outage</p>
              <h2 className="lp-h2" id="ps-outage-plan">What should I do when the {apiName} API is down?</h2>
              <p className="lp-lead">
                Confirm it is the service and not your account, retry the way the codes above say, and route around it
                until it answers again.
              </p>
            </div>
            <ol className="lp-steps">
              {[
                { title: 'Separate the account from the service', detail: `A 401, 403 or a 429 that mentions quota or billing is your key or your account, and no status page will show it. A 5xx, a timeout or a 429 rate limit is the service. This page shows what ${vendor.apiHost} answered to our own account at the same time.` },
                { title: 'Retry with backoff, briefly', detail: 'For 429 and 5xx, wait and retry with exponential backoff and a cap. If the failures persist across requests, stop retrying: you are adding load to a provider that is already struggling and latency to your own users.' },
                { title: 'Route around it', detail: `The Smart Router is one OpenAI-compatible endpoint over every provider we benchmark. It skips a provider that is not answering and sends the request to the next best model, on your own provider keys, with your fallback order if you set one. ${n(FREE.routerRequestsPerMonth)} routed requests a month are free.` },
                { title: 'Be told when it is over', detail: 'Turn on provider outage emails: one when a provider you track or have connected keys for stops answering our checks for 20 minutes or more, and another when it answers again. Free account, any plan.' },
              ].map((s, i) => (
                <li key={s.title} {...up(`${i * 0.08}s`, 'lp-step')}>
                  <p className="lp-step-n">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="lp-h3">{s.title}</h3>
                  <p>{s.detail}</p>
                </li>
              ))}
            </ol>
            <div className="ps-ctas lp-up">
              <OutageCtas page={page} section="outage" primaryRouter />
              <p className="lp-fine">
                <Link href="/router/docs" data-cta={`${page}-outage-router-docs`}>How fallbacks work in the Smart Router</Link>
              </p>
            </div>
          </div>
        </section>

        {/* ── Models from this provider ── */}
        <section className="lp-sec lp-B" aria-labelledby="ps-models">
          <div className="lp-wrap">
            <div className="lp-head lp-head-split lp-up">
              <p className="lp-kicker">Models</p>
              <h2 className="lp-h2" id="ps-models">Which {apiName} models does AI Stupid Level benchmark?</h2>
              <p className="lp-lead">
                Every {mention} model on the board is called through {vendor.apiHost} and gets the same tasks as every
                other vendor&rsquo;s models: coding every four hours, reasoning and tool use daily, with an hourly canary
                probe. Each has its own page with its 24-hour scores and places.
              </p>
            </div>
            {models.length > 0 ? (
              <ul className="rd-tags lp-up" aria-label={`${apiName} models tracked`}>
                {models.map((m) => <li key={m.slug}><Link href={`/models/${m.slug}`} data-cta={`${page}-models-${m.slug}`}>{m.displayName}</Link></li>)}
              </ul>
            ) : (
              <p className="lp-lead lp-up">The current list is on the <Link href="/">leaderboard</Link>.</p>
            )}
            <p className="ps-links lp-up">
              <Link href={vendor.modelsPath} className="lp-more" data-cta={`${page}-models-vendor`}>All {apiName} models on the same tests</Link>
              {vendor.worsePath && <Link href={vendor.worsePath} className="lp-more" data-cta={`${page}-models-worse`}>Is {apiName === 'OpenAI' ? 'ChatGPT' : apiName} getting worse?</Link>}
              <Link href="/compare" className="lp-more" data-cta={`${page}-models-compare`}>Compare models head to head</Link>
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="lp-sec lp-A" aria-labelledby="ps-faq">
          <div className="lp-wrap lp-faq">
            <div className="lp-head lp-up">
              <p className="lp-kicker">FAQ</p>
              <h2 className="lp-h2" id="ps-faq">Questions about {apiName} API status</h2>
              {asOf && <p className="lp-fine">Answers computed from the feed as of {asOf}.</p>}
            </div>
            <Faq items={faq} />
          </div>
        </section>

        {/* ── The other providers ── */}
        <section className="lp-sec lp-C" aria-labelledby="ps-others">
          <div className="lp-wrap">
            <div className="lp-head lp-up">
              <p className="lp-kicker">Every provider</p>
              <h2 className="lp-h3 ps-h-small" id="ps-others">Other providers we check every {interval} minutes</h2>
            </div>
            <ul className="rd-tags ps-provnav lp-up" aria-label="Provider status pages">
              <li><Link href="/status" data-cta={`${page}-others-hub`}>All providers</Link></li>
              {others.map((v) => (
                <li key={v.key}>
                  <Link href={v.statusPath} data-cta={`${page}-others-${v.key}`}>
                    <Logo provider={v.key} />{PROVIDER_PAGES.find((x) => x.key === v.key)?.name ?? `${v.label} API status`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <RdFinal
          title="Hear it from the probe, not from your users"
          lead={`Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${n(FREE.routerRequestsPerMonth)} routed requests a month and a Data API key. No card.`}
          actions={(
            <CtaRow>
              <SignupCta cta={`${page}-final-alerts`} next="/account/settings#email" label="Email me when it stops answering →" sub="Provider outage emails on any plan, for the providers you track or have connected keys for" />
              <LeaderboardCta cta={`${page}-final-leaderboard`} ghost />
            </CtaRow>
          )}
        />
      </div>
    </SubpageLayout>
  );
}
