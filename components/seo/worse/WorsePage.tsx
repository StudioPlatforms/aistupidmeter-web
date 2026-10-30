import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, RdFacts, RdFinal, tocNumber } from '@/components/landing/Reading';
import JsonLd from '@/components/seo/JsonLd';
import { AsOf, Verdict } from '@/components/seo/Verdict';
import { CtaRow, LeaderboardCta, RouterCta, WatchCta } from '@/components/seo/Cta';
import { PLANS } from '@/lib/entitlements';
import { FINDINGS_WINDOW, findingsOf } from '@/lib/findings';
import { breadcrumbLd, dayLabel, faqLd, graphLd, isoDay, itemListLd, utcStamp, webPageLd } from '@/lib/seo';
import { VENDORS, providerStatusOf, vendorMention, type ProviderStatus, type Vendor } from '@/lib/seo-data';
import { FindingsRows } from './FindingsRows';
import { WorseFaq, type WorseFaqItem } from './WorseFaq';
import { WorseTable } from './WorseTable';
import { HUB_BREADCRUMB, WORSE_COPY, WORSE_HUB_PATH, WORSE_VENDORS, worseDescription, worseH1, worsePath, worseVendor, type WorseVendorKey } from './worse-meta';
import { fleetCounts, getWorseData, modelSentence, numWord, trackedSince, verdictSentence } from './worse-data';
import '@/styles/landing.css';
import '@/styles/reading.css';
import '@/styles/seo.css';
import '@/styles/seo-worse.css';

/**
 * /is-<family>-getting-worse: one family's models on the same tests, with a verdict computed
 * from the 24-hour boards and the per-suite Page-Hinkley detectors. Rendered by the four route
 * files (app/is-chatgpt-getting-worse/page.tsx …) with the vendor key; revalidated every
 * fifteen minutes; never calls auth(), cookies() or headers().
 *
 * Static copy names only the family and the vendor. Every model name, score, place, trend,
 * detector state and uptime is read at render time; the dated findings come from
 * lib/findings.ts, the one place a past model may be named. When a feed does not answer, the
 * prose stays and the block that needed it is left out.
 */

const FREE = PLANS.free;
const n = (x: number) => x.toLocaleString('en-US');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (u: number): string => `${Number.isInteger(u) ? u : u.toFixed(1)}%`;

export const CADENCE = 'coding every four hours, reasoning and tool use daily, with an hourly canary probe';
export const OPENNESS = 'The methodology is public — every weight, statistical test and drift constant. The test tasks are private, so no lab can train on them.';
export const DRIFT_METHOD = 'Page-Hinkley change-point detection (a CUSUM-family test) run per suite on each model’s daily median, constants published: δ 0.01; λ 0.30 for coding and reasoning, λ 0.50 held for three consecutive daily runs for tool use; detectors run on daily medians and are armed after ten days on the current test version, so a real shift is confirmed over days, not hours. An hourly canary of two fixed probes catches sharp drops with Welch’s t-test (12-point fall, p < 0.01).';
export const FREE_TIER = `Free account: every ranking over 24 hours, 7 days and ${FREE.historyDays} days, a ${FREE.watchedModels}-model watchlist with email alerts, ${n(FREE.routerRequestsPerMonth)} routed requests a month and a Data API key. No card.`;
export const ALERT_RULE = 'an email when a watched model’s coding score falls five points below a week earlier, and a weekly summary of what moved';

const STATE_TEXT: Record<ProviderStatus['status'], string> = { operational: 'Answering', degraded: 'Slow', down: 'Not answering', unmeasured: 'Not measured' };
const STATE_PILL: Record<ProviderStatus['status'], string> = { operational: 'ok', degraded: 'warn', down: 'bad', unmeasured: 'na' };
const STATE_PAST: Record<ProviderStatus['status'], string> = {
  operational: 'was answering our probe',
  degraded: 'was answering our probe slowly',
  down: 'was not answering our probe',
  unmeasured: 'could not be measured from our side',
};

const TOC = [
  { id: 'scores', label: 'Nerfed? Model by model' },
  { id: 'status', label: 'Downgraded, or down?' },
  { id: 'tool', label: 'Tool or model?' },
  { id: 'record', label: 'What changed' },
  { id: 'method', label: 'Change vs noise' },
  { id: 'next', label: 'What to do' },
  { id: 'faq', label: 'FAQ' },
];
const num = (id: string) => tocNumber(TOC, id);

