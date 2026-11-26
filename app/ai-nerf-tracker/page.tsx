import type { Metadata } from 'next';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { CtaRow, RouterCta, WatchCta } from '@/components/seo/Cta';
import { WorseFaq, type WorseFaqItem } from '@/components/seo/worse/WorseFaq';
import { ALERT_RULE, CADENCE, FREE_TIER } from '@/components/seo/worse/WorsePage';
import { listJoin, numWord } from '@/components/seo/worse/worse-data';
import { WORSE_COPY, isWorseVendor } from '@/components/seo/worse/worse-meta';
import { PLANS } from '@/lib/entitlements';
import { breadcrumbLd, faqLd, graphLd, pageMeta, webPageLd } from '@/lib/seo';
import { VENDORS, byDisplayName, getRoster, modelsOfVendor, vendorMention, type Vendor } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-worse.css';
import '@/styles/seo-tracker.css';

/**
 * /ai-nerf-tracker: the guide for "nerf" searches ("Claude nerf tracker", "is ChatGPT nerfed",
 * "LLM nerf tracker"). What people mean by a nerf, how a nerf check works, where to check each
 * family, how to check a model on your own account, and what the Smart Router does with an alarm.
 *
 * The page states no model's condition itself: the live states are on /ai-degradation-tracker and
 * the family pages, and this page sends the reader there. Static copy names vendors and families
 * only; the model names under each family are the roster's, read at render time. ISR every fifteen
 * minutes; no auth(), cookies() or headers(). The version with one verdict per model is in app/_held.
 */

const PATH = '/ai-nerf-tracker';
const TITLE = 'AI nerf tracker: how to check Claude, GPT & Gemini';
const HEADLINE = 'AI nerf tracker: how to tell if Claude, ChatGPT or Gemini was nerfed';
const DESCRIPTION = 'AI nerf tracker guide: what “nerfed” means for an AI model, how a nerf check works, and where to check Claude, GPT, Gemini, DeepSeek, Kimi and GLM.';

export const metadata: Metadata = pageMeta({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  keywords: [
    'AI nerf tracker', 'LLM nerf tracker', 'AI model nerf tracker', 'Claude nerf tracker', 'ChatGPT nerf tracker',
    'Gemini nerf tracker', 'Opus nerf tracker', 'is Claude nerfed', 'is ChatGPT nerfed', 'is Gemini nerfed',
    'Claude nerfed', 'ChatGPT nerfed', 'AI model nerfed', 'has Claude been nerfed', 'did ChatGPT get nerfed', 'AI nerf check',
  ],
});

export const revalidate = 900;

