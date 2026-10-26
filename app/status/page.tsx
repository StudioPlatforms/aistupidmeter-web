import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import SubpageLayout from '@/components/SubpageLayout';
import StatusBoard from '@/components/landing/StatusBoard';
import LandingEffects from '@/components/landing/LandingEffects';
import { RdFacts } from '@/components/landing/Reading';
import { CtaRow, LeaderboardCta, RouterCta, SignupCta } from '@/components/seo/Cta';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf } from '@/components/seo/Verdict';
import { Faq, type FaqItem } from '@/components/seo/pair/Faq';
import { DEFAULT_INTERVAL_MIN, HUB_KEYWORDS, PROVIDER_PAGES, apiNameOf, hubDescription, hubTitle } from '@/components/seo/status/status-meta';
import {
  CAUSE_TEXT, LABELS, STATE_TEXT, STATE_TONE, ago, boardRow, byOrder, duration, groupEpisodes, isOurSide,
  labelOf, latestCheck, parseUtc, pct, secs,
} from '@/components/seo/status/status-utils';
import { PLANS } from '@/lib/entitlements';
import { lpBody, lpDisplay } from '@/lib/fonts';
import { breadcrumbLd, dayLabel, faqLd, graphLd, isoDay, itemListLd, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, getProviders, vendorByKey, type ProviderStatus } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/status-page.css';

/**
 * Public provider status: the hub of the six /status/<provider> pages.
 *
 * The health monitor has probed every provider every ten minutes for a year and the
 * result was rendered nowhere: the one component that read it (`StupidMeter`) is
 * imported and never mounted, and the homepage strip that looks like a status display
 * is computed from benchmark score trends, not availability.
 *
 * The hard part of this page is not the chart. It is refusing to overclaim. We probe
 * from ONE machine, with OUR key, once every ten minutes. So:
 *
 *   - a check that failed because our own key was rejected or our own bill was unpaid
 *     is reported as "not measured", never as the provider being down;
 *   - so is a check that came back empty because our probe asked a thinking model for
 *     one token — which is exactly what made Google look dead for 27 hours this week,
 *     and which this page shows rather than hides;
 *   - "slow" is our round-trip latency from a box that is often running a benchmark
 *     sweep at the same time, so the median sits next to it.
 *
 * Everything here comes from GET /providers/status, which does that classification and
 * also turns each provider's JSON error body into a sentence (summariseProviderError),
 * so the page and the outage email show the same words. The helpers that render it are
 * shared with the per-provider pages (components/seo/status/status-utils.ts), so the two
 * can never describe the same check differently.
 */

/** One minute: the check cadence is ten, so anything finer is just load. No auth(), so the page stays ISR. */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getProviders();
  const interval = data?.meta.checkIntervalMinutes ?? DEFAULT_INTERVAL_MIN;
  return pageMeta({ title: hubTitle(interval), description: hubDescription(interval), path: '/status', keywords: HUB_KEYWORDS });
}

const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
const intro = (d: string): CSSProperties => ({ '--d': d } as CSSProperties);

/** "OpenAI, Anthropic and Google". */
const andList = (xs: string[]): string => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

function Logo({ provider }: { provider: string }) {
  return (
    <span className="lp-lgc" aria-hidden="true">
      <img src={`/logos/${provider}.svg`} alt="" width={18} height={18} loading="lazy" />
    </span>
  );
}

/** The landing page's look (styles/landing.css) inside the site's own top bar, like /ai-drift-detection. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <SubpageLayout>
      <div className={`lp lp-sub lp-status ${lpBody.variable} ${lpDisplay.variable}`}>
        {/* Reveal-on-scroll hides blocks only once scripts run; the failsafe shows everything if they never do. */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var d=document.documentElement;d.classList.add('lp-js');setTimeout(function(){if(!window.__lpReady)d.classList.remove('lp-js')},4000)})();" }} />
        <LandingEffects />
        {children}
      </div>
    </SubpageLayout>
  );
}

const statusPathOf = (provider: string): string => vendorByKey(provider)?.statusPath ?? '/status';