/** The company as the owner writes it: "Moonshot AI (Kimi)" style only where the family name is not the company's household name. */
const companyOf = (v: Vendor): string => (v.key === 'kimi' || v.key === 'glm' ? vendorMention(v) : v.label);

/** The "tool or model" section: what sits between the person and the model, and why the API score is the control. */
function toolProse(key: WorseVendorKey, v: Vendor): ReactNode {
  const control = (tool: string) => (
    <p>
      That makes the scores a control. If the API-side scores hold and the detectors stay quiet while {tool} feels worse, the change is on
      the tool side: the harness, the context it assembles, or a session that has grown long enough to hurt (see{' '}
      <Link href="/context-rot">context rot</Link>). If the model behind the name changes, it shows up here, on the same tasks, inside the
      detector&apos;s confirmation window.
    </p>
  );
  switch (key) {
    case 'anthropic':
      return (
        <>
          <p>
            Claude Code is a harness around the model: a system prompt, a tool set, context management and a client version that changes
            often. AI Stupid Level does not test the harness. It calls the Anthropic API at {v.apiHost} with fixed tasks — the same prompts
            and the same output budget every time, coding every four hours — so the scores above describe the model as served, with nothing
            of yours in between.
          </p>
          {control('Claude Code')}
        </>
      );
    case 'openai':
      return (
        <>
          <p>
            ChatGPT is a product built around the GPT models: its own system prompt, tools, memory and model selection. AI Stupid Level does
            not test ChatGPT. It calls the OpenAI API at {v.apiHost}, model by model, with fixed tasks — the same prompts and the same output
            budget every time — so each score above describes one named model as served, with nothing of yours in between.
          </p>
          {control('ChatGPT')}
        </>
      );
    case 'google':
      return (
        <>
          <p>
            The Gemini app and the Gemini API are two surfaces of the same models. The app adds its own prompt, tools and product logic; the
            API at {v.apiHost} is what applications call, and it is what AI Stupid Level tests — model by model, with fixed tasks, the same
            prompts and the same output budget every time, with nothing of yours in between.
          </p>
          {control('the Gemini app')}
        </>
      );
    default:
      return (
        <>
          <p>
            The DeepSeek app and the DeepSeek API are two surfaces of the same models. The app adds its own prompt, tools and product logic;
            the API at {v.apiHost} is what applications call, and it is what AI Stupid Level tests — model by model, with fixed tasks, the
            same prompts and the same output budget every time, with nothing of yours in between.
          </p>
          {control('the DeepSeek app')}
        </>
      );
  }
}

