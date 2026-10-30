import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, RouterCta, WatchCta } from '@/components/seo/Cta';
import { WorseFaq, type WorseFaqItem } from '@/components/seo/worse/WorseFaq';
import { ALERT_RULE, CADENCE, FREE_TIER } from '@/components/seo/worse/WorsePage';
import { listJoin, numWord } from '@/components/seo/worse/worse-data';
import { isWorseVendor, worseH1, worsePath } from '@/components/seo/worse/worse-meta';
import { TrackerLog } from '@/components/seo/tracker/TrackerLog';
import { TrackerTable } from '@/components/seo/tracker/TrackerTable';
import { familySentence, getTrackerData, statusSentence, trackerCounts } from '@/components/seo/tracker/tracker-data';
import { PLANS } from '@/lib/entitlements';
import { breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, vendorMention } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-worse.css';
import '@/styles/seo-tracker.css';

/**
 * The AI degradation tracker: every model on the board with each suite's Page-Hinkley verdict,
 * how close the detector's statistic is to its threshold, the 24-hour board's own early warning,
 * the hourly canary's state and its dated alarms over the last 30 days, grouped by family. It is
 * the live view of the method on /ai-drift-detection, and it shows the two signals drift-aware
 * routing acts on, so the Smart Router section describes the router's real rule
 * (apps/api router/selector/drift-flags.ts and index.ts).
 *
 * Static copy names vendors and families only; every model, state, count and date is read at
 * render time (components/seo/tracker/tracker-data.ts). ISR every fifteen minutes; no auth(),
 * cookies() or headers(). A feed that does not answer leaves its block out, never a placeholder.
 */

const PATH = '/ai-degradation-tracker';
const TITLE = 'AI degradation tracker: live LLM drift status';
const HEADLINE = 'AI degradation tracker: is any model getting worse right now?';
const DESCRIPTION = 'Live AI model degradation tracker for GPT, Claude, Gemini, DeepSeek, Kimi and GLM: a drift detector per suite, an hourly canary and dated alarms.';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    'AI degradation tracker',
    'LLM degradation tracker',
    'model degradation tracker',
    'AI model degradation tracker',
    'AI performance tracker',
    'LLM performance tracker',
    'GPT degradation tracker',
    'Claude degradation tracker',
    'Opus degradation tracker',
    'Gemini degradation tracker',
    'DeepSeek degradation tracker',
    'AI model degradation',
    'LLM degradation',
    'LLM drift tracker',
    'AI drift alerts',
    'is AI getting worse',
    'is Claude nerfed',
    'AI model nerf tracker',
    'model drift monitoring',
  ],
});

export const revalidate = 900;

const FREE = PLANS.free;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const VENDOR_LIST = listJoin(VENDORS.map(vendorMention));

