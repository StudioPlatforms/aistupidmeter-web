import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, RouterCta, WatchCta } from '@/components/seo/Cta';
import { WorseFaq, type WorseFaqItem } from '@/components/seo/worse/WorseFaq';
import { ALERT_RULE, CADENCE, FREE_TIER } from '@/components/seo/worse/WorsePage';
import { listJoin, numWord } from '@/components/seo/worse/worse-data';
import { WORSE_COPY, isWorseVendor, worsePath } from '@/components/seo/worse/worse-meta';
import { familySentence, getTrackerData, statusSentence, trackerCounts, type TrackerGroup } from '@/components/seo/tracker/tracker-data';
import { PLANS } from '@/lib/entitlements';
import { breadcrumbLd, faqLd, graphLd, isoDay, itemListLd, pageMeta, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, vendorMention } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-worse.css';
import '@/styles/seo-tracker.css';

/**
 * /ai-nerf-tracker: the page for "nerf" searches ("Claude nerf tracker", "is ChatGPT nerfed",
 * "LLM nerf tracker"). One line per family and one verdict per model, in the word people type,
 * from the same data as /ai-degradation-tracker (components/seo/tracker/tracker-data.ts). The
 * suite-by-suite view, the canary log and the detector's states stay on the degradation tracker:
 * this page answers the yes-or-no question and sends the reader there for the detail.
 *
 * Static copy names vendors and families only; every model, state, count and date is read at
 * render time. "No open alarm" is never worded as "not nerfed": the tests can confirm a sustained
 * fall, not prove that nothing changed. ISR every fifteen minutes; no auth(), cookies() or headers().
 */

const PATH = '/ai-nerf-tracker';
const TITLE = 'AI nerf tracker: is Claude, GPT or Gemini nerfed?';
const HEADLINE = 'AI nerf tracker: is Claude, ChatGPT or Gemini nerfed right now?';
const DESCRIPTION = 'AI nerf tracker for Claude, GPT, Gemini, DeepSeek, Kimi and GLM: is your model nerfed right now? One verdict per model, from the same tests on a schedule.';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    'AI nerf tracker', 'LLM nerf tracker', 'AI model nerf tracker', 'Claude nerf tracker', 'ChatGPT nerf tracker',
    'Gemini nerf tracker', 'Opus nerf tracker', 'is Claude nerfed', 'is Claude nerfed right now', 'is ChatGPT nerfed',
    'is Gemini nerfed', 'Claude nerfed', 'ChatGPT nerfed', 'AI model nerfed', 'has Claude been nerfed', 'did ChatGPT get nerfed',
    'AI nerf check',
  ],
});

export const revalidate = 900;