export default async function WorsePage({ vendor: key }: { vendor: WorseVendorKey }): Promise<JSX.Element> {
  const vendor = worseVendor(key);
  const copy = WORSE_COPY[key];
  const { name } = copy;
  const family = vendor.family;
  const path = worsePath(key);
  const h1 = worseH1(key);
  const description = worseDescription(key);

  const data = await getWorseData(key);
  const { models, providers, asOf } = data;
  const count = models.length;
  const plural = count === 1 ? 'model' : 'models';
  const counts = fleetCounts(models);
  const verdict = verdictSentence(models, family);
  const stamp = asOf ? utcStamp(asOf) : null;
  const since = trackedSince(models);
  const findings = findingsOf(key);
  const siblings = WORSE_VENDORS.filter((k) => k !== key);
  const coldDays = numWord(models.flatMap((m) => m.detectors).find((d) => d.kind !== 'none')?.coldStart ?? 10);
  const fallbackLead = `Every ${family} model on the board is re-tested on the same tasks — ${CADENCE} — and compared with its own past by a drift detector per suite.`;

  /* ── per-model sentences, one each; only when the boards answered, so a feed failure never reads as "not on the boards" ── */
  const modelFacts: [ReactNode, ReactNode][] = (data.boards ? models : []).map((m) => {
    const s = modelSentence(m);
    const prefix = `${m.model.displayName}: `;
    const clause = s.startsWith(prefix) ? s.slice(prefix.length) : s;
    return [<Link key={m.model.slug} href={`/models/${m.model.slug}`}>{m.model.displayName}</Link>, cap(clause)];
  });

  /* ── provider status ── */
  const ps = providerStatusOf(providers, key);
  const interval = providers?.meta.checkIntervalMinutes ?? null;
  const retention = providers?.meta.retentionDays ?? null;
  const historyWord = retention ? `The ${retention}-day history` : 'The full history';
  const statusFacts: [ReactNode, ReactNode][] = [];
  if (ps) {
    statusFacts.push(['Status', <><span className={`lp-pill ${STATE_PILL[ps.status]}`}>{STATE_TEXT[ps.status]}</span>{ps.status === 'unmeasured' ? ' The check could not be made from our side, so it says nothing about the provider.' : ''}</>]);
    const answered: string[] = [];
    if (ps.uptime24h !== null) answered.push(`${pct(ps.uptime24h)} of checks in the last 24 hours`);
    if (ps.uptime7d !== null) answered.push(`${pct(ps.uptime7d)} over the last 7 days`);
    if (answered.length) statusFacts.push(['Answered', answered.join(' · ')]);
    const lat = ps.medianLatencyMs ?? ps.responseTime;
    if (lat !== null && Number.isFinite(lat)) statusFacts.push(['Median response', `${n(Math.round(lat))} ms to one short completion on our own key`]);
    if (ps.lastChecked) statusFacts.push(['Last checked', `${utcStamp(ps.lastChecked)}${interval ? ` · checked every ${interval} minutes` : ''}`]);
  }

  /* ── FAQ: one array feeds the visible questions and the FAQPage structured data ── */
  const faq: WorseFaqItem[] = [
    {
      q: h1,
      a: verdict
        ? `${verdict} The verdict reads the 24-hour boards and the per-suite Page-Hinkley detectors for every ${family} model on the board, re-tested on the same schedule as every other vendor's models: ${CADENCE}. The model-by-model table is at the top of this page.`
        : `Every ${family} model on the board is re-tested on the same tasks, ${CADENCE}, and compared with its own past by a Page-Hinkley (a CUSUM-family test) detector per suite. The model-by-model answer is at the top of this page whenever the boards are answering.`,
    },
    {
      q: `Is ${name} nerfed?`,
      a: `A nerf is a deliberate change that cuts a model's cost or capability. From outside, intent is invisible; behaviour is not. ${verdict ? `${verdict} ` : ''}A sustained fall on fixed tasks is what the per-suite Page-Hinkley detector is built to confirm over days; a single bad answer is not evidence, because model output varies run to run even when nothing has changed. Deliberate or not, a change behind a stable model name shows here as a change.`,
    },
    ...(copy.dumberQ ? [{
      q: copy.dumberQ,
      a: `${verdict ? `${verdict} ` : ''}"Dumber" usually means one of three things: the model behind the API changed, the app around it changed, or a long conversation is wearing it down. The first shows on this page as a decline on the 24-hour boards or a fired drift detector. The app layer is the section on ${copy.toolH2.charAt(0).toLowerCase()}${copy.toolH2.slice(1)}, and long conversations are measured on [context rot](/context-rot).`,
    }] : []),
    {
      q: copy.trackerQ,
      a: `Yes: this page. It tracks every ${family} model on the board through the ${vendor.label} API, at ${vendor.apiHost}: the 24-hour scores and places on the Coding, Reasoning and Tool use boards, a Page-Hinkley detector per suite that confirms a sustained decline over days, the API's availability, and the dated changes in the record${findings.length ? `, ${findings.length} of them for this family so far` : ''}. ${copy.trackerNote ? `${copy.trackerNote} ` : ''}Each model also has its own page with its drift chart, and [the whole board](/is-ai-getting-worse) is tracked the same way.`,
    },
    {
      q: `Why does ${name} seem dumber in long sessions?`,
      a: `Because a long conversation gives the model a different problem: more context to hold, more of it stale, and the facts that matter buried in the middle. Our boards use short, fixed tasks, so they separate a change in the model from a long-session effect. How accuracy falls as the context grows — finding, linking, tracking and counting facts from 8K to 1M tokens, graded exactly — is measured on [context rot](/context-rot).`,
    },
    {
      q: `How often do you test ${name}?`,
      a: `Every ${family} model on the board gets the same tasks on the same schedule as every other vendor's models: ${CADENCE}. ${count > 0 ? `${count} ${family} ${plural} ${count === 1 ? 'is' : 'are'} tracked${since ? `; the longest-tracked has been on the board since ${dayLabel(since)}` : ''}. ` : ''}${OPENNESS} Every weight is on the [methodology page](/methodology).`,
    },
    {
      q: `Can I get an alert when ${name} changes?`,
      a: `Yes. ${FREE_TIER} The watchlist sends ${ALERT_RULE}; paid plans tune the threshold and watch more models. Each ${family} model's page has a watch button, and the [watchlist](/watchlist) holds them together.`,
    },
    {
      q: copy.toolFaqQ,
      a: `No. We test the ${vendor.label} API at ${vendor.apiHost}, on our own account, with fixed tasks: what an application or the Smart Router calls, with nothing of ours in between. ${cap(copy.tool)} adds its own prompt, tools and context on top of the model, which we do not see. A model that holds steady here while ${copy.tool} feels worse points at that layer, or at a session that has grown long; see [context rot](/context-rot) and the [${vendor.label} API status](${vendor.statusPath}).`,
    },
  ];

  /* ── structured data ── */
  const ld = graphLd([
    breadcrumbLd([{ name: 'Home', path: '/' }, HUB_BREADCRUMB, { name, path }]),
    webPageLd({ path, name: h1, description, ...(asOf ? { dateModified: isoDay(asOf) } : {}) }),
    ...(models.length
      ? [itemListLd({ name: `${family} models tracked by AI Stupid Level`, items: models.map((m) => ({ name: m.model.displayName, url: `/models/${m.model.slug}` })) })]
      : []),
    faqLd(faq),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <ReadingPage
        className="rd-worse"
        kicker={`Is your AI getting worse? · ${companyOf(vendor)}`}
        title={h1}
        lead={verdict ?? fallbackLead}
        note={stamp ? `As of ${stamp} · 24-hour boards · per-suite Page-Hinkley detectors` : undefined}
        actions={(
          <CtaRow className="is-stack">
            <WatchCta cta={`worse-${key}-hero-watch`} label={`Watch a ${family} model →`} />
            <div className="seo-cta">
              <a className="lp-btn lp-btn-ghost" href="#scores" data-cta={`worse-${key}-hero-scores`}>Model by model</a>
            </div>
          </CtaRow>
        )}
        aside={(count > 0 || counts.series > 0 || (ps && ps.uptime7d !== null)) ? (
          <dl className="lp-facts">
            {count > 0 && <div><dt>{count}</dt><dd>{family} {plural} on the same tests as every other vendor&apos;s models</dd></div>}
            {counts.series > 0 && <div><dt>{counts.armed} of {counts.series}</dt><dd>per-suite drift detectors armed with no detection</dd></div>}
            {ps && ps.uptime7d !== null && <div><dt>{pct(ps.uptime7d)}</dt><dd>of our probes to {vendor.apiHost} answered in the last 7 days</dd></div>}
          </dl>
        ) : undefined}
        toc={TOC}
        final={(
          <RdFinal
            title={`Know the next time ${name} changes`}
            lead={FREE_TIER}
            actions={(
              <CtaRow>
                <WatchCta cta={`worse-${key}-final-watch`} label={`Watch a ${family} model →`} sub={`${cap(numWord(FREE.watchedModels))} models free · ${ALERT_RULE}`} />
                <RouterCta ghost cta={`worse-${key}-final-router`} label="Route around a model that drifts →" sub={`The Smart Router is drift-aware by default, on your own provider keys · ${n(FREE.routerRequestsPerMonth)} requests a month free`} />
              </CtaRow>
            )}
          />
        )}
      >
        <RdSection id="scores" n={num('scores')} title={`Is ${name} nerfed right now?`}>
          <Verdict>{verdict ?? fallbackLead}</Verdict>
          {stamp && <AsOf>As of {stamp} · 24-hour boards · score, then place among the ranked models; &ldquo;=&rdquo; marks a statistical tie</AsOf>}
          <WorseTable
            models={models}
            caption={`${family} models on the four boards over the last 24 hours, with the state of each model's Page-Hinkley detector per suite and the day it was first tracked.`}
          />
          {modelFacts.length > 0 && <RdFacts rows={modelFacts} />}
          <RdProse>
            <p>
              Places are the leaderboard&apos;s own: walking down a board, a model joins the group above it unless that group&apos;s leader is ahead by more than the
              measurement can resolve, so &ldquo;joint&rdquo; places are normal. A detector is armed once it has {coldDays} days of daily medians on the current test
              version; it fires only on a sustained fall, never on one bad run. Every {family} model has its own page with its history, and all of them are on{' '}
              <Link href={vendor.modelsPath}>{companyOf(vendor)} models</Link>.
            </p>
          </RdProse>
          <LeaderboardCta cta={`worse-${key}-scores-leaderboard`} sub={FREE_TIER} />
        </RdSection>

        <RdSection id="status" n={num('status')} title={`Has ${name} been downgraded, or is it down?`}
          lead="Two different questions, answered by two different instruments.">
          <RdProse>
            <p>
              Down is availability: {interval ? `every ${interval} minutes` : 'on a fixed interval'} we send one short completion to {vendor.apiHost} on our own key and
              record whether it answered, how fast, and whose fault a failure was — the provider&apos;s, our account&apos;s, the probe&apos;s or our server&apos;s.
              Downgraded is quality: the scores and detectors above, from fixed tasks the API did answer. A model can be fully available and quietly worse,
              or briefly unavailable and unchanged.
            </p>
            <p>We measure the API ({vendor.apiHost}), not the consumer app. {vendor.consumerNote}</p>
          </RdProse>
          {statusFacts.length > 0 && <RdFacts rows={statusFacts} />}
          <RdProse>
            <p>
              {historyWord} and every episode are on <Link href={vendor.statusPath}>{vendor.label} API status</Link>; all {numWord(VENDORS.length)} providers are on the{' '}
              <Link href="/status">status hub</Link>. When a provider stops answering, the Smart Router&apos;s fallback order moves traffic to the next model on the board.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="tool" n={num('tool')} title={copy.toolH2}>
          <RdProse>{toolProse(key, vendor)}</RdProse>
        </RdSection>

        <RdSection id="record" n={num('record')} title="What changed in the record"
          lead={`Dated, past-tense changes in this family from the test record, ${FINDINGS_WINDOW}: the same tasks before and after, with the values.`}>
          {findings.length > 0
            ? <FindingsRows findings={findings} showVendor={false} />
            : <RdProse><p>No sustained decline in the record for this family.</p></RdProse>}
          <RdProse>
            <p>
              The whole record, every vendor, is on <Link href={WORSE_HUB_PATH}>Is your AI getting worse?</Link>; the method and its measured false-alarm rate are in{' '}
              <Link href="/research/drift-detector-false-alarm-rate">How often our drift detector is wrong, measured</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="method" n={num('method')} title="How we tell a real change from noise">
          <RdProse>
            <p>{DRIFT_METHOD}</p>
            <p>
              Every score carries a standard error from its own run-to-run repeatability; models whose lead is inside that noise share a place, and a
              composite is labelled with how many suites contributed. A prompt a provider declines is recorded as a refusal with the provider&apos;s stated
              category and that session&apos;s score is withheld, never imputed, so a tightened filter shows as a refusal rate rather than as invented incapability.
            </p>
            <p>
              The detector, its constants and its measured false-alarm rate are on <Link href="/ai-drift-detection">AI drift detection</Link> and in the{' '}
              <Link href="/methodology#drift">methodology</Link>. {OPENNESS}
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="next" n={num('next')} title="What to do">
          <RdProse>
            <p>
              Watch the {family} {plural} you depend on and let the boards do the checking: {ALERT_RULE}. If you build on the API, the Smart Router sends each
              request to the model that scores best for it across every vendor on the board and is drift-aware by default, on your own provider keys.
            </p>
          </RdProse>
          <CtaRow>
            <WatchCta cta={`worse-${key}-next-watch`} label={`Watch a ${family} model →`} sub={`${cap(numWord(FREE.watchedModels))} models free · ${ALERT_RULE}`} />
            <RouterCta ghost cta={`worse-${key}-next-router`} label="Route around a model that drifts →" sub={`The Smart Router routes around a model that drifts · ${n(FREE.routerRequestsPerMonth)} requests a month free · no card`} />
          </CtaRow>
          <RdProse>
            <p>
              The same question for the other families:{' '}
              {siblings.map((k, i) => <span key={k}>{i > 0 && (i === siblings.length - 1 ? ' and ' : ', ')}<Link href={worsePath(k)}>{worseH1(k)}</Link></span>)}.
              Every model on the board, with the whole record, is on <Link href={WORSE_HUB_PATH}>Is your AI getting worse?</Link>; the {family} models&apos; scores,
              prices and head-to-head pages are on <Link href={vendor.modelsPath}>{companyOf(vendor)} models</Link>.
            </p>
          </RdProse>
        </RdSection>

        <RdSection id="faq" n={num('faq')} title={`Questions people ask about ${name}`}>
          <WorseFaq items={faq} />
        </RdSection>
      </ReadingPage>
    </>
  );
}