const FREE = PLANS.free;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TOC = [
  { id: 'meaning', label: 'What a nerf is' },
  { id: 'check', label: 'How a nerf check works' },
  { id: 'families', label: 'Where to check each family' },
  { id: 'own', label: 'Check it yourself' },
  { id: 'router', label: 'Smart Router' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** The name in the question: ChatGPT for OpenAI (the family pages' own wording), the family elsewhere. */
const askName = (v: Vendor): string => (isWorseVendor(v.key) ? WORSE_COPY[v.key].name : v.family);
/** The family's section of the degradation tracker. */
const trackerHref = (v: Vendor): string => `/ai-degradation-tracker#${v.family.toLowerCase()}`;

const NO_ALARM_CAVEAT = 'No open alarm means no detector has confirmed a sustained fall. It does not prove that nothing changed for your own prompts.';

export default async function AiNerfTrackerPage(): Promise<React.JSX.Element> {
  const roster = await getRoster();
  const vendorList = listJoin(VENDORS.map(vendorMention));
  const familyList = listJoin(VENDORS.map((v) => v.family));
  const worseLinks = listJoin(VENDORS.filter((v) => v.worsePath).map((v) => `[is ${askName(v)} getting worse](${v.worsePath})`));

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const faq: WorseFaqItem[] = [
    {
      q: 'What is an AI nerf tracker?',
      a: `A tracker that repeats fixed tasks against AI models and flags one that has fallen against its own past, under the word people use for it. On AI Stupid Level that is the [AI degradation tracker](/ai-degradation-tracker): a change-point detector for each suite and an hourly canary, for models from ${vendorList}. This page explains what a nerf is, how the check works and where to look for each family.`,
    },
    {
      q: 'Is Claude nerfed? Is ChatGPT nerfed?',
      a: `Each family has a page with its current state: ${worseLinks}. Every model, suite by suite, is on the [AI degradation tracker](/ai-degradation-tracker). ${NO_ALARM_CAVEAT}`,
    },
    {
      q: 'How is this different from the AI degradation tracker?',
      a: 'The [AI degradation tracker](/ai-degradation-tracker) is the live view: each suite’s detector, how close its statistic is to the alarm threshold, and the dated log of canary alarms. This page is the guide to it: what a nerf is, what an alarm means and how to check a model yourself.',
    },
    {
      q: 'Can a model be nerfed in the app but not in the API?',
      a: 'Yes. An app or a coding tool wraps the model in its own instructions, context limits and tools, and any of those can change while the model stays the same. The tracker’s tasks go to each provider’s public API, so it speaks for the model there. If the API holds steady and your tool feels worse, the change is more likely in the tool. The difference is explained on [is your AI getting worse](/is-ai-getting-worse#nerfed).',
    },
    {
      q: 'Why does it feel nerfed when the tracker shows no alarm?',
      a: 'Three common reasons. Model output varies from run to run, so a bad afternoon is not a trend. Your own prompts, files or tool version may have changed. And the tracker’s tasks cover coding, reasoning and tool use, so a change that only affects a different kind of work will not show there. An alarm needs a sustained fall over days, or a sharp drop on the hourly canary.',
    },
    {
      q: 'How can I check a model myself?',
      a: '[Test your keys](/router/test-keys) runs the same tasks with your own API key and scores them with the same code. Run it when a model feels off and again later: the same tasks on your own account are a like-for-like comparison. Keep a few prompts of your own with fixed settings as well, because your work is not our task list.',
    },
    {
      q: 'Can I get an alert when a model I use is nerfed?',
      a: `Yes. A free account includes a watchlist of ${numWord(FREE.watchedModels)} models with ${ALERT_RULE}.`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'AI degradation tracker', path: '/ai-degradation-tracker' }, { name: 'AI nerf tracker', path: PATH }]),
    webPageLd({ path: PATH, name: HEADLINE, description: DESCRIPTION, about: ['AI model nerf', 'AI model degradation', 'LLM drift detection'] }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-worse rd-tracker"
        kicker="Nerf check"
        title="AI nerf tracker"
        accent="How to tell if Claude, ChatGPT or Gemini was nerfed"
        lead="“Nerfed” is what people say when a model seems to have got worse under the same name. This page explains what that can mean, how a nerf check works (fixed tasks, a detector for each suite and an hourly canary) and where to check each model family. The Smart Router reads the same alarms and routes around a model that has one open."
        actions={(
          <CtaRow className="is-stack">
            <div className="seo-cta">
              <Link className="lp-btn lp-btn-primary" href="/ai-degradation-tracker" data-cta="nerf-hero-tracker">Open the degradation tracker</Link>
            </div>
            <WatchCta cta="nerf-hero-watch" label="Get an email when a model gets worse →" ghost />
          </CtaRow>
        )}
        aside={(
          <dl className="lp-facts">
            <div><dt>3</dt><dd>suites (coding, reasoning and tool use), each with its own change-point detector</dd></div>
            <div><dt>1 h</dt><dd>between canary probes, the fast check for a sudden drop</dd></div>
            <div><dt>{VENDORS.length}</dt><dd>model families to check: {familyList}</dd></div>
          </dl>
        )}
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

        <RdSection id="check" n={num('check')} title="How does a nerf check work?"
          lead="The same tasks for every model, on a schedule, judged against the model’s own history.">
          <RdRows rows={[
            ['Fixed tasks, repeated', `The same coding, reasoning and tool-use tasks for every model, through its provider’s public API, on a fixed schedule: ${CADENCE}.`],
            ['A detector for each suite', 'Each suite has its own change-point detector on the model’s daily results. It adds up how far each day falls below the model’s running level, so run-to-run noise cancels out and only a sustained fall raises an alarm.'],
            ['An hourly canary', 'Two fixed probes for every model each hour, with the last hours tested against the prior seven days. It is the fast check for a sudden collapse.'],
            ['What the states mean', `An open alarm: a detector has fired, or a canary alarm is open. A watch: the board shows an early warning that no detector has confirmed. Calibrating: a new model whose detectors have not armed yet. ${NO_ALARM_CAVEAT}`],
          ]} />
          <RdProse>
            <p>
              Every state and constant is explained on the <Link href="/ai-degradation-tracker#read">degradation tracker</Link>, the method is on{' '}
              <Link href="/ai-drift-detection">AI drift detection</Link>, and how often the detector raises a false alarm is in{' '}
              <Link href="/research/drift-detector-false-alarm-rate">How often our drift detector is wrong, measured</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="families" n={num('families')} title="Is Claude nerfed? Is ChatGPT nerfed? Where to check each family"
          lead="The current state of a family is on its own pages. Each model name opens that model’s page, with its history and its drift state by suite.">
          {VENDORS.map((v) => {
            const models = modelsOfVendor(roster, v.key).sort(byDisplayName);
            return (
              <div key={v.key} id={v.family.toLowerCase()} className="tk-family">
                <h3 className="lp-h3">Is {askName(v)} nerfed?</h3>
                <p className="tk-family-line">
                  Every {v.family} model, suite by suite, is on the <Link href={trackerHref(v)}>degradation tracker</Link>
                  {v.worsePath
                    ? <>, and the family’s 24-hour scores and dated record are on <Link href={v.worsePath}>is {askName(v)} getting worse</Link>.</>
                    : <>, and the family’s models are on <Link href={v.modelsPath}>{vendorMention(v)} models</Link>.</>}
                </p>
                {models.length > 0 && (
                  <ul className="rd-tags lp-up" aria-label={`${v.family} models`}>
                    {models.map((m) => <li key={m.id}><Link href={`/models/${m.slug}`}>{m.displayName}</Link></li>)}
                  </ul>
                )}
                <p className="tk-family-links">
                  <Link href={v.modelsPath}>{vendorMention(v)} models</Link>
                  <Link href={v.statusPath}>{v.label} API status</Link>
                </p>
              </div>
            );
          })}
        </RdSection>

        <RdSection id="own" n={num('own')} title="How to check a model on your own account"
          lead="A tracker speaks for its own tasks. Your prompts are yours, so the last check is one you run.">
          <RdRows rows={[
            ['Run the same tasks with your key', <>
              <Link href="/router/test-keys">Test your keys</Link> runs the same tasks with your own API key and scores them with the same
              code. Run it when a model feels off and again later, and compare the two.
            </>],
            ['Keep a fixed set of your own prompts', 'A handful of real prompts from your work, with the same settings each time. One answer proves little, because output varies from run to run; several runs on fixed prompts show a level.'],
            ['Rule out your side first', 'A new tool version, a longer context, a changed system prompt or a different reasoning setting can each move results while the model stays the same.'],
          ]} />
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
