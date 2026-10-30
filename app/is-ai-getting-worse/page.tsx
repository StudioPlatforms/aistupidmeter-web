import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdRows, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, RouterCta, SignupCta, WatchCta } from '@/components/seo/Cta';
import { FindingsRows } from '@/components/seo/worse/FindingsRows';
import { WorseFaq, type WorseFaqItem } from '@/components/seo/worse/WorseFaq';
import { ALERT_RULE, CADENCE, DRIFT_METHOD, FREE_TIER, OPENNESS } from '@/components/seo/worse/WorsePage';
import { fleetCounts, getWorseData, numWord, verdictSentence } from '@/components/seo/worse/worse-data';
import { HUB_BREADCRUMB, HUB_DESCRIPTION, HUB_H1, WORSE_HUB_PATH, WORSE_VENDORS, hubMetadata, worseH1, worsePath, worseVendor } from '@/components/seo/worse/worse-meta';
import { PLANS } from '@/lib/entitlements';
import { FINDINGS, FINDINGS_WINDOW, findingsNewestFirst } from '@/lib/findings';
import { breadcrumbLd, faqLd, graphLd, isoDay, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, byDisplayName, vendorMention } from '@/lib/seo-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-worse.css';

/**
 * /is-ai-getting-worse: the hub for "AI model nerfed", "why is my AI model getting dumber" and
 * "is my AI getting worse". A fleet-wide verdict from the 24-hour boards and every model's
 * per-suite Page-Hinkley state, the vocabulary (nerf, drift, harness), the four causes the
 * tests can see, the dated record (lib/findings.ts), one line per family linking the family
 * pages, and how to check for yourself. No auth(), no cookies(): ISR every fifteen minutes.
 */

export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata();
}