export default async function StatusPage() {
  const data = await getProviders();
  const now = new Date();
  const nowMs = now.getTime();

  if (!data) {
    return (
      <Shell>
        <header className="lp-hero lp-textured">
          <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="lp-wrap">
            <p className="lp-kicker lp-intro" style={intro('.04s')}>Provider status</p>
            <h1 className="lp-h1 lp-intro" style={intro('.1s')}>Is your AI provider down <span className="lp-b">right now?</span></h1>
            <p className="lp-lead lp-intro" style={intro('.18s')}>
              The status feed is not responding at the moment. That says nothing about the providers,
              only about this page.
            </p>
            <ul className="rd-tags ps-provnav lp-intro" style={intro('.26s')} aria-label="Provider status pages">
              {VENDORS.map((v) => <li key={v.key}><Link href={v.statusPath}><Logo provider={v.key} />{apiNameOf(v)} API status</Link></li>)}
            </ul>
          </div>
        </header>
      </Shell>
    );
  }

  const interval = data.meta.checkIntervalMinutes;
  const days = data.meta.retentionDays;
  const total = data.providers.length;
  // Defensive: the feed already publishes our-side failures as "unmeasured", never "down".
  const ours = (p: ProviderStatus) => p.status === 'unmeasured' || isOurSide(p.cause);
  const notAnswering = data.providers.filter((p) => p.status === 'down' && !ours(p));
  const unmeasured = data.providers.filter(ours);
  // A slow provider answered: it counts as answering everywhere on the page and is named as slow in the banner.
  const slowNow = data.providers.filter((p) => p.status === 'degraded' && !ours(p));
  const answering = total - notAnswering.length - unmeasured.length;
  const latest = latestCheck(data.providers) ?? data.generatedAt;
  const names = (ps: ProviderStatus[]): string => andList(ps.map((p) => labelOf(p.provider)));

  const outages = data.episodes.filter((e) => e.kind === 'down' && e.cause === 'provider');
  const notMeasured = data.episodes.filter((e) => isOurSide(e.cause));
  const slow = data.episodes.filter((e) => e.cause === 'latency');
  // The our-side list is only worth dating while its start is inside the window the page shows.
  const ourFaultSince = data.meta.ourFaultSince && parseUtc(data.meta.ourFaultSince) > nowMs - days * 86_400_000
    ? data.meta.ourFaultSince : null;

  const slowClause = slowNow.length ? `; ${names(slowNow)} answered slowly` : '';
  const headline =
    notAnswering.length > 0
      ? `${names(notAnswering)} did not answer our last check${slowClause}`
      : unmeasured.length > 0
        ? `${answering} of ${total} providers answered the last check; ${unmeasured.length} could not be measured${slowClause}`
        : `All ${total} providers answered the last check${slowClause}`;
  const tone = notAnswering.length ? 'is-bad' : unmeasured.length ? 'is-na' : slowNow.length ? 'is-warn' : 'is-ok';
  const anyDown = notAnswering.length > 0;

  /* ── the provider table: board order; a figure we do not have is a blank cell plus a note, never a dash ── */
  const rows = [...data.providers].sort(byOrder);
  const notes: ReactNode[] = [];
  for (const p of rows) {
    const total24 = p.checks24h + p.unmeasured24h;
    const name = labelOf(p.provider);
    if (total24 === 0) notes.push(<><b>{name}</b>: no checks in the last 24 hours.</>);
    else if (p.unmeasured24h > 0) {
      notes.push(<><b>{name}</b>: {n(p.unmeasured24h)} of the {n(total24)} checks in the last 24 hours failed on our side and count as neither uptime nor downtime.</>);
    }
    // Our own failures arrive from the API as one neutral sentence (routes/health.ts); a provider's words are quoted as its last error.
    if (p.status !== 'operational' && p.error) {
      notes.push(ours(p)
        ? <><b>{name}</b>: <span className="ps-note-err">{p.error}</span></>
        : <><b>{name}</b>, last error: <span className="ps-note-err">{p.error}</span></>);
    }
  }

  /* ── method, in rows ── */
  const methodFacts: [ReactNode, ReactNode][] = [
    ['The check', `${data.meta.probe} It is the same call for every provider, so the numbers are comparable.`],
    ['What “answered” means', <>The provider returned usable content. It does not mean the model was correct, fast or good; that is what the <Link href="/">benchmarks</Link> are for.</>],
    ['When a check fails', 'We ask again fifteen seconds later and record the second answer, so one dropped connection is not published as ten minutes of outage. If the provider still cannot be reached, we test our own side before blaming theirs: whether our server stalled while the check was in flight, whether other providers failed to connect at the same moment, and whether two independent control endpoints answer. Any of those means the failure was ours: it is listed under checks we could not make and counts as neither uptime nor downtime.'],
    ['What we do not claim', `One probe, every ${interval} minutes, from one machine in Germany, on one account. A provider can be down for us and up for you, or the reverse. If your own traffic disagrees with this page, trust your own traffic.`],
    ['When a provider is down', 'We stop benchmarking it rather than publishing a number we did not measure, and run the missed models as soon as it answers again. An outage leaves a gap in the charts, and that gap is deliberate.'],
    ['The same data by API', <>GET <code>/api/v1/providers</code> and GET <code>/api/v1/analytics/provider-reliability</code> return these figures with a free Data API key; both are on the <Link href="/api-docs">API reference</Link>.</>],
  ];

  /* ── FAQ: one array feeds the visible rows and the FAQPage structured data ── */
  const officialPages = VENDORS.filter((v) => v.officialStatusUrl);
  const faq: FaqItem[] = [
    {
      q: 'Is OpenAI, Anthropic or Google down right now?',
      a: `As of ${utcStamp(latest)}, ${answering} of ${total} providers answered our last check` +
        (slowNow.length ? ` (${names(slowNow)} slowly)` : '') +
        (notAnswering.length ? `; ${names(notAnswering)} did not answer` : '') +
        (unmeasured.length ? `; ${names(unmeasured)} could not be measured from our side, which says nothing about ${unmeasured.length === 1 ? 'that provider' : 'those providers'}` : '') +
        `. Each provider has its own page with the last 24 hours and ${days} days: ` +
        VENDORS.map((v) => `[${apiNameOf(v)}](${v.statusPath})`).join(', ') + '.',
    },
    {
      q: 'How do you check whether an AI provider is down?',
      a: `${data.meta.probe} Every ${interval} minutes we send the same short request to every provider's API on our own account and record whether usable content came back and how long it took; a provider that has not answered within 60 seconds is recorded as not answering. A failed check is tried again fifteen seconds later and only the second answer is recorded, so one dropped connection is never published as ten minutes of outage. "Slow" means the reply took longer than ${Math.round(data.meta.degradedAboveMs / 1000)} seconds from our machine, so the median sits next to it. The record is kept for ${days} days.`,
    },
    {
      q: 'Why does a provider say "not measured"?',
      a: 'Because the check failed on our side, not the provider\'s: an issue with our own account, our own request or our own server (its event loop frozen while the check was in flight, several providers failing to connect at the same moment, or two independent control endpoints not answering either). We publish those checks as not measured rather than hiding them, and they count as neither uptime nor downtime, so a problem of ours never shows up as somebody else\'s downtime and the uptime figures only ever divide real observations.',
    },
    {
      q: 'Is this the same as the providers\' official status pages?',
      a: 'No. An official status page is the provider\'s own report of its own services. This page is an independent measurement: one real completion to each API on our own account, every ' +
        `${interval} minutes, with every check we could make counted and every check we could not make listed separately. The two can disagree; when they do, the one that matches your own traffic is the one to trust. ` +
        (officialPages.length ? `The official pages we know of: ${officialPages.map((v) => `[${v.officialStatusUrl!.replace(/^https?:\/\//, '')}](${v.officialStatusUrl})`).join(', ')}. ` : '') +
        'The same figures are on the Data API as GET /api/v1/providers and GET /api/v1/analytics/provider-reliability, documented on the [API reference](/api-docs).',
    },
    {
      q: 'Can I get an email when a provider goes down?',
      a: `Yes, on any plan. A free account can turn on provider outage emails in [account settings](/account/settings#email): when a provider you track or have connected keys for stops answering our checks for 20 minutes or more you get an email, and another when it answers again. ` +
        `The [Smart Router](/router) handles the outage itself: it skips a provider that is not answering and routes the request to the next best model, on your own provider keys, with ${n(FREE.routerRequestsPerMonth)} routed requests a month free.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Provider status', path: '/status' }]),
    webPageLd({ path: '/status', name: 'Is your AI provider down right now?', description: hubDescription(interval), type: 'CollectionPage', dateModified: isoDay(latest) }),
    itemListLd({ name: 'AI provider status pages', items: PROVIDER_PAGES.map((p) => ({ name: p.name, url: p.path })) }),
    faqLd(faq),
  ]);

  return (
    <Shell>
      <JsonLd data={ld} />
      <header className="lp-hero lp-textured">
        <div className="lp-streaks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="lp-wrap">
          <div className="lp-hero-row">
            <div>
              <p className="lp-kicker lp-intro" style={intro('.04s')}>Provider status</p>
              <h1 className="lp-h1 lp-intro" style={intro('.1s')}>
                Is your AI provider down <span className="lp-b">right now?</span>
              </h1>
              <p className="lp-lead lp-intro ps-lead-count" style={intro('.18s')}>
                <b>{answering} of {total} providers answering</b>. We ask every provider one small question every{' '}
                {interval} minutes and record what comes back. This is that record, kept for {days} days, with a page
                for each provider.
              </p>
              <p className={`ps-banner ${tone} lp-intro`} style={intro('.26s')} role="status">
                <span className="ps-dot" aria-hidden="true" />
                <b>{headline}</b>
                <span className="ps-when">checked {ago(latest, nowMs)}</span>
              </p>
              <AsOf className="lp-intro ps-asof">
                As of {utcStamp(latest)} · one real completion to each provider&rsquo;s API every {interval} minutes, on our own account
              </AsOf>
              <div className="ps-hero-ctas lp-intro" style={intro('.3s')}>
                {anyDown ? (
                  <>
                    <CtaRow>
                      <RouterCta
                        cta="status-hero-router"
                        label="Route around it with the Smart Router →"
                        sub={`Skips a provider that is not answering and routes to the next best model · your own keys · ${n(FREE.routerRequestsPerMonth)} requests a month free`}
                      />
                      <SignupCta
                        cta="status-hero-alerts"
                        ghost
                        next="/account/settings#email"
                        label="Email me when it stops answering →"
                        sub="Free account · provider alerts on any plan"
                      />
                    </CtaRow>
                    <p className="lp-fine"><Link href="/router/docs" data-cta="status-hero-router-docs">How fallbacks work in the Smart Router</Link></p>
                  </>
                ) : (
                  <CtaRow>
                    <SignupCta
                      cta="status-hero-alerts"
                      next="/account/settings#email"
                      label="Email me when a provider stops answering →"
                      sub="Free account · provider alerts on any plan · an email after 20 minutes without an answer, and again when it comes back"
                    />
                    <LeaderboardCta cta="status-hero-leaderboard" ghost />
                  </CtaRow>
                )}
              </div>
            </div>
            <dl className="lp-facts lp-intro" style={intro('.34s')}>
              <div><dt>{answering}/{total}</dt><dd>providers answered the last check</dd></div>
              <div><dt>{interval} min</dt><dd>between checks, the same call for every provider</dd></div>
              <div><dt>{days} d</dt><dd>of record kept, with the checks we could not make listed separately</dd></div>
            </dl>
          </div>
        </div>
      </header>

      {/* ── The board ─────────────────────────────────────────────────── */}
      <section className="lp-sec lp-A">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">Last {days} days</p>
            <h2 className="lp-h2">Which AI providers are up? The last {days} days, hour by hour</h2>
            <p className="lp-lead">
              Each bar is one hour of checks. A check that failed on our side is hatched and counts as neither uptime
              nor downtime, and an hour with no check at all stays empty, so a gap in the record shows as a gap.
            </p>
          </div>
          <StatusBoard providers={data.providers.map((p) => boardRow(p, now))} wording="status" labels={LABELS} />
        </div>
      </section>

      {/* ── Providers ─────────────────────────────────────────────────── */}
      <section className="lp-sec lp-B" aria-labelledby="ps-by-provider">
        <div className="lp-wrap">
          <div className="lp-head lp-head-split lp-up">
            <p className="lp-kicker">By provider</p>
            <h2 className="lp-h2" id="ps-by-provider">Which AI provider is down? The last 24 hours and 7 days</h2>
            <p className="lp-lead">
              &ldquo;Answered&rdquo; counts only the checks we could make; the last column is the denominator. The median
              reply is our round trip, from a machine that is often running a benchmark sweep at the same time. Each
              name opens the provider&rsquo;s own page.
            </p>
          </div>
          <div className="rd-table-wrap is-narrow lp-up">
            <table className="rd-table ps-prov-table">
              <caption>
                Every provider&rsquo;s last check, share of checks answered over 24 hours and {days} days, and median reply,
                as of {utcStamp(latest)}. A figure we do not have is left blank; the notes under the table say why.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Last check</th>
                  <th scope="col" className="num">Answered, 24h</th>
                  <th scope="col" className="num">Answered, {days}d</th>
                  <th scope="col" className="num">Median reply, 24h</th>
                  <th scope="col" className="num">Checks measured, 24h</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const total24 = p.checks24h + p.unmeasured24h;
                  const median = secs(p.medianLatencyMs);
                  return (
                    <tr key={p.provider}>
                      <th scope="row">
                        <Link href={statusPathOf(p.provider)} data-cta={`status-table-${p.provider}`}>
                          <Logo provider={p.provider} />{labelOf(p.provider)}
                        </Link>
                      </th>
                      <td>
                        <span className={`lp-pill ${STATE_TONE[p.status]}`}>{STATE_TEXT[p.status]}</span>
                        <span className="ps-cell-when">{ago(p.lastChecked, nowMs)}</span>
                      </td>
                      <td className="num">{p.uptime24h !== null ? pct(p.uptime24h) : ''}</td>
                      <td className="num">{p.uptime7d !== null ? pct(p.uptime7d) : ''}</td>
                      <td className="num">{median ?? ''}</td>
                      <td className="num">{total24 > 0 ? `${n(p.checks24h)} of ${n(total24)}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {notes.length > 0 && (
            <ul className="ps-table-notes lp-up">
              {notes.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </div>
      </section>

      {/* ── What we recorded ──────────────────────────────────────────── */}
      <section className="lp-sec lp-A">
        <div className="lp-wrap">
          <div className="lp-head lp-up">
            <p className="lp-kicker">The record</p>
            <h2 className="lp-h2">Which AI provider outages did we record in the last {days} days?</h2>
          </div>

          <div className="ps-block lp-up">
            <div>
              <h3>Outages we recorded</h3>
            </div>
            {outages.length === 0 ? (
              <p className="ps-empty">
                <span className="ps-empty-dot" aria-hidden="true" />
                No provider failed to answer in the last {days} days.
              </p>
            ) : (
              <ul className="ps-log is-bad">
                {outages.map((e, i) => (
                  <li key={i}>
                    <span className="ps-log-p"><Logo provider={e.provider} /><Link href={statusPathOf(e.provider)}>{labelOf(e.provider)}</Link></span>
                    <span className="ps-log-dur">lasted {duration(e.minutes)}</span>
                    <span className="ps-log-when">
                      {utcStamp(e.startedAt)}{e.ongoing ? ' — ongoing' : ''}
                    </span>
                    {e.error && <span className="ps-log-err">{e.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ps-block lp-up">
            <div>
              <h3>Checks we could not make</h3>
              <p className="ps-note">
                These were issues on our side, not the providers&rsquo;. We list them so that a problem of ours never
                shows up as somebody else&rsquo;s downtime, and because a gap in the record is a fact about the
                record. Each line says how long it
                lasted and when it last happened: anything not marked ongoing is over, and stays listed
                only until it falls out of the {days}-day window.
                {ourFaultSince && (
                  <> This list starts from {dayLabel(ourFaultSince)}; earlier checks are still recorded and still
                  count in the uptime figures.</>
                )}
              </p>
            </div>
            {notMeasured.length === 0 ? (
              <p className="ps-empty">
                <span className="ps-empty-dot" aria-hidden="true" />
                None in the last {days} days.
              </p>
            ) : (
              <ul className="ps-log is-ours">
                {groupEpisodes(notMeasured).map((g, i) => (
                  <li key={i}>
                    <span className="ps-log-p"><Logo provider={g.provider} />{labelOf(g.provider)}</span>
                    <span className="ps-log-dur">lasted {duration(g.minutes)}</span>
                    <span className="ps-log-when">
                      {CAUSE_TEXT[g.cause]} · {g.episodes} episode{g.episodes === 1 ? '' : 's'}
                      {g.ongoing
                        ? ' — ongoing'
                        : g.lastEndedAt
                          ? ` · last seen ${ago(g.lastEndedAt, nowMs)}, since resolved`
                          : ''}
                    </span>
                    {g.error && <span className="ps-log-err">{g.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {slow.length > 0 && (
            <div className="ps-block lp-up">
              <div>
                <h3>Slow periods</h3>
                <p className="ps-note">
                  Two or more consecutive checks that took longer than {(data.meta.degradedAboveMs / 1000).toFixed(0)}{' '}
                  seconds. Measured from our machine, which is often running a benchmark sweep at the same time, so
                  read these next to the median above rather than on their own.
                </p>
              </div>
              <ul className="ps-log is-warn">
                {groupEpisodes(slow).map((g, i) => (
                  <li key={i}>
                    <span className="ps-log-p"><Logo provider={g.provider} />{labelOf(g.provider)}</span>
                    <span className="ps-log-dur">lasted {duration(g.minutes)}</span>
                    <span className="ps-log-when">
                      {g.episodes} episode{g.episodes === 1 ? '' : 's'} in the last {days} days
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ── Method ────────────────────────────────────────────────────── */}
      <section className="lp-sec lp-C" aria-labelledby="ps-method">
        <div className="lp-wrap lp-faq">
          <div className="lp-head lp-up">
            <p className="lp-kicker">Method</p>
            <h2 className="lp-h2" id="ps-method">How is AI provider status measured here?</h2>
          </div>
          <RdFacts rows={methodFacts} />
          <p className="ps-gen lp-up">
            Figures generated {utcStamp(data.generatedAt)}; this page is rebuilt from the feed about once a minute.
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="lp-sec lp-B" aria-labelledby="ps-faq">
        <div className="lp-wrap lp-faq">
          <div className="lp-head lp-up">
            <p className="lp-kicker">FAQ</p>
            <h2 className="lp-h2" id="ps-faq">Questions about AI provider status</h2>
            <p className="lp-fine">Answers computed from the feed as of {utcStamp(latest)}.</p>
          </div>
          <Faq items={faq} />
        </div>
      </section>

      {/* ── Every provider ────────────────────────────────────────────── */}
      <section className="lp-sec lp-A" aria-labelledby="ps-pages">
        <div className="lp-wrap">
          <div className="lp-head lp-up">
            <p className="lp-kicker">By provider</p>
            <h2 className="lp-h3 ps-h-small" id="ps-pages">One page per provider, checked every {interval} minutes</h2>
          </div>
          <ul className="rd-tags ps-provnav lp-up" aria-label="Provider status pages">
            {VENDORS.map((v) => (
              <li key={v.key}>
                <Link href={v.statusPath} data-cta={`status-pages-${v.key}`}><Logo provider={v.key} />{apiNameOf(v)} API status</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Shell>
  );
}