const FREE = PLANS.free;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TOC = [
  { id: 'now', label: 'Nerfed right now?' },
  { id: 'families', label: 'Family by family' },
  { id: 'meaning', label: 'What a nerf is' },
  { id: 'check', label: 'How the check works' },
  { id: 'router', label: 'Smart Router' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** The name in the question: ChatGPT for OpenAI (the family pages' own wording), the family elsewhere. */
const askName = (g: TrackerGroup): string => (isWorseVendor(g.vendor.key) ? WORSE_COPY[g.vendor.key].name : g.vendor.family);

export default async function AiNerfTrackerPage(): Promise<React.JSX.Element> {
  const data = await getTrackerData();
  const c = trackerCounts(data);
  const stamp = data.asOf ? utcStamp(data.asOf) : null;
  const status = statusSentence(data);
  const vendorList = listJoin(VENDORS.map(vendorMention));
  const answerFor = (key: string): string | null => {
    const g = data.groups.find((x) => x.vendor.key === key);
    return g ? familySentence(g) : null;
  };
  const claude = answerFor('anthropic');
  const gpt = answerFor('openai');
  const gemini = answerFor('google');
  const NO_ALARM_CAVEAT = 'No open alarm means the tests have not confirmed a sustained fall. It does not prove that nothing changed for your own prompts.';

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: WorseFaqItem[] = [
    {
      q: 'What is an AI nerf tracker?',
      a: `A page that re-tests AI models on fixed tasks and says whether one has got worse, in the word people use for it. This one covers ${c.models > 0 ? `the ${c.models} models` : 'every model'} on the AI Stupid Level board, from ${vendorList}, through each provider’s own API: ${CADENCE}. Each model gets one verdict here, and the [AI degradation tracker](/ai-degradation-tracker) shows the same data suite by suite.`,
    },
    ...(claude ? [{
      q: 'Is Claude nerfed right now?',
      a: `${stamp ? `As of ${stamp}: ` : ''}${claude} ${NO_ALARM_CAVEAT} The 24-hour scores and the dated record are on [is Claude getting worse](/is-claude-getting-worse).`,
    }] : []),
    ...(gpt ? [{
      q: 'Is ChatGPT nerfed right now?',
      a: `${stamp ? `As of ${stamp}: ` : ''}${gpt} These are the GPT models reached through the OpenAI API, which is what the tests call, not the ChatGPT app. More on [is ChatGPT getting worse](/is-chatgpt-getting-worse).`,
    }] : []),
    ...(gemini ? [{
      q: 'Is Gemini nerfed right now?',
      a: `${stamp ? `As of ${stamp}: ` : ''}${gemini} More on [is Gemini getting worse](/is-gemini-getting-worse).`,
    }] : []),
    {
      q: 'How is this different from the AI degradation tracker?',
      a: 'It is the same data, read two ways. This page gives one answer per family and one verdict per model. The [AI degradation tracker](/ai-degradation-tracker) shows each suite’s detector, how close its statistic is to the alarm threshold, and the dated log of canary alarms.',
    },
    {
      q: 'Can a model be nerfed in the app but not in the API?',
      a: 'Yes. An app or a coding tool wraps the model in its own instructions, context limits and tools, and any of those can change while the model stays the same. The tests here call each provider’s public API, so they show what the model does there. If the API results hold steady and your tool feels worse, the change is more likely in the tool. The difference is explained on [is your AI getting worse](/is-ai-getting-worse#nerfed).',
    },
    {
      q: 'Why does it feel nerfed when the tracker shows no alarm?',
      a: 'Three common reasons. Model output varies from run to run, so a bad afternoon is not a trend. Your own prompts, files or tool version may have changed. And these tests cover coding, reasoning and tool use on fixed tasks, so a change that only affects a different kind of work will not show here. An alarm needs a sustained fall over days, or a sharp drop on the hourly canary.',
    },
    {
      q: 'Can I get an alert when a model I use is nerfed?',
      a: `Yes. A free account includes a watchlist of ${numWord(FREE.watchedModels)} models with ${ALERT_RULE}.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'AI degradation tracker', path: '/ai-degradation-tracker' }, { name: 'AI nerf tracker', path: PATH }]),
    webPageLd({
      path: PATH,
      name: HEADLINE,
      description: DESCRIPTION,
      about: ['AI model nerf', 'AI model degradation', 'LLM drift detection'],
      ...(data.asOf ? { dateModified: isoDay(data.asOf) } : {}),
    }),
    faqLd(faq),
    ...(data.rows.length ? [itemListLd({ name: 'Models on the AI nerf tracker', items: data.rows.map((r) => ({ name: r.model.displayName, url: `/models/${r.model.slug}` })) })] : []),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-worse rd-tracker"
        kicker="Live nerf check"
        title="AI nerf tracker"
        accent="Is Claude, ChatGPT or Gemini nerfed right now?"
        lead={`“Nerfed” is what people say when a model seems to have got worse. Here every model on the board is re-tested on the same tasks, ${CADENCE}, and each one gets a verdict against its own past. The Smart Router reads the same verdicts and routes around a model with an open alarm.`}
        note={stamp && c.models > 0 ? `As of ${stamp} · ${c.models} models · ${c.alarms} open ${c.alarms === 1 ? 'alarm' : 'alarms'}` : undefined}
        actions={(
          <CtaRow className="is-stack">
            <WatchCta cta="nerf-hero-watch" label="Get an email when a model gets worse →" />
            <RouterCta cta="nerf-hero-router" label="Route around nerfed models →" ghost />
          </CtaRow>
        )}
        aside={c.models > 0 ? (
          <dl className="lp-facts">
            <div><dt>{c.alarms}</dt><dd>{c.alarms === 1 ? 'model has' : 'models have'} an open alarm, out of {c.models} checked here</dd></div>
            <div><dt>{c.watch}</dt><dd>{c.watch === 1 ? 'model is' : 'models are'} on watch, with an early warning no detector has confirmed</dd></div>
            <div><dt>1 h</dt><dd>between canary probes, the fast check for a sudden drop</dd></div>
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title="Know the next time a model you use gets worse"
            lead={FREE_TIER}
            actions={(
              <CtaRow className="is-stack">
                <WatchCta cta="nerf-final-watch" label="Watch the models you use →" sub={`${cap(numWord(FREE.watchedModels))} models free · ${ALERT_RULE}`} />
                <div className="seo-cta">
                  <Link className="lp-btn lp-btn-ghost" href="/ai-degradation-tracker" data-cta="nerf-final-tracker">Open the full degradation tracker</Link>
                </div>
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="now" n={num('now')} title="Is any AI model nerfed right now?">
          {status
            ? <Verdict>{status}</Verdict>
            : <RdProse><p>The boards and drift signatures are not answering at the moment, so there is no verdict to show. Each model’s own page has its history.</p></RdProse>}
          <RdProse>
            <p>
              An alarm here is a sustained fall on fixed tasks, or a sharp drop on the hourly canary. {NO_ALARM_CAVEAT}
            </p>
          </RdProse>
          {stamp && <AsOf>As of {stamp} · per-suite detectors, the 24-hour boards and the hourly canary · the page refreshes every 15 minutes</AsOf>}
        </RdSection>

        <RdSection id="families" n={num('families')} title="Is Claude nerfed? Is ChatGPT nerfed? The answer by family"
          lead="One verdict per model. Each name opens the model’s page, with its scores, history and drift state by suite.">
          {data.groups.map((g) => (
            <div key={g.anchor} id={g.anchor} className="tk-family">
              <h3 className="lp-h3">Is {askName(g)} nerfed right now?</h3>
              <p className="tk-family-line">{familySentence(g)}</p>
              <ul className="nf-list lp-up" aria-label={`${g.vendor.family} models`}>
                {g.rows.map((r) => (
                  <li key={r.model.id}>
                    <Link href={`/models/${r.model.slug}`}>{r.model.displayName}</Link>
                    <span className={`lp-pill ${r.tone}`}>{r.tone === 'ok' ? 'No open alarm' : r.status}</span>
                  </li>
                ))}
              </ul>
              <p className="tk-family-links">
                <Link href={`/ai-degradation-tracker#${g.anchor}`}>{g.vendor.family} suite by suite</Link>
                {isWorseVendor(g.vendor.key) && <Link href={worsePath(g.vendor.key)}>Is {askName(g)} getting worse?</Link>}
                <Link href={g.vendor.statusPath}>{g.vendor.label} API status</Link>
              </p>
            </div>
          ))}
          {!data.groups.length && <RdProse><p>The tracker could not read the board at the moment. The detectors keep running, and the verdicts return with the next refresh.</p></RdProse>}
        </RdSection>

        <RdSection id="meaning" n={num('meaning')} title="What does “nerfed” mean for an AI model?"
          lead="Three different things get called a nerf. From outside they are told apart the same way: fixed tasks, repeated runs and a baseline.">
          <RdRows rows={[
            ['A nerf', 'A deliberate change that cuts a model’s cost or capability. Intent is invisible from outside; behaviour is not. On fixed tasks a nerf looks like any other sustained fall.'],
            ['Drift', 'Any change behind a stable model name, deliberate or not, in either direction. A new checkpoint, a different quantisation or a changed serving setup can all move results while the name stays the same.'],
            ['A harness change', 'Your app or coding tool changing while the model stays the same: new system instructions, a smaller context budget, different tools. It feels like a nerf, and an API test will not show it.'],
          ]} />
          <RdProse>
            <p>
              The longer explanation, with the causes a test can and cannot see, is on{' '}
              <Link href="/is-ai-getting-worse#nerfed">is your AI getting worse</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="check" n={num('check')} title="How the nerf check works"
          lead="The same tasks for every model, on a schedule, judged against the model’s own history.">
          <RdRows rows={[
            ['Fixed tasks, repeated', `Every model runs the same coding, reasoning and tool-use tasks through its provider’s public API: ${CADENCE}.`],
            ['A detector per suite', 'Each suite has its own change-point detector on the model’s daily results. It adds up how far each day falls below the model’s running level, so run-to-run noise cancels out and only a sustained fall raises an alarm.'],
            ['An hourly canary', 'Two fixed probes go to every model each hour, and the last hours are tested against the prior seven days. It is the fast check for a sudden collapse.'],
            ['One verdict per model', 'A model shows an open alarm when a detector has fired or a canary alarm is open, a watch when the board shows an early warning that no detector has confirmed, and no open alarm when its detectors are armed and none has fired. A new model reads Calibrating until its detectors arm, and a model whose drift data did not answer reads Not checked.'],
          ]} />
          <RdProse>
            <p>
              Every state and constant is explained on the <Link href="/ai-degradation-tracker#read">degradation tracker</Link>, the method is on{' '}
              <Link href="/ai-drift-detection">AI drift detection</Link>, and how often the detector raises a false alarm is in{' '}
              <Link href="/research/drift-detector-false-alarm-rate">How often our drift detector is wrong, measured</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="router" n={num('router')} title="Route around a nerfed model"
          lead="The AI Stupid Level Smart Router reads the same alarms and acts on them, request by request.">
          <RdProse>
            <p>
              When a model’s detector fires on a suite your routing mode ranks on, or the model has an open canary alarm, the{' '}
              <Link href="/router">Smart Router</Link> puts it behind every model without an alarm for new requests. The model is never removed:
              if every candidate has an alarm the best of them still answers, and a conversation the model is already answering stays on it.
              The <code>X-AISM-Reasoning</code> header on each response names any model that was passed over.
            </p>
          </RdProse>
          <CtaRow className="is-stack">
            <RouterCta cta="nerf-router-key" label="Get a router key →" />
            <div className="seo-cta">
              <Link className="lp-btn lp-btn-ghost" href="/ai-degradation-tracker#router" data-cta="nerf-router-rule">The router’s rule, in full</Link>
            </div>
          </CtaRow>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions about the nerf tracker">
          <WorseFaq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