const TOC = [
  { id: 'now', label: 'Status now' },
  { id: 'models', label: 'Model by model' },
  { id: 'alarms', label: 'Canary alarms' },
  { id: 'read', label: 'How to read it' },
  { id: 'router', label: 'Smart Router' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function AiDegradationTrackerPage(): Promise<JSX.Element> {
  const data = await getTrackerData();
  const c = trackerCounts(data);
  const stamp = data.asOf ? utcStamp(data.asOf) : null;
  const funded = data.rows.filter((r) => r.model.community.length > 0).length;
  const status = statusSentence(data);
  const familyAnswers = data.groups.map(familySentence).join(' ');
  // "[is ChatGPT getting worse](/is-chatgpt-getting-worse)": the family pages' own questions, first letter lowered.
  const worseLinks = VENDORS.map((v) => v.key).filter(isWorseVendor).map((k) => {
    const q = worseH1(k).replace(/\?$/, '');
    return `[${q.charAt(0).toLowerCase()}${q.slice(1)}](${worsePath(k)})`;
  });

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: WorseFaqItem[] = [
    {
      q: 'What is an AI degradation tracker?',
      a: `A page that re-tests AI models on fixed tasks and tells you when one has got worse. This one covers ${c.models > 0 ? `the ${c.models} models` : 'every model'} on the AI Stupid Level board, from ${VENDOR_LIST}, through each provider’s own API: ${CADENCE}. Every suite has its own detector, run against the model’s own past, so a decline shows up as a dated measurement rather than a hunch.`,
    },
    {
      q: 'How do you know a model got worse, and not just had a bad day?',
      a: 'One bad run proves nothing: model output varies from run to run even when nothing has changed upstream. Each suite’s Page-Hinkley detector adds up how far every day’s median falls below the model’s running mean, less a small tolerance, so noise cancels out and only a sustained fall reaches the threshold. Sharp drops are the hourly canary’s job, and it needs a 12-point fall with p < 0.01 before it opens an alarm. How often the detector is wrong is measured in [How often our drift detector is wrong, measured](/research/drift-detector-false-alarm-rate).',
    },
    ...(familyAnswers ? [{
      q: 'Is Claude, GPT or Gemini getting worse right now?',
      a: `${stamp ? `As of ${stamp}: ` : ''}${familyAnswers} Each family also has its own page with the 24-hour scores and the dated record: ${listJoin(worseLinks)}.`,
    }] : []),
    {
      q: 'Does the Smart Router avoid degraded models?',
      a: 'Yes, by default, for new requests. A model whose detector has fired on a suite your routing mode ranks on, or that has an open canary alarm, goes behind every model without an alarm. It is never removed: if every option has an alarm the best of them still answers, and a conversation that model is already answering stays on it. The X-AISM-Reasoning header on each response names any model that was passed over. The setting is “Avoid models with an active drift alert” in the [Smart Router](/router) preferences.',
    },
    {
      q: 'Can I get an email when a model I use degrades?',
      a: `Yes. A free account includes a watchlist of ${numWord(FREE.watchedModels)} models with ${ALERT_RULE}.`,
    },
    {
      q: 'How often is each model tested?',
      a: `Coding every four hours, seven tasks with seven attempts each; reasoning and tool use once a day; and the canary’s two fixed probes every hour. The detectors run on daily medians, so they confirm a change over days, while the canary is the fast instrument for a collapse.${funded > 0 ? ` For ${funded === 1 ? 'one model' : `${numWord(funded)} models`}, reasoning and tool use are funded by the community and run when a member funds a run; their cells say so.` : ''}`,
    },
    {
      q: 'Why does a new model show Calibrating?',
      a: 'A detector arms after ten days of daily results on the current version of the tests. Until then there is not enough history to tell a change from the model’s normal spread, so the tracker says so instead of guessing. A suite whose tests were changed starts again the same way.',
    },
    {
      q: 'Is the degradation tracker free?',
      a: `Yes, the tracker is public, like the model pages, the methodology and the status page. ${FREE_TIER}`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'AI degradation tracker', path: PATH }]),
    webPageLd({
      path: PATH,
      name: HEADLINE,
      description: DESCRIPTION,
      about: ['AI model degradation', 'LLM drift detection', 'AI model monitoring'],
      ...(data.asOf ? { dateModified: isoDay(data.asOf) } : {}),
    }),
    faqLd(faq),
    ...(data.rows.length ? [itemListLd({ name: 'Models on the AI degradation tracker', items: data.rows.map((r) => ({ name: r.model.displayName, url: `/models/${r.model.slug}` })) })] : []),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-worse rd-tracker"
        kicker="Live model degradation tracker"
        title="AI degradation tracker"
        accent="Is any model getting worse right now?"
        lead={`Every model on the board is re-tested on the same tasks, ${CADENCE}. Each suite has its own drift detector against the model’s own past, the canary watches for sharp drops, and when either raises an alarm the Smart Router routes around that model in the modes the alarm affects.`}
        note={stamp && c.models > 0 ? `As of ${stamp} · ${c.models} models · ${c.alarms} open ${c.alarms === 1 ? 'alarm' : 'alarms'}` : undefined}
        actions={(
          <CtaRow className="is-stack">
            <WatchCta cta="tracker-hero-watch" label="Get an email when a model degrades →" />
            <RouterCta cta="tracker-hero-router" label="Route around degraded models →" ghost />
          </CtaRow>
        )}
        aside={c.models > 0 ? (
          <dl className="lp-facts">
            <div><dt>{c.alarms}</dt><dd>{c.alarms === 1 ? 'model has' : 'models have'} an open alarm, out of {c.models} on the tracker</dd></div>
            {c.series > 0 && <div><dt>{c.armed - c.fired} of {c.series}</dt><dd>per-suite detectors armed with no detection</dd></div>}
            {data.incidents && <div><dt>{c.canary30}</dt><dd>canary {c.canary30 === 1 ? 'alarm' : 'alarms'} in the last 30 days, each one logged below</dd></div>}
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title="Know the next time a model you use degrades"
            lead={FREE_TIER}
            actions={(
              <CtaRow className="is-stack">
                <WatchCta cta="tracker-final-watch" label="Watch the models you use →" sub={`${cap(numWord(FREE.watchedModels))} models free · ${ALERT_RULE}`} />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/ai-drift-detection" data-cta="tracker-final-method">How AI drift detection works</Link>
                </div>
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="now" n={num('now')} title="Is any AI model getting worse right now?">
          {status
            ? <Verdict>{status}</Verdict>
            : <RdProse><p>The boards and drift signatures are not answering at the moment, so there is no status to show. Each model’s own page has its history.</p></RdProse>}
          {data.groups.length > 0 && (
            <ul className="tk-jump lp-up" aria-label="Jump to a family">
              {data.groups.map((g) => {
                const alarms = g.rows.filter((r) => r.tone === 'bad').length;
                const watch = g.rows.filter((r) => r.tone === 'warn').length;
                const cls = alarms ? 'is-bad' : watch ? 'is-warn' : '';
                const count = alarms ? `${alarms} ${alarms === 1 ? 'alarm' : 'alarms'}` : watch ? `${watch} on watch` : `${g.rows.length} ${g.rows.length === 1 ? 'model' : 'models'}`;
                return <li key={g.anchor}><a className={cls} href={`#${g.anchor}`}>{g.vendor.family} <b>{count}</b></a></li>;
              })}
            </ul>
          )}
          {stamp && <AsOf>As of {stamp} · per-suite Page-Hinkley detectors, the 24-hour boards and the hourly canary · the page refreshes every 15 minutes</AsOf>}
        </RdSection>

        <RdSection id="models" n={num('models')} title="Every model, suite by suite"
          lead="Each pill is the detector’s verdict on one suite. The bar under it shows how close the detector’s statistic is to the alarm threshold, and the score beside it comes from the 24-hour board.">
          {data.groups.map((g) => (
            <div key={g.anchor} id={g.anchor} className="tk-family">
              <h3 className="lp-h3">{g.vendor.family} degradation tracker</h3>
              <p className="tk-family-line">{familySentence(g)}</p>
              <TrackerTable rows={g.rows} caption={`${vendorMention(g.vendor)} models${stamp ? ` · as of ${stamp}` : ''}`} />
              <p className="tk-family-links">
                {isWorseVendor(g.vendor.key) && <Link href={worsePath(g.vendor.key)}>{worseH1(g.vendor.key)}</Link>}
                <Link href={g.vendor.modelsPath}>Every {g.vendor.family} model</Link>
                <Link href={g.vendor.statusPath}>{g.vendor.label} API status</Link>
              </p>
            </div>
          ))}
          {!data.groups.length && <RdProse><p>The tracker could not read the board at the moment. The detectors keep running, and the table returns with the next refresh.</p></RdProse>}
        </RdSection>

        <RdSection id="alarms" n={num('alarms')} title="Canary alarms in the last 30 days"
          lead="Every hour the canary sends two fixed probes to every model and tests the last 6 and 24 hours against the prior seven days. An alarm opens at a 12-point fall with p < 0.01, and it closes once the 24-hour average is back within 10 points of the baseline.">
          <TrackerLog incidents={data.incidents} roster={data.worse.roster} />
        </RdSection>

        <RdSection id="read" n={num('read')} title="How the tracker decides"
          lead="What each state means. Every one comes from a published rule, and none is set by hand.">
          <RdRows rows={[
            ['Decline detected', 'The suite’s Page-Hinkley detector fired on its newest reading: a sustained fall against the model’s own past, on daily medians. The constants are δ 0.01 and λ 0.30 for coding and reasoning; tool use needs λ 0.50 on three daily runs in a row. A detection resets the detector, which then re-learns the model’s new level over three daily runs, so the state lasts until the suite’s next run. While it shows, it is the alarm the Smart Router acts on.'],
            ['Confirming', 'Tool use only. The statistic is over its threshold, and it has to stay there for three daily runs before it counts as a detection.'],
            ['Below baseline', 'The leaderboard’s own early warning: the median of the newest runs is more than 5 points, and more than three standard errors, below the runs before them. It stays a watch, not an alarm, until the detector confirms it.'],
            ['No decline', 'The detector is armed and its newest reading did not fire. The bar is its statistic against the threshold, so a full bar is an alarm. Right after a detection the detector is re-learning the model’s level, so a model that settled lower can read No decline here while the board still shows it below baseline.'],
            ['Calibrating', 'A detector arms after ten days of daily results on the current version of the tests, so a new model, or a suite whose tests changed, starts here. A suite with no results yet on the current tests reads No baseline yet.'],
            ['Not checked', 'The drift data did not answer when the page was built. It says nothing about the model, and the next refresh tries again.'],
            ['Canary alarm', 'The hourly probe score fell 12 points or more against the prior seven days, with p < 0.01 on Welch’s t-test. It closes on its own once the 24-hour average is back within 10 points of that baseline.'],
          ]} />
          <RdProse>
            <p>
              The tolerance and thresholds were set against the real score history. How often the detector raises a false alarm is measured in{' '}
              <Link href="/research/drift-detector-false-alarm-rate">How often our drift detector is wrong, measured</Link>. The full method is on{' '}
              <Link href="/ai-drift-detection">AI drift detection</Link>, and every weight and constant is on the <Link href="/methodology#drift">methodology page</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="router" n={num('router')} title="The Smart Router reads the same alarms"
          lead="A tracker tells you a model got worse. The Smart Router acts on the same alarms, request by request.">
          <RdProse>
            <p>
              When a model’s detector fires on a suite your routing mode ranks on, or the model has an open canary alarm, the{' '}
              <Link href="/router">Smart Router</Link> puts it behind every model without an alarm for new requests. Coding alarms count in the
              coding modes, reasoning alarms in the reasoning modes and tool-use alarms in the tool-use modes; agentic coding counts coding and tool
              use, the modes that rank on the combined score count all three, and a canary alarm counts in every mode.
            </p>
            <p>
              The model is never removed. If every candidate has an alarm, the best of them still answers. A conversation the model is already
              answering stays on it, so an agent does not change models mid-task, and in a custom traffic split a flagged model gives way to the
              split’s other models first. The <code>X-AISM-Reasoning</code> header on each response names any model that was passed over and why.
            </p>
            <p>
              The router acts for exactly as long as the alarm shows here: a detection until the suite’s next run, a canary alarm until it
              closes. It is on by default; the setting is “Avoid models with an active drift alert” in your router preferences. How each mode
              ranks is in <Link href="/router/docs">the router documentation</Link>.
            </p>
          </RdProse>
          <CtaRow className="is-stack">
            <RouterCta cta="tracker-router-key" label="Get a router key →" />
            <div className="seo-cta">
              <Link className="lp-btn lp-btn-ghost" href="/router" data-cta="tracker-router-how">How the Smart Router decides</Link>
            </div>
          </CtaRow>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about the degradation tracker">
          <WorseFaq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