const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TOC = [
  { id: 'nerfed', label: 'Nerfed, drift, harness' },
  { id: 'causes', label: 'Four causes' },
  { id: 'record', label: 'Degradation over time' },
  { id: 'families', label: 'By family' },
  { id: 'check', label: 'Check yourself' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

export default async function IsAiGettingWorsePage(): Promise<JSX.Element> {
  const data = await getWorseData();
  const { models, roster, asOf } = data;
  const counts = fleetCounts(models);
  // The detectors' cold start as the signatures report it (ten days today), for the record section.
  const coldDays = models.flatMap((m) => m.detectors).find((d) => d.kind !== 'none')?.coldStart ?? 10;
  const verdict = verdictSentence(models, null);
  const stamp = asOf ? utcStamp(asOf) : null;
  const h1 = `${HUB_H1.title} ${HUB_H1.accent}`;
  const fallbackLead = `Every model on the board is re-tested on the same tasks — ${CADENCE} — and compared with its own past by a drift detector per suite.`;
  const findings = findingsNewestFirst();

  /* ── one line per family, computed from the same models ── */
  const families = WORSE_VENDORS.map((k) => {
    const v = worseVendor(k);
    const mine = models.filter((m) => m.model.vendor === k);
    return { key: k, vendor: v, path: worsePath(k), question: worseH1(k), count: mine.length, verdict: verdictSentence(mine, v.family) };
  });
  const others = VENDORS.filter((v) => !(WORSE_VENDORS as string[]).includes(v.key)).map((v) => {
    const mine = models.filter((m) => m.model.vendor === v.key);
    return { vendor: v, count: mine.length, verdict: verdictSentence(mine, v.family) };
  });
  const familyRows: [ReactNode, ReactNode][] = [
    ...families.map((f): [ReactNode, ReactNode] => [
      <Link key={f.key} href={f.path}>{f.question}</Link>,
      f.verdict ?? `Every ${f.vendor.family} model on the board, on the same tests, with a detector per suite.`,
    ]),
    ...others.map((o): [ReactNode, ReactNode] => [
      <Link key={o.vendor.key} href={o.vendor.modelsPath}>{vendorMention(o.vendor)} models</Link>,
      o.verdict ?? `Every ${o.vendor.family} model on the board, on the same tests, with a detector per suite.`,
    ]),
  ];
  const allModels = [...roster].sort(byDisplayName);

  /* ── FAQ: the same strings feed the page and the FAQPage structured data ── */
  const chatgpt = families.find((f) => f.key === 'openai');
  const claude = families.find((f) => f.key === 'anthropic');
  const faq: WorseFaqItem[] = [
    {
      q: 'Are AI models really getting worse over time?',
      a: `Not as a rule, on fixed tasks. ${verdict ? `${verdict} ` : ''}Over ${FINDINGS_WINDOW} the record caught changes in how models answer — longer answers, slower or faster responses, a renamed served model, withdrawn endpoints — more often than changes in whether they answer correctly. Each change is listed above with its date and its before-and-after values, and every model on the board is re-tested on the same schedule — ${CADENCE} — so the answer is re-derived rather than remembered.`,
    },
    {
      q: 'What does "AI model nerfed" mean?',
      a: 'A nerf is a deliberate change that cuts a model\'s cost or capability. Drift is any change behind a stable model name, deliberate or not, in either direction. A harness change is your tool changing while the model stays the same. From outside, intent is invisible and behaviour is not, so all three are told apart the same way: fixed tasks, repeated runs, a baseline, and a change-point test that confirms a sustained shift over days. The API-side score, taken with nothing of yours in between, is the control that separates a harness change from the other two.',
    },
    {
      q: 'Why is my AI model getting dumber?',
      a: 'Four causes the tests can see: a silent version swap behind the same name (where a provider returns a build identifier we record it with every call); a serving change, which shows first as answer length and response time rather than correctness; safety tuning, which shows as refusals, recorded as refusals rather than scored as failures; and a long conversation, which is not a change in the model at all but the commonest reason an AI feels dumber mid-task. The three model-side causes are what the per-suite detectors watch; the long-conversation effect is measured separately on [context rot](/context-rot), from 8K to 1M tokens.',
    },
    {
      q: 'Is ChatGPT getting worse?',
      a: `${chatgpt?.verdict ? `${chatgpt.verdict} ` : ''}The GPT models are tested through the OpenAI API, model by model, on the same tasks as every other vendor's models: ${CADENCE}. The model-by-model answer, the API's availability and the dated record for the family are on [Is ChatGPT getting worse?](${worsePath('openai')}).`,
    },
    {
      q: 'Is Claude getting worse?',
      a: `${claude?.verdict ? `${claude.verdict} ` : ''}The Claude models are tested through the Anthropic API, model by model, on the same tasks as every other vendor's models: ${CADENCE}. The model-by-model answer, the API's availability, the Claude Code question and the dated record for the family are on [Is Claude getting worse?](${worsePath('anthropic')}).`,
    },
    {
      q: 'Can I get an alert when a model I use changes?',
      a: `Yes. ${FREE_TIER} The watchlist sends ${ALERT_RULE}; paid plans tune the threshold and watch more models. ${OPENNESS}`,
    },
  ];

  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, HUB_BREADCRUMB]),
    webPageLd({ path: WORSE_HUB_PATH, name: h1, description: HUB_DESCRIPTION, type: 'CollectionPage', ...(asOf ? { dateModified: isoDay(asOf) } : {}) }),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-worse rd-worse-hub"
        kicker="Is your AI getting worse?"
        title={HUB_H1.title}
        accent={HUB_H1.accent}
        lead={verdict ?? fallbackLead}
        note={stamp ? `As of ${stamp} · 24-hour boards · per-suite Page-Hinkley detectors` : undefined}
        actions={(
          <CtaRow className="is-stack">
            <WatchCta cta="worse-hub-hero-watch" label="Watch the models you use →" />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#families" data-cta="worse-hub-hero-families">By family</a>
            </div>
          </CtaRow>
        )}
        aside={(counts.onBoard > 0 || counts.series > 0) ? (
          <dl className="lp-facts">
            {counts.onBoard > 0 && <div><dt>{counts.onBoard}</dt><dd>models on the 24-hour boards, every one on the same tests</dd></div>}
            {counts.series > 0 && <div><dt>{counts.armed} of {counts.series}</dt><dd>per-suite drift detectors armed with no detection</dd></div>}
            <div><dt>{FINDINGS.length}</dt><dd>dated changes in the record, {FINDINGS_WINDOW}, each with its before-and-after values</dd></div>
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title="Know the next time it changes"
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <WatchCta cta="worse-hub-final-watch" label="Watch the models you use →" sub={`${cap(numWord(FREE.watchedModels))} models free · ${ALERT_RULE}`} />
                <RouterCta ghost cta="worse-hub-final-router" label="Route around a model that drifts →" sub={`The Smart Router is drift-aware by default, on your own provider keys · ${n(FREE.routerRequestsPerMonth)} requests a month free`} />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="nerfed" n={num('nerfed')} title="AI model nerfed? What the word means and what we can measure"
          lead="Three different things get called a nerf. Only one of them is, and all three are told apart the same way.">
          <RdRows rows={[
            ['Nerfed', 'A deliberate change that cuts a model’s cost or capability. Intent is invisible from outside; behaviour is not. On fixed tasks a nerf looks like any other sustained fall, so it is confirmed the same way: by a Page-Hinkley (a CUSUM-family test) detector per suite over days of daily medians, never by one bad answer.'],
            ['Drift', 'Any change in behaviour behind a stable model name, in either direction, announced or not: a new build, a serving change, a tuned filter. This is the word for what the detectors watch. The record below shows what drift has looked like on the same tasks: longer answers, slower or faster responses, a renamed served model, withdrawn endpoints.'],
            ['A harness change', 'Your tool changed, not the model: a new version of a coding agent, a different system prompt, more context stuffed into the window. The API-side score, taken with nothing of yours in between, is the control that separates the two.'],
          ]} />
          <RdProse>
            <p>
              {verdict ?? fallbackLead} {stamp && <>The verdict is read from the 24-hour boards and the per-suite detectors, as of {stamp}.</>}
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="causes" n={num('causes')} title="Why is my AI model getting dumber? Four causes we can measure"
          lead="Each cause leaves a different trace on fixed tasks, which is why the suites measure more than correctness.">
          <RdRows rows={[
            ['Silent version swaps', 'A provider routes a stable name to a new checkpoint or build. Where a provider returns a build identifier, we record it with every call: that is how two new builds were dated to the minute in the record below. Where it does not, the daily series on the same tasks is the evidence.'],
            ['Serving changes', 'Quantisation, a new serving stack, a different default budget. These show first as answer length and response time rather than correctness, so both are tracked on the same tasks; the record below has the steps — answer lengths that doubled, response times that stepped up or down under an unchanged name.'],
            ['Safety and refusal tuning', 'A tightened filter makes a model decline work it used to do. A prompt the provider declines is recorded as a refusal with the provider’s stated category and that session’s score is withheld, never imputed, so a tuned filter shows as a refusal rate rather than as invented incapability.'],
            [<>Long conversations</>, <>Not a change in the model at all, but the commonest reason an AI &ldquo;gets dumber&rdquo; mid-task: the context grows and the model uses it worse. How accuracy falls as the context grows, from 8K to 1M tokens, is measured on <Link href="/context-rot">context rot</Link>.</>],
          ]} />
          <RdProse>
            <p>{DRIFT_METHOD} The detector and its constants are on <Link href="/ai-drift-detection">AI drift detection</Link>; its measured false-alarm rate is in <Link href="/research/drift-detector-false-alarm-rate">How often our drift detector is wrong, measured</Link>.</p>
          </RdProse>
        </RdSection>

        <RdSection id="record" n={num('record')} title="AI performance degradation over time"
          lead={`What changed in the test record, ${FINDINGS_WINDOW}, newest first: dated, past-tense changes on the same tasks, with the values before and after.`}>
          <RdProse>
            <p>
              The leaderboard doubles as a degradation tracker, and the <Link href="/ai-degradation-tracker">AI degradation tracker</Link> shows it
              suite by suite. Every model on it is re-tested on the same tasks — {CADENCE} — and each
              suite is compared with that model&apos;s own past by a Page-Hinkley detector, so a decline shows as a dated change rather than a hunch.
              {counts.series > 0 && (
                <>
                  {' '}{stamp ? `As of ${stamp}, ` : 'Right now, '}{counts.armed} of {counts.series} per-suite detectors are armed with no detection
                  {counts.fired > 0 ? `, ${counts.fired} ${counts.fired === 1 ? 'has' : 'have'} fired` : ''}
                  {counts.cold > 0 ? `, and ${counts.cold} ${counts.cold === 1 ? 'is' : 'are'} still collecting ${numWord(coldDays)} days of daily results` : ''}.
                </>
              )}
              {' '}The changes the record caught so far are below; every row comes from the published study of{' '}
              <Link href="/research/thirteen-months-of-llm-monitoring">13 months of monitoring LLM APIs</Link>.
            </p>
          </RdProse>
          <FindingsRows findings={findings} />
        </RdSection>

        <RdSection id="families" n={num('families')} title="By family"
          lead="The same verdict, family by family, each with its own page: the models on the four boards, the API's availability, the tool-or-model question and the dated record.">
          <RdRows rows={familyRows} />
          {allModels.length > 0 && (
            <RdProse>
              <p>Every model on the board has a page of its own, with its history and drift status:</p>
              <ul className="rd-tags" aria-label="Models tracked">
                {allModels.map((m) => <li key={m.slug}><Link href={`/models/${m.slug}`}>{m.displayName}</Link></li>)}
              </ul>
            </RdProse>
          )}
        </RdSection>

        <RdSection id="check" n={num('check')} title="How to check yourself"
          lead="The same rules that keep our verdict honest work at any scale.">
          <RdProse>
            <ol>
              <li><b>Fix the tasks.</b> The same prompts and the same output budget every time; a changed prompt measures the prompt.</li>
              <li><b>Repeat.</b> Model output varies run to run even when nothing has changed; each of our coding tasks is run seven times and scored by the median.</li>
              <li><b>Decide the rule before you look.</b> A baseline, daily medians and a change-point test with a confirmation window — the constants are on the <Link href="/methodology#drift">methodology page</Link>.</li>
              <li><b>Test the API, not the app.</b> The app adds its own prompt, tools and context; the API is the model as served.</li>
              <li><b>Count refusals as refusals.</b> A declined prompt is a tuned filter, not a lost ability.</li>
            </ol>
            <p>Or run our tests on your own keys: Test Your Keys uses the same scoring code as the published runs, so your numbers and the boards are comparable.</p>
          </RdProse>
          <SignupCta next="/router/test-keys" cta="worse-hub-check-testkeys" label="Run the tests with your own keys →" sub="Free account · your own API keys · the same scoring code as our published runs" />
        </RdSection>

        <RdSection id="faq" n={num('faq')} title="Questions people ask">
          <WorseFaq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
